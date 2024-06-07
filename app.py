from flask import Flask, render_template, redirect, url_for, request, jsonify, send_from_directory
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

app = Flask(__name__)
toastr = Toastr(app)

# Substitua com suas novas chaves VAPID
VAPID_PUBLIC_KEY = "BO8JMOcEZWU8ycbE-UZRZD0r5Q-lQy28f5DZMUaF_vFV_NDagvj6Xc7OQz5cBj0CpYamkH9q-ab7dfctrglde00"
VAPID_PRIVATE_KEY = "9gjBdaUSxyqp_NEDfTGs8yXjQ20ckk3CLMYzjyy2ju4"
VAPID_CLAIMS = {
    "sub": "mailto:rafael.apfernandes78@gmail.com"
}

subscriptions = []

try:
    redis_webpush = redis.StrictRedis(host='109.199.119.223', port=6379, db=0)
    redis_webpush.ping()
    print("Conexão com o Redis estabelecida com sucesso!")
except redis.ConnectionError as e:
    print(f"Erro ao conectar ao Redis: {e}")


@app.route('/service-worker.js')
def service_worker():
    return send_from_directory('static/js', 'service-worker.js')

@app.route('/save-subscription', methods=['POST'])
def save_subscription():
    subscription = request.get_json()
    if subscription not in subscriptions:
        subscriptions.append(subscription)
    return jsonify({"message": "Inscrição salva com sucesso"}), 201

@app.route('/send-notification', methods=['POST'])
def send_notification():
    notification = request.get_json()
    print(f"Enviando notificação: {notification}")
    subscriptions_to_remove = []
    for subscription in subscriptions:
        try:
            webpush(
                subscription_info=subscription,
                data=json.dumps(notification),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS
            )
            print(f"Notificação enviada para: {subscription['endpoint']}")
        except WebPushException as ex:
            print(f"Erro ao enviar notificação: {ex}")
            if ex.response and ex.response.status_code == 410:
                print(f"Removendo inscrição expirada: {subscription['endpoint']}")
                subscriptions_to_remove.append(subscription)
            elif ex.response and ex.response.status_code == 403:
                print("Erro de credenciais VAPID")
    
    for subscription in subscriptions_to_remove:
        subscriptions.remove(subscription)
    
    return jsonify({"message": "Notificação enviada"}), 200

# Rota para salvar a inscrição
@app.route('/subscribe', methods=['GET', 'POST'])
def subscribe():
    if request.method == "GET":
        return jsonify({'public_key': VAPID_PUBLIC_KEY})
    subscription_info = {
        'endpoint': request.json.get('endpoint'),
        'keys': request.json.get('keys'),
        'expiration_time': request.json.get('expirationTime'),
    }
    webpush_key = str(uuid.uuid4())
    redis_webpush.set('webpush:subscription:info:{}'.format(webpush_key), json.dumps(subscription_info))
    redis_webpush.sadd('webpush:subscriptions', webpush_key)
    return jsonify({'id': webpush_key})

# Rota para enviar notificações
@app.route('/notify', methods=['POST'])
def notify():
    count = 0
    sub_webpush_key = 'webpush:subscription:info:{}'
    message_data = {
        'title': request.json.get('title'),
        'body': request.json.get('body'),
        'url': request.json.get('url'),
    }
    for key in redis_webpush.smembers('webpush:subscriptions'):
        try:
            sub_key = sub_webpush_key.format(key.decode())
            sub_val = redis_webpush.get(sub_key)
            if sub_val:
                webpush(
                    subscription_info=json.loads(sub_val),
                    data=json.dumps(message_data),
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims=VAPID_CLAIMS
                )
                count += 1
                print(f'Notificação enviada para: {sub_key}')
        except WebPushException as e:
            print(f'Erro ao enviar notificação para {sub_key}: {e}')
    print(f'Total de notificações enviadas: {count}')
    return f"{count} notification(s) sent"

# Rota para cancelar a inscrição
@app.route('/unsubscribe', methods=['POST'])
def unsubscribe():
    webpush_key = request.json.get('client_uuid')
    if not webpush_key:
        return jsonify({'message': 'client_uuid is required'}), 400
    redis_webpush.delete('webpush:subscription:info:{}'.format(webpush_key))
    redis_webpush.srem('webpush:subscriptions', webpush_key)
    return jsonify({'message': 'unsubscribed'})




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

def create_app(config):
    app = Flask(__name__)
    app.config.from_object(config)
    toastr.init_app(app)
    return app

@app.route('/')
def root():
    return redirect(url_for('index', path='eventos/', vapid_public_key=VAPID_PUBLIC_KEY))

@app.route('/<path:path>/', methods=['GET'])
def index(path):
    path = path.rstrip('/') + '/'
    folders, files, video_file = list_items(path)

    if path.startswith('eventos/'):
        last_folder_name = os.path.basename(os.path.normpath(path))
        return render_template('event_details.html', folders=folders, files=files, video=video_file, event_folder=last_folder_name, current_path=path, vapid_public_key=VAPID_PUBLIC_KEY)
    
    print(path)
    return render_template('index.html', folders=folders, files=files, current_path=path)

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
        print(f"Erro ao carregar o cache: {e}")
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
    except requests.RequestException:
        return False

def get_cover_image(folder_prefix):
    cache = load_cache()
    if folder_prefix in cache:
        cached_data = cache[folder_prefix]
        if 'url' in cached_data and 'timestamp' in cached_data and not is_url_expired(cached_data['timestamp']):
            if validate_url(cached_data['url']):
                return cached_data['url']
    
    response = s3.list_objects_v2(Bucket=bucket_name, Prefix=folder_prefix)
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
    response = s3.list_objects_v2(Bucket=bucket_name, Prefix='eventos/', Delimiter='/')
    events = [os.path.basename(os.path.normpath(event['Prefix'])) for event in response.get('CommonPrefixes', [])]
    return events

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
