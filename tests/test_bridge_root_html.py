"""Regression tests for bridge landing-page setup guidance."""
from __future__ import annotations

import ast
from pathlib import Path
import unittest


def _bridge_root_html() -> str:
    source = Path(__file__).resolve().parents[1] / "stitch_rag_bridge.py"
    module = ast.parse(source.read_text(encoding="utf-8"))
    for node in module.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "_BRIDGE_ROOT_HTML":
                    value = ast.literal_eval(node.value)
                    if isinstance(value, str):
                        return value
    raise AssertionError("_BRIDGE_ROOT_HTML assignment not found")


class BridgeRootHtmlTests(unittest.TestCase):
    def test_launcher_guidance_points_to_stitch_app(self) -> None:
        html = _bridge_root_html()

        self.assertIn("stitch-app</strong> repo root", html)
        self.assertIn("<code>Stitch.bat</code>", html)
        self.assertIn("<code>Stitch-Desktop.bat</code>", html)
        self.assertNotIn("<code>linkup_mcp</code> repo root", html)
        self.assertNotIn("npm run launch:stitch", html)


if __name__ == "__main__":
    unittest.main()
