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

    def _fake_hermes(self, bin_dir: Path, log_path: Path, status_text: str) -> None:
        fake_hermes = bin_dir / "hermes"
        fake_hermes.write_text(
            "#!/bin/sh\n"
            f"printf '%s\\n' \"$*\" >> {str(log_path)!r}\n"
            'if [ "$1" = "gateway" ] && [ "$2" = "status" ]; then\n'
            f"  printf '%s\\n' {status_text!r}\n"
            "fi\n"
            "exit 0\n",
            encoding="utf-8",
        )
        fake_hermes.chmod(fake_hermes.stat().st_mode | stat.S_IXUSR)

    def _run_with_fake_hermes(self, script: Path, status_text: str) -> tuple[str, str]:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp = Path(temp_dir)
            log_path = temp / "hermes.log"
            bin_dir = temp / "bin"
            bin_dir.mkdir()
            self._fake_hermes(bin_dir, log_path, status_text)
            env = os.environ.copy()
            env["PATH"] = f"{bin_dir}{os.pathsep}{env.get('PATH', '')}"
            proc = subprocess.run(
                ["bash", str(script)],
                cwd=ROOT,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            log = log_path.read_text(encoding="utf-8") if log_path.exists() else ""
            output = (proc.stdout or "") + (proc.stderr or "")
            return log, output

    @unittest.skipUnless(_BASH_SCRIPT_TESTS, "requires Unix bash (CI on Linux)")
    def test_start_gateway_starts_when_status_says_not_running(self) -> None:
        log, output = self._run_with_fake_hermes(
            ROOT / "scripts" / "start-nami-gateway.sh",
            "✗ Gateway is not running",
        )

        self.assertIn("gateway start", log)
        self.assertNotIn("Gateway already running.", output)

    @unittest.skipUnless(_BASH_SCRIPT_TESTS, "requires Unix bash (CI on Linux)")
    def test_start_gateway_skips_when_status_says_running(self) -> None:
        log, output = self._run_with_fake_hermes(
            ROOT / "scripts" / "start-nami-gateway.sh",
            "✓ Gateway is running (PID: 42)",
        )

        self.assertNotIn("gateway start", log)
        self.assertIn("Gateway already running.", output)

    @unittest.skipUnless(_BASH_SCRIPT_TESTS, "requires Unix bash (CI on Linux)")
    def test_verify_does_not_pass_gateway_when_status_says_not_running(self) -> None:
        _log, output = self._run_with_fake_hermes(
            ROOT / "scripts" / "verify-nami-hermes.sh",
            "✗ Gateway is not running",
        )

        self.assertIn("WARN gateway not running", output)
        self.assertNotIn("OK  gateway running", output)

    def test_windows_gateway_start_rejects_not_running_substring(self) -> None:
        script = (ROOT / "scripts" / "Start-NamiGateway.ps1").read_text(encoding="utf-8")

        self.assertNotIn('if ($status -match "running")', script)
        self.assertIn("not\\s+running", script)


if __name__ == "__main__":
    unittest.main()
