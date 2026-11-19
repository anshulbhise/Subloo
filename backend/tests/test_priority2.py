import json
import os
import sys
from datetime import date, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app, db
from app.users.models import User
from app.subscriptions.models import Subscription

app = create_app()
app.config["TESTING"] = True

def run_tests():
    print("=" * 60)
    print("RUNNING PRIORITY 2 DASHBOARD ANALYTICS TESTS")
    print("=" * 60)

    client = app.test_client()
    user_email = "priority2_user@example.com"

    with app.app_context():
        existing = User.query.filter_by(email=user_email).first()
        if existing:
            Subscription.query.filter_by(owner_user_id=existing.id).delete()
            db.session.delete(existing)
        db.session.commit()

    # Register user
    reg = client.post("/api/auth/register", json={
        "full_name": "Priority Two Analyst",
        "email": user_email,
        "password": "Password1234Secure!"
    })
    assert reg.status_code == 201

    # 1. Empty Dashboard Summary Check
    empty_summary = client.get("/api/analytics/summary").get_json()
    assert empty_summary["total_subscriptions"] == 0
    assert empty_summary["active_subscriptions"] == 0
    assert empty_summary["monthly_recurring_expenditure"] == 0.0
    assert empty_summary["yearly_estimated_expenditure"] == 0.0
    assert len(empty_summary["upcoming_renewals"]) == 0
    assert len(empty_summary["category_breakdown"]) == 0
    print(" [OK] Empty dashboard statistics verified (zeros across all metrics)")

    today = date.today()
    # 2. Add 3 subscriptions with real data
    # Sub 1: Netflix (monthly 649 INR)
    client.post("/api/subscriptions", json={
        "name": "Netflix",
        "amount": 649.00,
        "currency": "INR",
        "billing_interval": "monthly",
        "category_name": "Streaming & Entertainment",
        "start_date": today.isoformat(),
        "next_billing_date": (today + timedelta(days=5)).isoformat(),
        "status": "active",
        "usage_score": 80
    })

    # Sub 2: Amazon Prime (yearly 1499 INR -> monthly 124.92)
    client.post("/api/subscriptions", json={
        "name": "Amazon Prime",
        "amount": 1499.00,
        "currency": "INR",
        "billing_interval": "yearly",
        "category_name": "Streaming & Entertainment",
        "start_date": today.isoformat(),
        "next_billing_date": (today + timedelta(days=20)).isoformat(),
        "status": "active",
        "usage_score": 60
    })

    # Sub 3: ChatGPT Plus (monthly 1999 INR, AI Tools)
    client.post("/api/subscriptions", json={
        "name": "ChatGPT Plus",
        "amount": 1999.00,
        "currency": "INR",
        "billing_interval": "monthly",
        "category_name": "AI & Machine Learning",
        "start_date": today.isoformat(),
        "next_billing_date": (today + timedelta(days=12)).isoformat(),
        "status": "active",
        "usage_score": 95
    })

    # 3. Check Real Database Analytics
    summary = client.get("/api/analytics/summary").get_json()

    assert summary["total_subscriptions"] == 3
    assert summary["active_subscriptions"] == 3

    # Expected monthly = 649 + (1499 / 12 = 124.92) + 1999 = 2772.92
    expected_monthly = round(649.0 + (1499.0 / 12.0) + 1999.0, 2)
    assert abs(summary["monthly_recurring_expenditure"] - expected_monthly) < 0.1, \
        f"Expected {expected_monthly}, got {summary['monthly_recurring_expenditure']}"
    print(f" [OK] Monthly Recurring Spend calculated accurately: ₹{summary['monthly_recurring_expenditure']}")

    # Expected yearly = monthly * 12
    expected_yearly = round(summary["monthly_recurring_expenditure"] * 12, 2)
    assert abs(summary["yearly_estimated_expenditure"] - expected_yearly) < 0.2
    print(f" [OK] Yearly Estimated Spend calculated accurately: ₹{summary['yearly_estimated_expenditure']}")

    # 4. Check Upcoming Renewals Ordering
    renewals = summary["upcoming_renewals"]
    assert len(renewals) == 3
    assert renewals[0]["name"] == "Netflix" and renewals[0]["days_until"] == 5
    assert renewals[1]["name"] == "ChatGPT Plus" and renewals[1]["days_until"] == 12
    assert renewals[2]["name"] == "Amazon Prime" and renewals[2]["days_until"] == 20
    print(" [OK] Upcoming Renewals properly sorted chronologically (5d, 12d, 20d)")

    # 5. Check Category Breakdown
    cats = {c["category"]: c for c in summary["category_breakdown"]}
    assert "Streaming & Entertainment" in cats
    assert "AI & Machine Learning" in cats
    print(f" [OK] Category Spending breakdown verified: {summary['category_breakdown']}")

    print("=" * 60)
    print("ALL PRIORITY 2 DASHBOARD TESTS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
