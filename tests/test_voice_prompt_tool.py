from __future__ import annotations

import importlib.util
import threading
import unittest
from unittest.mock import patch


if importlib.util.find_spec("numpy") is None:
    raise unittest.SkipTest("voice prompt tests require numpy")

import voice_prompt_tool


class _DummyStream:
    def __init__(self) -> None:
        self.stopped = False
        self.closed = False

    def stop(self) -> None:
        self.stopped = True

    def close(self) -> None:
        self.closed = True


class _DummyStatus:
    def __init__(self) -> None:
        self.values: list[tuple[str, str | None]] = []

    def set_status(self, text: str, color: str | None = None) -> None:
        self.values.append((text, color))

    def set_state(self, state: str) -> None:
        self.values.append((state, None))


class _CapturedThread:
    def __init__(self, target, args=(), kwargs=None, daemon=None) -> None:
        self.target = target
        self.args = args
        self.kwargs = kwargs or {}
        self.daemon = daemon
        self.started = False

    def start(self) -> None:
        self.started = True


class VoicePromptToolStopTests(unittest.TestCase):
    def test_stop_recording_snapshots_frames_before_transcribe_thread_starts(self) -> None:
        tool = object.__new__(voice_prompt_tool.VoicePromptTool)
        tool.is_recording = True
        tool._stream = _DummyStream()
        tool._recording_lock = threading.Lock()
        original_frame = object()
        tool._recording_frames = [original_frame]
        tool.osd = _DummyStatus()
        tool.tray = _DummyStatus()

        transcribed_frames: list[list[object]] = []

        def fake_transcribe(frames: list[object]) -> None:
            transcribed_frames.append(frames)

        tool._transcribe_and_emit = fake_transcribe
        captured_threads: list[_CapturedThread] = []

        def thread_factory(*args, **kwargs):
            thread = _CapturedThread(*args, **kwargs)
            captured_threads.append(thread)
            return thread

        with patch.object(voice_prompt_tool.threading, "Thread", side_effect=thread_factory):
            tool.stop_recording()

        self.assertFalse(tool.is_recording)
        self.assertIsNone(tool._stream)
        self.assertEqual(len(captured_threads), 1)
        self.assertTrue(captured_threads[0].started)

        # Simulate an immediate next recording clearing the shared buffer before
        # the transcription worker gets CPU time.
        tool._recording_frames.clear()
        captured_threads[0].target(*captured_threads[0].args, **captured_threads[0].kwargs)

        self.assertEqual(transcribed_frames, [[original_frame]])
        self.assertIsNot(transcribed_frames[0], tool._recording_frames)


if __name__ == "__main__":
    unittest.main()
