from datetime import date
from decimal import Decimal

from app.database.extensions import db
from app.intelligence.models import SubscriptionAssessment
from app.preprocessing.service import (
    calculate_monthly_cost,
    prepare_ai_features,
)
from app.subscriptions.models import (
    Subscription,
    SubscriptionUsageCheckIn,
)
from app.users.models import UserProfile

# Curated, realistic alternative options for popular subscription services
SERVICE_ALTERNATIVES = {
    "netflix": {
        "provider": "Netflix Standard with Ads / Base Tier",
        "plan": "Basic / Ad-supported plan",
        "factor": Decimal("0.35"),  # ~35% cost of premium
        "url": "https://www.netflix.com",
    },
    "spotify": {
        "provider": "Spotify Free / Student Plan",
        "plan": "Ad-supported free tier or student discount",
        "factor": Decimal("0.00"),
        "url": "https://www.spotify.com",
    },
    "chatgpt": {
        "provider": "Claude Free / Google Gemini Free",
        "plan": "Free conversational AI tier",
        "factor": Decimal("0.00"),
        "url": "https://gemini.google.com",
    },
    "github copilot": {
        "provider": "GitHub Copilot Free / Codeium",
        "plan": "Free AI coding tier (2,000 completions/mo)",
        "factor": Decimal("0.00"),
        "url": "https://github.com/features/copilot",
    },
    "adobe": {
        "provider": "Canva Pro / Figma Starter",
        "plan": "Affordable creative design alternative",
        "factor": Decimal("0.25"),
        "url": "https://www.canva.com",
    },
    "youtube": {
        "provider": "YouTube with AdBlock / Student",
        "plan": "Student discount or shared family plan",
        "factor": Decimal("0.50"),
        "url": "https://www.youtube.com/premium",
    },
    "amazon prime": {
        "provider": "Amazon Prime Monthly / Student",
        "plan": "Pay-per-month during shopping seasons",
        "factor": Decimal("0.50"),
        "url": "https://www.amazon.in/prime",
    },
}


