from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from flask import Blueprint, jsonify

from app.common.auth import get_current_user_id, login_required
from app.preprocessing.service import calculate_monthly_cost
from app.subscriptions.models import (
    Subscription,
    SubscriptionUsageCheckIn,
)
from app.users.models import UserProfile

analytics_bp = Blueprint(
    "analytics",
    __name__,
    url_prefix="/api/analytics"
)


@analytics_bp.route("/summary", methods=["GET"])
@login_required
def get_analytics_summary():
    """
    Calculate real dashboard statistics from the user's active database records.
    Returns:
      - total_subscriptions
      - active_subscriptions
      - monthly_recurring_expenditure
      - yearly_estimated_expenditure
      - upcoming_renewals
      - category_breakdown
      - at_risk_count
    """
    user_id = get_current_user_id()
    today = date.today()

    subscriptions = Subscription.query.filter_by(owner_user_id=user_id).all()

    profile = UserProfile.query.filter_by(user_id=user_id).first()
    preferred_currency = profile.currency if profile else "INR"

    total_count = len(subscriptions)
    active_count = 0
    trial_count = 0
    paused_count = 0
    cancelled_count = 0

    monthly_recurring_spend = Decimal("0.00")
    category_totals = defaultdict(lambda: Decimal("0.00"))
    upcoming_renewals = []
    at_risk_count = 0

    for sub in subscriptions:
        if sub.status == "active":
            active_count += 1
        elif sub.status == "trial":
            trial_count += 1
        elif sub.status == "paused":
            paused_count += 1
        elif sub.status == "cancelled":
            cancelled_count += 1

        # Calculate recurring spend for active and trial subscriptions
        if sub.status in {"active", "trial"}:
            cost = calculate_monthly_cost(sub.amount, sub.billing_interval)
            monthly_recurring_spend += cost

            category_name = sub.category.name if sub.category else "Uncategorized"
            category_totals[category_name] += cost

        # Check for latest usage score to determine at-risk subscriptions
        checkins = (
            SubscriptionUsageCheckIn.query.filter_by(
                subscription_id=sub.id,
                user_id=user_id
            )
            .order_by(SubscriptionUsageCheckIn.recorded_at.asc())
            .all()
        )
        latest_checkin = checkins[-1] if checkins else None
        if latest_checkin and latest_checkin.usage_score < 40 and sub.status == "active":
            at_risk_count += 1

        # Collect upcoming renewals
        if sub.status in {"active", "trial"} and sub.next_billing_date:
            days_until = (sub.next_billing_date - today).days
            monthly_cost = calculate_monthly_cost(sub.amount, sub.billing_interval)
            upcoming_renewals.append({
                "id": sub.id,
                "name": sub.custom_name or (sub.provider.name if sub.provider else "Subscription"),
                "amount": float(sub.amount),
                "currency": sub.currency,
                "monthly_cost": float(monthly_cost),
                "billing_interval": sub.billing_interval,
                "next_billing_date": sub.next_billing_date.isoformat(),
                "days_until": days_until,
                "status": sub.status,
                "category_name": sub.category.name if sub.category else "Uncategorized",
                "usage_score": latest_checkin.usage_score if latest_checkin else None,
            })

    # Sort upcoming renewals by next_billing_date
    upcoming_renewals.sort(key=lambda r: (r["days_until"] if r["days_until"] >= 0 else 9999))

    yearly_estimated_spend = (monthly_recurring_spend * Decimal("12")).quantize(Decimal("0.01"))

    # Prepare category breakdown
    category_breakdown = []
    total_spend_float = float(monthly_recurring_spend)
    for cat_name, cat_amount in sorted(category_totals.items(), key=lambda x: x[1], reverse=True):
        cat_amount_float = float(cat_amount)
        pct = round((cat_amount_float / total_spend_float * 100), 1) if total_spend_float > 0 else 0
        category_breakdown.append({
            "category": cat_name,
            "monthly_amount": cat_amount_float,
            "percentage": pct,
        })

    # Calculate average usage score across active subscriptions
    all_usage_scores = []
    for sub in subscriptions:
        if sub.status in {"active", "trial"}:
            c_list = (
                SubscriptionUsageCheckIn.query.filter_by(
                    subscription_id=sub.id,
                    user_id=user_id
                )
                .order_by(SubscriptionUsageCheckIn.recorded_at.desc())
                .first()
            )
            if c_list and c_list.usage_score is not None:
                all_usage_scores.append(c_list.usage_score)

    avg_usage_score = round(sum(all_usage_scores) / len(all_usage_scores), 1) if all_usage_scores else 70.0

    return jsonify({
        "status": "success",
        "currency": preferred_currency,
        "total_subscriptions": total_count,
        "active_subscriptions": active_count,
        "trial_subscriptions": trial_count,
        "paused_subscriptions": paused_count,
        "cancelled_subscriptions": cancelled_count,
        "monthly_recurring_expenditure": float(monthly_recurring_spend.quantize(Decimal("0.01"))),
        "yearly_estimated_expenditure": float(yearly_estimated_spend),
        "at_risk_count": at_risk_count,
        "average_usage_score": avg_usage_score,
        "upcoming_renewals_count": len([r for r in upcoming_renewals if 0 <= r["days_until"] <= 30]),
        "upcoming_renewals": upcoming_renewals[:10],
        "category_breakdown": category_breakdown,
    }), 200


