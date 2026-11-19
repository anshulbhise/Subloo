
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


class OrganizationInvitation(db.Model):
    __tablename__ = "organization_invitations"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    organization_id = db.Column(
        db.String(36),
        db.ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    email = db.Column(
        db.String(255),
        nullable=False,
        index=True
    )

    role = db.Column(
        db.String(30),
        nullable=False,
        default="member"
    )

    invited_by_user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False
    )

    status = db.Column(
        db.String(20),
        nullable=False,
        default="pending"
    )

    token = db.Column(
        db.String(100),
        nullable=False,
        unique=True,
        default=lambda: str(uuid.uuid4())
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=utc_now
    )

    organization = db.relationship("Organization")
    inviter = db.relationship("User", foreign_keys=[invited_by_user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "organization_id": self.organization_id,
            "organization_name": self.organization.name if self.organization else "",
            "email": self.email,
            "role": self.role,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<Invitation {self.email} -> {self.organization_id}>"


class OrganizationAuditLog(db.Model):
    __tablename__ = "organization_audit_logs"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    organization_id = db.Column(
        db.String(36),
        db.ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    actor_user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False
    )

    action = db.Column(
        db.String(100),
        nullable=False
    )

    target_type = db.Column(
        db.String(50),
        nullable=True
    )

    target_id = db.Column(
        db.String(36),
        nullable=True
    )

    details = db.Column(
        db.JSON,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=utc_now,
        index=True
    )

    organization = db.relationship("Organization")
    actor = db.relationship("User", foreign_keys=[actor_user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "organization_id": self.organization_id,
            "actor_user_id": self.actor_user_id,
            "actor_name": self.actor.full_name if self.actor else "System",
            "action": self.action,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "details": self.details or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<AuditLog {self.action} on {self.organization_id}>"
