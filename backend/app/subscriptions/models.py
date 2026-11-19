
import uuid
from datetime import datetime, timezone

from app.database.extensions import db


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class SubscriptionProvider(db.Model):
    __tablename__ = "subscription_providers"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    name = db.Column(
        db.String(150),
        nullable=False
    )

    slug = db.Column(
        db.String(150),
        nullable=False,
        unique=True
    )

    website_url = db.Column(
        db.String(500),
        nullable=True
    )

    logo_url = db.Column(
        db.String(500),
        nullable=True
    )

    is_active = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=utc_now
    )

    subscriptions = db.relationship(
        "Subscription",
        back_populates="provider"
    )

    def __repr__(self):
        return f"<SubscriptionProvider {self.name}>"


class SubscriptionCategory(db.Model):
    __tablename__ = "subscription_categories"

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    name = db.Column(
        db.String(100),
        nullable=False
    )

    slug = db.Column(
        db.String(100),
        nullable=False,
        unique=True
    )

    description = db.Column(
        db.Text,
        nullable=True
    )

    parent_id = db.Column(
        db.String(36),
        db.ForeignKey(
            "subscription_categories.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    is_active = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    parent = db.relationship(
        "SubscriptionCategory",
        remote_side="SubscriptionCategory.id",
        back_populates="children"
    )

    children = db.relationship(
        "SubscriptionCategory",
        back_populates="parent"
    )

    subscriptions = db.relationship(
        "Subscription",
        back_populates="category"
    )

    def __repr__(self):
        return f"<SubscriptionCategory {self.name}>"


class Subscription(db.Model):
    __tablename__ = "subscriptions"

    __table_args__ = (
        db.CheckConstraint(
            """
            (owner_user_id IS NOT NULL AND organization_id IS NULL)
            OR
            (owner_user_id IS NULL AND organization_id IS NOT NULL)
            """,
            name="ck_subscription_single_owner"
        ),

        db.CheckConstraint(
            "amount >= 0",
            name="ck_subscription_amount_positive"
        ),

        db.CheckConstraint(
            """
            billing_interval IN (
                'weekly', 'monthly', 'quarterly',
                'half_yearly', 'yearly', 'one_time', 'custom'
            )
            """,
            name="ck_subscription_billing_interval"
        ),

        db.CheckConstraint(
            """
            status IN (
                'active', 'trial', 'paused',
                'cancelled', 'expired'
            )
            """,
            name="ck_subscription_status"
        ),

        db.Index(
            "ix_subscription_user_status",
            "owner_user_id",
            "status"
        ),

        db.Index(
            "ix_subscription_org_status",
            "organization_id",
            "status"
        ),

        db.Index(
            "ix_subscription_renewal",
            "next_billing_date",
            "status"
        ),
    )

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    # Ownership: exactly one of user or organization

    owner_user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True
    )

    organization_id = db.Column(
        db.String(36),
        db.ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=True
    )

    created_by_user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False
    )

    # Provider and category

    provider_id = db.Column(
        db.String(36),
        db.ForeignKey(
            "subscription_providers.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    category_id = db.Column(
        db.String(36),
        db.ForeignKey(
            "subscription_categories.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    custom_name = db.Column(
        db.String(180),
        nullable=True
    )

    # Financial information

    amount = db.Column(
        db.Numeric(14, 2),
        nullable=False
    )

    currency = db.Column(
        db.String(3),
        nullable=False,
        default="INR"
    )

    billing_interval = db.Column(
        db.String(20),
        nullable=False,
        default="monthly"
    )

    # Subscription lifecycle

    status = db.Column(
        db.String(20),
        nullable=False,
        default="active"
    )

    start_date = db.Column(
        db.Date,
        nullable=False
    )

    current_period_start = db.Column(
        db.Date,
        nullable=True
    )

    current_period_end = db.Column(
        db.Date,
        nullable=True
    )

    next_billing_date = db.Column(
        db.Date,
        nullable=True,
        index=True
    )

    trial_end_date = db.Column(
        db.Date,
        nullable=True
    )

    cancellation_date = db.Column(
        db.Date,
        nullable=True
    )

    auto_renew = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    # Non-sensitive payment information

    payment_method_label = db.Column(
        db.String(80),
        nullable=True
    )

    source = db.Column(
        db.String(30),
        nullable=False,
        default="manual"
    )

    notes = db.Column(
        db.Text,
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

    # Relationships

    owner_user = db.relationship(
        "User",
        foreign_keys=[owner_user_id]
    )

    organization = db.relationship(
        "Organization",
        foreign_keys=[organization_id]
    )

    created_by = db.relationship(
        "User",
        foreign_keys=[created_by_user_id]
    )

    provider = db.relationship(
        "SubscriptionProvider",
        back_populates="subscriptions"
    )

    category = db.relationship(
        "SubscriptionCategory",
        back_populates="subscriptions"
    )

    def __repr__(self):
        return f"<Subscription {self.id}>"


class SubscriptionUsageCheckIn(db.Model):
    __tablename__ = "subscription_usage_checkins"

    __table_args__ = (
        db.CheckConstraint(
            "usage_score >= 0 AND usage_score <= 100",
            name="ck_usage_score_range"
        ),
        db.CheckConstraint(
            """
            feedback_action IS NULL OR feedback_action IN (
                'keep', 'cancel', 'downgrade', 'not_useful'
            )
            """,
            name="ck_usage_feedback_action"
        ),
        db.Index(
            "ix_usage_subscription_date",
            "subscription_id",
            "recorded_at"
        ),
    )

    id = db.Column(
        db.String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )

    subscription_id = db.Column(
        db.String(36),
        db.ForeignKey("subscriptions.id", ondelete="CASCADE"),
        nullable=False
    )

    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False
    )

    # Normalized usage score: 0 = no usage, 100 = very frequent usage
    usage_score = db.Column(
        db.SmallInteger,
        nullable=False
    )

    # Category default or user-reported check-in
    source = db.Column(
        db.String(30),
        nullable=False,
        default="user_checkin"
    )

    # User feedback used as a machine-learning label
    feedback_action = db.Column(
        db.String(20),
        nullable=True
    )

    notes = db.Column(
        db.Text,
        nullable=True
    )

    recorded_at = db.Column(
        db.DateTime,
        nullable=False,
        default=utc_now
    )

    subscription = db.relationship("Subscription")

    user = db.relationship("User")

    def __repr__(self):
        return (
            f"<UsageCheckIn "
            f"{self.subscription_id}: {self.feedback_action}>"
        )
