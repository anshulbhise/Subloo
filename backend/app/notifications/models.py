import uuid
from datetime import datetime, timezone
from app.database.extensions import db


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Notification(db.Model):
    __tablename__ = "notifications"

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

    organization_id = db.Column(
        db.String(36),
        db.ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True
    )

    type = db.Column(
        db.String(50),
        nullable=False
    )

    title = db.Column(
        db.String(180),
        nullable=False
    )

    message = db.Column(
        db.Text,
        nullable=False
    )

    data = db.Column(
        db.JSON,
        nullable=True
    )

    is_read = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        index=True
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=utc_now,
        index=True
    )

    read_at = db.Column(
        db.DateTime,
        nullable=True
    )

    user = db.relationship("User")
    organization = db.relationship("Organization")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "organization_id": self.organization_id,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "data": self.data or {},
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "read_at": self.read_at.isoformat() if self.read_at else None,
        }

    def __repr__(self):
        return f"<Notification {self.id}: {self.title}>"
