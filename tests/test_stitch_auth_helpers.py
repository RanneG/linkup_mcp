"""Unit tests for pure stitch_auth helpers (no OAuth/Gmail network calls)."""
from __future__ import annotations

import unittest

try:
    import flask  # noqa: F401

    _HAS_FLASK = True
except ImportError:
    _HAS_FLASK = False

if _HAS_FLASK:
    from stitch_auth.flask_routes import _redirect_origin_ipv4


@unittest.skipUnless(_HAS_FLASK, "stitch-bridge extra not installed")
class RedirectOriginIpv4Tests(unittest.TestCase):
    def test_empty_falls_back_to_bridge_default(self) -> None:
        self.assertEqual(_redirect_origin_ipv4(""), "http://127.0.0.1:8765")

    def test_localhost_rewritten_to_ipv4_with_port(self) -> None:
        self.assertEqual(_redirect_origin_ipv4("http://localhost:1420"), "http://127.0.0.1:1420")

    def test_localhost_without_port(self) -> None:
        self.assertEqual(_redirect_origin_ipv4("http://localhost"), "http://127.0.0.1")

    def test_non_localhost_passthrough(self) -> None:
        self.assertEqual(_redirect_origin_ipv4("http://127.0.0.1:5173/"), "http://127.0.0.1:5173")
        self.assertEqual(_redirect_origin_ipv4("https://example.com"), "https://example.com")

    def test_missing_scheme_gets_http(self) -> None:
        self.assertEqual(_redirect_origin_ipv4("localhost:8080"), "http://127.0.0.1:8080")


if __name__ == "__main__":
    unittest.main()
