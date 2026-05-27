"""Regression tests for Stitch Google OAuth session linking."""

from __future__ import annotations

import importlib
import os
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

try:
    from flask import Flask
except ImportError:  # pragma: no cover - exercised in the default MCP-only install profile
    Flask = None


@unittest.skipIf(Flask is None, "Flask is only installed with the stitch-bridge extra")
class OAuthLinkingTests(unittest.TestCase):
    def _load_auth_modules(self, tmp: str):
        env = {
            "STITCH_AUTH_DB": str(Path(tmp) / "stitch_auth.db"),
            "STITCH_GOOGLE_FERNET_KEY": "test-fernet-key",
        }
        patcher = patch.dict(os.environ, env)
        patcher.start()
        self.addCleanup(patcher.stop)

        import stitch_auth.store as store
        import stitch_auth.flask_routes as routes

        store = importlib.reload(store)
        routes = importlib.reload(routes)
        return store, routes

    def _callback_client(self, routes):
        app = Flask(__name__)
        routes.register_stitch_auth_routes(app)
        return app.test_client()

    def _extract_session_id(self, html: str) -> str:
        match = re.search(r'"session_id":\s*"([0-9a-f]+)"', html)
        self.assertIsNotNone(match)
        assert match is not None
        return match.group(1)

    def test_callback_does_not_graft_new_google_account_into_existing_session(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store, routes = self._load_auth_modules(tmp)
            attacker_aid = store.google_account_upsert("attacker@example.com", "attacker-sub", "attacker-refresh", None)
            attacker_sid = store.session_create([attacker_aid], "attacker@example.com")
            store.oauth_pending_save("state", "verifier", "http://localhost:1420", attacker_sid)

            client = self._callback_client(routes)
            with (
                patch.object(
                    routes.google_client,
                    "exchange_code",
                    return_value={"access_token": "access", "refresh_token": "victim-refresh"},
                ),
                patch.object(
                    routes.google_client,
                    "userinfo_from_token_response",
                    return_value={"email": "victim@example.com", "sub": "victim-sub", "picture": None},
                ),
            ):
                response = client.get("/api/auth/google/callback?state=state&code=code")

            self.assertEqual(response.status_code, 200)
            returned_sid = self._extract_session_id(response.get_data(as_text=True))
            self.assertNotEqual(returned_sid, attacker_sid)

            attacker_session = store.session_load(attacker_sid)
            self.assertIsNotNone(attacker_session)
            assert attacker_session is not None
            self.assertEqual(attacker_session["account_ids"], [attacker_aid])
            self.assertEqual(attacker_session["active_email"], "attacker@example.com")

            victim_account = store.google_account_by_email("victim@example.com")
            self.assertIsNotNone(victim_account)
            victim_session = store.session_load(returned_sid)
            self.assertIsNotNone(victim_session)
            assert victim_session is not None
            self.assertEqual(victim_session["account_ids"], [victim_account["id"]])

    def test_callback_reuses_session_for_already_linked_account(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store, routes = self._load_auth_modules(tmp)
            aid = store.google_account_upsert("owner@example.com", "owner-sub", "old-refresh", None)
            sid = store.session_create([aid], "owner@example.com")
            store.oauth_pending_save("state", "verifier", "http://localhost:1420", sid)

            client = self._callback_client(routes)
            with (
                patch.object(
                    routes.google_client,
                    "exchange_code",
                    return_value={"access_token": "access", "refresh_token": "new-refresh"},
                ),
                patch.object(
                    routes.google_client,
                    "userinfo_from_token_response",
                    return_value={"email": "owner@example.com", "sub": "owner-sub", "picture": None},
                ),
            ):
                response = client.get("/api/auth/google/callback?state=state&code=code")

            self.assertEqual(response.status_code, 200)
            self.assertEqual(self._extract_session_id(response.get_data(as_text=True)), sid)
            session = store.session_load(sid)
            self.assertIsNotNone(session)
            assert session is not None
            self.assertEqual(session["account_ids"], [aid])


if __name__ == "__main__":
    unittest.main()
