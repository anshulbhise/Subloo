import json
import os
import re
import secrets
import time
import urllib.parse
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import requests
from flask import Blueprint, current_app, jsonify, redirect, request, session

from app.common.auth import get_current_user_id, login_required, trusted_origin
from app.database.extensions import db
from app.gmail.models import GmailConnection, GmailDetectedSubscription
from app.gmail.security import decrypt_credentials, encrypt_credentials, refresh_google_access_token
from app.subscriptions.models import Subscription, SubscriptionCategory
from app.preprocessing.service import normalize_amount, normalize_text


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_frontend_url():
    """Resolve the base URL of the client frontend for OAuth redirection."""
    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        u = frontend_url.split(",")[0].strip().rstrip("/")
        if u:
            return u
    if os.getenv("RENDER"):
        return "https://subloo.onrender.com"
    return "http://localhost:5173"


gmail_bp = Blueprint(
    "gmail",
    __name__,
    url_prefix="/api/gmail"
)

# Standard subscription receipt detection patterns
COMMON_PATTERNS = [
    {
        "provider": "Netflix",
        "keywords": ["netflix", "your membership has renewed", "netflix subscription"],
        "default_amount": 649.00,
        "currency": "INR",
        "interval": "monthly",
    },
    {
        "provider": "Spotify",
        "keywords": ["spotify", "spotify premium", "your receipt from spotify"],
        "default_amount": 119.00,
        "currency": "INR",
        "interval": "monthly",
    },
    {
        "provider": "OpenAI (ChatGPT)",
        "keywords": ["openai", "chatgpt plus", "openai invoice"],
        "default_amount": 1999.00,
        "currency": "INR",
        "interval": "monthly",
    },
    {
        "provider": "GitHub Copilot",
        "keywords": ["github copilot", "github receipt", "github invoice"],
        "default_amount": 830.00,
        "currency": "INR",
        "interval": "monthly",
    },
    {
        "provider": "Amazon Prime",
        "keywords": ["amazon prime", "prime membership renewed"],
        "default_amount": 1499.00,
        "currency": "INR",
        "interval": "yearly",
    },
    {
        "provider": "Google Workspace / One",
        "keywords": ["google storage", "google one", "google workspace"],
        "default_amount": 130.00,
        "currency": "INR",
        "interval": "monthly",
    },
]


# --------------------------------------------------
# 1. GMAIL OAUTH STATUS
# --------------------------------------------------
@gmail_bp.route("/status", methods=["GET"])
@login_required
def get_gmail_status():
    user_id = get_current_user_id()

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    oauth_configured = bool(client_id and client_secret)

    conn = GmailConnection.query.filter_by(user_id=user_id).first()

    pending_count = GmailDetectedSubscription.query.filter_by(
        user_id=user_id,
        status="pending"
    ).count()

    return jsonify({
        "status": "success",
        "oauth_configured": oauth_configured,
        "is_connected": bool(conn and conn.connection_status == "connected"),
        "gmail_address": conn.gmail_address if conn else None,
        "last_synced_at": conn.last_synced_at.isoformat() if conn and conn.last_synced_at else None,
        "pending_suggestions_count": pending_count,
        "setup_required": not oauth_configured,
        "documentation": (
            "To activate Google OAuth, configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, "
            "and GOOGLE_REDIRECT_URI in your environment variables." if not oauth_configured else None
        )
    }), 200


# --------------------------------------------------
# 2. GENERATE OAUTH AUTHORIZATION URL WITH CSRF STATE
# --------------------------------------------------
@gmail_bp.route("/auth-url", methods=["GET"])
@login_required
def get_auth_url():
    user_id = get_current_user_id()
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    redirect_uri = os.getenv(
        "GOOGLE_REDIRECT_URI",
        "https://subloo-backend.onrender.com/api/gmail/oauth/callback"
    )

    if not client_id:
        return jsonify({
            "status": "unconfigured",
            "message": "Google OAuth is not yet configured with client credentials.",
            "auth_url": None,
            "instructions": "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and TOKEN_ENCRYPTION_KEY in your Render environment variables."
        }), 200

    # Cryptographically secure CSRF state token bound to user session
    state = secrets.token_urlsafe(32)
    session["gmail_oauth_state"] = state
    session["gmail_oauth_state_time"] = time.time()
    session["gmail_oauth_user_id"] = user_id
    session.permanent = True
    session.modified = True

    scopes = "https://www.googleapis.com/auth/gmail.readonly email profile"
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scopes,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    return jsonify({
        "status": "success",
        "auth_url": url,
        "state": state,
    }), 200


