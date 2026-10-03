"""Instance-lock safety: never signal an unrelated PID when replacing a stale lock."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from voice_prompt_tool import InstanceLock, _lock_owner_kind, _process_exists


class VoicePromptLockTests(unittest.TestCase):
    def test_windows_existence_check_does_not_signal(self) -> None:
        with (
            patch("voice_prompt_tool.platform.system", return_value="Windows"),
            patch("voice_prompt_tool._windows_process_alive", return_value=True) as alive,
            patch("voice_prompt_tool.os.kill") as kill,
        ):
            self.assertTrue(_process_exists(4242))
            alive.assert_called_once_with(4242)
            kill.assert_not_called()

    def test_reused_live_pid_is_not_terminated(self) -> None:
        """PID 1 is alive and is not this tool. Relaunch must not signal it."""
        self.assertEqual(_lock_owner_kind(1), "other")
        with tempfile.TemporaryDirectory() as tmp:
            lock_path = Path(tmp) / "voice_prompt_tool.lock"
            lock_path.write_text("1", encoding="utf-8")
            lock = InstanceLock(lock_path)
            with patch("voice_prompt_tool._terminate_process") as terminate:
                self.assertTrue(lock.acquire(replace_existing=True))
                terminate.assert_not_called()
            self.assertEqual(lock_path.read_text(encoding="utf-8").strip(), str(os.getpid()))
            lock.release()

    def test_confirmed_voice_process_is_replaced(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            lock_path = Path(tmp) / "voice_prompt_tool.lock"
            lock_path.write_text("4321", encoding="utf-8")
            lock = InstanceLock(lock_path)
            with (
                patch("voice_prompt_tool._process_exists", return_value=True),
                patch("voice_prompt_tool._process_command_line", return_value="python voice_prompt_tool.py"),
                patch("voice_prompt_tool._terminate_process") as terminate,
                patch("voice_prompt_tool.time.sleep"),
            ):
                self.assertTrue(lock.acquire(replace_existing=True))
                terminate.assert_called_once_with(4321)
            self.assertEqual(lock_path.read_text(encoding="utf-8").strip(), str(os.getpid()))
            lock.release()

    def test_unreadable_live_pid_is_left_alone(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            lock_path = Path(tmp) / "voice_prompt_tool.lock"
            lock_path.write_text("4321", encoding="utf-8")
            lock = InstanceLock(lock_path)
            with (
                patch("voice_prompt_tool._process_exists", return_value=True),
                patch("voice_prompt_tool._process_command_line", return_value=None),
                patch("voice_prompt_tool._terminate_process") as terminate,
            ):
                self.assertFalse(lock.acquire(replace_existing=True))
                terminate.assert_not_called()
            self.assertEqual(lock_path.read_text(encoding="utf-8").strip(), "4321")

    def test_lock_naming_current_pid_is_not_self_terminated(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            lock_path = Path(tmp) / "voice_prompt_tool.lock"
            lock_path.write_text(str(os.getpid()), encoding="utf-8")
            lock = InstanceLock(lock_path)
            with patch("voice_prompt_tool._terminate_process") as terminate:
                self.assertTrue(lock.acquire(replace_existing=True))
                terminate.assert_not_called()
            self.assertEqual(lock_path.read_text(encoding="utf-8").strip(), str(os.getpid()))
            lock.release()

    def test_dead_pid_lock_is_replaced_without_signal(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            lock_path = Path(tmp) / "voice_prompt_tool.lock"
            lock_path.write_text("99999999", encoding="utf-8")
            lock = InstanceLock(lock_path)
            with patch("voice_prompt_tool._terminate_process") as terminate:
                self.assertTrue(lock.acquire(replace_existing=True))
                terminate.assert_not_called()
            self.assertEqual(lock_path.read_text(encoding="utf-8").strip(), str(os.getpid()))
            lock.release()


if __name__ == "__main__":
    unittest.main()
