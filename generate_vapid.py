import base64
from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid

def generate_vapid_keys():
    vapid = Vapid()
    vapid.generate_keys()
    
    # Obter a chave privada em formato PEM e codificar em base64
    private_key_der = vapid.private_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    private_key_b64 = base64.urlsafe_b64encode(private_key_der).decode('utf-8')

    # Obter a chave pública em formato PEM e codificar em base64
    public_key_der = vapid.public_key.public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    public_key_b64 = base64.urlsafe_b64encode(public_key_der).decode('utf-8')

    print("Chave Privada VAPID (base64):")
    print(private_key_b64)
    print("\nChave Pública VAPID (base64):")
    print(public_key_b64)

if __name__ == "__main__":
    generate_vapid_keys()
