"""Voice prompt transcription must not lose or clobber a newer recording."""

from __future__ import annotations

import threading
import unittest
from unittest.mock import MagicMock, patch

from voice_prompt_tool import VoicePromptTool


class _HoldThread:
    """Capture the worker and run it only when the test says so."""

    last: "_HoldThread | None" = None

    def __init__(self, target=None, args=(), kwargs=None, daemon=None, name=None):
        self.target = target
        self.args = args
        self.kwargs = kwargs or {}
        _HoldThread.last = self

    def start(self) -> None:
        return None

    def run_now(self) -> None:
        self.target(*self.args, **self.kwargs)


def _tool() -> VoicePromptTool:
    tool = VoicePromptTool.__new__(VoicePromptTool)
    tool.sample_rate = 16000
    tool.channels = 1
    tool.autopaste = False
    tool.system_instruction = None
    tool.continuation_mode = False
    tool.continuation_window_seconds = 30
    tool._last_prompt_copied_at = None
    tool._clipboard_buffer = None
    tool.is_recording = False
    tool._recording_frames = []
    tool._stream = None
    tool._recording_lock = threading.Lock()
    tool._transcription_seq = 0
    tool._emit_lock = threading.Lock()
    tool.osd = MagicMock()
    tool.tray = MagicMock()
    return tool


class VoicePromptTranscriptionRaceTests(unittest.TestCase):
    def test_stop_hands_worker_frames_that_survive_a_new_recording(self) -> None:
        tool = _tool()
        original = object()
        tool.is_recording = True
        tool._recording_frames = [original]

        with patch("voice_prompt_tool.threading.Thread", _HoldThread):
            tool.stop_recording()
            # A new recording starts before Whisper finishes and clears the shared buffer.
            tool._recording_frames.clear()
            tool._recording_frames.append(object())
            held = _HoldThread.last
            self.assertIsNotNone(held)
            assert held is not None
            seen: dict[str, object] = {}

            def _capture(frames, job_id):
                seen["frames"] = frames
                seen["job_id"] = job_id

            held.target = _capture
            held.run_now()

        self.assertEqual(seen["frames"], [original])
        self.assertEqual(seen["job_id"], 1)
        self.assertEqual(len(tool._recording_frames), 1)
        self.assertIsNot(tool._recording_frames[0], original)

    def test_older_transcription_does_not_overwrite_newer_clipboard(self) -> None:
        tool = _tool()
        tool._transcription_seq = 2
        tool._clipboard_buffer = "latest prompt"
        with patch("voice_prompt_tool.pyperclip") as clip:
            tool._publish_prompt(1, "OLD PROMPT")
            clip.copy.assert_not_called()
            tool._publish_prompt(2, "NEW PROMPT")
            clip.copy.assert_called_once_with("NEW PROMPT")
        self.assertEqual(tool._clipboard_buffer, "NEW PROMPT")

    def test_clipboard_failure_returns_tool_to_idle(self) -> None:
        tool = _tool()
        tool._transcription_seq = 1
        with patch("voice_prompt_tool.pyperclip") as clip:
            clip.copy.side_effect = RuntimeError("clipboard busy")
            tool._publish_prompt(1, "prompt")
        tool.osd.set_status.assert_called_with("COPY ERROR", "#da3633")
        tool.tray.set_state.assert_called_with("idle")


if __name__ == "__main__":
    unittest.main()
