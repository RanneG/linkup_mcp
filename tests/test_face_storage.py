"""Round-trip tests for encrypted face enrollment storage (no DeepFace)."""
from __future__ import annotations

import importlib
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np


class TestFaceStorage(unittest.TestCase):
    def test_save_load_delete(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            fake_home = Path(td) / "h"
            fake_home.mkdir()
            dbdir = fake_home / "stitch" / "face_db"
            with patch.dict(os.environ, {"STITCH_FACE_DB_DIR": str(dbdir)}):
                import face_verification.storage as storage

                importlib.reload(storage)

                email = "User@Example.com"
                emb = [np.random.randn(128).astype(float).tolist()]
                storage.save_enrollment(email, emb, model_name="Facenet")
                self.assertTrue(storage.is_enrolled(email))
                rec = storage.load_enrollment(email)
                self.assertIsNotNone(rec)
                assert rec is not None
                self.assertEqual(len(rec.embeddings), 1)
                self.assertTrue(storage.delete_enrollment(email))
                self.assertFalse(storage.is_enrolled(email))


if __name__ == "__main__":
    unittest.main()
