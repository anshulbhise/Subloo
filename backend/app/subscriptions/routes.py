import calendar
import csv
import io
import re
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from flask import Blueprint, jsonify, request, Response

from app.common.auth import get_current_user_id, login_required
from app.database.extensions import db


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)
from app.preprocessing.service import (
    calculate_monthly_cost,
    normalize_amount,
    normalize_date,
    normalize_text,
    normalize_usage_score,
)
from app.subscriptions.models import (
    Subscription,
    SubscriptionCategory,
    SubscriptionProvider,
    SubscriptionUsageCheckIn,
)

subscriptions_bp = Blueprint(
    "subscriptions",
    __name__,
    url_prefix="/api/subscriptions"
)


def slugify(value):
    """Generate a clean URL-friendly slug."""
    text = re.sub(r"[^\w\s-]", "", str(value or "").strip().lower())
    return re.sub(r"[-\s]+", "-", text) or "default"


DEFAULT_CATEGORIES = [
    {"name": "Streaming & Entertainment", "description": "Video, music and media subscriptions"},
    {"name": "Software & SaaS", "description": "Cloud software and digital productivity tools"},
    {"name": "AI & Machine Learning", "description": "Generative AI, assistants and API subscriptions"},
    {"name": "Developer & Cloud", "description": "Hosting, domains, cloud infrastructure and dev tools"},
    {"name": "Finance & Business", "description": "Accounting, banking and business subscriptions"},
    {"name": "Health & Fitness", "description": "Gym, wellness and health memberships"},
    {"name": "Utilities & Other", "description": "General subscriptions and services"},
]


def ensure_default_categories():
    """Seed initial categories if the table is empty."""
    if SubscriptionCategory.query.count() == 0:
        for cat in DEFAULT_CATEGORIES:
            slug = slugify(cat["name"])
            existing = SubscriptionCategory.query.filter_by(slug=slug).first()
            if not existing:
                category = SubscriptionCategory(
                    name=cat["name"],
                    slug=slug,
                    description=cat["description"],
                    is_active=True,
                )
                db.session.add(category)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()


def calculate_next_billing_date(start_date, interval):
    """Automatically calculate next billing date based on billing cycle."""
    if not start_date:
        start_date = date.today()

    if interval == "weekly":
        return start_date + timedelta(days=7)

    if interval == "monthly":
        month = start_date.month + 1
        year = start_date.year
        if month > 12:
            month = 1
            year += 1
        day = min(start_date.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)

    if interval == "quarterly":
        month = start_date.month + 3
        year = start_date.year
        while month > 12:
            month -= 12
            year += 1
        day = min(start_date.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)

    if interval == "half_yearly":
        month = start_date.month + 6
        year = start_date.year
        while month > 12:
            month -= 12
            year += 1
        day = min(start_date.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)

    if interval == "yearly":
        year = start_date.year + 1
        day = min(start_date.day, calendar.monthrange(year, start_date.month)[1])
        return date(year, start_date.month, day)

    return start_date + timedelta(days=30)


