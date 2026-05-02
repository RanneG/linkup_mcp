"""Regression tests for Stitch subscription persistence ownership."""
from __future__ import annotations

import importlib
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class TestSubscriptionStore(unittest.TestCase):
    def test_cross_owner_id_collision_does_not_move_existing_row(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            db_path = Path(td) / "stitch_auth.db"
            with patch.dict(os.environ, {"STITCH_AUTH_DB": str(db_path)}):
                import stitch_auth.store as store

                importlib.reload(store)

                store.subscriptions_upsert_many(
                    "alice@example.com",
                    [
                        {
                            "id": "shared-id",
                            "name": "Alice Plan",
                            "category": "software",
                            "amountUsd": 10,
                            "dueDateIso": "2026-05-10",
                            "status": "pending",
                        }
                    ],
                )
                bob_rows = store.subscriptions_upsert_many(
                    "bob@example.com",
                    [
                        {
                            "id": "shared-id",
                            "name": "Bob Plan",
                            "category": "music",
                            "amountUsd": 20,
                            "dueDateIso": "2026-05-11",
                            "status": "pending",
                        }
                    ],
                )

                alice = store.subscriptions_list("alice@example.com")
                bob = store.subscriptions_list("bob@example.com")

                self.assertEqual(len(alice), 1)
                self.assertEqual(alice[0]["id"], "shared-id")
                self.assertEqual(alice[0]["name"], "Alice Plan")
                self.assertEqual(len(bob), 1)
                self.assertNotEqual(bob[0]["id"], "shared-id")
                self.assertEqual(bob[0]["id"], bob_rows[0]["id"])
                self.assertEqual(bob[0]["name"], "Bob Plan")

    def test_same_owner_upsert_updates_existing_row(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            db_path = Path(td) / "stitch_auth.db"
            with patch.dict(os.environ, {"STITCH_AUTH_DB": str(db_path)}):
                import stitch_auth.store as store

                importlib.reload(store)

                store.subscriptions_upsert_many(
                    "alice@example.com",
                    [{"id": "sub-1", "name": "Old", "amountUsd": 5, "dueDateIso": "2026-05-10"}],
                )
                store.subscriptions_upsert_many(
                    "alice@example.com",
                    [{"id": "sub-1", "name": "New", "amountUsd": 7, "dueDateIso": "2026-05-12"}],
                )

                rows = store.subscriptions_list("alice@example.com")

                self.assertEqual(len(rows), 1)
                self.assertEqual(rows[0]["id"], "sub-1")
                self.assertEqual(rows[0]["name"], "New")
                self.assertEqual(rows[0]["amountUsd"], 7.0)


if __name__ == "__main__":
    unittest.main()
