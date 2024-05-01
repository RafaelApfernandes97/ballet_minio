from flask import Flask, render_template, redirect, url_for, request, jsonify
import boto3
from botocore.client import Config
import json
import os
import re
import humanize

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

def load_cache():
    try:
        with open(cache_file, 'r') as file:
            return json.load(file)
    except FileNotFoundError:
        return {}

def save_cache(cache):
    with open(cache_file, 'w') as file:
        json.dump(cache, file)

def get_cover_image(folder_prefix):
    cache = load_cache()
    if folder_prefix in cache:
        return cache[folder_prefix]
    
    # Lista todos os objetos na pasta até encontrar uma imagem
    response = s3.list_objects_v2(Bucket=bucket_name, Prefix=folder_prefix)
    for obj in response.get('Contents', []):
        if obj['Key'].lower().endswith(('.png', '.webp', '.jpg', '.jpeg', '.gif')):
            url = s3.generate_presigned_url('get_object', Params={'Bucket': bucket_name, 'Key': obj['Key']}, ExpiresIn=3600)
            cache[folder_prefix] = url
            save_cache(cache)
            return url

    # Retorna uma imagem padrão se nenhuma imagem for encontrada
    default_image = '/static/img/sem_capa.jpg'
    cache[folder_prefix] = default_image
    save_cache(cache)
    return default_image

# Função auxiliar para extrair o número da pasta para ordenação
def extract_number(s):
    match = re.search(r'\d+$', s)
    return int(match.group()) if match else 0

def list_items(prefix=''):
    response = s3.list_objects_v2(Bucket=bucket_name, Prefix=prefix, Delimiter='/')
    
    folders = []
    for folder in response.get('CommonPrefixes', []):
        folder_path = folder['Prefix']
        folder_name = os.path.basename(os.path.normpath(folder_path))
        
        # Busca ou recupera a imagem de capa do cache
        cover_image_url = get_cover_image(folder_path)
        
        folders.append({
            'name': folder_name,
            'cover_image_url': cover_image_url
            
        })
    
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
    
    return folders, files

def find_cover_image(folder_prefix):
    # Lista todos os objetos dentro da pasta até encontrar uma imagem
    response = s3.list_objects_v2(Bucket=bucket_name, Prefix=folder_prefix)
    for obj in response.get('Contents', []):
        if obj['Key'].lower().endswith(('.png', '.webp', '.jpg', '.jpeg', '.gif')):
            return s3.generate_presigned_url('get_object', Params={'Bucket': bucket_name, 'Key': obj['Key']}, ExpiresIn=3600)
    return '/static/img/sem_capa.jpg' 

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
