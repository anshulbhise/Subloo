import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

# Ensure backend directory is in path
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app import create_app
from app.database.extensions import db
from app.users.models import User
from app.notifications.service import (
    check_and_generate_renewal_reminders,
    check_and_generate_budget_alerts,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("subloo.cron")


def run_automated_checks():
    """
    Automated cron job for Render Cron Jobs or scheduled workers.
    Iterates across all active users, evaluates subscription renewal dates (7d, 3d, 1d, 0d),
    checks monthly spending against budget caps, and issues deduplicated notifications.
    """
    app = create_app()
    with app.app_context():
        logger.info("Starting automated Subloo scheduled checks...")
        users = User.query.filter_by(is_active=True).all()
        logger.info(f"Processing scheduled checks for {len(users)} active users.")

        total_reminders = 0
        total_budget_alerts = 0

        for user in users:
            try:
                reminders = check_and_generate_renewal_reminders(user.id)
                total_reminders += reminders
            except Exception as e:
                logger.error(f"Error checking renewal reminders for user {user.id}: {e}")

            try:
                alert = check_and_generate_budget_alerts(user.id)
                if alert:
                    total_budget_alerts += 1
            except Exception as e:
                logger.error(f"Error checking budget alerts for user {user.id}: {e}")

        logger.info(
            f"Scheduled run complete. Created {total_reminders} renewal reminders and {total_budget_alerts} budget alerts."
        )


if __name__ == "__main__":
    run_automated_checks()
