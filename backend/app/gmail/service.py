import base64
import json
import logging
import re
from datetime import datetime, timezone
import requests

from app.database.extensions import db
from app.gmail.models import GmailDetectedSubscription
from app.gmail.security import refresh_google_access_token
from app.subscriptions.models import Subscription

logger = logging.getLogger("subloo.gmail.scanner")

KNOWN_PROVIDERS = {
    "netflix": {"name": "Netflix", "category": "Entertainment", "interval": "monthly"},
    "spotify": {"name": "Spotify", "category": "Entertainment", "interval": "monthly"},
    "openai": {"name": "OpenAI (ChatGPT)", "category": "Productivity", "interval": "monthly"},
    "chatgpt": {"name": "OpenAI (ChatGPT)", "category": "Productivity", "interval": "monthly"},
    "github": {"name": "GitHub", "category": "Development", "interval": "monthly"},
    "copilot": {"name": "GitHub Copilot", "category": "Development", "interval": "monthly"},
    "amazon": {"name": "Amazon Prime", "category": "Shopping & Utilities", "interval": "yearly"},
    "prime": {"name": "Amazon Prime", "category": "Shopping & Utilities", "interval": "yearly"},
    "google": {"name": "Google One / Workspace", "category": "Cloud & Storage", "interval": "monthly"},
    "adobe": {"name": "Adobe Creative Cloud", "category": "Design & Media", "interval": "monthly"},
    "figma": {"name": "Figma", "category": "Design & Media", "interval": "monthly"},
    "notion": {"name": "Notion", "category": "Productivity", "interval": "monthly"},
    "slack": {"name": "Slack", "category": "Communication", "interval": "monthly"},
    "zoom": {"name": "Zoom", "category": "Communication", "interval": "monthly"},
    "apple": {"name": "Apple Services / iCloud", "category": "Cloud & Storage", "interval": "monthly"},
    "youtube": {"name": "YouTube Premium", "category": "Entertainment", "interval": "monthly"},
    "canva": {"name": "Canva", "category": "Design & Media", "interval": "monthly"},
    "linkedin": {"name": "LinkedIn Premium", "category": "Networking", "interval": "monthly"},
    "dropbox": {"name": "Dropbox", "category": "Cloud & Storage", "interval": "monthly"},
    "digitalocean": {"name": "DigitalOcean", "category": "Hosting & Cloud", "interval": "monthly"},
    "render": {"name": "Render Cloud", "category": "Hosting & Cloud", "interval": "monthly"},
}


def _extract_body_text(payload):
    """Recursively extract plain text or HTML body from Gmail message payload."""
    text_content = ""
    mime_type = payload.get("mimeType", "")

    if mime_type == "text/plain" and "data" in payload.get("body", {}):
        raw = payload["body"]["data"]
        try:
            return base64.urlsafe_b64decode(raw.encode("utf-8")).decode("utf-8", errors="ignore")
        except Exception:
            return ""

    parts = payload.get("parts", [])
    for part in parts:
        part_mime = part.get("mimeType", "")
        if part_mime == "text/plain" and "data" in part.get("body", {}):
            try:
                raw = part["body"]["data"]
                return base64.urlsafe_b64decode(raw.encode("utf-8")).decode("utf-8", errors="ignore")
            except Exception:
                pass
        elif "parts" in part:
            sub = _extract_body_text(part)
            if sub:
                return sub

    return text_content


def _extract_amount_and_currency(text):
    """Extract price amount and currency symbol/code using multi-currency regex."""
    if not text:
        return 0.0, "USD"

    # Regex patterns for currency and numbers
    # Pattern 1: $19.99, €9.99, £14.99, ₹649.00
    p1 = re.search(r"([\$€£₹])\s*(\d{1,5}(?:[.,]\d{2})?)", text)
    if p1:
        sym, amt_str = p1.groups()
        sym_map = {"$": "USD", "€": "EUR", "£": "GBP", "₹": "INR"}
        curr = sym_map.get(sym, "USD")
        amt = float(amt_str.replace(",", ""))
        if 0 < amt < 50000:
            return amt, curr

    # Pattern 2: 19.99 USD, 649 INR
    p2 = re.search(r"(\d{1,5}(?:[.,]\d{2})?)\s*(USD|EUR|GBP|INR)", text, re.IGNORECASE)
    if p2:
        amt_str, curr = p2.groups()
        amt = float(amt_str.replace(",", ""))
        if 0 < amt < 50000:
            return amt, curr.upper()

    return 0.0, "USD"


