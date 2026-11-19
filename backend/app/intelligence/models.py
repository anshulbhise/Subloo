
import uuid
from datetime import datetime, timezone

from app.database.extensions import db


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class SubscriptionAssessment(db.Model):
    __tablename__ = "subscription_assessments"

    __table_args__ = (
        db.CheckConstraint(
            "waste_score >= 0 AND waste_score <= 100",
            name="ck_assessment_waste_score"
        ),

        db.CheckConstraint(
            "rule_score >= 0 AND rule_score <= 100",
            name="ck_assessment_rule_score"
        ),

        db.CheckConstraint(
            "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)",
            name="ck_assessment_confidence"
        ),

        db.CheckConstraint(
            "risk_level IN ('low', 'medium', 'high')",
            name="ck_assessment_risk"
        ),

        db.CheckConstraint(
            "predicted_action IN ('keep', 'cancel', 'downgrade')",
            name="ck_assessment_action"
        ),

        db.Index(
            "ix_assessment_subscription_date",
            "subscription_id",
            "created_at"
        ),

        db.Index(
            "ix_assessment_risk_date",
            "risk_level",
            "created_at"
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

    # Rule-based intelligence

    rule_score = db.Column(
        db.SmallInteger,
        nullable=False
    )

    waste_score = db.Column(
        db.SmallInteger,
        nullable=False
    )

    risk_level = db.Column(
        db.String(10),
        nullable=False
    )

    # Machine learning prediction

    predicted_action = db.Column(
        db.String(20),
        nullable=False
    )

    confidence = db.Column(
        db.Float,
        nullable=True
    )

    model_name = db.Column(
        db.String(100),
        nullable=True
    )

    model_version = db.Column(
        db.String(50),
        nullable=True
    )

    # Input snapshot used for reproducibility

    feature_snapshot = db.Column(
        db.JSON,
        nullable=True
    )

    # Gemini explanation

    ai_explanation = db.Column(
        db.Text,
        nullable=True
    )

    ai_provider = db.Column(
        db.String(50),
        nullable=True
    )

    ai_model_name = db.Column(
        db.String(100),
        nullable=True
    )

    # Cheaper alternative

    alternative_provider = db.Column(
        db.String(150),
        nullable=True
    )

    alternative_plan = db.Column(
        db.String(150),
        nullable=True
    )

    alternative_monthly_cost = db.Column(
        db.Numeric(14, 2),
        nullable=True
    )

    estimated_monthly_savings = db.Column(
        db.Numeric(14, 2),
        nullable=True
    )

    alternative_url = db.Column(
        db.String(500),
        nullable=True
    )

    # Assessment metadata

    assessment_status = db.Column(
        db.String(20),
        nullable=False,
        default="completed"
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=utc_now,
        index=True
    )

    subscription = db.relationship(
        "Subscription"
    )

    def __repr__(self):
        return (
            f"<SubscriptionAssessment "
            f"{self.subscription_id}: {self.risk_level}>"
        )
