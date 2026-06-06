import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from voice_prompt_tool import InstanceLock


class VoicePromptToolLockTests(unittest.TestCase):
    def test_replaced_instance_release_does_not_remove_successor_lock(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            lock_path = Path(tmp) / "voice_prompt_tool.lock"
            old_lock = InstanceLock(lock_path)
            new_lock = InstanceLock(lock_path)

            with patch("os.getpid", return_value=111):
                self.assertTrue(old_lock.acquire(replace_existing=False))
            self.assertEqual(lock_path.read_text(encoding="utf-8"), "111")

            with (
                patch("os.getpid", return_value=222),
                patch("voice_prompt_tool._process_exists", return_value=True),
                patch("voice_prompt_tool._terminate_process"),
            ):
                self.assertTrue(new_lock.acquire(replace_existing=True))
            self.assertEqual(lock_path.read_text(encoding="utf-8"), "222")

            with patch("os.getpid", return_value=111):
                old_lock.release()
            self.assertEqual(lock_path.read_text(encoding="utf-8"), "222")

            with patch("os.getpid", return_value=222):
                new_lock.release()
            self.assertFalse(lock_path.exists())


if __name__ == "__main__":
    unittest.main()