def _extract_billing_interval(text):
    """Detect whether subscription billing is annual or monthly."""
    if not text:
        return "monthly"
    t_lower = text.lower()
    if any(k in t_lower for k in ["annual", "yearly", "/year", "per year", "12 months"]):
        return "yearly"
    return "monthly"


def _identify_provider(sender, subject, body):
    """Identify subscription provider from email headers and body text."""
    combined = f"{sender} {subject} {body[:500]}".lower()
    for key, data in KNOWN_PROVIDERS.items():
        if key in combined:
            return data["name"], data["interval"]
    return None, "monthly"


def scan_live_gmail(conn, user_id, max_emails=15):
    """
    Connect to Google Gmail REST API with user's access token,
    query billing and receipt emails, parse invoice details,
    and persist new subscription suggestions.
    """
    access_token = refresh_google_access_token(conn)
    if not access_token:
        logger.warning(f"Unable to refresh access token for connection {conn.id}")
        return 0

    headers = {"Authorization": f"Bearer {access_token}"}
    query = "subject:(receipt OR invoice OR subscription OR renewal OR billed OR billing OR payment)"

    try:
        list_url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages?q={requests.utils.quote(query)}&maxResults={max_emails}"
        resp = requests.get(list_url, headers=headers, timeout=10)
        if resp.status_code != 200:
            logger.warning(f"Gmail messages list failed with status {resp.status_code}: {resp.text}")
            return 0

        data = resp.json()
        messages = data.get("messages", [])
        if not messages:
            return 0

    except Exception as e:
        logger.warning(f"Error querying Gmail API: {e}")
        return 0

    # Fetch existing subscriptions to avoid suggesting duplicates
    existing_subs = Subscription.query.filter_by(owner_user_id=user_id).all()
    existing_names = {
        (s.custom_name or (s.provider.name if s.provider else "")).strip().lower()
        for s in existing_subs
    }

    discovered = 0
    today = datetime.now(timezone.utc).date()

    for msg_meta in messages:
        msg_id = msg_meta.get("id")
        if not msg_id:
            continue

        try:
            msg_url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}?format=full"
            msg_resp = requests.get(msg_url, headers=headers, timeout=10)
            if msg_resp.status_code != 200:
                continue

            msg_data = msg_resp.json()
            payload = msg_data.get("payload", {})
            header_list = payload.get("headers", [])
            header_dict = {h.get("name", "").lower(): h.get("value", "") for h in header_list}

            sender = header_dict.get("from", "")
            subject = header_dict.get("subject", "Subscription Invoice")
            date_raw = header_dict.get("date", "")

            body_text = _extract_body_text(payload) or subject

            provider_name, default_interval = _identify_provider(sender, subject, body_text)
            if not provider_name:
                continue

            # Deduplicate against active subscriptions
            if provider_name.lower() in existing_names:
                continue

            # Deduplicate against existing suggestions
            existing_sug = GmailDetectedSubscription.query.filter_by(
                user_id=user_id,
                detected_provider=provider_name
            ).first()
            if existing_sug:
                continue

            amount, currency = _extract_amount_and_currency(f"{subject} {body_text}")
            interval = _extract_billing_interval(f"{subject} {body_text}") or default_interval

            sug = GmailDetectedSubscription(
                user_id=user_id,
                gmail_connection_id=conn.id,
                detected_provider=provider_name,
                detected_amount=amount if amount > 0 else 9.99,
                detected_currency=currency,
                detected_billing_interval=interval,
                email_subject=subject[:250],
                email_sender=sender[:250],
                email_date=today,
                confidence=0.95 if amount > 0 else 0.80,
                status="pending",
                created_at=datetime.now(timezone.utc).replace(tzinfo=None)
            )
            db.session.add(sug)
            discovered += 1

        except Exception as msg_err:
            logger.warning(f"Failed parsing message {msg_id}: {msg_err}")
            continue

    return discovered
