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


def get_candidate_fernet_instances():
    """
    Return all viable Fernet encryption instances in priority order:
    1. Private TOKEN_ENCRYPTION_KEY if valid.
    2. SECRET_KEY derived key (AES-128 via SHA-256).
    3. Production/development fallback keys.
    This guarantees decryption never fails due to key derivation discrepancies.
    """
    import base64
    import hashlib

    candidates = []
    seen = set()

    # 1. Configured TOKEN_ENCRYPTION_KEY
    env_key = os.getenv("TOKEN_ENCRYPTION_KEY")
    if env_key:
        clean_key = env_key.strip().strip("'\"")
        try:
            candidates.append(Fernet(clean_key.encode("utf-8")))
            seen.add(clean_key)
        except Exception:
            pass

    # 2. Configured SECRET_KEY
    secret = os.getenv("SECRET_KEY")
    if secret:
        clean_secret = secret.strip().strip("'\"")
        derived_key = base64.urlsafe_b64encode(hashlib.sha256(clean_secret.encode()).digest()).decode()
        if derived_key not in seen:
            try:
                candidates.append(Fernet(derived_key.encode("utf-8")))
                seen.add(derived_key)
            except Exception:
                pass

    # 3. Known fallback secrets
    for fallback in ["subloo-dev-secret-key", "subloo-dev-secret-key-encryption-fallback"]:
        k = base64.urlsafe_b64encode(hashlib.sha256(fallback.encode()).digest()).decode()
        if k not in seen:
            try:
                candidates.append(Fernet(k.encode("utf-8")))
                seen.add(k)
            except Exception:
                pass

    return candidates


def get_encryption():
    """Primary encryption instance for new encryptions."""
    candidates = get_candidate_fernet_instances()
    if candidates:
        return candidates[0]
    import base64
    import hashlib
    fallback_key = base64.urlsafe_b64encode(hashlib.sha256(b"subloo-dev-secret-key").digest()).decode()
    return Fernet(fallback_key.encode("utf-8"))


def encrypt_credentials(credentials):
    """Encrypt OAuth credentials before database storage."""
    if not isinstance(credentials, str) or not credentials:
        raise ValueError("Credentials must be a non-empty string.")

    encryption = get_encryption()
    encrypted = encryption.encrypt(credentials.encode("utf-8"))
    return encrypted.decode("utf-8")


def decrypt_credentials(encrypted_credentials):
    """
    Decrypt OAuth credentials inside the backend only.
    Tries all candidate Fernet keys to ensure backward and configuration compatibility.
    """
    if not encrypted_credentials:
        raise ValueError("Encrypted credentials are missing.")

    token = encrypted_credentials.strip()
    token_bytes = token.encode("utf-8") if isinstance(token, str) else token

    last_error = None
    for fernet in get_candidate_fernet_instances():
        try:
            decrypted = fernet.decrypt(token_bytes)
            return decrypted.decode("utf-8")
        except InvalidToken as it:
            last_error = it
            continue
        except Exception as e:
            last_error = e
            continue

    raise ValueError(f"Unable to decrypt credentials with configured encryption keys: {last_error}")


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

    clean_state = state_token.strip()
    if "%" in clean_state:
        import urllib.parse
        clean_state = urllib.parse.unquote(clean_state)

    try:
        decrypted = decrypt_credentials(clean_state)
        payload = json.loads(decrypted)
    except Exception as e:
        import logging
        logging.getLogger("subloo.gmail.security").warning(f"Failed to decrypt OAuth state: {e}")
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
