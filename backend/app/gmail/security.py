import json
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from cryptography.fernet import Fernet, InvalidToken

_used_nonces = {}  # nonce -> timestamp


def purge_expired_nonces():
    now = time.time()
    cutoff = now - 900  # 15 minutes
    expired = [n for n, ts in _used_nonces.items() if ts < cutoff]
    for n in expired:
        _used_nonces.pop(n, None)


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


def generate_oauth_state(user_id, frontend_url=None):
    """
    Generate a cryptographically tamper-proof OAuth state token.
    Encodes user_id, timestamp, frontend_url, and a random nonce.
    Encrypted with Fernet (AES-128-CBC + HMAC-SHA256).
    """
    payload = {
        "uid": str(user_id),
        "ts": time.time(),
        "origin": (frontend_url or "").strip().rstrip("/"),
        "nonce": secrets.token_hex(16),
    }
    return encrypt_credentials(json.dumps(payload))


def verify_oauth_state(state_token, max_age_seconds=600):
    """
    Verify and decode a tamper-proof OAuth state token.
    Ensures cryptographic integrity, age limit, and prevents replay attacks.
    Returns (user_id, frontend_url) if valid, or (None, None) if invalid/expired/replayed.
    """
    if not state_token or not isinstance(state_token, str):
        return None, None

    try:
        decrypted = decrypt_credentials(state_token)
        payload = json.loads(decrypted)
    except Exception:
        return None, None

    user_id = payload.get("uid")
    created_at = payload.get("ts")
    origin = payload.get("origin")
    nonce = payload.get("nonce")

    if not user_id or not created_at or not nonce:
        return None, None

    # Enforce expiry window
    now = time.time()
    if (now - float(created_at)) > max_age_seconds:
        return None, None

    # Enforce single-use (replay prevention)
    purge_expired_nonces()
    if nonce in _used_nonces:
        return None, None
    _used_nonces[nonce] = now

    return user_id, (origin or None)


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
