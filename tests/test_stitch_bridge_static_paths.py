"""Security tests for Stitch bridge SPA static file serving."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import ModuleType
from unittest.mock import patch

try:
    rag_runtime_stub = ModuleType("rag_runtime")
    rag_runtime_stub.ensure_rag_ready = lambda: None  # type: ignore[attr-defined]
    rag_contract_stub = ModuleType("rag_stitch_contract")
    rag_contract_stub._to_stitch_view = lambda payload: payload  # type: ignore[attr-defined]
    rag_contract_stub.rag_stitch_help_query = lambda query: {}  # type: ignore[attr-defined]
    rag_contract_stub.read_stitch_user_guide_text = lambda: ""  # type: ignore[attr-defined]
    with patch.dict(
        "sys.modules",
        {
            "rag_runtime": rag_runtime_stub,
            "rag_stitch_contract": rag_contract_stub,
        },
    ):
        from stitch_rag_bridge import app, register_stitch_spa_routes
except ImportError as exc:  # pragma: no cover - default install may omit stitch-bridge extras
    app = None
    register_stitch_spa_routes = None
    _IMPORT_ERROR = exc
else:
    _IMPORT_ERROR = None


@unittest.skipIf(app is None, f"stitch bridge dependencies unavailable: {_IMPORT_ERROR}")
class StitchBridgeStaticPathTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        base = Path(self._tmp.name)
        self.dist = base / "dist"
        self.dist.mkdir()
        (self.dist / "index.html").write_text("<html>ok</html>", encoding="utf-8")
        (self.dist / "assets").mkdir()
        (self.dist / "assets" / "app.js").write_text("console.log('ok')", encoding="utf-8")
        (base / "dist_evil").mkdir()
        (base / "dist_evil" / "secret.txt").write_text("outside root", encoding="utf-8")
        (self.dist / "assets_evil").mkdir()
        (self.dist / "assets_evil" / "secret.txt").write_text("outside assets", encoding="utf-8")

        assert app is not None
        app.config.update(TESTING=True, STITCH_SPA_ROOT=str(self.dist))
        assert register_stitch_spa_routes is not None
        register_stitch_spa_routes()
        self.client = app.test_client()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_serves_valid_asset_under_assets_dir(self) -> None:
        response = self.client.get("/assets/app.js")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"console.log('ok')", response.data)

    def test_rejects_sibling_assets_prefix_escape(self) -> None:
        response = self.client.get("/assets/..%2Fassets_evil%2Fsecret.txt")
        self.assertEqual(response.status_code, 404)
        self.assertNotIn(b"outside assets", response.data)

    def test_rejects_sibling_spa_root_prefix_escape(self) -> None:
        response = self.client.get("/%2e%2e%2Fdist_evil%2Fsecret.txt")
        self.assertEqual(response.status_code, 404)
        self.assertNotIn(b"outside root", response.data)


if __name__ == "__main__":
    unittest.main()
