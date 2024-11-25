from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Compra(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    cpf = db.Column(db.String(11), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    telefone = db.Column(db.String(15), nullable=False)  # Novo campo para o telefone
    cep = db.Column(db.String(8), nullable=False)
    rua = db.Column(db.String(100), nullable=False)
    numero = db.Column(db.String(10), nullable=False)
    bairro = db.Column(db.String(50), nullable=False)
    cidade = db.Column(db.String(50), nullable=False)
    estado = db.Column(db.String(2), nullable=False)
    imagens_selecionadas = db.Column(db.Text, nullable=False)
    total = db.Column(db.Float, nullable=False)
    data_compra = db.Column(db.DateTime, default=datetime.utcnow)
    nome_evento = db.Column(db.String(100), nullable=False)  # Novo campo para o nome do evento
    status = db.Column(db.String(20), nullable=False, default='Pendente')  # Novo campo para status

def init_db(app):
    db.init_app(app)
    with app.app_context():
        db.create_all()
