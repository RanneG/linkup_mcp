"""Regression tests for Stitch face verification route threshold handling."""
from __future__ import annotations

import importlib
import os
import sys
import tempfile
import unittest
from types import ModuleType, SimpleNamespace
from unittest.mock import patch

import numpy as np


class _FakeFaceStorage:
    def __init__(self) -> None:
        self.touched: list[str] = []

    def load_enrollment(self, email: str):
        if email.lower() != "user@example.com":
            return None
        return SimpleNamespace(embeddings=[[1.0, 0.0]], model_name="FakeFace")

    def touch_last_verified(self, email: str) -> None:
        self.touched.append(email)


def _rag_import_stubs() -> dict[str, ModuleType]:
    rag_runtime = ModuleType("rag_runtime")

    async def ensure_rag_ready():
        raise AssertionError("RAG runtime is not used by face verification tests")

    rag_runtime.ensure_rag_ready = ensure_rag_ready  # type: ignore[attr-defined]

    rag_contract = ModuleType("rag_stitch_contract")
    rag_contract._to_stitch_view = lambda payload: payload  # type: ignore[attr-defined]
    rag_contract.rag_stitch_help_query = ensure_rag_ready  # type: ignore[attr-defined]
    rag_contract.read_stitch_user_guide_text = lambda: ""  # type: ignore[attr-defined]
    return {"rag_runtime": rag_runtime, "rag_stitch_contract": rag_contract}


class TestFaceVerifyThreshold(unittest.TestCase):
    def test_verify_ignores_client_supplied_threshold(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            env = {
                "STITCH_AUTH_DB": os.path.join(td, "auth.db"),
                "STITCH_GOOGLE_FERNET_KEY": "test-face-threshold-key",
            }
            with patch.dict(os.environ, env):
                import stitch_auth.store as store

                importlib.reload(store)
                account_id = store.google_account_upsert("user@example.com", "sub", "refresh", None)
                session_id = store.session_create([account_id], "user@example.com")

                sys.modules.pop("stitch_rag_bridge", None)
                with patch.dict(sys.modules, _rag_import_stubs()):
                    import stitch_rag_bridge

                storage = _FakeFaceStorage()
                thresholds: list[float] = []

                def decode_image_base64(_raw: str):
                    return np.zeros((2, 2, 3), dtype=np.uint8)

                def embed_bgr(_image):
                    return np.asarray([0.2, 0.0], dtype=np.float64)

                def match_embeddings(_probe, _gallery, *, threshold: float):
                    thresholds.append(float(threshold))
                    return 0.2, bool(0.2 >= threshold)

                def fake_face_imports():
                    return (
                        decode_image_base64,
                        0.6,
                        "FakeFace",
                        embed_bgr,
                        lambda *_args, **_kwargs: None,
                        lambda *_args, **_kwargs: "diagnostic",
                        lambda *_args, **_kwargs: ([], 0.0, None),
                        lambda *_args, **_kwargs: 1.0,
                        match_embeddings,
                        lambda _images: (True, "ok", {}),
                        storage,
                    )

                with patch.object(stitch_rag_bridge, "_face_imports", side_effect=fake_face_imports):
                    client = stitch_rag_bridge.app.test_client()
                    resp = client.post(
                        "/api/face/verify",
                        json={
                            "email": "user@example.com",
                            "image": "fake-image",
                            "liveness_frames": ["fake-live-frame"],
                            "threshold": 0,
                        },
                        headers={"Authorization": f"Bearer {session_id}"},
                    )

                payload = resp.get_json()
                self.assertEqual(resp.status_code, 200)
                self.assertEqual(thresholds, [0.6])
                self.assertEqual(payload["threshold"], 0.6)
                self.assertFalse(payload["match"])
                self.assertFalse(payload["verified"])
                self.assertEqual(storage.touched, [])

                if store._conn is not None:
                    store._conn.close()
                    store._conn = None


if __name__ == "__main__":
    unittest.main()