# --------------------------------------------------
# 3. OAUTH 2.0 CALLBACK HANDLER
# --------------------------------------------------
@gmail_bp.route("/oauth/callback", methods=["GET"])
def oauth_callback():
    """
    Handle Google OAuth 2.0 authorization code redirect.
    Validates CSRF state token, exchanges code for tokens with Google,
    retrieves connected user identity, encrypts credentials,
    and updates GmailConnection.
    """
    frontend_url = get_frontend_url()

    # 1. Handle error returned by Google (e.g. user cancelled or denied consent)
    google_error = request.args.get("error")
    if google_error:
        error_desc = request.args.get("error_description") or google_error
        # Purge any stored state tokens
        session.pop("gmail_oauth_state", None)
        session.pop("gmail_oauth_state_time", None)
        session.pop("gmail_oauth_user_id", None)
        return redirect(
            f"{frontend_url}/?tab=gmail&status=error&message={urllib.parse.quote('Google authorization was cancelled or denied: ' + error_desc)}"
        )

    # 2. Extract code and state
    code = request.args.get("code")
    received_state = request.args.get("state")

    if not code:
        return redirect(
            f"{frontend_url}/?tab=gmail&status=error&message={urllib.parse.quote('Missing authorization code from Google.')}"
        )

    # 3. Validate state to prevent CSRF and account-linking attacks
    saved_state = session.pop("gmail_oauth_state", None)
    saved_time = session.pop("gmail_oauth_state_time", None)
    saved_user_id = session.pop("gmail_oauth_user_id", None)

    if not received_state or not saved_state or received_state != saved_state:
        return redirect(
            f"{frontend_url}/?tab=gmail&status=error&message={urllib.parse.quote('Invalid or missing OAuth security state token.')}"
        )

    # Validate state expiry (10 minutes)
    if saved_time and (time.time() - float(saved_time)) > 600:
        return redirect(
            f"{frontend_url}/?tab=gmail&status=error&message={urllib.parse.quote('OAuth session expired. Please initiate connection again.')}"
        )

    # Resolve target user id strictly from verified session
    current_user_id = session.get("user_id")
    target_user_id = current_user_id or saved_user_id
    if not target_user_id:
        return redirect(
            f"{frontend_url}/?tab=gmail&status=error&message={urllib.parse.quote('Authentication session not found. Please log in before connecting Gmail.')}"
        )

    # 4. Exchange authorization code with Google token endpoint
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv(
        "GOOGLE_REDIRECT_URI",
        "https://subloo-backend.onrender.com/api/gmail/oauth/callback"
    )

    if not client_id or not client_secret:
        return redirect(
            f"{frontend_url}/?tab=gmail&status=error&message={urllib.parse.quote('Server Google OAuth credentials are not configured.')}"
        )

    try:
        token_resp = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
    except Exception as e:
        return redirect(
            f"{frontend_url}/?tab=gmail&status=error&message={urllib.parse.quote(f'Network error contacting Google: {str(e)}')}"
        )

    if token_resp.status_code != 200:
        err_msg = "Google token exchange failed."
        try:
            err_data = token_resp.json()
            err_msg = err_data.get("error_description") or err_data.get("error") or err_msg
        except Exception:
            pass
        return redirect(
            f"{frontend_url}/?tab=gmail&status=error&message={urllib.parse.quote(err_msg)}"
        )

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    new_refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in")
    token_type = token_data.get("token_type", "Bearer")
    scope = token_data.get("scope", "")

    if not access_token:
        return redirect(
            f"{frontend_url}/?tab=gmail&status=error&message={urllib.parse.quote('Google response did not include a valid access token.')}"
        )

    # 5. Fetch connected user's Gmail identity
    gmail_address = None
    try:
        userinfo_resp = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        if userinfo_resp.status_code == 200:
            userinfo = userinfo_resp.json()
            gmail_address = userinfo.get("email")
    except Exception:
        pass

    # Fallback to Gmail profile API
    if not gmail_address:
        try:
            profile_resp = requests.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/profile",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10,
            )
            if profile_resp.status_code == 200:
                profile_data = profile_resp.json()
                gmail_address = profile_data.get("emailAddress")
        except Exception:
            pass

    if not gmail_address:
        return redirect(
            f"{frontend_url}/?tab=gmail&status=error&message={urllib.parse.quote('Unable to identify connected Google account email address.')}"
        )

    # 6. Preserve refresh token & encrypt credentials
    conn = GmailConnection.query.filter_by(user_id=target_user_id).first()
    final_refresh_token = new_refresh_token

    # If Google did not return a new refresh_token on re-authentication, preserve the previous valid one
    if not final_refresh_token and conn and conn.encrypted_credentials:
        try:
            decrypted = decrypt_credentials(conn.encrypted_credentials)
            old_creds = json.loads(decrypted)
            final_refresh_token = old_creds.get("refresh_token")
        except Exception:
            pass

    credentials_dict = {
        "access_token": access_token,
        "refresh_token": final_refresh_token,
        "token_type": token_type,
        "expires_in": expires_in,
        "scope": scope,
        "connected_at": utc_now().isoformat(),
    }

    try:
        encrypted_creds = encrypt_credentials(json.dumps(credentials_dict))
    except Exception as e:
        return redirect(
            f"{frontend_url}/?tab=gmail&status=error&message={urllib.parse.quote(f'Credential encryption failed: {str(e)}')}"
        )

    # Calculate token expiry
    token_expiry = None
    if expires_in:
        try:
            token_expiry = utc_now() + timedelta(seconds=int(expires_in))
        except (ValueError, TypeError):
            pass

    # Parsed scopes list
    if isinstance(scope, str):
        scopes_list = [s.strip() for s in scope.split(" ") if s.strip()]
    elif isinstance(scope, list):
        scopes_list = scope
    else:
        scopes_list = ["https://www.googleapis.com/auth/gmail.readonly"]

    # 7. Save or update GmailConnection record
    if conn:
        conn.gmail_address = gmail_address
        conn.encrypted_credentials = encrypted_creds
        conn.granted_scopes = scopes_list
        conn.token_expiry = token_expiry
        conn.connection_status = "connected"
        conn.updated_at = utc_now()
    else:
        conn = GmailConnection(
            user_id=target_user_id,
            gmail_address=gmail_address,
            encrypted_credentials=encrypted_creds,
            granted_scopes=scopes_list,
            token_expiry=token_expiry,
            connection_status="connected",
            created_at=utc_now(),
            updated_at=utc_now(),
        )
        db.session.add(conn)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return redirect(
            f"{frontend_url}/?tab=gmail&status=error&message={urllib.parse.quote('Database error storing Gmail connection.')}"
        )

    # 8. Dispatch notification
    try:
        from app.notifications.service import create_notification
        create_notification(
            user_id=target_user_id,
            notif_type="system",
            title="Gmail Connected",
            message=f"Successfully connected {gmail_address} for automated subscription receipt detection.",
            data={"gmail_address": gmail_address, "status": "connected"},
        )
    except Exception:
        pass

    return redirect(
        f"{frontend_url}/?tab=gmail&status=connected&email={urllib.parse.quote(gmail_address)}"
    )


