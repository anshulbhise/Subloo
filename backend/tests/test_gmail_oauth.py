import json
import os
import sys
import time
import unittest
import urllib.parse
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from werkzeug.security import generate_password_hash

# Ensure backend root is on path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)

from app import create_app
from app.database.extensions import db
from app.users.models import User
from app.gmail.models import GmailConnection, GmailDetectedSubscription
from app.gmail.security import (
    decrypt_credentials,
    encrypt_credentials,
    generate_oauth_state,
    refresh_google_access_token,
    verify_oauth_state,
)
from app.notifications.models import Notification
from app.common.auth import _request_records


class GmailOAuthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ["DATABASE_URL"] = "sqlite:///:memory:"
        os.environ["SECRET_KEY"] = "test-secret-key-12345"
        os.environ["TOKEN_ENCRYPTION_KEY"] = "dGVzdC1lbmNyeXB0aW9uLWtleS1mb3ItZmVybmV0LTMyYg=="  # Valid base64 32-byte key
        os.environ["GOOGLE_CLIENT_ID"] = "mock-google-client-id.apps.googleusercontent.com"
        os.environ["GOOGLE_CLIENT_SECRET"] = "mock-google-client-secret"
        os.environ["GOOGLE_REDIRECT_URI"] = "https://subloo-backend.onrender.com/api/gmail/oauth/callback"
        os.environ["FRONTEND_URL"] = "https://subloo-frontend.onrender.com"
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
        _request_records.clear()

    def tearDown(self):
        self.app_ctx.pop()

    def _create_and_login_user(self, email="gmailuser@example.com", name="Gmail User"):
        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(
                full_name=name,
                email=email,
                password_hash=generate_password_hash("SecurePassword123!")
            )
            db.session.add(user)
            db.session.commit()

        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id
            sess["user_email"] = user.email

        return user

    # -------------------------------------------------------------------------
    # 1. Auth URL Generation & State Security
    # -------------------------------------------------------------------------
    def test_01_auth_url_requires_login(self):
        """Unauthenticated call to /api/gmail/auth-url must return 401."""
        with self.client.session_transaction() as sess:
            sess.clear()
        res = self.client.get("/api/gmail/auth-url")
        self.assertEqual(res.status_code, 401)

    def test_02_auth_url_generation_success(self):
        """Logged-in user generates Google authorization URL with CSRF state encoding user_id and origin."""
        user = self._create_and_login_user("oauth_user1@example.com")
        res = self.client.get("/api/gmail/auth-url?origin=https://subloo-frontend.onrender.com")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertIn("auth_url", data)
        self.assertIn("state", data)
        self.assertIn("accounts.google.com", data["auth_url"])
        self.assertIn(urllib.parse.quote(data["state"]), data["auth_url"])

        # Verify state decrypts and contains user_id and origin
        verified_uid, verified_origin = verify_oauth_state(data["state"])
        self.assertEqual(verified_uid, str(user.id))
        self.assertEqual(verified_origin, "https://subloo-frontend.onrender.com")

    def test_03_auth_url_when_unconfigured(self):
        """Returns helpful unconfigured status when GOOGLE_CLIENT_ID is not set."""
        self._create_and_login_user("oauth_user1@example.com")
        with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": ""}):
            res = self.client.get("/api/gmail/auth-url")
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertEqual(data["status"], "unconfigured")
            self.assertIsNone(data["auth_url"])

    # -------------------------------------------------------------------------
    # 2. Callback Security & Error Handling
    # -------------------------------------------------------------------------
    def test_04_callback_google_error(self):
        """When user cancels on Google consent screen, redirect to frontend with error."""
        user = self._create_and_login_user("oauth_user2@example.com")
        state = generate_oauth_state(user.id, "https://subloo-frontend.onrender.com")

        res = self.client.get(f"/api/gmail/oauth/callback?error=access_denied&error_description=User+cancelled&state={state}")
        self.assertEqual(res.status_code, 302)
        location = urllib.parse.unquote(res.location)
        self.assertIn("https://subloo-frontend.onrender.com", location)
        self.assertIn("status=error", location)
        self.assertIn("cancelled or denied", location)

    def test_05_callback_missing_code(self):
        """Callback without code returns error redirect."""
        user = self._create_and_login_user("oauth_user2@example.com")
        state = generate_oauth_state(user.id, "https://subloo-frontend.onrender.com")
        res = self.client.get(f"/api/gmail/oauth/callback?state={state}")
        self.assertEqual(res.status_code, 302)
        location = urllib.parse.unquote(res.location)
        self.assertIn("status=error", location)
        self.assertIn("Missing authorization code", location)

    def test_06_callback_invalid_or_missing_state(self):
        """Callback with tampered or invalid state prevents CSRF."""
        self._create_and_login_user("oauth_user2@example.com")

        res = self.client.get("/api/gmail/oauth/callback?code=mock_code&state=attacker_fake_token_123")
        self.assertEqual(res.status_code, 302)
        location = urllib.parse.unquote(res.location)
        self.assertIn("status=error", location)
        self.assertIn("Invalid or missing OAuth security state", location)

    def test_07_callback_expired_state(self):
        """Callback with state older than 10 minutes is rejected."""
        user = self._create_and_login_user("oauth_user2@example.com")

        # Manually create payload with ts 15 minutes ago
        expired_payload = {
            "uid": str(user.id),
            "ts": time.time() - 900,
            "origin": "https://subloo-frontend.onrender.com",
            "nonce": "old_nonce_123",
        }
        expired_state = encrypt_credentials(json.dumps(expired_payload))

        res = self.client.get(f"/api/gmail/oauth/callback?code=mock_code&state={expired_state}")
        self.assertEqual(res.status_code, 302)
        location = urllib.parse.unquote(res.location)
        self.assertIn("status=error", location)
        self.assertIn("Invalid or missing OAuth security state", location)

    # -------------------------------------------------------------------------
    # 3. Successful Token Exchange, Storage, and Identity Retrieval
    # -------------------------------------------------------------------------
    @patch("requests.get")
    @patch("requests.post")
    def test_08_successful_token_exchange_and_connection_creation(self, mock_post, mock_get):
        """Mock successful code exchange and profile retrieval; verify encrypted storage and notification."""
        user = self._create_and_login_user("oauth_success_user@example.com")
        state = generate_oauth_state(user.id, "https://subloo-frontend.onrender.com")

        # Mock Google Token endpoint response
        mock_token_resp = MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.json.return_value = {
            "access_token": "ya29.mock_access_token_12345",
            "refresh_token": "1//0mock_refresh_token_67890",
            "expires_in": 3600,
            "token_type": "Bearer",
            "scope": "https://www.googleapis.com/auth/gmail.readonly email profile"
        }
        mock_post.return_value = mock_token_resp

        # Mock Google userinfo endpoint response
        mock_userinfo_resp = MagicMock()
        mock_userinfo_resp.status_code = 200
        mock_userinfo_resp.json.return_value = {
            "email": "user.connected@gmail.com",
            "name": "Connected User"
        }
        mock_get.return_value = mock_userinfo_resp

        # Trigger callback
        res = self.client.get(f"/api/gmail/oauth/callback?code=valid_oauth_code_abc&state={state}")

        # Check redirect
        self.assertEqual(res.status_code, 302)
        location = urllib.parse.unquote(res.location)
        self.assertIn("https://subloo-frontend.onrender.com", location)
        self.assertIn("status=connected", location)
        self.assertIn("email=user.connected@gmail.com", location)

        # Verify GmailConnection in database
        conn = GmailConnection.query.filter_by(user_id=user.id).first()
        self.assertIsNotNone(conn)
        self.assertEqual(conn.gmail_address, "user.connected@gmail.com")
        self.assertEqual(conn.connection_status, "connected")

        # Verify credentials are encrypted, not stored in plaintext
        self.assertNotIn("ya29.mock_access_token_12345", conn.encrypted_credentials)
        self.assertNotIn("1//0mock_refresh_token_67890", conn.encrypted_credentials)

        # Verify credentials can be decrypted successfully
        decrypted_json = decrypt_credentials(conn.encrypted_credentials)
        creds = json.loads(decrypted_json)
        self.assertEqual(creds["access_token"], "ya29.mock_access_token_12345")
        self.assertEqual(creds["refresh_token"], "1//0mock_refresh_token_67890")

        # Verify system notification was dispatched
        notif = Notification.query.filter_by(user_id=user.id, title="Gmail Connected").first()
        self.assertIsNotNone(notif)
        self.assertIn("user.connected@gmail.com", notif.message)

    # -------------------------------------------------------------------------
    # 4. Refresh Token Preservation on Subsequent Consent
    # -------------------------------------------------------------------------
    @patch("requests.get")
    @patch("requests.post")
    def test_09_refresh_token_preserved_when_google_omits_it(self, mock_post, mock_get):
        """When an already connected user reconnects and Google omits refresh_token, preserve existing one."""
        user = self._create_and_login_user("oauth_preserve_user@example.com")

        # Create existing connection with a valid refresh_token
        initial_creds = {
            "access_token": "ya29.old_access_token",
            "refresh_token": "1//0original_precious_refresh_token",
            "expires_in": 3600,
            "token_type": "Bearer"
        }
        existing_conn = GmailConnection(
            user_id=user.id,
            gmail_address="user.preserve@gmail.com",
            encrypted_credentials=encrypt_credentials(json.dumps(initial_creds)),
            granted_scopes=["https://www.googleapis.com/auth/gmail.readonly"],
            connection_status="connected",
            created_at=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        db.session.add(existing_conn)
        db.session.commit()

        # Reconnection flow: Google sends ONLY new access_token, NO refresh_token
        state = generate_oauth_state(user.id, "https://subloo-frontend.onrender.com")

        mock_token_resp = MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.json.return_value = {
            "access_token": "ya29.brand_new_access_token",
            "expires_in": 3600,
            "token_type": "Bearer"
        }
        mock_post.return_value = mock_token_resp

        mock_userinfo_resp = MagicMock()
        mock_userinfo_resp.status_code = 200
        mock_userinfo_resp.json.return_value = {"email": "user.preserve@gmail.com"}
        mock_get.return_value = mock_userinfo_resp

        res = self.client.get(f"/api/gmail/oauth/callback?code=reauth_code_123&state={state}")
        self.assertEqual(res.status_code, 302)
        location = urllib.parse.unquote(res.location)
        self.assertIn("status=connected", location)

        # Inspect updated connection
        updated_conn = GmailConnection.query.filter_by(user_id=user.id).first()
        decrypted_json = decrypt_credentials(updated_conn.encrypted_credentials)
        updated_creds = json.loads(decrypted_json)

        # Must have updated access token AND preserved original refresh token
        self.assertEqual(updated_creds["access_token"], "ya29.brand_new_access_token")
        self.assertEqual(updated_creds["refresh_token"], "1//0original_precious_refresh_token")

    # -------------------------------------------------------------------------
    # 5. User Isolation & Disconnect
    # -------------------------------------------------------------------------
    def test_10_user_data_isolation(self):
        """User B cannot see or manipulate User A's Gmail connection."""
        user_a = self._create_and_login_user("usera@example.com", "User A")
        user_b = self._create_and_login_user("userb@example.com", "User B")

        # Establish connection for User A
        conn_a = GmailConnection(
            user_id=user_a.id,
            gmail_address="usera@gmail.com",
            encrypted_credentials=encrypt_credentials(json.dumps({"access_token": "token_a"})),
            granted_scopes=["https://www.googleapis.com/auth/gmail.readonly"],
            connection_status="connected",
            created_at=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        db.session.add(conn_a)
        db.session.commit()

        # Switch to User B
        with self.client.session_transaction() as sess:
            sess["user_id"] = user_b.id
            sess["user_email"] = user_b.email

        # Check User B status: must show disconnected
        res = self.client.get("/api/gmail/status")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertFalse(data["is_connected"])
        self.assertIsNone(data["gmail_address"])

        # User B calling disconnect does not affect User A
        disc_res = self.client.post("/api/gmail/disconnect")
        self.assertEqual(disc_res.status_code, 200)

        # User A's connection must still be present and intact
        conn_a_check = GmailConnection.query.filter_by(user_id=user_a.id).first()
        self.assertIsNotNone(conn_a_check)
        self.assertEqual(conn_a_check.gmail_address, "usera@gmail.com")

    # -------------------------------------------------------------------------
    # 6. Proactive Refresh Token Helper
    # -------------------------------------------------------------------------
    @patch("requests.post")
    def test_11_refresh_google_access_token(self, mock_post):
        """Test proactive token refresh when access token is expired."""
        user = self._create_and_login_user("refresh_test_user@example.com")

        # Expired token (expiry 10 minutes in the past)
        conn = GmailConnection(
            user_id=user.id,
            gmail_address="user.refresh@gmail.com",
            encrypted_credentials=encrypt_credentials(json.dumps({
                "access_token": "expired_access_token",
                "refresh_token": "valid_refresh_token_xyz"
            })),
            granted_scopes=["https://www.googleapis.com/auth/gmail.readonly"],
            token_expiry=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=10),
            connection_status="connected",
            created_at=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        db.session.add(conn)
        db.session.commit()

        # Mock refresh response from Google
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "access_token": "freshly_refreshed_access_token",
            "expires_in": 3600
        }
        mock_post.return_value = mock_resp

        # Call helper
        fresh_token = refresh_google_access_token(conn)
        self.assertEqual(fresh_token, "freshly_refreshed_access_token")

        # Verify db record updated
        updated_conn = GmailConnection.query.filter_by(user_id=user.id).first()
        creds = json.loads(decrypt_credentials(updated_conn.encrypted_credentials))
        self.assertEqual(creds["access_token"], "freshly_refreshed_access_token")
        self.assertEqual(creds["refresh_token"], "valid_refresh_token_xyz")
        self.assertGreater(updated_conn.token_expiry, datetime.now(timezone.utc).replace(tzinfo=None))

    # -------------------------------------------------------------------------
    # 7. Immunity from Cross-Site Cookie Blocking (Brave Shields / Safari ITP)
    # -------------------------------------------------------------------------
    @patch("requests.get")
    @patch("requests.post")
    def test_12_callback_succeeds_without_session_cookie(self, mock_post, mock_get):
        """When browser strips session cookie on cross-site redirect, cryptographic state token preserves authentication."""
        user = self._create_and_login_user("oauth_brave_shield_user@example.com")
        state = generate_oauth_state(user.id, "https://subloo-frontend.onrender.com")

        # SIMULATE BRAVE SHIELDS / CROSS-ORIGIN COOKIE STRIPPING:
        with self.client.session_transaction() as sess:
            sess.clear()

        # Mock responses
        mock_token_resp = MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.json.return_value = {
            "access_token": "ya29.brave_access_token",
            "expires_in": 3600,
            "token_type": "Bearer"
        }
        mock_post.return_value = mock_token_resp

        mock_userinfo_resp = MagicMock()
        mock_userinfo_resp.status_code = 200
        mock_userinfo_resp.json.return_value = {"email": "brave.user@gmail.com"}
        mock_get.return_value = mock_userinfo_resp

        # Callback must succeed despite session cookie being absent
        res = self.client.get(f"/api/gmail/oauth/callback?code=mock_code&state={state}")
        self.assertEqual(res.status_code, 302)
        location = urllib.parse.unquote(res.location)
        self.assertIn("status=connected", location)
        self.assertIn("email=brave.user@gmail.com", location)

        # Verify GmailConnection was saved to the correct user
        conn = GmailConnection.query.filter_by(user_id=user.id).first()
        self.assertIsNotNone(conn)
        self.assertEqual(conn.gmail_address, "brave.user@gmail.com")

    def test_13_replay_attack_prevention(self):
        """Re-using the same state token is rejected as replay."""
        user = self._create_and_login_user("oauth_replay_user@example.com")
        state = generate_oauth_state(user.id, "https://subloo-frontend.onrender.com")

        # First verification succeeds
        uid, origin = verify_oauth_state(state)
        self.assertEqual(uid, str(user.id))

        # Second verification with exact same state token must fail (replay blocked)
        uid_second, origin_second = verify_oauth_state(state)
        self.assertIsNone(uid_second)
        self.assertIsNone(origin_second)


if __name__ == "__main__":
    unittest.main()