def serialize_subscription(sub):
    """Format subscription into clean JSON dictionary."""
    monthly_cost = calculate_monthly_cost(sub.amount, sub.billing_interval)

    # Get latest checkin
    latest_checkin = (
        SubscriptionUsageCheckIn.query.filter_by(
            subscription_id=sub.id,
            user_id=sub.owner_user_id
        )
        .order_by(SubscriptionUsageCheckIn.recorded_at.desc())
        .first()
    )

    display_name = sub.custom_name or (sub.provider.name if sub.provider else "Unnamed Subscription")

    # Days until renewal calculation
    days_until_renewal = None
    if sub.next_billing_date:
        days_until_renewal = (sub.next_billing_date - date.today()).days

    return {
        "id": sub.id,
        "name": display_name,
        "custom_name": sub.custom_name,
        "provider": {
            "id": sub.provider.id,
            "name": sub.provider.name,
            "slug": sub.provider.slug,
            "website_url": sub.provider.website_url,
            "logo_url": sub.provider.logo_url,
        } if sub.provider else None,
        "provider_name": sub.provider.name if sub.provider else "",
        "category": {
            "id": sub.category.id,
            "name": sub.category.name,
            "slug": sub.category.slug,
        } if sub.category else None,
        "category_name": sub.category.name if sub.category else "Uncategorized",
        "amount": float(sub.amount),
        "currency": sub.currency,
        "billing_interval": sub.billing_interval,
        "monthly_cost": float(monthly_cost),
        "yearly_cost": float((monthly_cost * Decimal("12")).quantize(Decimal("0.01"))),
        "status": sub.status,
        "start_date": sub.start_date.isoformat() if sub.start_date else None,
        "next_billing_date": sub.next_billing_date.isoformat() if sub.next_billing_date else None,
        "trial_end_date": sub.trial_end_date.isoformat() if sub.trial_end_date else None,
        "cancellation_date": sub.cancellation_date.isoformat() if sub.cancellation_date else None,
        "days_until_renewal": days_until_renewal,
        "auto_renew": sub.auto_renew,
        "payment_method_label": sub.payment_method_label,
        "source": sub.source,
        "notes": sub.notes,
        "usage_score": latest_checkin.usage_score if latest_checkin else None,
        "created_at": sub.created_at.isoformat() if sub.created_at else None,
        "updated_at": sub.updated_at.isoformat() if sub.updated_at else None,
    }


# --------------------------------------------------
# 1. LIST ALL SUBSCRIPTIONS FOR CURRENT USER
# --------------------------------------------------
@subscriptions_bp.route("", methods=["GET"])
@login_required
def list_subscriptions():
    user_id = get_current_user_id()

    status_filter = request.args.get("status")

    query = Subscription.query.filter_by(owner_user_id=user_id)

    if status_filter and status_filter != "all":
        query = query.filter_by(status=status_filter)

    subscriptions = query.order_by(Subscription.created_at.desc()).all()

    items = [serialize_subscription(s) for s in subscriptions]

    return jsonify({
        "status": "success",
        "count": len(items),
        "subscriptions": items,
    }), 200


# --------------------------------------------------
# CSV EXPORT FOR CURRENT USER
# --------------------------------------------------
@subscriptions_bp.route("/export/csv", methods=["GET"])
@login_required
def export_subscriptions_csv():
    user_id = get_current_user_id()
    subscriptions = (
        Subscription.query.filter_by(owner_user_id=user_id)
        .order_by(Subscription.created_at.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Subscription Name",
        "Provider",
        "Category",
        "Amount",
        "Currency",
        "Billing Interval",
        "Monthly Equivalent",
        "Status",
        "Start Date",
        "Next Renewal Date",
        "Auto Renew",
        "Notes"
    ])

    for sub in subscriptions:
        monthly_cost = calculate_monthly_cost(sub.amount, sub.billing_interval)
        writer.writerow([
            sub.custom_name or (sub.provider.name if sub.provider else "Subscription"),
            sub.provider.name if sub.provider else "",
            sub.category.name if sub.category else "Uncategorized",
            f"{sub.amount:.2f}",
            sub.currency,
            sub.billing_interval,
            f"{monthly_cost:.2f}",
            sub.status,
            sub.start_date.isoformat() if sub.start_date else "",
            sub.next_billing_date.isoformat() if sub.next_billing_date else "",
            "Yes" if sub.auto_renew else "No",
            sub.notes or ""
        ])

    csv_data = output.getvalue()
    today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    return Response(
        csv_data,
        mimetype="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=subloo_subscriptions_{today_str}.csv",
            "Content-Type": "text/csv; charset=utf-8"
        }
    )


