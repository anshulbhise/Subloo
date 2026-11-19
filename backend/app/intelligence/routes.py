from decimal import Decimal
from flask import Blueprint, jsonify, request

from app.common.auth import get_current_user_id, login_required
from app.intelligence.models import SubscriptionAssessment
from app.intelligence.service import (
    assess_subscription,
    calculate_budget_insights,
    detect_duplicates,
    serialize_assessment,
)
from app.preprocessing.service import calculate_monthly_cost
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

    # 1. Detect duplicate subscriptions
    duplicates = detect_duplicates(active_subscriptions)
    duplicate_monthly_savings = sum(Decimal(str(d["potential_monthly_savings"])) for d in duplicates)

    # 2. Total monthly recurring spend
    total_monthly_recurring = sum(
        calculate_monthly_cost(s.amount, s.billing_interval) for s in active_subscriptions
    )

    # Combined savings across underutilization + duplicates
    combined_monthly_savings = total_potential_monthly + duplicate_monthly_savings
    combined_yearly_savings = combined_monthly_savings * Decimal("12")

    # 3. Budget utilization intelligence
    budget_insights = calculate_budget_insights(
        user_id,
        float(total_monthly_recurring),
        float(combined_monthly_savings)
    )

    return jsonify({
        "status": "success",
        "waste_count": waste_count,
        "duplicate_count": len(duplicates),
        "total_potential_monthly_savings": float(combined_monthly_savings),
        "total_potential_yearly_savings": float(combined_yearly_savings),
        "duplicates": duplicates,
        "budget_insights": budget_insights,
        "recommendations": recommendations,
    }), 200


@intelligence_bp.route("/history", methods=["GET"])
@login_required
def get_assessment_history():
    """Return historical assessment records for the user's subscriptions."""
    user_id = get_current_user_id()
    limit = min(int(request.args.get("limit") or 20), 50)

    user_subs = Subscription.query.filter_by(owner_user_id=user_id).all()
    sub_ids = [s.id for s in user_subs]
    sub_map = {s.id: s for s in user_subs}

    if not sub_ids:
        return jsonify({
            "status": "success",
            "history": []
        }), 200

    assessments = (
        SubscriptionAssessment.query.filter(SubscriptionAssessment.subscription_id.in_(sub_ids))
        .order_by(SubscriptionAssessment.created_at.desc())
        .limit(limit)
        .all()
    )

    history = [
        serialize_assessment(a, sub_map[a.subscription_id])
        for a in assessments
        if a.subscription_id in sub_map
    ]

    return jsonify({
        "status": "success",
        "count": len(history),
        "history": history
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
