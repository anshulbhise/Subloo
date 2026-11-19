from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from app.common.auth import get_current_user_id, login_required, trusted_origin
from app.database.extensions import db
from app.notifications.models import Notification
from app.notifications.service import (
    check_and_generate_renewal_reminders,
    check_and_generate_budget_alerts,
)


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


notifications_bp = Blueprint(
    "notifications",
    __name__,
    url_prefix="/api/notifications"
)


@notifications_bp.route("", methods=["GET"])
@login_required
def get_notifications():
    user_id = get_current_user_id()

    # Automatically check for upcoming renewals & budget thresholds
    try:
        check_and_generate_renewal_reminders(user_id)
        check_and_generate_budget_alerts(user_id)
    except Exception:
        # Never break the list endpoint if reminder evaluation errors
        db.session.rollback()

    unread_only = request.args.get("unread_only", "").lower() == "true"
    limit = min(int(request.args.get("limit") or 50), 100)

    query = Notification.query.filter_by(user_id=user_id)
    if unread_only:
        query = query.filter_by(is_read=False)

    notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()

    unread_count = Notification.query.filter_by(
        user_id=user_id,
        is_read=False
    ).count()

    return jsonify({
        "status": "success",
        "unread_count": unread_count,
        "count": len(notifications),
        "notifications": [n.to_dict() for n in notifications],
    }), 200


@notifications_bp.route("/<notification_id>/read", methods=["PUT"])
@login_required
def mark_notification_read(notification_id):
    user_id = get_current_user_id()

    notif = db.session.get(Notification, notification_id)
    if not notif or notif.user_id != user_id:
        return jsonify({"error": "Notification not found."}), 404

    notif.is_read = True
    notif.read_at = utc_now()
    db.session.commit()

    return jsonify({
        "status": "success",
        "message": "Notification marked as read.",
        "notification": notif.to_dict()
    }), 200


@notifications_bp.route("/read-all", methods=["PUT"])
@login_required
def mark_all_read():
    user_id = get_current_user_id()

    unread_notifs = Notification.query.filter_by(
        user_id=user_id,
        is_read=False
    ).all()

    now = utc_now()
    for n in unread_notifs:
        n.is_read = True
        n.read_at = now

    db.session.commit()

    return jsonify({
        "status": "success",
        "message": f"Marked {len(unread_notifs)} notifications as read.",
        "unread_count": 0
    }), 200


@notifications_bp.route("/<notification_id>", methods=["DELETE"])
@login_required
def delete_notification(notification_id):
    user_id = get_current_user_id()

    notif = db.session.get(Notification, notification_id)
    if not notif or notif.user_id != user_id:
        return jsonify({"error": "Notification not found."}), 404

    db.session.delete(notif)
    db.session.commit()

    return jsonify({
        "status": "success",
        "message": "Notification deleted."
    }), 200


@notifications_bp.route("/check-reminders", methods=["POST"])
@login_required
def trigger_reminders():
    user_id = get_current_user_id()
    reminders = check_and_generate_renewal_reminders(user_id)
    alerts = check_and_generate_budget_alerts(user_id)

    return jsonify({
        "status": "success",
        "message": "Reminders and budget alerts evaluated.",
        "reminders_created": reminders,
        "alerts_created": alerts
    }), 200
