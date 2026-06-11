"""Safety checks for Nami/Hermes helper scripts."""
from __future__ import annotations

import os
import shutil
import stat
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def _write_executable(path: Path, contents: str) -> None:
    path.write_text(textwrap.dedent(contents), encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


class NamiScriptTests(unittest.TestCase):
    def test_mcp_installer_fallback_writes_nested_linkup_config(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            temp_root = Path(td) / "repo"
            scripts_dir = temp_root / "scripts"
            scripts_dir.mkdir(parents=True)
            shutil.copy(ROOT / "scripts" / "install-nami-mcp-mac.sh", scripts_dir)
            shutil.copy(ROOT / "scripts" / "run-linkup-mcp-stdio.sh", scripts_dir)

            python_bin = temp_root / ".venv" / "bin" / "python"
            python_bin.parent.mkdir(parents=True)
            _write_executable(python_bin, "#!/usr/bin/env bash\nexit 0\n")

            fake_bin = Path(td) / "bin"
            fake_bin.mkdir()
            _write_executable(
                fake_bin / "hermes",
                """
                #!/usr/bin/env bash
                exit 1
                """,
            )

            hermes_home = Path(td) / "hermes"
            env = {
                **os.environ,
                "HERMES_HOME": str(hermes_home),
                "LINKUP_API_KEY": "test-key",
                "PATH": f"{fake_bin}{os.pathsep}{os.environ['PATH']}",
            }
            subprocess.run(
                ["bash", str(scripts_dir / "install-nami-mcp-mac.sh")],
                check=True,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )

            config = (hermes_home / "config.yaml").read_text(encoding="utf-8")
            self.assertIn("mcp_servers:\n  linkup:\n", config)
            self.assertNotIn("mcp_servers:\nlinkup:\n", config)
            self.assertIn("    command: /bin/bash\n", config)

    def test_mcp_installer_does_not_source_dotenv(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            temp_root = Path(td) / "repo"
            scripts_dir = temp_root / "scripts"
            scripts_dir.mkdir(parents=True)
            shutil.copy(ROOT / "scripts" / "install-nami-mcp-mac.sh", scripts_dir)
            shutil.copy(ROOT / "scripts" / "run-linkup-mcp-stdio.sh", scripts_dir)

            python_bin = temp_root / ".venv" / "bin" / "python"
            python_bin.parent.mkdir(parents=True)
            _write_executable(python_bin, "#!/usr/bin/env bash\nexit 0\n")

            marker = Path(td) / "dotenv-was-sourced"
            (temp_root / ".env").write_text(
                f"LINKUP_API_KEY=$(touch {marker})\n",
                encoding="utf-8",
            )

            fake_bin = Path(td) / "bin"
            fake_bin.mkdir()
            _write_executable(
                fake_bin / "hermes",
                """
                #!/usr/bin/env bash
                exit 1
                """,
            )

            env = {
                **os.environ,
                "HERMES_HOME": str(Path(td) / "hermes"),
                "PATH": f"{fake_bin}{os.pathsep}{os.environ['PATH']}",
            }
            env.pop("LINKUP_API_KEY", None)
            subprocess.run(
                ["bash", str(scripts_dir / "install-nami-mcp-mac.sh")],
                check=True,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )

            self.assertFalse(marker.exists())

    def test_gateway_starter_does_not_use_global_pkill(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            script = Path(td) / "start-nami-gateway.sh"
            shutil.copy(ROOT / "scripts" / "start-nami-gateway.sh", script)

            fake_bin = Path(td) / "bin"
            fake_bin.mkdir()
            hermes_log = Path(td) / "hermes.log"
            pkill_marker = Path(td) / "pkill-called"
            _write_executable(
                fake_bin / "hermes",
                f"""
                #!/usr/bin/env bash
                echo "$*" >> {hermes_log}
                if [[ "$1 $2" == "gateway status" ]]; then
                  exit 1
                fi
                exit 0
                """,
            )
            _write_executable(
                fake_bin / "pkill",
                f"""
                #!/usr/bin/env bash
                touch {pkill_marker}
                exit 0
                """,
            )

            env = {**os.environ, "PATH": f"{fake_bin}{os.pathsep}{os.environ['PATH']}"}
            subprocess.run(
                ["bash", str(script)],
                check=True,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )

            self.assertFalse(pkill_marker.exists())
            calls = hermes_log.read_text(encoding="utf-8").splitlines()
            self.assertIn("gateway stop", calls)
            self.assertIn("gateway start", calls)


if __name__ == "__main__":
    unittest.main()
