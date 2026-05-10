"""Regression tests for Stitch bridge SPA static-file containment."""
from __future__ import annotations

import importlib
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch


def _stub_rag_modules() -> dict[str, types.ModuleType]:
    rag_runtime = types.ModuleType("rag_runtime")

    async def ensure_rag_ready():
        raise RuntimeError("not used in static route tests")

    rag_runtime.ensure_rag_ready = ensure_rag_ready  # type: ignore[attr-defined]

    rag_contract = types.ModuleType("rag_stitch_contract")
    rag_contract._to_stitch_view = lambda payload: payload  # type: ignore[attr-defined]

    async def rag_stitch_help_query(query: str) -> dict:
        return {"answer": query}

    rag_contract.rag_stitch_help_query = rag_stitch_help_query  # type: ignore[attr-defined]
    rag_contract.read_stitch_user_guide_text = lambda: ""  # type: ignore[attr-defined]
    return {"rag_runtime": rag_runtime, "rag_stitch_contract": rag_contract}


def _import_bridge_for_dist(dist: Path):
    try:
        import flask  # noqa: F401
        import numpy  # noqa: F401
        import dotenv  # noqa: F401
    except Exception as exc:  # pragma: no cover - depends on optional bridge deps
        raise unittest.SkipTest(f"bridge dependencies unavailable: {exc}") from exc

    sys.modules.pop("stitch_rag_bridge", None)
    with patch.dict(sys.modules, _stub_rag_modules()):
        with patch.dict(os.environ, {"STITCH_DESKTOP_DIST": str(dist)}):
            bridge = importlib.import_module("stitch_rag_bridge")
            bridge.app.config["STITCH_SPA_ROOT"] = str(dist)
            return bridge


class StitchBridgeStaticFileTests(unittest.TestCase):
    def test_spa_static_routes_do_not_escape_dist_root(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            dist = base / "dist"
            sibling = base / "dist_evil"
            assets = dist / "assets"
            assets.mkdir(parents=True)
            sibling.mkdir()
            (dist / "index.html").write_text("INDEX", encoding="utf-8")
            (assets / "app.js").write_text("APP", encoding="utf-8")
            (sibling / "secret.txt").write_text("SECRET", encoding="utf-8")

            bridge = _import_bridge_for_dist(dist)
            bridge.app.config["TESTING"] = True
            client = bridge.app.test_client()

            normal_asset = client.get("/assets/app.js")
            self.assertEqual(normal_asset.status_code, 200)
            self.assertEqual(normal_asset.data, b"APP")

            for path in (
                "/../dist_evil/secret.txt",
                "/%2e%2e/dist_evil/secret.txt",
                "/assets/..%2Findex.html",
                "/assets/%2e%2e%2Findex.html",
            ):
                with self.subTest(path=path):
                    response = client.get(path)
                    self.assertEqual(response.status_code, 404)
                    self.assertNotIn(b"SECRET", response.data)


if __name__ == "__main__":
    unittest.main()