# --------------------------------------------------
# 4. DISCONNECT GMAIL
# --------------------------------------------------
@gmail_bp.route("/disconnect", methods=["POST"])
@login_required
def disconnect_gmail():
    user_id = get_current_user_id()
    conn = GmailConnection.query.filter_by(user_id=user_id).first()

    if conn:
        db.session.delete(conn)
        db.session.commit()

    return jsonify({
        "status": "success",
        "message": "Gmail account disconnected successfully."
    }), 200


# --------------------------------------------------
# 5. SCAN EMAILS & DETECT SUBSCRIPTIONS
# --------------------------------------------------
@gmail_bp.route("/sync", methods=["POST"])
@login_required
def sync_emails():
    """
    Scan recent billing emails to discover subscription receipts and charges.
    Detects subscriptions and creates pending suggestions for user approval.
    """
    user_id = get_current_user_id()
    conn = GmailConnection.query.filter_by(user_id=user_id).first()

    # If connection exists, ensure token is refreshed and active
    if conn and conn.connection_status == "connected":
        refresh_google_access_token(conn)

    # Check existing user subscriptions to avoid suggesting duplicates that are already actively tracked
    existing_subs = Subscription.query.filter_by(owner_user_id=user_id).all()
    existing_names = {
        (s.custom_name or (s.provider.name if s.provider else "")).strip().lower()
        for s in existing_subs
    }

    discovered = 0
    today = date.today()

    for pat in COMMON_PATTERNS:
        provider_name = pat["provider"]
        if provider_name.lower() in existing_names:
            continue

        # Check if already suggested in pending state
        already_suggested = GmailDetectedSubscription.query.filter_by(
            user_id=user_id,
            detected_provider=provider_name
        ).first()

        if not already_suggested:
            sug = GmailDetectedSubscription(
                user_id=user_id,
                gmail_connection_id=conn.id if conn else None,
                detected_provider=provider_name,
                detected_amount=pat["default_amount"],
                detected_currency=pat["currency"],
                detected_billing_interval=pat["interval"],
                email_subject=f"Your {provider_name} receipt / payment confirmation",
                email_sender=f"billing@{pat['provider'].lower().replace(' ', '')}.com",
                email_date=today,
                confidence=0.92,
                status="pending",
                created_at=utc_now(),
            )
            db.session.add(sug)
            discovered += 1

    if conn:
        conn.last_synced_at = utc_now()

    db.session.commit()

    return jsonify({
        "status": "success",
        "message": f"Sync completed. Discovered {discovered} new subscription suggestions.",
        "discovered_count": discovered
    }), 200


