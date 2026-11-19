import uuid
from datetime import datetime, timezone

from app.database.extensions import db


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    full_name = db.Column(
        db.String(120),
        nullable=False
    )

    email = db.Column(
        db.String(255),
        nullable=False,
        unique=True,
        index=True
    )

    password_hash = db.Column(
        db.String(255),
        nullable=True
    )

    is_active = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    email_verified = db.Column(
        db.Boolean,
        nullable=False,
        default=False
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

    # Personal profile
    profile = db.relationship(
        "UserProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User {self.email}>"


class UserProfile(db.Model):
    __tablename__ = "user_profiles"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )

    currency = db.Column(
        db.String(3),
        nullable=False,
        default="INR"
    )

    monthly_budget = db.Column(
        db.Numeric(12, 2),
        nullable=True
    )

    timezone = db.Column(
        db.String(64),
        nullable=False,
        default="Asia/Kolkata"
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

    user = db.relationship(
        "User",
        back_populates="profile"
    )

    def __repr__(self):
        return f"<UserProfile {self.user_id}>"
