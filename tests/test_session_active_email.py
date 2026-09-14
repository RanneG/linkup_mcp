"""Regression: switching active email must not drop concurrently linked accounts."""
from __future__ import annotations

import importlib
import os
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

try:
    from cryptography.fernet import Fernet  # noqa: F401

    _HAS_CRYPTO = True
except ImportError:
    _HAS_CRYPTO = False


@unittest.skipUnless(_HAS_CRYPTO, "cryptography (stitch-bridge extra) not installed")
class TestSessionSetActiveEmail(unittest.TestCase):
    def test_set_active_email_keeps_ids_appended_after_stale_load(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            db_path = Path(td) / "stitch_auth.db"
            with patch.dict(
                os.environ,
                {"STITCH_AUTH_DB": str(db_path), "STITCH_GOOGLE_FERNET_KEY": "test-fernet-key-material"},
            ):
                import stitch_auth.store as store

                importlib.reload(store)

                primary = store.google_account_upsert("owner@example.com", "sub-owner", "refresh-owner", None)
                second = store.google_account_upsert("second@example.com", "sub-second", "refresh-second", None)
                sid = store.session_create([primary], "owner@example.com")

                # Stale snapshot as POST /api/auth/active-email used to take.
                sess = store.session_load(sid)
                assert sess is not None
                stale_ids = [int(x) for x in sess.get("account_ids") or []]
                self.assertEqual(stale_ids, [primary])

                # OAuth Add-account callback appends the second mailbox (main still
                # uses session_update here; PR #47 may swap in session_link_account).
                store.session_update(sid, [primary, second], "second@example.com")

                err = store.session_set_active_email(sid, primary, "owner@example.com")
                self.assertIsNone(err)

                sess = store.session_load(sid)
                assert sess is not None
                self.assertEqual({int(x) for x in sess["account_ids"]}, {primary, second})
                self.assertEqual(sess["active_email"], "owner@example.com")

                # Contrast: the old full-payload rewrite would have dropped `second`.
                store.session_update(sid, stale_ids, "owner@example.com")
                sess = store.session_load(sid)
                assert sess is not None
                self.assertEqual([int(x) for x in sess["account_ids"]], [primary])

                store._reset_connection_for_tests()

    def test_concurrent_oauth_update_and_active_email_keeps_both(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            db_path = Path(td) / "stitch_auth.db"
            with patch.dict(
                os.environ,
                {"STITCH_AUTH_DB": str(db_path), "STITCH_GOOGLE_FERNET_KEY": "test-fernet-key-material"},
            ):
                import stitch_auth.store as store

                importlib.reload(store)

                primary = store.google_account_upsert("owner@example.com", "sub-owner", "refresh-owner", None)
                second = store.google_account_upsert("second@example.com", "sub-second", "refresh-second", None)
                sid = store.session_create([primary], "owner@example.com")

                barrier = threading.Barrier(2)
                errors: list[BaseException] = []

                def oauth_append() -> None:
                    try:
                        barrier.wait(timeout=5)
                        sess = store.session_load(sid)
                        assert sess is not None
                        ids = [int(x) for x in sess.get("account_ids") or []]
                        if second not in ids:
                            ids.append(second)
                        store.session_update(sid, ids, "second@example.com")
                    except BaseException as exc:  # noqa: BLE001 — collect thread failures
                        errors.append(exc)

                def switch_active() -> None:
                    try:
                        barrier.wait(timeout=5)
                        err = store.session_set_active_email(sid, primary, "owner@example.com")
                        if err:
                            raise AssertionError(f"set_active failed: {err}")
                    except BaseException as exc:  # noqa: BLE001
                        errors.append(exc)

                t1 = threading.Thread(target=oauth_append)
                t2 = threading.Thread(target=switch_active)
                t1.start()
                t2.start()
                t1.join(timeout=10)
                t2.join(timeout=10)

                self.assertEqual(errors, [])
                sess = store.session_load(sid)
                assert sess is not None
                self.assertEqual({int(x) for x in sess["account_ids"]}, {primary, second})

                store._reset_connection_for_tests()

    def test_rejects_email_not_in_session(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            db_path = Path(td) / "stitch_auth.db"
            with patch.dict(
                os.environ,
                {"STITCH_AUTH_DB": str(db_path), "STITCH_GOOGLE_FERNET_KEY": "test-fernet-key-material"},
            ):
                import stitch_auth.store as store

                importlib.reload(store)

                primary = store.google_account_upsert("owner@example.com", "sub-owner", "refresh-owner", None)
                other = store.google_account_upsert("other@example.com", "sub-other", "refresh-other", None)
                sid = store.session_create([primary], "owner@example.com")

                self.assertEqual(
                    store.session_set_active_email(sid, other, "other@example.com"),
                    "email_not_linked",
                )
                self.assertEqual(
                    store.session_set_active_email("missing", primary, "owner@example.com"),
                    "invalid_session",
                )

                store._reset_connection_for_tests()


if __name__ == "__main__":
    unittest.main()
