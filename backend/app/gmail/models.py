
import uuid
from datetime import datetime, timezone

from app.database.extensions import db


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class GmailConnection(db.Model):
    __tablename__ = "gmail_connections"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )

    gmail_address = db.Column(
        db.String(255),
        nullable=False
    )

    # Encrypted JSON credentials.
    # Never store raw OAuth tokens here.
    encrypted_credentials = db.Column(
        db.Text,
        nullable=False
    )

    granted_scopes = db.Column(
        db.JSON,
        nullable=False
    )

    token_expiry = db.Column(
        db.DateTime,
        nullable=True
    )

    connection_status = db.Column(
        db.String(20),
        nullable=False,
        default="connected"
    )

    last_synced_at = db.Column(
        db.DateTime,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=utc_now
    )

    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=utc_now,
        onupdate=utc_now
    )

    user = db.relationship("User")

    def __repr__(self):
        return f"<GmailConnection {self.gmail_address}>"


class GmailDetectedSubscription(db.Model):
    __tablename__ = "gmail_detected_subscriptions"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    gmail_connection_id = db.Column(
        db.String(36),
        db.ForeignKey("gmail_connections.id", ondelete="CASCADE"),
        nullable=True
    )

    detected_provider = db.Column(
        db.String(180),
        nullable=False
    )

    detected_amount = db.Column(
        db.Numeric(14, 2),
        nullable=False
    )

    detected_currency = db.Column(
        db.String(3),
        nullable=False,
        default="INR"
    )

    detected_billing_interval = db.Column(
        db.String(20),
        nullable=False,
        default="monthly"
    )

    email_subject = db.Column(
        db.String(300),
        nullable=True
    )

    email_sender = db.Column(
        db.String(200),
        nullable=True
    )

    email_date = db.Column(
        db.Date,
        nullable=True
    )

    confidence = db.Column(
        db.Float,
        nullable=False,
        default=0.85
    )

    status = db.Column(
        db.String(20),
        nullable=False,
        default="pending"
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=utc_now
    )

    user = db.relationship("User")
    connection = db.relationship("GmailConnection")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "detected_provider": self.detected_provider,
            "detected_amount": float(self.detected_amount),
            "detected_currency": self.detected_currency,
            "detected_billing_interval": self.detected_billing_interval,
            "email_subject": self.email_subject,
            "email_sender": self.email_sender,
            "email_date": self.email_date.isoformat() if self.email_date else None,
            "confidence": self.confidence,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<GmailDetected {self.detected_provider}: {self.detected_amount}>"
