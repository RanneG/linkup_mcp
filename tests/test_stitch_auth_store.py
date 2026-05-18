"""Concurrency-safety tests for Stitch auth SQLite storage."""
from __future__ import annotations

import importlib
import os
import tempfile
import threading
import unittest
from pathlib import Path
from typing import Any
from unittest.mock import patch


class _GuardedRLock:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._local = threading.local()

    def __enter__(self) -> "_GuardedRLock":
        self._lock.acquire()
        self._local.depth = getattr(self._local, "depth", 0) + 1
        return self

    def __exit__(self, *exc: object) -> None:
        self._local.depth -= 1
        self._lock.release()

    def held_by_current_thread(self) -> bool:
        return getattr(self._local, "depth", 0) > 0


class _GuardedConnection:
    def __init__(self, wrapped: Any, guard: _GuardedRLock) -> None:
        self._wrapped = wrapped
        self._guard = guard

    def execute(self, *args: Any, **kwargs: Any) -> Any:
        if not self._guard.held_by_current_thread():
            raise AssertionError("SQLite execute called without stitch_auth.store._lock")
        return self._wrapped.execute(*args, **kwargs)

    def commit(self) -> None:
        if not self._guard.held_by_current_thread():
            raise AssertionError("SQLite commit called without stitch_auth.store._lock")
        self._wrapped.commit()

    def __getattr__(self, name: str) -> Any:
        return getattr(self._wrapped, name)


class StitchAuthStoreTests(unittest.TestCase):
    def test_public_read_apis_use_store_lock(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            db_path = Path(td) / "auth.db"
            env = {
                "STITCH_AUTH_DB": str(db_path),
                "STITCH_GOOGLE_FERNET_KEY": "test-fernet-key",
            }
            with patch.dict(os.environ, env):
                import stitch_auth.store as store

                importlib.reload(store)
                account_id = store.google_account_upsert(
                    "user@example.com",
                    "google-sub",
                    "refresh-token",
                    "https://example.com/avatar.png",
                )
                session_id = store.session_create([account_id], "user@example.com")
                store.subscriptions_upsert_many(
                    "user@example.com",
                    [
                        {
                            "id": "sub-1",
                            "name": "Example",
                            "category": "software",
                            "amountUsd": 12.34,
                            "dueDateIso": "2026-06-01",
                            "status": "pending",
                        }
                    ],
                )

                real_conn = store._conn
                self.assertIsNotNone(real_conn)
                guard = _GuardedRLock()
                store._lock = guard
                store._conn = _GuardedConnection(real_conn, guard)
                try:
                    self.assertEqual(store.google_account_by_id(account_id)["email"], "user@example.com")
                    self.assertEqual(store.google_account_by_email("user@example.com")["id"], account_id)
                    self.assertEqual(store.session_load(session_id)["active_email"], "user@example.com")
                    self.assertEqual(store.session_accounts_detail(session_id)[0]["email"], "user@example.com")
                    self.assertEqual(store.subscriptions_list("user@example.com")[0]["id"], "sub-1")
                finally:
                    store._conn = real_conn
                    if store._conn is not None:
                        store._conn.close()
                    store._conn = None


if __name__ == "__main__":
    unittest.main()