# --------------------------------------------------
# 2. CREATE A NEW SUBSCRIPTION
# --------------------------------------------------
@subscriptions_bp.route("", methods=["POST"])
@login_required
def create_subscription():
    user_id = get_current_user_id()
    data = request.get_json(silent=True) or {}

    name = normalize_text(data.get("name") or data.get("custom_name") or data.get("provider_name"))
    if not name:
        return jsonify({"error": "Subscription name is required."}), 400

    # Validate amount
    raw_amount = data.get("amount")
    if raw_amount is None:
        return jsonify({"error": "Subscription amount is required."}), 400

    try:
        amount = normalize_amount(raw_amount)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    # Billing interval
    interval = (data.get("billing_interval") or "monthly").strip().lower()
    valid_intervals = {"weekly", "monthly", "quarterly", "half_yearly", "yearly", "one_time", "custom"}
    if interval not in valid_intervals:
        return jsonify({
            "error": f"Invalid billing interval. Must be one of: {', '.join(sorted(valid_intervals))}"
        }), 400

    # Currency
    currency = normalize_text(data.get("currency") or "INR").upper()
    if len(currency) != 3:
        currency = "INR"

    # Status
    status = (data.get("status") or "active").strip().lower()
    valid_statuses = {"active", "trial", "paused", "cancelled", "expired"}
    if status not in valid_statuses:
        status = "active"

    # Dates
    try:
        start_date = normalize_date(data.get("start_date")) if data.get("start_date") else date.today()
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    try:
        if data.get("next_billing_date"):
            next_billing_date = normalize_date(data.get("next_billing_date"))
        else:
            next_billing_date = calculate_next_billing_date(start_date, interval)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    try:
        trial_end_date = normalize_date(data.get("trial_end_date")) if data.get("trial_end_date") else None
    except ValueError:
        trial_end_date = None

    # Resolve or create provider
    provider = None
    provider_name = normalize_text(data.get("provider_name") or name)
    if provider_name:
        provider_slug = slugify(provider_name)
        provider = SubscriptionProvider.query.filter_by(slug=provider_slug).first()
        if not provider:
            provider = SubscriptionProvider(
                name=provider_name,
                slug=provider_slug,
                website_url=data.get("website_url"),
                is_active=True
            )
            db.session.add(provider)
            db.session.flush()

    # Resolve or create category
    category = None
    category_name = normalize_text(data.get("category_name") or data.get("category"))
    if category_name:
        cat_slug = slugify(category_name)
        category = SubscriptionCategory.query.filter_by(slug=cat_slug).first()
        if not category:
            category = SubscriptionCategory(
                name=category_name,
                slug=cat_slug,
                is_active=True
            )
            db.session.add(category)
            db.session.flush()
    elif data.get("category_id"):
        category = db.session.get(SubscriptionCategory, data.get("category_id"))

    # Create Subscription record
    subscription = Subscription(
        owner_user_id=user_id,
        created_by_user_id=user_id,
        organization_id=None,
        provider_id=provider.id if provider else None,
        category_id=category.id if category else None,
        custom_name=name,
        amount=amount,
        currency=currency,
        billing_interval=interval,
        status=status,
        start_date=start_date,
        next_billing_date=next_billing_date,
        trial_end_date=trial_end_date,
        auto_renew=bool(data.get("auto_renew", True)),
        payment_method_label=normalize_text(data.get("payment_method_label")),
        notes=normalize_text(data.get("notes")),
        source="manual",
    )

    db.session.add(subscription)
    db.session.flush()

    # Optional initial usage check-in
    raw_usage = data.get("usage_score")
    if raw_usage is not None:
        try:
            usage_score = normalize_usage_score(raw_usage)
            check_in = SubscriptionUsageCheckIn(
                subscription_id=subscription.id,
                user_id=user_id,
                usage_score=usage_score,
                source="user_checkin",
                notes=normalize_text(data.get("usage_notes")),
            )
            db.session.add(check_in)
        except ValueError:
            pass

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to save subscription: {str(e)}"}), 500

    try:
        from app.notifications.service import create_notification
        create_notification(
            user_id=user_id,
            notif_type="subscription_created",
            title=f"Subscription Added: {name}",
            message=f"Added {name} ({currency} {amount:.2f} / {interval}) to your active commitments.",
            data={"subscription_id": subscription.id}
        )
    except Exception:
        pass

    try:
        from app.intelligence.service import assess_subscription
        assess_subscription(subscription, user_id)
    except Exception as assess_err:
        current_app.logger.warning(f"Could not assess new subscription: {assess_err}")

    return jsonify({
        "status": "success",
        "message": "Subscription created successfully.",
        "subscription": serialize_subscription(subscription),
    }), 201