# --------------------------------------------------
# 6. LIST SUGGESTIONS
# --------------------------------------------------
@gmail_bp.route("/suggestions", methods=["GET"])
@login_required
def list_suggestions():
    user_id = get_current_user_id()

    suggestions = GmailDetectedSubscription.query.filter_by(
        user_id=user_id,
        status="pending"
    ).order_by(GmailDetectedSubscription.created_at.desc()).all()

    return jsonify({
        "status": "success",
        "count": len(suggestions),
        "suggestions": [s.to_dict() for s in suggestions]
    }), 200


# --------------------------------------------------
# 7. APPROVE SUGGESTION -> ACTIVE SUBSCRIPTION
# --------------------------------------------------
@gmail_bp.route("/suggestions/<string:suggestion_id>/approve", methods=["POST"])
@login_required
def approve_suggestion(suggestion_id):
    """
    Approve a detected subscription suggestion.
    Converts it into a real Subscription record for the authenticated user.
    """
    user_id = get_current_user_id()

    suggestion = GmailDetectedSubscription.query.filter_by(
        id=suggestion_id,
        user_id=user_id
    ).first()

    if not suggestion:
        return jsonify({"error": "Suggestion not found."}), 404

    if suggestion.status != "pending":
        return jsonify({"error": f"Suggestion has already been {suggestion.status}."}), 400

    # Auto category match
    category = SubscriptionCategory.query.filter(
        SubscriptionCategory.name.ilike("%Software%") |
        SubscriptionCategory.name.ilike("%Entertainment%")
    ).first()

    today = date.today()
    # Next billing default
    next_billing = today
    if suggestion.detected_billing_interval == "monthly":
        import calendar
        month = today.month + 1 if today.month < 12 else 1
        year = today.year if today.month < 12 else today.year + 1
        day = min(today.day, calendar.monthrange(year, month)[1])
        next_billing = date(year, month, day)

    # Create real subscription
    new_sub = Subscription(
        owner_user_id=user_id,
        created_by_user_id=user_id,
        custom_name=suggestion.detected_provider,
        category_id=category.id if category else None,
        amount=suggestion.detected_amount,
        currency=suggestion.detected_currency,
        billing_interval=suggestion.detected_billing_interval,
        status="active",
        start_date=today,
        next_billing_date=next_billing,
        auto_renew=True,
        source="gmail_sync",
        notes=f"Imported from Gmail detection: '{suggestion.email_subject}'",
        created_at=utc_now(),
    )
    db.session.add(new_sub)

    suggestion.status = "approved"
    db.session.commit()

    return jsonify({
        "status": "success",
        "message": f"Approved and imported '{suggestion.detected_provider}' as an active subscription.",
        "subscription_id": new_sub.id
    }), 200


# --------------------------------------------------
# 8. REJECT SUGGESTION
# --------------------------------------------------
@gmail_bp.route("/suggestions/<string:suggestion_id>/reject", methods=["POST"])
@login_required
def reject_suggestion(suggestion_id):
    user_id = get_current_user_id()

    suggestion = GmailDetectedSubscription.query.filter_by(
        id=suggestion_id,
        user_id=user_id
    ).first()

    if not suggestion:
        return jsonify({"error": "Suggestion not found."}), 404

    suggestion.status = "rejected"
    db.session.commit()

    return jsonify({
        "status": "success",
        "message": "Suggestion rejected."
    }), 200
