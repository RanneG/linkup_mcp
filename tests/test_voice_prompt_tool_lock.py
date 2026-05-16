import os
import stat
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from voice_prompt_tool import InstanceLock, _default_instance_lock_path


class VoicePromptToolLockTests(unittest.TestCase):
    def test_default_lock_path_is_not_shared_temp_file(self) -> None:
        self.assertNotEqual(
            _default_instance_lock_path(),
            Path(tempfile.gettempdir()) / "voice_prompt_tool.lock",
        )

    def test_acquire_creates_private_lock_directory_and_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            lock_path = Path(tmp) / "locks" / "voice_prompt_tool.lock"
            lock = InstanceLock(lock_path)
            self.assertTrue(lock.acquire(replace_existing=False))
            try:
                self.assertEqual(lock_path.read_text(encoding="utf-8"), str(os.getpid()))
                if os.name != "nt":
                    self.assertEqual(stat.S_IMODE(lock_path.parent.stat().st_mode) & 0o077, 0)
                    self.assertEqual(stat.S_IMODE(lock_path.stat().st_mode) & 0o077, 0)
            finally:
                lock.release()

    @unittest.skipIf(os.name == "nt", "POSIX permission check")
    def test_untrusted_existing_lock_does_not_terminate_pid(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            lock_dir = Path(tmp) / "locks"
            lock_dir.mkdir()
            lock_path = lock_dir / "voice_prompt_tool.lock"
            lock_path.write_text(str(os.getpid()), encoding="utf-8")
            lock_path.chmod(0o666)

            lock = InstanceLock(lock_path)
            with patch("voice_prompt_tool._terminate_process") as terminate:
                self.assertTrue(lock.acquire(replace_existing=True))
                terminate.assert_not_called()
            lock.release()


if __name__ == "__main__":
    unittest.main()