# --------------------------------------------------
# 3. GET SINGLE SUBSCRIPTION (USER ISOLATED)
# --------------------------------------------------
@subscriptions_bp.route("/<string:sub_id>", methods=["GET"])
@login_required
def get_subscription(sub_id):
    user_id = get_current_user_id()

    subscription = Subscription.query.filter_by(
        id=sub_id,
        owner_user_id=user_id
    ).first()

    if not subscription:
        return jsonify({"error": "Subscription not found."}), 404

    return jsonify({
        "status": "success",
        "subscription": serialize_subscription(subscription),
    }), 200


# --------------------------------------------------
# 4. UPDATE SUBSCRIPTION (USER ISOLATED)
# --------------------------------------------------
@subscriptions_bp.route("/<string:sub_id>", methods=["PUT", "PATCH"])
@login_required
def update_subscription(sub_id):
    user_id = get_current_user_id()

    subscription = Subscription.query.filter_by(
        id=sub_id,
        owner_user_id=user_id
    ).first()

    if not subscription:
        return jsonify({"error": "Subscription not found."}), 404

    data = request.get_json(silent=True) or {}

    # Update name
    if "name" in data or "custom_name" in data:
        new_name = normalize_text(data.get("name") or data.get("custom_name"))
        if new_name:
            subscription.custom_name = new_name

    # Update amount
    if "amount" in data and data["amount"] is not None:
        try:
            subscription.amount = normalize_amount(data["amount"])
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    # Update interval
    if "billing_interval" in data and data["billing_interval"]:
        interval = data["billing_interval"].strip().lower()
        valid_intervals = {"weekly", "monthly", "quarterly", "half_yearly", "yearly", "one_time", "custom"}
        if interval not in valid_intervals:
            return jsonify({"error": f"Invalid billing interval: {interval}"}), 400
        subscription.billing_interval = interval

    # Update currency
    if "currency" in data and data["currency"]:
        currency = normalize_text(data["currency"]).upper()
        if len(currency) == 3:
            subscription.currency = currency

    # Update status
    if "status" in data and data["status"]:
        status = data["status"].strip().lower()
        valid_statuses = {"active", "trial", "paused", "cancelled", "expired"}
        if status in valid_statuses:
            subscription.status = status
            if status == "cancelled" and not subscription.cancellation_date:
                subscription.cancellation_date = date.today()

    # Update dates
    if "start_date" in data and data["start_date"]:
        try:
            subscription.start_date = normalize_date(data["start_date"])
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    if "next_billing_date" in data and data["next_billing_date"]:
        try:
            subscription.next_billing_date = normalize_date(data["next_billing_date"])
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    if "trial_end_date" in data:
        try:
            subscription.trial_end_date = normalize_date(data["trial_end_date"]) if data["trial_end_date"] else None
        except ValueError:
            pass

    if "auto_renew" in data:
        subscription.auto_renew = bool(data["auto_renew"])

    if "payment_method_label" in data:
        subscription.payment_method_label = normalize_text(data["payment_method_label"])

    if "notes" in data:
        subscription.notes = normalize_text(data["notes"])

    # Update category if provided
    category_name = normalize_text(data.get("category_name") or data.get("category"))
    if category_name:
        cat_slug = slugify(category_name)
        category = SubscriptionCategory.query.filter_by(slug=cat_slug).first()
        if not category:
            category = SubscriptionCategory(
                name=category_name,
                slug=cat_slug,
                is_active=True
            )
            db.session.add(category)
            db.session.flush()
        subscription.category_id = category.id

    # Update usage score if provided
    if "usage_score" in data and data["usage_score"] is not None:
        try:
            usage_score = normalize_usage_score(data["usage_score"])
            last_checkin = (
                SubscriptionUsageCheckIn.query.filter_by(
                    subscription_id=subscription.id,
                    user_id=user_id
                )
                .order_by(SubscriptionUsageCheckIn.recorded_at.desc())
                .first()
            )
            new_recorded_at = utc_now()
            if last_checkin and last_checkin.recorded_at and new_recorded_at <= last_checkin.recorded_at:
                new_recorded_at = last_checkin.recorded_at + timedelta(seconds=1)

            check_in = SubscriptionUsageCheckIn(
                subscription_id=subscription.id,
                user_id=user_id,
                usage_score=usage_score,
                source="user_checkin",
                notes=normalize_text(data.get("usage_notes")),
                recorded_at=new_recorded_at,
            )
            db.session.add(check_in)
        except ValueError:
            pass

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to update subscription: {str(e)}"}), 500

    # Automatically recompute AI waste intelligence assessment
    try:
        from app.intelligence.service import assess_subscription
        assess_subscription(subscription, user_id)
    except Exception as assess_err:
        current_app.logger.warning(f"Could not re-assess subscription after update: {assess_err}")

    return jsonify({
        "status": "success",
        "message": "Subscription updated successfully.",
        "subscription": serialize_subscription(subscription),
    }), 200


