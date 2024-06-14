from flask import Flask, render_template, redirect, url_for, request, jsonify
import boto3
from botocore.client import Config
import json
import os
import time
from natsort import natsorted
import requests
from flask_toastr import Toastr
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from db import db, init_db, Compra


app = Flask(__name__)
toastr = Toastr(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuração do banco de dados
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///compras.db'  # ou o URI do seu banco de dados
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Inicializa o banco de dados
init_db(app)

# Carregar credenciais do arquivo JSON
try:
    with open('minio-credentials.json', 'r') as file:
        credentials = json.load(file)
except FileNotFoundError:
    logger.error("Arquivo de credenciais 'minio-credentials.json' não encontrado.")
    raise
except json.JSONDecodeError:
    logger.error("Erro ao decodificar 'minio-credentials.json'. Verifique se o arquivo está no formato JSON correto.")
    raise

# Configuração do cliente MinIO
s3 = boto3.client(
    's3',
    endpoint_url='https://site-ballet-minio.mj6dzq.easypanel.host',
    aws_access_key_id=credentials['aws_access_key_id'],
    aws_secret_access_key=credentials['aws_secret_access_key'],
    config=Config(signature_version='s3v4'),
    region_name='us-east-1'
)

bucket_name = 'balletphotos'
cache_file = 'cover_images_cache.json'

@app.route('/')
def root():
    return redirect(url_for('index', path='eventos/'))

@app.route('/<path:path>/', methods=['GET'])
def index(path):
    path = path.rstrip('/') + '/'
    try:
        folders, files = list_items(path)
    except Exception as e:
        logger.error(f"Erro ao listar itens para o caminho {path}: {e}")
        return render_template('error.html', message=str(e)), 500

    if path.startswith('eventos/'):
        last_folder_name = os.path.basename(os.path.normpath(path))
        return render_template('event_details.html', folders=folders, files=files, event_folder=last_folder_name, current_path=path)

    return render_template('index.html', folders=folders, files=files, current_path=path)

def list_items(prefix=''):
    try:
        response = s3.list_objects_v2(Bucket=bucket_name, Prefix=prefix, Delimiter='/')
    except Exception as e:
        logger.error(f"Erro ao listar objetos do bucket {bucket_name} com prefixo {prefix}: {e}")
        raise

    folders = []
    for folder in response.get('CommonPrefixes', []):
        folder_path = folder['Prefix']
        folder_name = os.path.basename(os.path.normpath(folder_path))
        cover_image_url = get_cover_image(folder_path)
        folders.append({'name': folder_name, 'cover_image_url': cover_image_url})
    
    folders = natsorted(folders, key=lambda x: x['name'])

    files = []
    for obj in response.get('Contents', []):
        if not obj['Key'].endswith('/'):
            file_url = s3.generate_presigned_url('get_object', Params={'Bucket': bucket_name, 'Key': obj['Key']}, ExpiresIn=3600)
            file_info = {
                'name': os.path.basename(obj['Key']),
                'is_image': obj['Key'].lower().endswith(('.png', '.webp', '.jpg', '.jpeg', '.gif')),
                'url': file_url,
            }
            files.append(file_info)
    
    files = natsorted(files, key=lambda x: x['name'] if x['is_image'] else float('inf'))
    return folders, files

def load_cache():
    try:
        with open(cache_file, 'r') as file:
            return json.load(file)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logger.error(f"Erro ao carregar o cache: {e}")
        return {}

def save_cache(cache):
    with open(cache_file, 'w') as file:
        json.dump(cache, file, indent=4)

def is_url_expired(timestamp, max_age=604800):
    return (time.time() - timestamp) > max_age

def regenerate_url_and_update_cache(folder_prefix, key):
    url = s3.generate_presigned_url('get_object', Params={'Bucket': bucket_name, 'Key': key}, ExpiresIn=604800)
    cache = load_cache()
    cache[folder_prefix] = {'url': url, 'timestamp': time.time()}
    save_cache(cache)
    return url

def get_cover_image(folder_prefix):
    cache = load_cache()
    if folder_prefix in cache:
        cached_data = cache[folder_prefix]
        if 'url' in cached_data and 'timestamp' in cached_data and not is_url_expired(cached_data['timestamp']):
            return cached_data['url']
    
    response = s3.list_objects_v2(Bucket=bucket_name, Prefix=folder_prefix)
    for obj in response.get('Contents', []):
        if obj['Key'].lower().endswith(('.png', '.webp', '.jpg', '.jpeg', '.gif')):
            return regenerate_url_and_update_cache(folder_prefix, obj['Key'])

    default_image = '/static/img/sem_capa.jpg'
    cache[folder_prefix] = {'url': default_image, 'timestamp': time.time()}
    save_cache(cache)
    return default_image

def clear_cache_and_generate_new_urls():
    response = s3.list_objects_v2(Bucket=bucket_name, Prefix='eventos/', Delimiter='/')
    for folder in response.get('CommonPrefixes', []):
        folder_path = folder['Prefix']
        response_inner = s3.list_objects_v2(Bucket=bucket_name, Prefix=folder_path)
        for obj in response_inner.get('Contents', []):
            if obj['Key'].lower().endswith(('.png', '.webp', '.jpg', '.jpeg', '.gif')):
                regenerate_url_and_update_cache(folder_path, obj['Key'])
                break  # Assuming one cover image per folder

selected_images = set()

@app.route('/save-selection', methods=['POST'])
def save_selection():
    data = request.get_json()
    selected_images.add(data['imageName'])
    with open('selected_images.json', 'w') as f:
        json.dump(list(selected_images), f)
    return jsonify({"status": "saved", "imageName": data['imageName']})

@app.route('/remove-selection', methods=['POST'])
def remove_selection():
    data = request.get_json()
    selected_images.discard(data['imageName'])
    with open('selected_images.json', 'w') as f:
        json.dump(list(selected_images), f)
    return jsonify({"status": "removed", "imageName": data['imageName']})

event_value_config = {}

@app.route('/config-event', methods=['GET', 'POST'])
def config_event():
    if request.method == 'POST':
        event_name = request.form.get('event_name')
        value_type = request.form.get('value_type')
        event_value_config[event_name] = value_type
        with open('event_value_config.json', 'w') as f:
            json.dump(event_value_config, f)
        return redirect(url_for('config_event'))
    
    events = get_event_list()
    return render_template('config_event.html', events=events, config=event_value_config)

def get_event_list():
    try:
        response = s3.list_objects_v2(Bucket=bucket_name, Prefix='eventos/', Delimiter='/')
        events = [os.path.basename(os.path.normpath(event['Prefix'])) for event in response.get('CommonPrefixes', [])]
        return events
    except Exception as e:
        logger.error(f"Erro ao listar eventos: {e}")
        return []

def load_event_value_config():
    global event_value_config
    try:
        with open('event_value_config.json', 'r') as f:
            event_value_config = json.load(f)
    except FileNotFoundError:
        event_value_config = {}

@app.route('/load-config')
def load_config():
    global event_value_config
    return jsonify(event_value_config)

@app.route('/finalizar-compra', methods=['POST'])
def finalizar_compra():
    data = request.get_json()
    
    nova_compra = Compra(
        nome=data['nome'],
        cpf=data['cpf'],
        email=data['email'],
        cep=data['cep'],
        rua=data['rua'],
        numero=data['numero'],
        bairro=data['bairro'],
        cidade=data['cidade'],
        estado=data['estado'],
        imagens_selecionadas=', '.join(data['imagens_selecionadas']),
        total=data['total']
    )
    
    try:
        db.session.add(nova_compra)
        db.session.commit()
        return jsonify({"status": "success", "message": "Compra finalizada com sucesso!"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    
    
    
    
    
    
    
    
    
@app.route('/dashboard', methods=['GET', 'POST'])
def dashboard():
    try:
        if request.method == 'POST':
            nome = request.form.get('nome')
            cpf = request.form.get('cpf')
            if cpf:
                cpf = cpf.replace('.', '').replace('-', '')
            query = Compra.query
            if nome:
                query = query.filter(Compra.nome.like(f"%{nome}%"))
            if cpf:
                query = query.filter(db.func.replace(db.func.replace(Compra.cpf, '.', ''), '-', '').like(f"%{cpf}%"))
            compras = query.all()
        else:
            compras = Compra.query.all()
        return render_template('dashboard.html', compras=compras)
    except Exception as e:
        logger.error(f"Erro ao carregar o dashboard: {e}")
        return render_template('error.html', message=str(e)), 500












if __name__ == '__main__':
    load_event_value_config()

    # Agendar a limpeza do cache e a geração de novas URLs diariamente à meia-noite
    scheduler = BackgroundScheduler()
    scheduler.add_job(clear_cache_and_generate_new_urls, 'cron', hour=0, minute=0)
    scheduler.start()

    try:
        app.run(debug=True)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
