from flask import Flask, render_template, redirect, url_for, request, jsonify
import boto3
from botocore.client import Config
import json
import os
import re
import time
from natsort import natsorted
import requests
from flask_toastr import Toastr
from pywebpush import webpush, WebPushException
import redis
import uuid
import logging

app = Flask(__name__)
toastr = Toastr(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
        folders, files, video_file = list_items(path)
    except Exception as e:
        logger.error(f"Erro ao listar itens para o caminho {path}: {e}")
        return render_template('error.html', message=str(e)), 500

    if path.startswith('eventos/'):
        last_folder_name = os.path.basename(os.path.normpath(path))
        return render_template('event_details.html', folders=folders, files=files, video=video_file, event_folder=last_folder_name, current_path=path)

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
    video_file = None
    for obj in response.get('Contents', []):
        if not obj['Key'].endswith('/'):
            file_url = s3.generate_presigned_url('get_object', Params={'Bucket': bucket_name, 'Key': obj['Key']}, ExpiresIn=3600)
            file_info = {
                'name': os.path.basename(obj['Key']),
                'is_image': obj['Key'].lower().endswith(('.png', '.webp', '.jpg', '.jpeg', '.gif')),
                'is_video': obj['Key'].lower().endswith('.mp4'),
                'url': file_url,
            }
            if file_info['is_video']:
                video_file = file_info
            else:
                files.append(file_info)
    
    files = natsorted(files, key=lambda x: x['name'] if x['is_image'] else float('inf'))
    return folders, files, video_file

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

def validate_url(url):
    try:
        response = requests.head(url, timeout=5)
        return response.status_code == 200
    except requests.RequestException as e:
        logger.error(f"Erro ao validar a URL {url}: {e}")
        return False

def get_cover_image(folder_prefix):
    cache = load_cache()
    if folder_prefix in cache:
        cached_data = cache[folder_prefix]
        if 'url' in cached_data and 'timestamp' in cached_data and not is_url_expired(cached_data['timestamp']):
            if validate_url(cached_data['url']):
                return cached_data['url']
    
    try:
        response = s3.list_objects_v2(Bucket=bucket_name, Prefix=folder_prefix)
    except Exception as e:
        logger.error(f"Erro ao listar objetos do bucket {bucket_name} com prefixo {folder_prefix}: {e}")
        return '/static/img/sem_capa.jpg'

    for obj in response.get('Contents', []):
        if obj['Key'].lower().endswith(('.png', '.webp', '.jpg', '.jpeg', '.gif')):
            return regenerate_url_and_update_cache(folder_prefix, obj['Key'])

    default_image = '/static/img/sem_capa.jpg'
    cache[folder_prefix] = {'url': default_image, 'timestamp': time.time()}
    save_cache(cache)
    return default_image

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

if __name__ == '__main__':
    load_event_value_config()
    app.run(debug=True)
