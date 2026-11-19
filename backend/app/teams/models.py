
import uuid
from datetime import datetime, timezone

from app.database.extensions import db


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Team(db.Model):
    __tablename__ = "teams"

    __table_args__ = (
        db.UniqueConstraint(
            "organization_id",
            "name",
            name="uq_team_organization_name"
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
        nullable=False,
        index=True
    )

    name = db.Column(
        db.String(120),
        nullable=False
    )

    description = db.Column(
        db.Text,
        nullable=True
    )

    manager_user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    status = db.Column(
        db.String(20),
        nullable=False,
        default="active"
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

    organization = db.relationship("Organization")

    manager = db.relationship(
        "User",
        foreign_keys=[manager_user_id]
    )

    members = db.relationship(
        "TeamMembership",
        back_populates="team",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Team {self.name}>"


class TeamMembership(db.Model):
    __tablename__ = "team_memberships"

    __table_args__ = (
        db.UniqueConstraint(
            "team_id",
            "user_id",
            name="uq_team_user"
        ),
        db.Index(
            "ix_team_membership_user",
            "user_id"
        ),
    )

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    team_id = db.Column(
        db.String(36),
        db.ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False
    )

    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    assigned_at = db.Column(
        db.DateTime,
        nullable=False,
        default=utc_now
    )

    team = db.relationship(
        "Team",
        back_populates="members"
    )

    user = db.relationship("User")

    def __repr__(self):
        return f"<TeamMembership {self.team_id}: {self.user_id}>"
