"""
Contract tests for cheap bridge routes (no Ollama, no DeepFace, no model downloads).

Skipped automatically when the `stitch-bridge` extra is not installed (default
CI profile), so plain `unittest discover` stays safe everywhere.
"""
from __future__ import annotations

import os
import unittest
from unittest.mock import patch

try:
    import flask  # noqa: F401

    _HAS_FLASK = True
except ImportError:
    _HAS_FLASK = False

if _HAS_FLASK:
    import stitch_rag_bridge
    from bridge.cors import parse_allowed_origins


@unittest.skipUnless(_HAS_FLASK, "stitch-bridge extra not installed")
class BridgeRouteContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = stitch_rag_bridge.app.test_client()

    def test_api_health_shape(self) -> None:
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        self.assertTrue(body["ok"])
        self.assertEqual(body["service"], "stitch-rag-bridge")
        self.assertIsInstance(body["google_oauth"], bool)
        self.assertIn("voice_stt", body)
        self.assertIn("engines", body["voice_stt"])
        self.assertIn("stitch_spa", body)
        self.assertIn("serving", body["stitch_spa"])

    def test_health_equals_api_health(self) -> None:
        a = self.client.get("/health").get_json()
        b = self.client.get("/api/health").get_json()
        self.assertEqual(a, b)

    def test_root_json_hint(self) -> None:
        resp = self.client.get("/", headers={"Accept": "application/json"})
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        self.assertTrue(body["ok"])
        self.assertIn("try", body)

    def test_root_html_hint(self) -> None:
        resp = self.client.get("/", headers={"Accept": "text/html"})
        self.assertEqual(resp.status_code, 200)
        self.assertIn(b"Stitch RAG bridge is running", resp.data)

    def test_rag_stitch_missing_query_400(self) -> None:
        resp = self.client.post("/api/rag/stitch", json={})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.get_json(), {"error": "missing query"})

    def test_rag_stitch_help_missing_query_400(self) -> None:
        resp = self.client.post("/api/rag/stitch-help", json={})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.get_json(), {"error": "missing query"})

    def test_rag_stitch_options_204(self) -> None:
        resp = self.client.options("/api/rag/stitch")
        self.assertEqual(resp.status_code, 204)

    def test_cors_allowed_origin_echoed(self) -> None:
        resp = self.client.options(
            "/api/rag/stitch", headers={"Origin": "http://localhost:5173"}
        )
        self.assertEqual(resp.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173")
        self.assertEqual(resp.headers.get("Vary"), "Origin")

    def test_cors_disallowed_origin_not_echoed(self) -> None:
        resp = self.client.options(
            "/api/rag/stitch", headers={"Origin": "http://evil.example"}
        )
        self.assertIsNone(resp.headers.get("Access-Control-Allow-Origin"))

    def test_voice_transcribe_disabled_by_env_503(self) -> None:
        with patch.dict(os.environ, {"STITCH_VOICE_TRANSCRIBE": "0"}):
            resp = self.client.post(
                "/api/voice/transcribe",
                data=b"RIFF" + b"\x00" * 4 + b"WAVE" + b"\x00" * 400,
                headers={"Content-Type": "audio/wav"},
            )
        self.assertEqual(resp.status_code, 503)
        self.assertEqual(resp.get_json()["voice_stt"]["reason"], "disabled_by_env")

    def test_voice_transcribe_rejects_non_wav(self) -> None:
        resp = self.client.post(
            "/api/voice/transcribe", data=b"A" * 500, headers={"Content-Type": "audio/wav"}
        )
        # 415 when an STT backend exists, 503 when none installed — both reject before decoding.
        self.assertIn(resp.status_code, (415, 503))

    def test_favicon_204(self) -> None:
        resp = self.client.get("/favicon.ico")
        self.assertEqual(resp.status_code, 204)

    def test_user_guide_route_responds_json(self) -> None:
        resp = self.client.get("/api/stitch-user-guide")
        self.assertIn(resp.status_code, (200, 404))
        self.assertIn("markdown", resp.get_json())


@unittest.skipUnless(_HAS_FLASK, "stitch-bridge extra not installed")
class CorsParsingTests(unittest.TestCase):
    def test_parse_strips_and_drops_empties(self) -> None:
        self.assertEqual(
            parse_allowed_origins(" http://a , ,http://b,"),
            {"http://a", "http://b"},
        )

    def test_parse_empty_string(self) -> None:
        self.assertEqual(parse_allowed_origins(""), set())


if __name__ == "__main__":
    unittest.main()
