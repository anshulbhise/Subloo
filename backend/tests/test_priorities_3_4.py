import json
import os
import sys
from datetime import date, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app, db
from app.users.models import User
from app.subscriptions.models import Subscription
from app.intelligence.models import SubscriptionAssessment

app = create_app()
app.config["TESTING"] = True

def run_tests():
    print("=" * 60)
    print("RUNNING PRIORITIES 3 & 4 (RENEWALS, ANALYTICS & AI INSIGHTS) TESTS")
    print("=" * 60)

    client1 = app.test_client()
    client2 = app.test_client()
    user1_email = "ai_analyst1@example.com"
    user2_email = "ai_analyst2@example.com"

    with app.app_context():
        for email in [user1_email, user2_email]:
            existing = User.query.filter_by(email=email).first()
            if existing:
                Subscription.query.filter_by(owner_user_id=existing.id).delete()
                db.session.delete(existing)
        db.session.commit()

    # Register User 1 and User 2
    client1.post("/api/auth/register", json={
        "full_name": "AI Test User 1",
        "email": user1_email,
        "password": "Password1234Secure!"
    })

    client2.post("/api/auth/register", json={
        "full_name": "AI Test User 2",
        "email": user2_email,
        "password": "Password1234Secure!"
    })

    today = date.today()

    # User 1 creates 3 subscriptions:
    # 1. Netflix (High Waste: ₹649/mo, usage: 15%, renews in 4 days)
    res1 = client1.post("/api/subscriptions", json={
        "name": "Netflix Premium",
        "amount": 649.00,
        "currency": "INR",
        "billing_interval": "monthly",
        "category_name": "Streaming & Entertainment",
        "start_date": today.isoformat(),
        "next_billing_date": (today + timedelta(days=4)).isoformat(),
        "status": "active",
        "usage_score": 15
    })
    sub_netflix = res1.get_json()["subscription"]

    # 2. Adobe Creative Cloud (Medium Waste: ₹4200/mo, usage: 45%, renews in 12 days)
    res2 = client1.post("/api/subscriptions", json={
        "name": "Adobe Creative Cloud",
        "amount": 4200.00,
        "currency": "INR",
        "billing_interval": "monthly",
        "category_name": "Software & SaaS",
        "start_date": today.isoformat(),
        "next_billing_date": (today + timedelta(days=12)).isoformat(),
        "status": "active",
        "usage_score": 45
    })
    sub_adobe = res2.get_json()["subscription"]

    # 3. GitHub Copilot (Low Waste / Healthy: ₹830/mo, usage: 95%, renews in 28 days)
    res3 = client1.post("/api/subscriptions", json={
        "name": "GitHub Copilot",
        "amount": 830.00,
        "currency": "INR",
        "billing_interval": "monthly",
        "category_name": "Developer & Cloud",
        "start_date": today.isoformat(),
        "next_billing_date": (today + timedelta(days=28)).isoformat(),
        "status": "active",
        "usage_score": 95
    })
    sub_github = res3.get_json()["subscription"]

    print(" [OK] 3 Subscriptions created for User 1 with real usage data")

    # -------------------------------------------------------------
    # PRIORITY 3 TEST: Renewals Calendar Endpoint
    # -------------------------------------------------------------
    renewals_res = client1.get("/api/analytics/renewals")
    assert renewals_res.status_code == 200
    renewals_data = renewals_res.get_json()

    assert renewals_data["total_renewals_tracked"] == 3
    # Netflix (4 days) must be in due_soon
    assert len(renewals_data["due_soon"]) == 1
    assert renewals_data["due_soon"][0]["name"] == "Netflix Premium"
    # Adobe (12 days) must be in next_two_weeks
    assert len(renewals_data["next_two_weeks"]) == 1
    assert renewals_data["next_two_weeks"][0]["name"] == "Adobe Creative Cloud"
    # GitHub (28 days) must be in this_month
    assert len(renewals_data["this_month"]) == 1
    assert renewals_data["this_month"][0]["name"] == "GitHub Copilot"
    print(" [OK] Renewals Calendar accurately categorized buckets (due_soon: 1, next_two_weeks: 1, this_month: 1)")

    # -------------------------------------------------------------
    # PRIORITY 4 TEST: AI Waste Intelligence & Recommendations
    # -------------------------------------------------------------
    ai_res = client1.get("/api/intelligence/recommendations")
    assert ai_res.status_code == 200
    ai_data = ai_res.get_json()

    assert ai_data["waste_count"] == 2  # Netflix and Adobe flagged
    assert ai_data["total_potential_monthly_savings"] > 0
    assert ai_data["total_potential_yearly_savings"] > 0

    recs = {r["subscription_name"]: r for r in ai_data["recommendations"]}

    # Verify Netflix is High Risk, Cancel
    assert "Netflix Premium" in recs
    netflix_rec = recs["Netflix Premium"]
    assert netflix_rec["risk_level"] == "high"
    assert netflix_rec["predicted_action"] == "cancel"
    assert netflix_rec["waste_score"] == 85  # 100 - 15
    assert netflix_rec["estimated_monthly_savings"] == 649.00
    assert netflix_rec["estimated_yearly_savings"] == 649.00 * 12
    assert "underutilized" in netflix_rec["ai_explanation"].lower() or "cancel" in netflix_rec["ai_explanation"].lower()
    print(" [OK] Netflix accurately flagged as High Risk Waste (Cancel, ₹7,788/yr savings)")

    # Verify Adobe is Medium Risk, Downgrade
    assert "Adobe Creative Cloud" in recs
    adobe_rec = recs["Adobe Creative Cloud"]
    assert adobe_rec["risk_level"] == "medium"
    assert adobe_rec["predicted_action"] == "downgrade"
    assert adobe_rec["alternative_provider"] is not None
    print(f" [OK] Adobe flagged as Medium Risk Downgrade with alternative: {adobe_rec['alternative_provider']}")

    # Verify GitHub is Low Risk, Keep
    assert "GitHub Copilot" in recs
    github_rec = recs["GitHub Copilot"]
    assert github_rec["risk_level"] == "low"
    assert github_rec["predicted_action"] == "keep"
    print(" [OK] GitHub Copilot verified as Low Risk / Healthy Value (Keep)")

    # -------------------------------------------------------------
    # USER ISOLATION TEST FOR INTELLIGENCE
    # -------------------------------------------------------------
    ai_res2 = client2.get("/api/intelligence/recommendations")
    assert ai_res2.status_code == 200
    assert len(ai_res2.get_json()["recommendations"]) == 0
    print(" [OK] User 2 sees 0 recommendations (User data isolation verified for AI)")

    print("=" * 60)
    print("ALL PRIORITIES 3 & 4 TESTS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
