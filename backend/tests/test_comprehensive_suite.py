import os
import sys
import unittest
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

# Ensure backend root is on path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)

from app import create_app
from app.database.extensions import db
from app.users.models import User, UserProfile
from app.subscriptions.models import Subscription, SubscriptionCategory, SubscriptionProvider, SubscriptionUsageCheckIn
from app.notifications.models import Notification
from app.notifications.service import check_and_generate_renewal_reminders, check_and_generate_budget_alerts
from app.gmail.models import GmailDetectedSubscription
from app.organizations.models import Organization, OrganizationMembership, OrganizationInvitation, OrganizationAuditLog
from app.teams.models import Team, TeamMembership


class ComprehensiveSublooTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ["DATABASE_URL"] = "sqlite:///:memory:"
        os.environ["SECRET_KEY"] = "test-secret-key-12345"
        os.environ["FLASK_ENV"] = "testing"
        cls.app = create_app()
        cls.app.config["TESTING"] = True
        cls.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        cls.client = cls.app.test_client()

        with cls.app.app_context():
            db.create_all()

    def setUp(self):
        self.app_ctx = self.app.app_context()
        self.app_ctx.push()

    def tearDown(self):
        self.app_ctx.pop()

    def test_01_user_registration_and_login(self):
        """Test registration, duplicate prevention, and login."""
        # 1. Register user
        res = self.client.post("/api/auth/register", json={
            "full_name": "Test User",
            "email": "tester@example.com",
            "password": "ValidPassword123!"
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertIn("user", data)
        self.assertEqual(data["user"]["email"], "tester@example.com")

        # 2. Check welcome notification created
        user_id = data["user"]["id"]
        welcome_notif = Notification.query.filter_by(user_id=user_id).first()
        self.assertIsNotNone(welcome_notif)
        self.assertEqual(welcome_notif.title, "Welcome to Subloo!")

        # 3. Duplicate email test
        res_dup = self.client.post("/api/auth/register", json={
            "full_name": "Duplicate User",
            "email": "tester@example.com",
            "password": "ValidPassword123!"
        })
        self.assertEqual(res_dup.status_code, 409)

        # 4. Login test
        res_login = self.client.post("/api/auth/login", json={
            "email": "tester@example.com",
            "password": "ValidPassword123!"
        })
        self.assertEqual(res_login.status_code, 200)

    def test_02_subscription_and_csv_export(self):
        """Test creating subscription, notification trigger, and CSV export."""
        user = User.query.filter_by(email="tester@example.com").first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id

        # Create subscription
        today = date.today()
        res_create = self.client.post("/api/subscriptions", json={
            "name": "Netflix Premium",
            "amount": "649.00",
            "currency": "INR",
            "billing_interval": "monthly",
            "start_date": today.isoformat(),
            "next_billing_date": (today + timedelta(days=7)).isoformat()
        })
        self.assertEqual(res_create.status_code, 201)

        # Test CSV export
        res_csv = self.client.get("/api/subscriptions/export/csv")
        self.assertEqual(res_csv.status_code, 200)
        self.assertEqual(res_csv.mimetype, "text/csv")
        csv_text = res_csv.get_data(as_text=True)
        self.assertIn("Netflix Premium", csv_text)
        self.assertIn("649.00", csv_text)
        self.assertIn("Subscription Name,Provider,Category", csv_text)

    def test_03_notifications_and_reminders(self):
        """Test reminder generation, listing, marking read, and deleting."""
        user = User.query.filter_by(email="tester@example.com").first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id

        # Trigger renewal reminder evaluation
        res_check = self.client.post("/api/notifications/check-reminders")
        self.assertEqual(res_check.status_code, 200)

        # List notifications
        res_list = self.client.get("/api/notifications")
        self.assertEqual(res_list.status_code, 200)
        notifs_data = res_list.get_json()
        self.assertGreater(len(notifs_data["notifications"]), 0)

        # Mark first as read
        notif_id = notifs_data["notifications"][0]["id"]
        res_read = self.client.put(f"/api/notifications/{notif_id}/read")
        self.assertEqual(res_read.status_code, 200)

        # Mark all read
        res_all_read = self.client.put("/api/notifications/read-all")
        self.assertEqual(res_all_read.status_code, 200)
        self.assertEqual(res_all_read.get_json()["unread_count"], 0)

    def test_04_financial_report(self):
        """Test comprehensive financial report payload."""
        user = User.query.filter_by(email="tester@example.com").first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id

        res_rep = self.client.get("/api/analytics/report")
        self.assertEqual(res_rep.status_code, 200)
        report = res_rep.get_json()
        self.assertIn("monthly_recurring_expenditure", report)
        self.assertIn("yearly_projected_expenditure", report)
        self.assertIn("category_breakdown", report)
        self.assertIn("subscriptions", report)
        self.assertEqual(report["active_subscriptions"], 1)

    def test_05_intelligence_duplicates_and_budget(self):
        """Test duplicate detection and budget utilization insights."""
        user = User.query.filter_by(email="tester@example.com").first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id

        # Add duplicate Netflix subscription
        today = date.today()
        self.client.post("/api/subscriptions", json={
            "name": "Netflix Standard",
            "amount": "499.00",
            "currency": "INR",
            "billing_interval": "monthly",
            "start_date": today.isoformat()
        })

        # Set user budget to 1000
        user.profile.monthly_budget = Decimal("1000.00")
        db.session.commit()

        res_intel = self.client.get("/api/intelligence/recommendations")
        self.assertEqual(res_intel.status_code, 200)
        intel = res_intel.get_json()

        # Should detect Netflix duplicate
        self.assertGreater(intel["duplicate_count"], 0)
        self.assertIsNotNone(intel["budget_insights"])
        self.assertEqual(intel["budget_insights"]["budget"], 1000.00)

    def test_06_gmail_suggestions_and_approval(self):
        """Test Gmail suggestions discovery and conversion to active subscription."""
        user = User.query.filter_by(email="tester@example.com").first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id

        # Check status
        res_status = self.client.get("/api/gmail/status")
        self.assertEqual(res_status.status_code, 200)

        # Sync receipts (built-in discovery pattern)
        res_sync = self.client.post("/api/gmail/sync")
        self.assertEqual(res_sync.status_code, 200)

        # List suggestions
        res_sug = self.client.get("/api/gmail/suggestions")
        self.assertEqual(res_sug.status_code, 200)
        sugs = res_sug.get_json()["suggestions"]
        self.assertGreater(len(sugs), 0)

        # Approve Spotify suggestion
        spotify_sug = next((s for s in sugs if "Spotify" in s["detected_provider"]), sugs[0])
        res_app = self.client.post(f"/api/gmail/suggestions/{spotify_sug['id']}/approve")
        self.assertEqual(res_app.status_code, 200)

        # Verify Spotify is now a real active subscription
        spotify_sub = Subscription.query.filter_by(
            owner_user_id=user.id,
            custom_name=spotify_sug["detected_provider"]
        ).first()
        self.assertIsNotNone(spotify_sub)
        self.assertEqual(spotify_sub.source, "gmail_sync")

    def test_07_organizations_and_teams(self):
        """Test Organization creation, invitations, and team management."""
        user = User.query.filter_by(email="tester@example.com").first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id

        # 1. Create Organization
        res_org = self.client.post("/api/organizations", json={
            "name": "Acme Innovations",
            "legal_name": "Acme Innovations Inc."
        })
        self.assertEqual(res_org.status_code, 201)
        org_id = res_org.get_json()["organization"]["id"]

        # 2. Invite a member
        res_inv = self.client.post(f"/api/organizations/{org_id}/invitations", json={
            "email": "colleague@acme.com",
            "role": "office_manager"
        })
        self.assertEqual(res_inv.status_code, 201)

        # 3. Create Team
        res_team = self.client.post(f"/api/organizations/{org_id}/teams", json={
            "name": "Design & Engineering",
            "description": "Product engineering subscriptions"
        })
        self.assertEqual(res_team.status_code, 201)

        # 4. Check audit logs
        res_audit = self.client.get(f"/api/organizations/{org_id}/audit-logs")
        self.assertEqual(res_audit.status_code, 200)
        logs = res_audit.get_json()["audit_logs"]
        self.assertGreater(len(logs), 0)


if __name__ == "__main__":
    unittest.main()
