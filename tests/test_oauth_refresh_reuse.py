"""Regression tests for Google OAuth callback refresh-token handling."""
from __future__ import annotations

import importlib
import importlib.util
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


HAS_FLASK_AND_CRYPTO = importlib.util.find_spec("flask") is not None and importlib.util.find_spec("cryptography") is not None


@unittest.skipUnless(HAS_FLASK_AND_CRYPTO, "requires stitch-bridge dependencies")
class OAuthRefreshReuseTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.env = patch.dict(
            os.environ,
            {
                "STITCH_AUTH_DB": str(Path(self.tmp.name) / "stitch_auth.db"),
                "STITCH_GOOGLE_FERNET_KEY": "test-key-for-oauth-refresh-reuse",
            },
        )
        self.env.start()

        import stitch_auth.store as store
        import stitch_auth.flask_routes as flask_routes

        self.store = importlib.reload(store)
        self.flask_routes = importlib.reload(flask_routes)

    def tearDown(self) -> None:
        conn = getattr(self.store, "_conn", None)
        if conn is not None:
            conn.close()
            self.store._conn = None
        self.env.stop()
        self.tmp.cleanup()

    def _app(self):
        from flask import Flask

        app = Flask(__name__)
        self.flask_routes.register_stitch_auth_routes(app)
        return app

    def test_existing_account_reuses_stored_refresh_when_google_omits_refresh_token(self) -> None:
        self.store.google_account_upsert("user@example.com", "google-sub", "stored-refresh-token", "old-pic")
        self.store.oauth_pending_save("state-1", "verifier", "http://localhost:1420", None)

        app = self._app()
        with (
            patch.object(self.flask_routes.google_client, "exchange_code", return_value={"access_token": "access-token"}),
            patch.object(
                self.flask_routes.google_client,
                "userinfo_from_token_response",
                return_value={"email": "user@example.com", "sub": "google-sub", "picture": "new-pic"},
            ),
        ):
            response = app.test_client().get("/api/auth/google/callback?state=state-1&code=code")

        self.assertEqual(response.status_code, 200)
        body = response.get_data(as_text=True)
        self.assertIn("stitch_oauth_session", body)
        self.assertNotIn("no_refresh_token", body)

        row = self.store.google_account_by_email("user@example.com")
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(self.store.decrypt_refresh(row), "stored-refresh-token")

    def test_new_account_without_refresh_token_still_fails(self) -> None:
        self.store.oauth_pending_save("state-2", "verifier", "http://localhost:1420", None)

        app = self._app()
        with (
            patch.object(self.flask_routes.google_client, "exchange_code", return_value={"access_token": "access-token"}),
            patch.object(
                self.flask_routes.google_client,
                "userinfo_from_token_response",
                return_value={"email": "new@example.com", "sub": "new-sub"},
            ),
        ):
            response = app.test_client().get("/api/auth/google/callback?state=state-2&code=code")

        self.assertEqual(response.status_code, 200)
        body = response.get_data(as_text=True)
        self.assertIn("no_refresh_token", body)
        self.assertNotIn("stitch_oauth_session", body)


if __name__ == "__main__":
    unittest.main()
