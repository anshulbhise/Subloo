from decimal import Decimal
from flask import Blueprint, jsonify

from app.common.auth import get_current_user_id, login_required
from app.intelligence.service import assess_subscription, serialize_assessment
from app.subscriptions.models import Subscription

intelligence_bp = Blueprint(
    "intelligence",
    __name__,
    url_prefix="/api/intelligence"
)


@intelligence_bp.route("/recommendations", methods=["GET"])
@login_required
def get_recommendations():
    """
    Generate or return real subscription intelligence recommendations.
    Every recommendation is derived strictly from actual database records.
    """
    user_id = get_current_user_id()

    subscriptions = Subscription.query.filter_by(owner_user_id=user_id).all()

    active_subscriptions = [
        s for s in subscriptions if s.status in {"active", "trial"}
    ]

    total_potential_monthly = Decimal("0.00")
    total_potential_yearly = Decimal("0.00")
    waste_count = 0

    recommendations = []

    for sub in active_subscriptions:
        assessment = assess_subscription(sub, user_id)
        serialized = serialize_assessment(assessment, sub)

        if serialized["risk_level"] in {"high", "medium"}:
            waste_count += 1
            total_potential_monthly += Decimal(str(serialized["estimated_monthly_savings"]))
            total_potential_yearly += Decimal(str(serialized["estimated_yearly_savings"]))

        recommendations.append(serialized)

    # Sort recommendations by risk level (high -> medium -> low), then by savings descending
    risk_rank = {"high": 0, "medium": 1, "low": 2}
    recommendations.sort(
        key=lambda r: (risk_rank.get(r["risk_level"], 9), -r["estimated_monthly_savings"])
    )

    return jsonify({
        "status": "success",
        "waste_count": waste_count,
        "total_potential_monthly_savings": float(total_potential_monthly),
        "total_potential_yearly_savings": float(total_potential_yearly),
        "recommendations": recommendations,
    }), 200


@intelligence_bp.route("/assess/<string:sub_id>", methods=["POST"])
@login_required
def assess_single_subscription(sub_id):
    """Trigger a fresh assessment for a specific subscription."""
    user_id = get_current_user_id()

    subscription = Subscription.query.filter_by(
        id=sub_id,
        owner_user_id=user_id
    ).first()

    if not subscription:
        return jsonify({"error": "Subscription not found."}), 404

    assessment = assess_subscription(subscription, user_id)

    return jsonify({
        "status": "success",
        "message": "Subscription assessment completed.",
        "assessment": serialize_assessment(assessment, subscription),
    }), 200
