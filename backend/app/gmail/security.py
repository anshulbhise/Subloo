
import os
from cryptography.fernet import Fernet, InvalidToken


def get_encryption():
    """Load the private encryption key from environment variables or derive a fallback key from SECRET_KEY."""
    import base64
    import hashlib

    key = os.getenv("TOKEN_ENCRYPTION_KEY")

    if not key:
        secret = os.getenv("SECRET_KEY", "subloo-dev-secret-key-encryption-fallback")
        key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest()).decode()

    try:
        return Fernet(key.encode("utf-8"))
    except (ValueError, TypeError):
        raise RuntimeError(
            "TOKEN_ENCRYPTION_KEY is invalid."
        )


def encrypt_credentials(credentials):
    """Encrypt OAuth credentials before database storage."""

    if not isinstance(credentials, str) or not credentials:
        raise ValueError("Credentials must be a non-empty string.")

    encryption = get_encryption()

    encrypted = encryption.encrypt(
        credentials.encode("utf-8")
    )

    return encrypted.decode("utf-8")


def decrypt_credentials(encrypted_credentials):
    """Decrypt OAuth credentials inside the backend only."""

    if not encrypted_credentials:
        raise ValueError("Encrypted credentials are missing.")

    encryption = get_encryption()

    try:
        decrypted = encryption.decrypt(
            encrypted_credentials.encode("utf-8")
        )

        return decrypted.decode("utf-8")

    except InvalidToken:
        raise ValueError(
            "Unable to decrypt credentials. Check the encryption key."
        )
