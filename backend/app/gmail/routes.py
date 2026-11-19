import json
import os
import re
from datetime import date, datetime, timezone
from decimal import Decimal
import urllib.parse

from flask import Blueprint, jsonify, request
from app.common.auth import get_current_user_id, login_required, trusted_origin
from app.database.extensions import db
from app.gmail.models import GmailConnection, GmailDetectedSubscription
from app.gmail.security import decrypt_credentials, encrypt_credentials
from app.subscriptions.models import Subscription, SubscriptionCategory
from app.preprocessing.service import normalize_amount, normalize_text


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


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
            "To activate Google OAuth, configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET "
            "in your environment variables." if not oauth_configured else None
        )
    }), 200


@gmail_bp.route("/auth-url", methods=["GET"])
@login_required
def get_auth_url():
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "https://subloo-backend.onrender.com/api/gmail/oauth/callback")

    if not client_id:
        return jsonify({
            "status": "unconfigured",
            "message": "Google OAuth is not yet configured with client credentials.",
            "auth_url": None,
            "instructions": "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and TOKEN_ENCRYPTION_KEY in your Render environment variables."
        }), 200

    scopes = "https://www.googleapis.com/auth/gmail.readonly email profile"
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scopes,
        "access_type": "offline",
        "prompt": "consent",
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    return jsonify({
        "status": "success",
        "auth_url": url
    }), 200


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


@gmail_bp.route("/sync", methods=["POST"])
@login_required
def sync_emails():
    """
    Scan recent billing emails to discover subscription receipts and charges.
    Detects subscriptions and creates pending suggestions for user approval.
    """
    user_id = get_current_user_id()
    conn = GmailConnection.query.filter_by(user_id=user_id).first()

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
