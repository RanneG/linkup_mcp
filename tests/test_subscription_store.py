"""Regression tests for per-owner Stitch subscription storage."""

from __future__ import annotations

import importlib
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class TestSubscriptionStore(unittest.TestCase):
    def test_upsert_cannot_reassign_subscription_to_different_owner(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            db_path = Path(td) / "stitch_auth.db"
            with patch.dict(os.environ, {"STITCH_AUTH_DB": str(db_path)}):
                import stitch_auth.store as store

                importlib.reload(store)

                store.subscriptions_upsert_many(
                    "owner-a@example.com",
                    [
                        {
                            "id": "shared-id",
                            "name": "Original",
                            "amountUsd": 9.99,
                            "dueDateIso": "2026-06-01",
                        }
                    ],
                )

                with self.assertRaises(PermissionError):
                    store.subscriptions_upsert_many(
                        "owner-b@example.com",
                        [
                            {
                                "id": "shared-id",
                                "name": "Stolen",
                                "amountUsd": 1.0,
                                "dueDateIso": "2026-06-02",
                            }
                        ],
                    )

                owner_a = store.subscriptions_list("owner-a@example.com")
                owner_b = store.subscriptions_list("owner-b@example.com")
                self.assertEqual(len(owner_a), 1)
                self.assertEqual(owner_a[0]["name"], "Original")
                self.assertEqual(owner_a[0]["amountUsd"], 9.99)
                self.assertEqual(owner_b, [])

    def test_upsert_allows_existing_owner_to_update_subscription(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            db_path = Path(td) / "stitch_auth.db"
            with patch.dict(os.environ, {"STITCH_AUTH_DB": str(db_path)}):
                import stitch_auth.store as store

                importlib.reload(store)

                store.subscriptions_upsert_many(
                    "owner@example.com",
                    [
                        {
                            "id": "sub-id",
                            "name": "Before",
                            "amountUsd": 4.0,
                            "dueDateIso": "2026-06-01",
                        }
                    ],
                )
                store.subscriptions_upsert_many(
                    "owner@example.com",
                    [
                        {
                            "id": "sub-id",
                            "name": "After",
                            "amountUsd": 5.0,
                            "dueDateIso": "2026-06-02",
                        }
                    ],
                )

                rows = store.subscriptions_list("owner@example.com")
                self.assertEqual(len(rows), 1)
                self.assertEqual(rows[0]["name"], "After")
                self.assertEqual(rows[0]["amountUsd"], 5.0)
                self.assertEqual(rows[0]["dueDateIso"], "2026-06-02")


if __name__ == "__main__":
    unittest.main()
