"""Unit tests for reel_workflow (pure heuristics — no whisper/yt-dlp)."""
from __future__ import annotations

import unittest

import reel_workflow as rw


class SlugTests(unittest.TestCase):
    def test_reels_path(self) -> None:
        self.assertEqual(
            rw.slug_from_url("https://www.instagram.com/reels/DW7lN7sj2ow/"),
            "DW7lN7sj2ow",
        )

    def test_reel_singular(self) -> None:
        self.assertEqual(
            rw.slug_from_url("https://www.instagram.com/reel/DZ5H6F1Rz1S/"),
            "DZ5H6F1Rz1S",
        )

    def test_fallback_slug(self) -> None:
        slug = rw.slug_from_url("https://example.com/video/abc")
        self.assertTrue(slug)


class CleanTranscriptTests(unittest.TestCase):
    def test_whisper_tool_fixes(self) -> None:
        raw = "Go to Easy Gift and use cloud design with Revan your cat MCP."
        cleaned = rw.clean_transcript(raw)
        self.assertIn("ezgif", cleaned)
        self.assertIn("Claude design", cleaned)
        self.assertIn("RevenueCat", cleaned)


class ClassifyTypeTests(unittest.TestCase):
    def test_scroll_reel_is_tutorial(self) -> None:
        text = (
            "First go to Whisk. Then open Google Flow. Next upload to Easy Gift. "
            "Download them as a zip. Paste in your coding tool."
        )
        self.assertEqual(rw.classify_type(rw.clean_transcript(text)), "tutorial")

    def test_luke_reel_is_opinion(self) -> None:
        text = (
            "Nope this is one of the biggest mistakes. Overall his breakdown was okay. "
            "Hot take Codex is better. Trust me I tried."
        )
        self.assertEqual(rw.classify_type(text), "opinion")


class WorkflowCardTests(unittest.TestCase):
    def test_render_includes_sections(self) -> None:
        card = rw.build_workflow_card(
            slug="DW7lN7sj2ow",
            source_url="https://www.instagram.com/reels/DW7lN7sj2ow/",
            transcript_text="First go to Whisk. Then open Google Flow.",
            transcript_rel_path="data/inbox/DW7lN7sj2ow.md",
        )
        md = rw.render_workflow_markdown(card)
        self.assertIn("## Steps", md)
        self.assertIn("## Surface map", md)
        self.assertIn("## MVP slice", md)
        self.assertIn("## Not doing", md)
        self.assertEqual(card.workflow_type, "tutorial")


if __name__ == "__main__":
    unittest.main()
