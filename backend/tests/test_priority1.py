import json
import os
import sys
from decimal import Decimal

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app, db
from app.users.models import User
from app.subscriptions.models import Subscription, SubscriptionCategory, SubscriptionProvider

app = create_app()
app.config["TESTING"] = True

def run_tests():
    print("=" * 60)
    print("RUNNING PRIORITY 1 VALIDATION TESTS")
    print("=" * 60)

    client1 = app.test_client()
    client2 = app.test_client()

    with app.app_context():
        # Clean up any previous test accounts
        test_emails = ["priority1_user1@example.com", "priority1_user2@example.com"]
        for email in test_emails:
            existing = User.query.filter_by(email=email).first()
            if existing:
                Subscription.query.filter_by(owner_user_id=existing.id).delete()
                db.session.delete(existing)
        db.session.commit()

    # 1. Register User 1
    resp1 = client1.post("/api/auth/register", json={
        "full_name": "Priority One User",
        "email": "priority1_user1@example.com",
        "password": "Password1234Secure!"
    })
    assert resp1.status_code == 201, f"User 1 register failed: {resp1.get_json()}"
    user1_data = resp1.get_json()["user"]
    print(" [OK] User 1 Registered successfully:", user1_data["email"])

    # 2. Register User 2
    resp2 = client2.post("/api/auth/register", json={
        "full_name": "Priority Two User",
        "email": "priority1_user2@example.com",
        "password": "Password1234Secure!"
    })
    assert resp2.status_code == 201, f"User 2 register failed: {resp2.get_json()}"
    user2_data = resp2.get_json()["user"]
    print(" [OK] User 2 Registered successfully:", user2_data["email"])

    # 3. Create subscriptions for User 1
    sub1_payload = {
        "name": "Netflix Premium",
        "amount": 649.00,
        "currency": "INR",
        "billing_interval": "monthly",
        "category_name": "Streaming & Entertainment",
        "start_date": "2026-01-15",
        "status": "active",
        "usage_score": 75,
        "notes": "Family plan 4K"
    }
    create_resp1 = client1.post("/api/subscriptions", json=sub1_payload)
    assert create_resp1.status_code == 201, f"Create sub1 failed: {create_resp1.get_json()}"
    sub1 = create_resp1.get_json()["subscription"]
    print(f" [OK] User 1 created subscription: {sub1['name']} (ID: {sub1['id']}, Monthly: {sub1['monthly_cost']})")

    sub2_payload = {
        "name": "GitHub Copilot",
        "amount": 100.00,
        "currency": "USD",
        "billing_interval": "yearly",
        "category_name": "Developer & Cloud",
        "start_date": "2026-02-01",
        "status": "active",
        "usage_score": 90
    }
    create_resp2 = client1.post("/api/subscriptions", json=sub2_payload)
    assert create_resp2.status_code == 201, f"Create sub2 failed: {create_resp2.get_json()}"
    sub2 = create_resp2.get_json()["subscription"]
    print(f" [OK] User 1 created subscription: {sub2['name']} (ID: {sub2['id']}, Monthly: {sub2['monthly_cost']})")

    # 4. List User 1's subscriptions
    list1 = client1.get("/api/subscriptions")
    assert list1.status_code == 200
    subs_u1 = list1.get_json()["subscriptions"]
    assert len(subs_u1) == 2, f"Expected 2 subscriptions for User 1, got {len(subs_u1)}"
    print(f" [OK] User 1 has {len(subs_u1)} subscriptions listed")

    # 5. TEST USER DATA ISOLATION: User 2 listings must be empty
    list2 = client2.get("/api/subscriptions")
    assert list2.status_code == 200
    subs_u2 = list2.get_json()["subscriptions"]
    assert len(subs_u2) == 0, f"DATA LEAK DETECTED: User 2 sees {len(subs_u2)} subscriptions!"
    print(" [OK] User 2 sees 0 subscriptions (Data isolation verified)")

    # 6. TEST USER DATA ISOLATION: User 2 cannot GET, UPDATE, or DELETE User 1's subscription
    hack_get = client2.get(f"/api/subscriptions/{sub1['id']}")
    assert hack_get.status_code == 404, f"Security issue: User 2 could access User 1 sub: {hack_get.status_code}"
    print(" [OK] User 2 blocked from accessing User 1's subscription (404 Not Found)")

    hack_update = client2.put(f"/api/subscriptions/{sub1['id']}", json={"amount": 1.00})
    assert hack_update.status_code == 404, f"Security issue: User 2 could update User 1 sub: {hack_update.status_code}"
    print(" [OK] User 2 blocked from updating User 1's subscription (404 Not Found)")

    hack_delete = client2.delete(f"/api/subscriptions/{sub1['id']}")
    assert hack_delete.status_code == 404, f"Security issue: User 2 could delete User 1 sub: {hack_delete.status_code}"
    print(" [OK] User 2 blocked from deleting User 1's subscription (404 Not Found)")

    # 7. User 1 updates subscription
    update_resp = client1.put(f"/api/subscriptions/{sub1['id']}", json={
        "amount": 799.00,
        "name": "Netflix 4K Ultra",
        "status": "active"
    })
    assert update_resp.status_code == 200
    updated_sub = update_resp.get_json()["subscription"]
    assert updated_sub["amount"] == 799.00
    assert updated_sub["name"] == "Netflix 4K Ultra"
    print(" [OK] User 1 updated subscription successfully (amount changed to 799.00)")

    # 8. User 1 usage check-in
    checkin_resp = client1.post(f"/api/subscriptions/{sub1['id']}/check-in", json={
        "usage_score": 40,
        "notes": "Watched less this week",
        "feedback_action": "downgrade"
    })
    assert checkin_resp.status_code == 200
    assert checkin_resp.get_json()["subscription"]["usage_score"] == 40
    print(" [OK] User 1 recorded usage check-in (score: 40)")

    # 9. User 1 deletes sub2
    del_resp = client1.delete(f"/api/subscriptions/{sub2['id']}")
    assert del_resp.status_code == 200
    print(" [OK] User 1 deleted sub2 successfully")

    # Verify only 1 subscription left for User 1
    list1_after = client1.get("/api/subscriptions")
    assert len(list1_after.get_json()["subscriptions"]) == 1
    print(" [OK] User 1 now has exactly 1 subscription left")

    # 10. Test logout
    logout_resp = client1.post("/api/auth/logout")
    assert logout_resp.status_code == 200
    me_resp = client1.get("/api/auth/me")
    assert me_resp.status_code == 401
    print(" [OK] User 1 logged out successfully (session invalidated)")

    print("=" * 60)
    print("ALL PRIORITY 1 BACKEND CHECKS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
