"""Permission tests for local Stitch OAuth/session storage."""
from __future__ import annotations

import importlib
import os
import stat
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from cryptography.fernet import Fernet


def _mode(path: Path) -> int:
    return stat.S_IMODE(path.stat().st_mode)


def _reload_store():
    import stitch_auth.store as store

    if store._conn is not None:  # noqa: SLF001 - reset module singleton for env-isolated tests
        store._conn.close()  # noqa: SLF001
        store._conn = None  # noqa: SLF001
    return importlib.reload(store)


@unittest.skipIf(os.name == "nt", "POSIX file modes are not portable to Windows")
class TestStitchAuthStorePermissions(unittest.TestCase):
    def test_created_auth_store_files_are_owner_only(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            home = Path(td) / "home"
            home.mkdir()

            with patch.dict(os.environ, {"HOME": str(home), "STITCH_AUTH_DB": ""}, clear=False):
                store = _reload_store()
                store.google_account_upsert(
                    "user@example.com",
                    "google-sub",
                    "refresh-token",
                    "https://example.test/avatar.png",
                )

                auth_dir = home / ".stitch"
                key_path = auth_dir / ".google_fernet_key"
                db_path = auth_dir / "stitch_auth.db"

                self.assertEqual(_mode(auth_dir), 0o700)
                self.assertEqual(_mode(key_path), 0o600)
                self.assertEqual(_mode(db_path), 0o600)

                row = store.google_account_by_email("user@example.com")
                self.assertIsNotNone(row)
                assert row is not None
                self.assertEqual(store.decrypt_refresh(row), "refresh-token")

    def test_existing_permissive_auth_files_are_tightened(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            home = Path(td) / "home"
            auth_dir = home / ".stitch"
            auth_dir.mkdir(parents=True)
            key_path = auth_dir / ".google_fernet_key"
            db_path = auth_dir / "stitch_auth.db"
            key_path.write_bytes(Fernet.generate_key())
            db_path.write_bytes(b"")
            os.chmod(auth_dir, 0o755)
            os.chmod(key_path, 0o644)
            os.chmod(db_path, 0o644)

            with patch.dict(os.environ, {"HOME": str(home), "STITCH_AUTH_DB": ""}, clear=False):
                store = _reload_store()
                store.google_account_upsert("user@example.com", None, "refresh-token", None)

                self.assertEqual(_mode(auth_dir), 0o700)
                self.assertEqual(_mode(key_path), 0o600)
                self.assertEqual(_mode(db_path), 0o600)


if __name__ == "__main__":
    unittest.main()
