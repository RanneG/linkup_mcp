"""Regression tests for bridge landing-page setup guidance."""
from __future__ import annotations

import importlib
import unittest


try:
    stitch_rag_bridge = importlib.import_module("stitch_rag_bridge")
except ImportError as exc:  # pragma: no cover - default install lacks stitch-bridge extras
    stitch_rag_bridge = None
    _IMPORT_ERROR = exc
else:
    _IMPORT_ERROR = None


@unittest.skipIf(stitch_rag_bridge is None, f"stitch-bridge extras unavailable: {_IMPORT_ERROR}")
class BridgeRootHtmlTests(unittest.TestCase):
    def test_launcher_guidance_points_to_stitch_app(self) -> None:
        html = stitch_rag_bridge._BRIDGE_ROOT_HTML

        self.assertIn("stitch-app</strong> repo root", html)
        self.assertIn("<code>Stitch.bat</code>", html)
        self.assertIn("<code>Stitch-Desktop.bat</code>", html)
        self.assertNotIn("<code>linkup_mcp</code> repo root", html)
        self.assertNotIn("npm run launch:stitch", html)


if __name__ == "__main__":
    unittest.main()
