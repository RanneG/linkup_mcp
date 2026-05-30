import unittest
from types import SimpleNamespace
from unittest import mock

import numpy as np

import voice_prompt_tool


class _FakeStatus:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def set_status(self, text: str, color_hex: str) -> None:
        self.calls.append((text, color_hex))


class _FakeTray:
    def __init__(self) -> None:
        self.states: list[str] = []

    def set_state(self, state: str) -> None:
        self.states.append(state)


class VoicePromptToolTests(unittest.TestCase):
    def _bare_tool(self) -> voice_prompt_tool.VoicePromptTool:
        tool = voice_prompt_tool.VoicePromptTool.__new__(voice_prompt_tool.VoicePromptTool)
        tool.sample_rate = 10
        tool.channels = 1
        tool.autopaste = False
        tool.system_instruction = None
        tool.continuation_mode = False
        tool.continuation_window_seconds = 30
        tool._last_prompt_copied_at = None
        tool._clipboard_buffer = None
        tool.osd = _FakeStatus()
        tool.tray = _FakeTray()
        return tool

    def test_audio_callback_caps_recording_and_requests_stop(self) -> None:
        tool = self._bare_tool()
        tool.is_recording = True
        tool.max_recording_seconds = 1
        tool._max_recording_samples = 10
        tool._recording_frames = []
        tool._recording_sample_count = 0
        tool._recording_limit_reached = False
        tool._recording_limit_stop_requested = False

        stop_requests: list[bool] = []
        tool._handle_recording_limit_reached = lambda: stop_requests.append(True)

        tool._audio_callback(np.ones((8, 1), dtype=np.float32), 8, None, None)
        tool._audio_callback(np.ones((8, 1), dtype=np.float32), 8, None, None)

        total_samples = sum(len(frame) for frame in tool._recording_frames)
        self.assertEqual(total_samples, 10)
        self.assertEqual(tool._recording_sample_count, 10)
        self.assertEqual(stop_requests, [True])

    def test_clipboard_failure_resets_processing_state(self) -> None:
        tool = self._bare_tool()
        tool._recording_frames = [np.zeros((4, 1), dtype=np.float32)]

        with mock.patch.object(voice_prompt_tool, "transcribe_wav_bytes", return_value="hello world"):
            with mock.patch.object(
                voice_prompt_tool,
                "pyperclip",
                SimpleNamespace(copy=mock.Mock(side_effect=RuntimeError("clipboard unavailable"))),
            ):
                tool._transcribe_and_emit()

        self.assertIn(("CLIPBOARD ERROR", "#da3633"), tool.osd.calls)
        self.assertEqual(tool.tray.states[-1], "idle")


if __name__ == "__main__":
    unittest.main()