# --------------------------------------------------
# 5. DELETE SUBSCRIPTION (USER ISOLATED)
# --------------------------------------------------
@subscriptions_bp.route("/<string:sub_id>", methods=["DELETE"])
@login_required
def delete_subscription(sub_id):
    user_id = get_current_user_id()

    subscription = Subscription.query.filter_by(
        id=sub_id,
        owner_user_id=user_id
    ).first()

    if not subscription:
        return jsonify({"error": "Subscription not found."}), 404

    sub_name = subscription.custom_name or (subscription.provider.name if subscription.provider else "Subscription")

    try:
        db.session.delete(subscription)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to delete subscription: {str(e)}"}), 500

    try:
        from app.notifications.service import create_notification
        create_notification(
            user_id=user_id,
            notif_type="subscription_deleted",
            title=f"Subscription Deleted: {sub_name}",
            message=f"Removed {sub_name} from your tracked subscriptions.",
            data={"subscription_id": sub_id}
        )
    except Exception:
        pass

    return jsonify({
        "status": "success",
        "message": "Subscription deleted successfully.",
        "deleted_id": sub_id,
    }), 200


# --------------------------------------------------
# 6. USAGE CHECK-IN FOR A SUBSCRIPTION
# --------------------------------------------------
@subscriptions_bp.route("/<string:sub_id>/check-in", methods=["POST"])
@login_required
def check_in_usage(sub_id):
    user_id = get_current_user_id()

    subscription = Subscription.query.filter_by(
        id=sub_id,
        owner_user_id=user_id
    ).first()

    if not subscription:
        return jsonify({"error": "Subscription not found."}), 404

    data = request.get_json(silent=True) or {}

    try:
        usage_score = normalize_usage_score(data.get("usage_score"))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if usage_score is None:
        return jsonify({"error": "usage_score is required (0-100)."}), 400

    feedback_action = normalize_text(data.get("feedback_action"))
    if feedback_action and feedback_action not in {"keep", "cancel", "downgrade", "not_useful"}:
        feedback_action = None

    # Ensure recorded_at advances beyond previous checkin
    last_checkin = (
        SubscriptionUsageCheckIn.query.filter_by(
            subscription_id=subscription.id,
            user_id=user_id
        )
        .order_by(SubscriptionUsageCheckIn.recorded_at.desc())
        .first()
    )
    new_recorded_at = utc_now()
    if last_checkin and last_checkin.recorded_at and new_recorded_at <= last_checkin.recorded_at:
        new_recorded_at = last_checkin.recorded_at + timedelta(seconds=1)

    check_in = SubscriptionUsageCheckIn(
        subscription_id=subscription.id,
        user_id=user_id,
        usage_score=usage_score,
        source="user_checkin",
        feedback_action=feedback_action,
        notes=normalize_text(data.get("notes")),
        recorded_at=new_recorded_at,
    )

    db.session.add(check_in)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to record check-in: {str(e)}"}), 500

    return jsonify({
        "status": "success",
        "message": "Usage check-in recorded successfully.",
        "subscription": serialize_subscription(subscription),
    }), 200


# --------------------------------------------------
# 7. LIST AVAILABLE CATEGORIES
# --------------------------------------------------
@subscriptions_bp.route("/categories", methods=["GET"])
@login_required
def list_categories():
    ensure_default_categories()

    categories = (
        SubscriptionCategory.query.filter_by(is_active=True)
        .order_by(SubscriptionCategory.name.asc())
        .all()
    )

    return jsonify({
        "status": "success",
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "slug": c.slug,
                "description": c.description,
            }
            for c in categories
        ],
    }), 200
