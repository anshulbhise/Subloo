
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
