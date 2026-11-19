from datetime import date, datetime, timezone
from decimal import Decimal
from app.database.extensions import db
from app.notifications.models import Notification
from app.subscriptions.models import Subscription
from app.users.models import UserProfile
from app.preprocessing.service import calculate_monthly_cost


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def create_notification(user_id, notif_type, title, message, data=None, organization_id=None):
    """Create a single user notification safely."""
    try:
        notif = Notification(
            user_id=user_id,
            organization_id=organization_id,
            type=notif_type,
            title=title,
            message=message,
            data=data or {},
            is_read=False,
            created_at=utc_now(),
        )
        db.session.add(notif)
        db.session.commit()
        return notif
    except Exception as e:
        db.session.rollback()
        return None


def check_and_generate_renewal_reminders(user_id):
    """
    Check all active subscriptions for upcoming renewals and generate reminders
    at 7 days, 3 days, 1 day, and 0 days (today).
    Deduplicates reminders so the user is never spammed twice for the same renewal cycle.
    """
    today = date.today()
    active_subs = Subscription.query.filter_by(
        owner_user_id=user_id,
        status="active"
    ).filter(Subscription.next_billing_date.isnot(None)).all()

    # Load existing recent renewal notifications for this user in python
    # to avoid DB-specific JSON path query syntax differences between Postgres & MySQL
    existing_notifs = Notification.query.filter_by(
        user_id=user_id
    ).filter(
        Notification.type.in_(["renewal_upcoming", "renewal_urgent"])
    ).all()

    existing_keys = set()
    for n in existing_notifs:
        d = n.data or {}
        sub_id = str(d.get("subscription_id") or "")
        ren_date = str(d.get("renewal_date") or "")
        d_until = str(d.get("days_until") if d.get("days_until") is not None else "")
        if sub_id and ren_date:
            existing_keys.add((sub_id, ren_date, d_until))

    reminders_created = 0

    for sub in active_subs:
        days_until = (sub.next_billing_date - today).days

        # Check intervals: 0 (today), 1 (tomorrow), 3 (3 days), 7 (7 days)
        if days_until in {0, 1, 3, 7}:
            billing_str = sub.next_billing_date.isoformat()
            sub_name = sub.custom_name or (sub.provider.name if sub.provider else "Subscription")

            key = (str(sub.id), billing_str, str(days_until))
            if key not in existing_keys:
                is_urgent = days_until <= 1
                notif_type = "renewal_urgent" if is_urgent else "renewal_upcoming"

                if days_until == 0:
                    title = f"Renewal Today: {sub_name}"
                    message = f"Your {sub_name} subscription ({sub.currency} {sub.amount:.2f}) is scheduled to renew today."
                elif days_until == 1:
                    title = f"Renewal Tomorrow: {sub_name}"
                    message = f"Your {sub_name} subscription ({sub.currency} {sub.amount:.2f}) renews tomorrow ({billing_str})."
                else:
                    title = f"Renewal in {days_until} days: {sub_name}"
                    message = f"Upcoming charge of {sub.currency} {sub.amount:.2f} for {sub_name} on {billing_str}."

                notif = Notification(
                    user_id=user_id,
                    type=notif_type,
                    title=title,
                    message=message,
                    data={
                        "subscription_id": sub.id,
                        "subscription_name": sub_name,
                        "amount": float(sub.amount),
                        "currency": sub.currency,
                        "renewal_date": billing_str,
                        "days_until": days_until,
                    },
                    is_read=False,
                    created_at=utc_now(),
                )
                db.session.add(notif)
                existing_keys.add(key)
                reminders_created += 1

    if reminders_created > 0:
        db.session.commit()

    return reminders_created


def check_and_generate_budget_alerts(user_id):
    """
    Check monthly recurring spend against the user's monthly budget.
    Generates 'budget_approaching' alert at >= 80% and 'budget_exceeded' alert at >= 100%.
    Deduplicated per month (YYYY-MM).
    """
    profile = UserProfile.query.filter_by(user_id=user_id).first()
    if not profile or not profile.monthly_budget or profile.monthly_budget <= 0:
        return 0

    budget = Decimal(str(profile.monthly_budget))
    current_month_key = date.today().strftime("%Y-%m")

    # Calculate current active recurring expenditure
    active_subs = Subscription.query.filter_by(
        owner_user_id=user_id,
        status="active"
    ).all()

    total_monthly = sum(
        calculate_monthly_cost(s.amount, s.billing_interval) for s in active_subs
    )

    ratio = total_monthly / budget if budget > 0 else Decimal("0.00")
    alerts_created = 0

    # Query recent budget notifications in python
    budget_notifs = Notification.query.filter_by(
        user_id=user_id
    ).filter(
        Notification.type.in_(["budget_approaching", "budget_exceeded"])
    ).all()

    existing_months = set()
    for n in budget_notifs:
        d = n.data or {}
        m = d.get("month")
        if m:
            existing_months.add((n.type, str(m)))

    if ratio >= Decimal("1.00"):
        if ("budget_exceeded", current_month_key) not in existing_months:
            pct = int(ratio * 100)
            notif = Notification(
                user_id=user_id,
                type="budget_exceeded",
                title="Monthly Budget Exceeded",
                message=(
                    f"Your monthly recurring commitments ({profile.currency} {total_monthly:.2f}) "
                    f"have exceeded your target budget of {profile.currency} {budget:.2f} ({pct}% utilized)."
                ),
                data={
                    "month": current_month_key,
                    "budget": float(budget),
                    "total_monthly": float(total_monthly),
                    "currency": profile.currency,
                    "percentage": pct,
                },
                is_read=False,
                created_at=utc_now(),
            )
            db.session.add(notif)
            existing_months.add(("budget_exceeded", current_month_key))
            alerts_created += 1

    elif ratio >= Decimal("0.80"):
        if ("budget_approaching", current_month_key) not in existing_months:
            pct = int(ratio * 100)
            notif = Notification(
                user_id=user_id,
                type="budget_approaching",
                title="Monthly Budget Warning (80%+)",
                message=(
                    f"You have committed {profile.currency} {total_monthly:.2f} of your "
                    f"{profile.currency} {budget:.2f} budget ({pct}% utilized)."
                ),
                data={
                    "month": current_month_key,
                    "budget": float(budget),
                    "total_monthly": float(total_monthly),
                    "currency": profile.currency,
                    "percentage": pct,
                },
                is_read=False,
                created_at=utc_now(),
            )
            db.session.add(notif)
            existing_months.add(("budget_approaching", current_month_key))
            alerts_created += 1

    if alerts_created > 0:
        db.session.commit()

    return alerts_created
