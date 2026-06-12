"""Unit tests for rag_heuristics (pure functions — no Ollama/embeddings needed)."""
from __future__ import annotations

import unittest

import rag_heuristics as h


class SnippetTests(unittest.TestCase):
    def test_short_text_passthrough(self) -> None:
        self.assertEqual(h.make_snippet("  hello\nworld  "), "hello world")

    def test_long_text_truncated_with_ellipsis(self) -> None:
        text = "a" * 300
        out = h.make_snippet(text)
        self.assertEqual(len(out), h.SNIPPET_MAX_CHARS + 3)
        self.assertTrue(out.endswith("..."))

    def test_exact_limit_no_ellipsis(self) -> None:
        text = "b" * h.SNIPPET_MAX_CHARS
        self.assertEqual(h.make_snippet(text), text)


class WeakEvidenceTests(unittest.TestCase):
    def test_no_scores_is_not_weak(self) -> None:
        self.assertFalse(h.is_weak_evidence([]))
        self.assertFalse(h.is_weak_evidence([None, None]))

    def test_below_threshold_is_weak(self) -> None:
        self.assertTrue(h.is_weak_evidence([0.1, 0.2]))

    def test_at_threshold_is_not_weak(self) -> None:
        self.assertFalse(h.is_weak_evidence([h.WEAK_EVIDENCE_THRESHOLD]))

    def test_one_strong_score_wins(self) -> None:
        self.assertFalse(h.is_weak_evidence([0.05, 0.9, None]))


class ConfidenceLabelTests(unittest.TestCase):
    def test_no_scores_low(self) -> None:
        self.assertEqual(h.confidence_label([]), "low")
        self.assertEqual(h.confidence_label([None]), "low")

    def test_high(self) -> None:
        self.assertEqual(h.confidence_label([0.2, h.HIGH_CONFIDENCE_THRESHOLD]), "high")

    def test_medium(self) -> None:
        self.assertEqual(h.confidence_label([h.MEDIUM_CONFIDENCE_THRESHOLD]), "medium")

    def test_low(self) -> None:
        self.assertEqual(h.confidence_label([0.49]), "low")


class KeywordCoverageTests(unittest.TestCase):
    def test_no_meaningful_terms_returns_full_coverage(self) -> None:
        # All tokens are stopwords or < 4 chars.
        self.assertEqual(h.keyword_coverage("what is the fix", ["anything"]), 1.0)

    def test_full_coverage(self) -> None:
        self.assertEqual(
            h.keyword_coverage("DeepSeek training", ["deepseek was trained via training runs"]),
            1.0,
        )

    def test_partial_coverage(self) -> None:
        cov = h.keyword_coverage("deepseek pricing", ["deepseek paper text"])
        self.assertAlmostEqual(cov, 0.5)

    def test_zero_coverage(self) -> None:
        self.assertEqual(h.keyword_coverage("quantum blockchain", ["a rice wine story"]), 0.0)

    def test_case_insensitive(self) -> None:
        self.assertEqual(h.keyword_coverage("DEEPSEEK", ["DeepSeek details"]), 1.0)


if __name__ == "__main__":
    unittest.main()
