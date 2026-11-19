import json
import os
from datetime import datetime, timedelta, timezone
from cryptography.fernet import Fernet, InvalidToken


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_encryption():
    """
    Load the private encryption key from environment variables or derive a fallback key from SECRET_KEY.
    Ensures safe handling of whitespace, quotes, and invalid strings.
    """
    import base64
    import hashlib

    key = os.getenv("TOKEN_ENCRYPTION_KEY")
    if key:
        key = key.strip().strip("'\"")
        try:
            return Fernet(key.encode("utf-8"))
        except (ValueError, TypeError):
            pass

    secret = os.getenv("SECRET_KEY", "subloo-dev-secret-key-encryption-fallback")
    fallback_key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest()).decode()
    return Fernet(fallback_key.encode("utf-8"))


def encrypt_credentials(credentials):
    """Encrypt OAuth credentials before database storage."""
    if not isinstance(credentials, str) or not credentials:
        raise ValueError("Credentials must be a non-empty string.")

    encryption = get_encryption()
    encrypted = encryption.encrypt(credentials.encode("utf-8"))
    return encrypted.decode("utf-8")


def decrypt_credentials(encrypted_credentials):
    """Decrypt OAuth credentials inside the backend only."""
    if not encrypted_credentials:
        raise ValueError("Encrypted credentials are missing.")

    encryption = get_encryption()
    try:
        decrypted = encryption.decrypt(encrypted_credentials.encode("utf-8"))
        return decrypted.decode("utf-8")
    except InvalidToken:
        raise ValueError("Unable to decrypt credentials. Check the encryption key.")


def refresh_google_access_token(conn):
    """
    Check if the access token in conn is expired or expiring within 5 minutes.
    If expired and a refresh_token is present, exchange with Google for a fresh access_token.
    Updates conn with the new access token and token expiry.
    Returns valid access_token string or None.
    """
    if not conn or not conn.encrypted_credentials:
        return None

    try:
        creds_json = decrypt_credentials(conn.encrypted_credentials)
        creds = json.loads(creds_json)
    except Exception:
        return None

    access_token = creds.get("access_token")
    refresh_token = creds.get("refresh_token")

    # If token_expiry is in the future (> 5 min), current access_token is valid
    if conn.token_expiry and conn.token_expiry > (utc_now() + timedelta(minutes=5)):
        return access_token

    # If expired and we have a refresh_token, perform refresh
    if refresh_token:
        client_id = os.getenv("GOOGLE_CLIENT_ID")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        if client_id and client_secret:
            try:
                import requests
                resp = requests.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "refresh_token": refresh_token,
                        "grant_type": "refresh_token",
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    timeout=10
                )
                if resp.status_code == 200:
                    data = resp.json()
                    new_access_token = data.get("access_token")
                    expires_in = data.get("expires_in", 3600)
                    if new_access_token:
                        creds["access_token"] = new_access_token
                        creds["expires_in"] = expires_in
                        conn.encrypted_credentials = encrypt_credentials(json.dumps(creds))
                        conn.token_expiry = utc_now() + timedelta(seconds=int(expires_in))
                        from app.database.extensions import db
                        db.session.commit()
                        return new_access_token
            except Exception:
                pass

    return access_token
