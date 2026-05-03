"""Regression tests for Stitch subscription persistence boundaries."""
from __future__ import annotations

import importlib
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class TestSubscriptionStore(unittest.TestCase):
    def test_upsert_cannot_reassign_subscription_to_another_owner(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            db_path = Path(td) / "auth.db"
            with patch.dict(os.environ, {"STITCH_AUTH_DB": str(db_path)}):
                import stitch_auth.store as store

                importlib.reload(store)

                [created] = store.subscriptions_upsert_many(
                    "alice@example.com",
                    [
                        {
                            "id": "shared-id",
                            "name": "Alice Plan",
                            "category": "software",
                            "amountUsd": 12.34,
                            "dueDateIso": "2026-06-01",
                            "status": "pending",
                        }
                    ],
                )

                blocked = store.subscriptions_upsert_many(
                    "bob@example.com",
                    [
                        {
                            "id": created["id"],
                            "name": "Bob Takeover",
                            "category": "streaming",
                            "amountUsd": 99.99,
                            "dueDateIso": "2026-07-01",
                            "status": "paid",
                        }
                    ],
                )

                self.assertEqual(blocked, [])
                self.assertEqual(store.subscriptions_list("bob@example.com"), [])

                [alice_subscription] = store.subscriptions_list("alice@example.com")
                self.assertEqual(alice_subscription["id"], "shared-id")
                self.assertEqual(alice_subscription["ownerEmail"], "alice@example.com")
                self.assertEqual(alice_subscription["name"], "Alice Plan")
                self.assertEqual(alice_subscription["amountUsd"], 12.34)

    def test_upsert_allows_existing_owner_to_update_subscription(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            db_path = Path(td) / "auth.db"
            with patch.dict(os.environ, {"STITCH_AUTH_DB": str(db_path)}):
                import stitch_auth.store as store

                importlib.reload(store)

                store.subscriptions_upsert_many(
                    "alice@example.com",
                    [
                        {
                            "id": "owned-id",
                            "name": "Old Plan",
                            "amountUsd": 5,
                            "dueDateIso": "2026-06-01",
                        }
                    ],
                )
                [updated] = store.subscriptions_upsert_many(
                    "alice@example.com",
                    [
                        {
                            "id": "owned-id",
                            "name": "New Plan",
                            "category": "music",
                            "amountUsd": 7.5,
                            "dueDateIso": "2026-08-01",
                            "status": "active",
                        }
                    ],
                )

                self.assertEqual(updated["name"], "New Plan")
                [stored] = store.subscriptions_list("alice@example.com")
                self.assertEqual(stored["ownerEmail"], "alice@example.com")
                self.assertEqual(stored["name"], "New Plan")
                self.assertEqual(stored["category"], "music")
                self.assertEqual(stored["amountUsd"], 7.5)


if __name__ == "__main__":
    unittest.main()
