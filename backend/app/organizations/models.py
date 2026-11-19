
import uuid
from datetime import datetime, timezone

from app.database.extensions import db


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Organization(db.Model):
    __tablename__ = "organizations"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    name = db.Column(
        db.String(180),
        nullable=False
    )

    slug = db.Column(
        db.String(100),
        nullable=False,
        unique=True,
        index=True
    )

    legal_name = db.Column(
        db.String(255),
        nullable=True
    )

    status = db.Column(
        db.String(20),
        nullable=False,
        default="active"
    )

    created_by_user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False
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

    memberships = db.relationship(
        "OrganizationMembership",
        back_populates="organization",
        cascade="all, delete-orphan"
    )

    creator = db.relationship(
        "User",
        foreign_keys=[created_by_user_id]
    )

    def __repr__(self):
        return f"<Organization {self.name}>"


class OrganizationMembership(db.Model):
    __tablename__ = "organization_memberships"

    __table_args__ = (
        db.UniqueConstraint(
            "organization_id",
            "user_id",
            name="uq_organization_user"
        ),
        db.CheckConstraint(
            "role IN ('owner', 'admin', 'office_manager', 'member')",
            name="ck_organization_membership_role"
        ),
        db.Index(
            "ix_membership_user_status",
            "user_id",
            "status"
        ),
    )

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    organization_id = db.Column(
        db.String(36),
        db.ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False
    )

    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    role = db.Column(
        db.String(30),
        nullable=False,
        default="member"
    )

    status = db.Column(
        db.String(20),
        nullable=False,
        default="active"
    )

    joined_at = db.Column(
        db.DateTime,
        nullable=False,
        default=utc_now
    )

    organization = db.relationship(
        "Organization",
        back_populates="memberships"
    )

    user = db.relationship(
        "User"
    )

    def __repr__(self):
        return f"<Membership {self.role}: {self.user_id}>"