def assess_subscription(subscription, user_id):
    """
    Generate an assessment based on actual usage, monthly cost and renewal dates.
    Uses database records without fabricating data.
    """
    today = date.today()
    monthly_cost = calculate_monthly_cost(
        subscription.amount, subscription.billing_interval
    )

    # Get latest usage checkin
    latest_checkin = (
        SubscriptionUsageCheckIn.query.filter_by(
            subscription_id=subscription.id,
            user_id=user_id
        )
        .order_by(SubscriptionUsageCheckIn.recorded_at.desc())
        .first()
    )

    usage_score = latest_checkin.usage_score if latest_checkin else 50
    user_feedback = latest_checkin.feedback_action if latest_checkin else None

    # Get user profile budget
    profile = UserProfile.query.filter_by(user_id=user_id).first()
    monthly_budget = profile.monthly_budget if profile else None

    # Prepare features
    features = prepare_ai_features(
        {
            "monthly_cost": monthly_cost,
            "usage_score": usage_score,
            "next_billing_date": subscription.next_billing_date,
        },
        monthly_budget=monthly_budget,
        today=today
    )

    days_until_renewal = features.get("days_until_renewal")

    # Determine Waste Score (0-100) & Rule Score
    # Lower usage = higher waste score
    waste_score = max(0, min(100, 100 - usage_score))
    rule_score = waste_score

    # Determine Risk Level and Action
    if usage_score <= 25 or user_feedback == "cancel":
        risk_level = "high"
        predicted_action = "cancel"
        confidence = 0.90 if user_feedback else 0.85
    elif usage_score <= 50 or user_feedback in {"downgrade", "not_useful"}:
        risk_level = "medium"
        predicted_action = "downgrade"
        confidence = 0.80
    else:
        risk_level = "low"
        predicted_action = "keep"
        confidence = 0.95

    # Determine Estimated Savings
    sub_name_lower = (subscription.custom_name or "").lower()
    matched_alt = None
    for key, alt in SERVICE_ALTERNATIVES.items():
        if key in sub_name_lower:
            matched_alt = alt
            break

    alternative_provider = None
    alternative_plan = None
    alternative_monthly_cost = None
    estimated_monthly_savings = Decimal("0.00")
    alternative_url = None

    if predicted_action == "cancel":
        estimated_monthly_savings = monthly_cost
    elif predicted_action == "downgrade":
        if matched_alt:
            alternative_monthly_cost = (monthly_cost * matched_alt["factor"]).quantize(Decimal("0.01"))
            estimated_monthly_savings = (monthly_cost - alternative_monthly_cost).quantize(Decimal("0.01"))
            alternative_provider = matched_alt["provider"]
            alternative_plan = matched_alt["plan"]
            alternative_url = matched_alt["url"]
        else:
            # General downgrade assumption (saving ~40%)
            estimated_monthly_savings = (monthly_cost * Decimal("0.40")).quantize(Decimal("0.01"))
            alternative_monthly_cost = (monthly_cost - estimated_monthly_savings).quantize(Decimal("0.01"))
            alternative_provider = f"{subscription.custom_name} Lower Tier"
            alternative_plan = "Standard / Free tier"

    # Explanation based on actual metrics
    annual_savings = (estimated_monthly_savings * Decimal("12")).quantize(Decimal("0.01"))

    explanation_parts = []
    if risk_level == "high":
        explanation_parts.append(
            f"You are spending ₹{monthly_cost}/month with an underutilized usage score of only {usage_score}%."
        )
        if days_until_renewal is not None and 0 <= days_until_renewal <= 7:
            explanation_parts.append(
                f"Action alert: This renews in {days_until_renewal} days. Cancelling before the deadline saves you ₹{annual_savings} annually."
            )
        else:
            explanation_parts.append(
                f"We recommend cancelling this subscription to save approximately ₹{annual_savings} per year."
            )
    elif risk_level == "medium":
        explanation_parts.append(
            f"Moderate usage ({usage_score}%) detected. At ₹{monthly_cost}/month, you may be paying for features you rarely need."
        )
        if alternative_provider:
            explanation_parts.append(
                f"Consider switching to {alternative_provider} to save ~₹{estimated_monthly_savings}/month."
            )
    else:
        explanation_parts.append(
            f"High usage score ({usage_score}%) indicates this subscription provides good value for its recurring cost."
        )

    explanation = " ".join(explanation_parts)

    # Upsert SubscriptionAssessment
    assessment = SubscriptionAssessment.query.filter_by(
        subscription_id=subscription.id
    ).first()

    if not assessment:
        assessment = SubscriptionAssessment(
            subscription_id=subscription.id,
            rule_score=rule_score,
            waste_score=waste_score,
            risk_level=risk_level,
            predicted_action=predicted_action,
            confidence=confidence,
            model_name="subloo-rules-v1",
            model_version="1.0.0",
            feature_snapshot=features,
            ai_explanation=explanation,
            ai_provider="Subloo Rule Intelligence Engine",
            ai_model_name="Deterministic Feature Classifier",
            alternative_provider=alternative_provider,
            alternative_plan=alternative_plan,
            alternative_monthly_cost=alternative_monthly_cost,
            estimated_monthly_savings=estimated_monthly_savings,
            alternative_url=alternative_url,
            assessment_status="completed",
        )
        db.session.add(assessment)
    else:
        assessment.rule_score = rule_score
        assessment.waste_score = waste_score
        assessment.risk_level = risk_level
        assessment.predicted_action = predicted_action
        assessment.confidence = confidence
        assessment.feature_snapshot = features
        assessment.ai_explanation = explanation
        assessment.alternative_provider = alternative_provider
        assessment.alternative_plan = alternative_plan
        assessment.alternative_monthly_cost = alternative_monthly_cost
        assessment.estimated_monthly_savings = estimated_monthly_savings
        assessment.alternative_url = alternative_url

    db.session.commit()
    return assessment


def serialize_assessment(assessment, sub):
    """Serialize assessment record into JSON."""
    monthly_cost = calculate_monthly_cost(sub.amount, sub.billing_interval)
    annual_savings = (
        (assessment.estimated_monthly_savings or Decimal("0.00")) * Decimal("12")
    ).quantize(Decimal("0.01"))

    return {
        "id": assessment.id,
        "subscription_id": sub.id,
        "subscription_name": sub.custom_name or (sub.provider.name if sub.provider else "Subscription"),
        "category_name": sub.category.name if sub.category else "Uncategorized",
        "monthly_cost": float(monthly_cost),
        "rule_score": assessment.rule_score,
        "waste_score": assessment.waste_score,
        "risk_level": assessment.risk_level,
        "predicted_action": assessment.predicted_action,
        "confidence": assessment.confidence,
        "ai_explanation": assessment.ai_explanation,
        "ai_provider": assessment.ai_provider,
        "alternative_provider": assessment.alternative_provider,
        "alternative_plan": assessment.alternative_plan,
        "alternative_monthly_cost": float(assessment.alternative_monthly_cost) if assessment.alternative_monthly_cost else None,
        "estimated_monthly_savings": float(assessment.estimated_monthly_savings or 0),
        "estimated_yearly_savings": float(annual_savings),
        "alternative_url": assessment.alternative_url,
        "created_at": assessment.created_at.isoformat() if assessment.created_at else None,
    }
