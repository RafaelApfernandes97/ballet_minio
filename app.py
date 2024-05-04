from flask import Flask, render_template, redirect, url_for, request, jsonify
import boto3
from botocore.client import Config
import json
import os
import re
import time

app = Flask(__name__)

# Carregar credenciais do arquivo JSON
with open('minio-credentials.json', 'r') as file:
    credentials = json.load(file)

# Configuração do cliente MinIO
s3 = boto3.client('s3',
                  endpoint_url='https://site-ballet-minio.mj6dzq.easypanel.host',
                  aws_access_key_id=credentials['aws_access_key_id'],
                  aws_secret_access_key=credentials['aws_secret_access_key'],
                  config=Config(signature_version='s3v4'),
                  region_name='us-east-1')

bucket_name = 'balletphotos'
cache_file = 'cover_images_cache.json'

@app.route('/')
def root():
    # Redireciona para a pasta 'eventos/'
    return redirect(url_for('index', path='eventos/'))

@app.route('/<path:path>/', methods=['GET'])
def index(path):
    # Garante que o caminho termina com '/'
    path = path.rstrip('/') + '/'
    folders, files = list_items(path)

    # Se estiver dentro da pasta 'eventos', renderize 'event_details.html'
    if path.startswith('eventos/'):
        last_folder_name = os.path.basename(os.path.normpath(path))
        return render_template('event_details.html', folders=folders, files=files, event_folder=last_folder_name, current_path=path)
    
    print(path)

    # Caso contrário, continue renderizando 'index.html'
    return render_template('index.html', folders=folders, files=files, current_path=path)


def load_cache():
    try:
        with open(cache_file, 'r') as file:
            return json.load(file)
    except FileNotFoundError:
        return {}

def save_cache(cache):
    with open(cache_file, 'w') as file:
        json.dump(cache, file)

def is_url_expired(timestamp, max_age=604800):
    return (time.time() - timestamp) > max_age

def regenerate_url_and_update_cache(folder_prefix, key):
    """Gera uma nova URL pré-assinada e atualiza o cache."""
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
        else:
            # O código aqui deve lidar com a situação de dados incompletos ou expirados
            # Isso pode envolver regenerar a URL e atualizar o cache
            # Encontra a chave do objeto para regenerar a URL
            response = s3.list_objects_v2(Bucket=bucket_name, Prefix=folder_prefix)
            for obj in response.get('Contents', []):
                if obj['Key'].lower().endswith(('.png', '.webp', '.jpg', '.jpeg', '.gif')):
                    return regenerate_url_and_update_cache(folder_prefix, obj['Key'])

    # Se a URL não estiver no cache ou precisar ser regenerada mas nenhum arquivo corresponder, gera nova
    response = s3.list_objects_v2(Bucket=bucket_name, Prefix=folder_prefix)
    for obj in response.get('Contents', []):
        if obj['Key'].lower().endswith(('.png', '.webp', '.jpg', '.jpeg', '.gif')):
            return regenerate_url_and_update_cache(folder_prefix, obj['Key'])

    # Retorna uma imagem padrão se nenhuma imagem for encontrada
    default_image = '/static/img/sem_capa.jpg'
    cache[folder_prefix] = {'url': default_image, 'timestamp': time.time()}
    save_cache(cache)
    return default_image



# Função auxiliar para extrair o número da pasta para ordenação
def extract_number(s):
    # Encontra todos os grupos de dígitos no nome
    matches = re.findall(r'\d+', s)
    # Retorna o maior número encontrado no nome para usar na ordenação
    return max(map(int, matches)) if matches else 0

def list_items(prefix=''):
    response = s3.list_objects_v2(Bucket=bucket_name, Prefix=prefix, Delimiter='/')
    
    folders = []
    for folder in response.get('CommonPrefixes', []):
        folder_path = folder['Prefix']
        folder_name = os.path.basename(os.path.normpath(folder_path))
        cover_image_url = get_cover_image(folder_path)
        
        folders.append({
            'name': folder_name,
            'cover_image_url': cover_image_url
        })
    
    # Ordena as pastas baseado no número extraído do nome
    folders.sort(key=lambda x: extract_number(x['name']))

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
    
    # Ordena os arquivos de imagem baseado no número extraído do nome
    files.sort(key=lambda x: extract_number(x['name']) if x['is_image'] else float('inf'))

    return folders, files










selected_images = set()  # Using a set to avoid duplicates

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






if __name__ == '__main__':
    app.run(debug=True)