@analytics_bp.route("/renewals", methods=["GET"])
@login_required
def get_renewals_calendar():
    """Detailed renewal breakdown across 7, 14, 30 and 60 days."""
    user_id = get_current_user_id()
    today = date.today()

    subscriptions = (
        Subscription.query.filter_by(owner_user_id=user_id)
        .filter(Subscription.status.in_(["active", "trial"]))
        .all()
    )

    items = []
    for sub in subscriptions:
        if not sub.next_billing_date:
            continue

        days_until = (sub.next_billing_date - today).days
        monthly_cost = calculate_monthly_cost(sub.amount, sub.billing_interval)

        checkins = (
            SubscriptionUsageCheckIn.query.filter_by(
                subscription_id=sub.id,
                user_id=user_id
            )
            .order_by(SubscriptionUsageCheckIn.recorded_at.asc())
            .all()
        )
        latest_checkin = checkins[-1] if checkins else None

        items.append({
            "id": sub.id,
            "name": sub.custom_name or (sub.provider.name if sub.provider else "Subscription"),
            "amount": float(sub.amount),
            "currency": sub.currency,
            "monthly_cost": float(monthly_cost),
            "billing_interval": sub.billing_interval,
            "next_billing_date": sub.next_billing_date.isoformat(),
            "days_until": days_until,
            "status": sub.status,
            "category_name": sub.category.name if sub.category else "Uncategorized",
            "usage_score": latest_checkin.usage_score if latest_checkin else None,
        })

    items.sort(key=lambda x: x["days_until"])

    due_soon = [i for i in items if 0 <= i["days_until"] <= 7]
    next_two_weeks = [i for i in items if 7 < i["days_until"] <= 14]
    this_month = [i for i in items if 14 < i["days_until"] <= 30]
    future = [i for i in items if i["days_until"] > 30]
    overdue = [i for i in items if i["days_until"] < 0]

    return jsonify({
        "status": "success",
        "total_renewals_tracked": len(items),
        "due_soon": due_soon,
        "next_two_weeks": next_two_weeks,
        "this_month": this_month,
        "future": future,
        "overdue": overdue,
    }), 200


# --------------------------------------------------
# COMPREHENSIVE FINANCIAL REPORT ENDPOINT
# --------------------------------------------------
@analytics_bp.route("/report", methods=["GET"])
@login_required
def get_financial_report():
    """
    Generate an isolated, comprehensive subscription and spending report
    for the authenticated user.
    """
    user_id = get_current_user_id()
    today = date.today()

    subscriptions = (
        Subscription.query.filter_by(owner_user_id=user_id)
        .order_by(Subscription.created_at.desc())
        .all()
    )

    profile = UserProfile.query.filter_by(user_id=user_id).first()
    preferred_currency = profile.currency if profile else "INR"
    budget = float(profile.monthly_budget) if profile and profile.monthly_budget else None

    active_count = 0
    monthly_recurring = Decimal("0.00")
    category_totals = defaultdict(lambda: Decimal("0.00"))
    upcoming_renewals = []
    sub_details = []

    for sub in subscriptions:
        monthly_cost = calculate_monthly_cost(sub.amount, sub.billing_interval)

        if sub.status in {"active", "trial"}:
            active_count += 1
            monthly_recurring += monthly_cost
            category_name = sub.category.name if sub.category else "Uncategorized"
            category_totals[category_name] += monthly_cost

        days_until = None
        if sub.next_billing_date:
            days_until = (sub.next_billing_date - today).days
            if 0 <= days_until <= 30 and sub.status in {"active", "trial"}:
                upcoming_renewals.append({
                    "name": sub.custom_name or (sub.provider.name if sub.provider else "Subscription"),
                    "amount": float(sub.amount),
                    "currency": sub.currency,
                    "monthly_cost": float(monthly_cost),
                    "next_billing_date": sub.next_billing_date.isoformat(),
                    "days_until": days_until,
                    "status": sub.status,
                })

        sub_details.append({
            "id": sub.id,
            "name": sub.custom_name or (sub.provider.name if sub.provider else "Subscription"),
            "provider": sub.provider.name if sub.provider else "",
            "category": sub.category.name if sub.category else "Uncategorized",
            "amount": float(sub.amount),
            "currency": sub.currency,
            "billing_interval": sub.billing_interval,
            "monthly_cost": float(monthly_cost),
            "status": sub.status,
            "next_billing_date": sub.next_billing_date.isoformat() if sub.next_billing_date else None,
            "days_until": days_until,
            "auto_renew": sub.auto_renew,
        })

    upcoming_renewals.sort(key=lambda x: x["days_until"])
    yearly_projected = monthly_recurring * Decimal("12")

    cat_breakdown = []
    for cat_name, cat_cost in sorted(category_totals.items(), key=lambda x: x[1], reverse=True):
        pct = float((cat_cost / monthly_recurring * 100).quantize(Decimal("0.1"))) if monthly_recurring > 0 else 0
        cat_breakdown.append({
            "category_name": cat_name,
            "monthly_cost": float(cat_cost),
            "percentage": pct,
        })

    budget_pct = None
    if budget and budget > 0:
        budget_pct = round((float(monthly_recurring) / budget) * 100, 1)

    return jsonify({
        "status": "success",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "currency": preferred_currency,
        "total_subscriptions": len(subscriptions),
        "active_subscriptions": active_count,
        "monthly_recurring_expenditure": float(monthly_recurring),
        "yearly_projected_expenditure": float(yearly_projected),
        "monthly_budget": budget,
        "budget_percentage_utilized": budget_pct,
        "category_breakdown": cat_breakdown,
        "upcoming_renewals": upcoming_renewals,
        "subscriptions": sub_details,
    }), 200
