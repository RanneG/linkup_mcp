"""Security regression tests for local Stitch bridge helpers."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from flask import Flask

import stitch_rag_bridge
from stitch_auth.flask_routes import register_stitch_auth_routes


class StitchBridgeSecurityTests(unittest.TestCase):
    def test_path_containment_rejects_sibling_prefix_escape(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp) / "dist" / "assets"
            sibling = Path(tmp) / "dist" / "assets_secret" / "token.txt"
            base.mkdir(parents=True)
            sibling.parent.mkdir(parents=True)
            sibling.write_text("secret", encoding="utf-8")

            self.assertFalse(stitch_rag_bridge._path_is_within(str(sibling), str(base)))

    def test_oauth_start_rejects_untrusted_client_origin(self) -> None:
        app = Flask(__name__)
        app.config["STITCH_ALLOWED_ORIGINS"] = {"http://localhost:1420", "http://127.0.0.1:1420"}
        register_stitch_auth_routes(app)

        with (
            patch("stitch_auth.flask_routes.google_client.oauth_configured", return_value=True),
            patch("stitch_auth.flask_routes.oauth_pending_save") as save_pending,
        ):
            response = app.test_client().post(
                "/api/auth/google/url",
                json={"client_origin": "https://attacker.example"},
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"ok": False, "error": "untrusted_client_origin"})
        save_pending.assert_not_called()

    def test_oauth_start_accepts_allowed_client_origin(self) -> None:
        app = Flask(__name__)
        app.config["STITCH_ALLOWED_ORIGINS"] = {"http://localhost:1420", "http://127.0.0.1:1420"}
        register_stitch_auth_routes(app)

        with (
            patch("stitch_auth.flask_routes.google_client.oauth_configured", return_value=True),
            patch("stitch_auth.flask_routes.google_client.pkce_pair", return_value=("verifier", "challenge")),
            patch("stitch_auth.flask_routes.google_client.build_authorize_url", return_value="https://accounts.example/auth"),
            patch("stitch_auth.flask_routes.oauth_pending_save") as save_pending,
        ):
            response = app.test_client().post(
                "/api/auth/google/url",
                json={"client_origin": "http://localhost:1420"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["auth_url"], "https://accounts.example/auth")
        self.assertEqual(save_pending.call_args.args[2], "http://localhost:1420")


if __name__ == "__main__":
    unittest.main()
