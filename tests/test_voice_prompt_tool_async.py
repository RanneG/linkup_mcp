import threading
import unittest
from types import SimpleNamespace
from unittest import mock

import voice_prompt_tool as vpt


class _DummyStatus:
    def __init__(self) -> None:
        self.values: list[tuple[str, str]] = []

    def set_status(self, text: str, color: str) -> None:
        self.values.append((text, color))


class _DummyTray:
    def __init__(self) -> None:
        self.states: list[str] = []

    def set_state(self, state: str) -> None:
        self.states.append(state)


class _DummyStream:
    def __init__(self) -> None:
        self.stopped = False
        self.closed = False

    def stop(self) -> None:
        self.stopped = True

    def close(self) -> None:
        self.closed = True


def _bare_tool() -> vpt.VoicePromptTool:
    tool = vpt.VoicePromptTool.__new__(vpt.VoicePromptTool)
    tool.sample_rate = 16000
    tool.channels = 1
    tool.autopaste = False
    tool.system_instruction = None
    tool.continuation_mode = False
    tool.continuation_window_seconds = 30
    tool._last_prompt_copied_at = None
    tool._clipboard_buffer = None
    tool._recording_lock = threading.Lock()
    tool._emit_lock = threading.Lock()
    tool._latest_transcription_job_id = 0
    tool.osd = _DummyStatus()
    tool.tray = _DummyTray()
    return tool


class VoicePromptAsyncTests(unittest.TestCase):
    def test_stop_recording_passes_frame_snapshot_to_worker(self) -> None:
        tool = _bare_tool()
        tool.is_recording = True
        tool._stream = _DummyStream()
        tool._recording_frames = ["original"]
        started: list[tuple[int, list[str]]] = []

        class FakeThread:
            def __init__(self, target, args, daemon):
                self.target = target
                self.args = args
                self.daemon = daemon

            def start(self) -> None:
                started.append(self.args)

        with mock.patch.object(vpt.threading, "Thread", FakeThread):
            tool.stop_recording()

        self.assertFalse(tool.is_recording)
        self.assertEqual(started, [(1, ["original"])])
        tool._recording_frames.clear()
        self.assertEqual(started[0][1], ["original"])

    def test_stale_transcription_cannot_overwrite_newer_clipboard(self) -> None:
        tool = _bare_tool()
        tool._latest_transcription_job_id = 2
        copies: list[str] = []
        old_started = threading.Event()
        allow_old_finish = threading.Event()

        def fake_wav_from_frames(frames: list[bytes]) -> bytes:
            return frames[0]

        def fake_transcribe(raw: bytes, *, language: str = "en") -> str:
            if raw == b"old":
                old_started.set()
                self.assertTrue(allow_old_finish.wait(timeout=5))
                return "old prompt"
            return "new prompt"

        tool._wav_bytes_from_frames = fake_wav_from_frames

        with (
            mock.patch.object(vpt, "transcribe_wav_bytes", fake_transcribe),
            mock.patch.object(vpt, "pyperclip", SimpleNamespace(copy=copies.append)),
        ):
            old_thread = threading.Thread(target=tool._transcribe_and_emit, args=(1, [b"old"]))
            old_thread.start()
            self.assertTrue(old_started.wait(timeout=5))

            tool._transcribe_and_emit(2, [b"new"])
            self.assertEqual(copies, ["[FILE REFERENCE: none]\n[TASK: New prompt.]"])

            allow_old_finish.set()
            old_thread.join(timeout=5)

        self.assertFalse(old_thread.is_alive())
        self.assertEqual(copies, ["[FILE REFERENCE: none]\n[TASK: New prompt.]"])


if __name__ == "__main__":
    unittest.main()
