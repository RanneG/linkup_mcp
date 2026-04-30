"""Contract tests for Stitch-shaped RAG JSON (_to_stitch_view)."""

import json
import os
import unittest

from server import _to_stitch_view


class RagStitchContractTests(unittest.TestCase):
    def test_answered_has_sources_and_flags(self) -> None:
        payload = {
            "answer": "Example",
            "confidence": "high",
            "fallback": False,
            "sources": [
                {"rank": 1, "source_id": "paper.pdf", "score": 0.9, "snippet": "hello world"},
            ],
        }
        view = _to_stitch_view(payload)
        self.assertEqual(view["state"], "answered")
        self.assertEqual(view["confidence"], "high")
        self.assertTrue(view["show_sources"])
        self.assertEqual(len(view["source_cards"]), 1)
        self.assertEqual(view["source_cards"][0]["source_id"], "paper.pdf")
        self.assertNotIn("debug_retrieval_cards", view)

    def test_fallback_hides_sources_by_default(self) -> None:
        payload = {
            "answer": "No evidence",
            "confidence": "low",
            "fallback": True,
            "sources": [{"rank": 1, "source_id": "x.pdf", "score": 0.2, "snippet": "nope"}],
        }
        view = _to_stitch_view(payload)
        self.assertEqual(view["state"], "fallback")
        self.assertFalse(view["show_sources"])
        self.assertEqual(view["source_cards"], [])
        self.assertNotIn("debug_retrieval_cards", view)

    def test_fallback_debug_optional(self) -> None:
        prev = os.environ.get("STITCH_RAG_DEBUG")
        os.environ["STITCH_RAG_DEBUG"] = "1"
        try:
            payload = {
                "answer": "No evidence",
                "confidence": "low",
                "fallback": True,
                "sources": [{"rank": 1, "source_id": "x.pdf", "score": 0.2, "snippet": "nope"}],
            }
            view = _to_stitch_view(payload)
            self.assertIn("debug_retrieval_cards", view)
            self.assertEqual(len(view["debug_retrieval_cards"]), 1)
        finally:
            if prev is None:
                os.environ.pop("STITCH_RAG_DEBUG", None)
            else:
                os.environ["STITCH_RAG_DEBUG"] = prev

    def test_rag_stitch_tool_returns_json_object_string(self) -> None:
        """Sanity: MCP tool output is a JSON string parseable to the view shape."""
        view = _to_stitch_view(
            {
                "answer": "A",
                "confidence": "medium",
                "fallback": False,
                "sources": [],
            }
        )
        raw = json.dumps(view)
        parsed = json.loads(raw)
        self.assertIn("state", parsed)
        self.assertIn("answer", parsed)
        self.assertIn("confidence", parsed)
        self.assertIn("source_cards", parsed)
        self.assertIn("show_sources", parsed)


if __name__ == "__main__":
    unittest.main()
