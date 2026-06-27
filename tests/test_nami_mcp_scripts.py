"""Regression tests for Nami/Hermes helper scripts."""

import os
import shutil
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
_BASH_SCRIPT_TESTS = os.name != "nt" and shutil.which("bash") is not None


class NamiMcpScriptTests(unittest.TestCase):
    def _run_install_with_failing_hermes(self, initial_config: str | None = None) -> str:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp = Path(temp_dir)
            repo = temp / "repo"
            scripts_dir = repo / "scripts"
            scripts_dir.mkdir(parents=True)

            shutil.copy2(ROOT / "scripts" / "install-nami-mcp-mac.sh", scripts_dir)
            shutil.copy2(ROOT / "scripts" / "run-linkup-mcp-stdio.sh", scripts_dir)

            venv_bin = repo / ".venv" / "bin"
            venv_bin.mkdir(parents=True)
            python_stub = venv_bin / "python"
            python_stub.write_text("#!/usr/bin/env sh\nexit 0\n", encoding="utf-8")
            python_stub.chmod(python_stub.stat().st_mode | stat.S_IXUSR)

            hermes_home = temp / "hermes"
            hermes_home.mkdir()
            config = hermes_home / "config.yaml"
            if initial_config is not None:
                config.write_text(initial_config, encoding="utf-8")

            fake_bin = temp / "bin"
            fake_bin.mkdir()
            fake_hermes = fake_bin / "hermes"
            fake_hermes.write_text("#!/usr/bin/env sh\nexit 1\n", encoding="utf-8")
            fake_hermes.chmod(fake_hermes.stat().st_mode | stat.S_IXUSR)

            env = os.environ.copy()
            env.update(
                {
                    "HERMES_HOME": str(hermes_home),
                    "LINKUP_API_KEY": "test-key",
                    "PATH": f"{fake_bin}{os.pathsep}{env.get('PATH', '')}",
                }
            )

            subprocess.run(
                ["bash", str(scripts_dir / "install-nami-mcp-mac.sh")],
                cwd=repo,
                env=env,
                check=True,
                capture_output=True,
                text=True,
            )
            return config.read_text(encoding="utf-8")

    @unittest.skipUnless(_BASH_SCRIPT_TESTS, "requires Unix bash (CI on Linux)")
    def test_fallback_writes_linkup_under_mcp_servers(self) -> None:
        config = self._run_install_with_failing_hermes()

        self.assertIn("mcp_servers:\n  linkup:\n    command: /bin/bash", config)
        self.assertNotIn("mcp_servers:\nlinkup:", config)

    @unittest.skipUnless(_BASH_SCRIPT_TESTS, "requires Unix bash (CI on Linux)")
    def test_fallback_repairs_prior_top_level_linkup_block(self) -> None:
        broken_config = (
            "profile: default\n"
            "mcp_servers:\n"
            "linkup:\n"
            "  command: /bin/bash\n"
        )

        config = self._run_install_with_failing_hermes(broken_config)

        self.assertIn("mcp_servers:\n  linkup:\n    command: /bin/bash", config)

    def test_start_gateway_does_not_kill_all_hermes_gateways(self) -> None:
        script = (ROOT / "scripts" / "start-nami-gateway.sh").read_text(encoding="utf-8")

        self.assertNotIn("pkill", script)


if __name__ == "__main__":
    unittest.main()
