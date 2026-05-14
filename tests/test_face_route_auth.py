"""Route-level authorization tests for Stitch face enrollment APIs."""
from __future__ import annotations

import importlib
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np


class FakeFaceStorage:
    def __init__(self) -> None:
        self.records: dict[str, list[list[float]]] = {}
        self.verified: set[str] = set()

    @staticmethod
    def _key(email: str) -> str:
        return email.strip().lower()

    def save_enrollment(self, email: str, embeddings: list, *, model_name: str) -> None:
        self.records[self._key(email)] = [np.asarray(e, dtype=float).tolist() for e in embeddings]

    def load_enrollment(self, email: str):
        embeddings = self.records.get(self._key(email))
        if embeddings is None:
            return None
        return SimpleNamespace(embeddings=embeddings, model_name="Facenet")

    def is_enrolled(self, email: str) -> bool:
        return self._key(email) in self.records

    def delete_enrollment(self, email: str) -> bool:
        return self.records.pop(self._key(email), None) is not None

    def touch_last_verified(self, email: str) -> None:
        self.verified.add(self._key(email))


class TestFaceRouteAuth(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        root = Path(self.tempdir.name)
        env = patch.dict(
            os.environ,
            {
                "STITCH_AUTH_DB": str(root / "auth.db"),
                "STITCH_GOOGLE_FERNET_KEY": "test-fernet-key",
                "STITCH_FACE_DB_DIR": str(root / "face_db"),
            },
        )
        env.start()
        self.addCleanup(env.stop)

        import stitch_auth.store as store

        self.store = importlib.reload(store)
        self._stub_rag_bridge_dependencies()

        import stitch_rag_bridge as bridge

        self.bridge = importlib.reload(bridge)
        self.storage = FakeFaceStorage()

        def fake_face_imports():
            def decode_image_base64(_raw: str):
                return object()

            def embed_bgr(_image):
                return [0.1, 0.2, 0.3]

            def embed_bgr_enrollment_mode(_image, *, quality_check: str):
                return [0.1, 0.2, 0.3]

            def diagnose_enrollment_failure(_image):
                return "no face detected"

            def build_single_frame_enrollment_embeddings(_image, *, quality_check: str):
                return [[0.1, 0.2, 0.3]], 0.99, None

            def enrollment_consistency_score(_embeddings: list) -> float:
                return 1.0

            def match_embeddings(_probe, _gallery, *, threshold: float):
                return 0.99, True

            def evaluate_liveness_sequence(_images: list):
                return True, "ok", {}

            return (
                decode_image_base64,
                0.35,
                "Facenet",
                embed_bgr,
                embed_bgr_enrollment_mode,
                diagnose_enrollment_failure,
                build_single_frame_enrollment_embeddings,
                enrollment_consistency_score,
                match_embeddings,
                evaluate_liveness_sequence,
                self.storage,
            )

        self.bridge._face_imports = fake_face_imports
        self.client = self.bridge.app.test_client()

    def _stub_rag_bridge_dependencies(self) -> None:
        previous: dict[str, object | None] = {}

        def install(name: str, module) -> None:
            previous[name] = sys.modules.get(name)
            sys.modules[name] = module

        rag_runtime = types.ModuleType("rag_runtime")

        async def ensure_rag_ready():
            raise AssertionError("RAG runtime should not be used by face route auth tests")

        rag_runtime.ensure_rag_ready = ensure_rag_ready
        install("rag_runtime", rag_runtime)

        rag_contract = types.ModuleType("rag_stitch_contract")
        rag_contract._to_stitch_view = lambda payload: payload
        rag_contract.rag_stitch_help_query = lambda query: {"answer": query}
        rag_contract.read_stitch_user_guide_text = lambda: ""
        install("rag_stitch_contract", rag_contract)

        def restore() -> None:
            for name, module in previous.items():
                if module is None:
                    sys.modules.pop(name, None)
                else:
                    sys.modules[name] = module

        self.addCleanup(restore)

    def _session_for(self, email: str) -> str:
        account_id = self.store.google_account_upsert(email, "google-sub", "refresh-token", None)
        return self.store.session_create([account_id], email)

    def test_face_delete_requires_session_before_removing_enrollment(self) -> None:
        self.storage.records["victim@example.com"] = [[0.1, 0.2, 0.3]]

        resp = self.client.post("/api/face/delete", json={"email": "victim@example.com"})

        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.get_json()["error"], "not_authenticated")
        self.assertTrue(self.storage.is_enrolled("victim@example.com"))

    def test_face_delete_rejects_email_outside_session(self) -> None:
        sid = self._session_for("owner@example.com")
        self.storage.records["victim@example.com"] = [[0.1, 0.2, 0.3]]

        resp = self.client.post(
            "/api/face/delete",
            json={"email": "victim@example.com"},
            headers={"Authorization": f"Bearer {sid}"},
        )

        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.get_json()["error"], "email_not_in_session")
        self.assertTrue(self.storage.is_enrolled("victim@example.com"))

    def test_face_enroll_allows_active_session_email(self) -> None:
        sid = self._session_for("Owner@Example.com")

        resp = self.client.post(
            "/api/face/enroll",
            json={"email": "owner@example.com", "image": "base64-image"},
            headers={"Authorization": f"Bearer {sid}"},
        )

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.get_json()["ok"])
        self.assertTrue(self.storage.is_enrolled("owner@example.com"))

    def test_face_verify_rejects_email_outside_session_with_verify_shape(self) -> None:
        sid = self._session_for("owner@example.com")

        resp = self.client.post(
            "/api/face/verify",
            json={"email": "victim@example.com", "image": "base64-image"},
            headers={"Authorization": f"Bearer {sid}"},
        )

        payload = resp.get_json()
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(payload["verified"])
        self.assertEqual(payload["error"], "email_not_in_session")


if __name__ == "__main__":
    unittest.main()
