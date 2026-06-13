"""Safety checks for Nami/Hermes helper scripts."""

from __future__ import annotations

import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def test_mcp_installer_does_not_source_dotenv_as_shell() -> None:
    script = (ROOT / "scripts" / "install-nami-mcp-mac.sh").read_text(encoding="utf-8")

    assert not re.search(r"\bsource\s+[^#\n]*\.env", script)
    assert not re.search(r"\.\s+[^#\n]*\.env", script)


def test_mcp_installer_yaml_fallback_nests_linkup_under_mcp_servers(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    scripts = repo / "scripts"
    scripts.mkdir(parents=True)
    installer = scripts / "install-nami-mcp-mac.sh"
    installer.write_text(
        (ROOT / "scripts" / "install-nami-mcp-mac.sh").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    installer.chmod(0o755)
    runner = scripts / "run-linkup-mcp-stdio.sh"
    runner.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")

    fake_python = repo / ".venv" / "bin" / "python"
    fake_python.parent.mkdir(parents=True)
    fake_python.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
    fake_python.chmod(0o755)

    hermes_home = tmp_path / "hermes"
    bin_dir = tmp_path / "bin"
    marker = tmp_path / "env-source-marker"
    bin_dir.mkdir()
    hermes_home.mkdir()
    (hermes_home / ".env").write_text(
        f"LINKUP_API_KEY=from-hermes-env\nMALICIOUS=$(touch {marker})\n",
        encoding="utf-8",
    )
    (bin_dir / "hermes").write_text("#!/usr/bin/env bash\nexit 1\n", encoding="utf-8")
    (bin_dir / "hermes").chmod(0o755)

    result = subprocess.run(
        ["/bin/bash", str(installer)],
        cwd=repo,
        env={
            "HOME": str(tmp_path),
            "HERMES_HOME": str(hermes_home),
            "PATH": f"{bin_dir}:/usr/bin:/bin",
        },
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert not marker.exists()
    config = (hermes_home / "config.yaml").read_text(encoding="utf-8")
    assert "mcp_servers:\n  linkup:\n    command: /bin/bash" in config


def test_gateway_starter_does_not_globally_kill_hermes_processes() -> None:
    script = (ROOT / "scripts" / "start-nami-gateway.sh").read_text(encoding="utf-8")

    assert "pkill" not in script
    assert "killall" not in script
