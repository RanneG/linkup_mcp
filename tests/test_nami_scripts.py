"""Regression tests for Nami/Hermes helper scripts."""

from __future__ import annotations

import os
import shutil
import stat
import subprocess
import textwrap
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def _write_executable(path: Path, body: str) -> None:
    path.write_text(body, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def _run_installer_fallback(tmp_path: Path, existing_config: str | None = None) -> str:
    fake_repo = tmp_path / "repo"
    scripts_dir = fake_repo / "scripts"
    scripts_dir.mkdir(parents=True)
    shutil.copy2(REPO_ROOT / "scripts" / "install-nami-mcp-mac.sh", scripts_dir)
    shutil.copy2(REPO_ROOT / "scripts" / "run-linkup-mcp-stdio.sh", scripts_dir)

    # Satisfy the installer's venv check without invoking dependency installation.
    venv_bin = fake_repo / ".venv" / "bin"
    venv_bin.mkdir(parents=True)
    _write_executable(venv_bin / "python", "#!/usr/bin/env sh\nexit 0\n")

    hermes_home = tmp_path / "hermes"
    hermes_home.mkdir()
    config = hermes_home / "config.yaml"
    if existing_config is not None:
        config.write_text(existing_config, encoding="utf-8")

    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    _write_executable(
        fake_bin / "hermes",
        "#!/usr/bin/env bash\n"
        "# Force the installer down its Python YAML fallback path.\n"
        "exit 1\n",
    )

    env = os.environ.copy()
    env.update(
        {
            "HERMES_HOME": str(hermes_home),
            "LINKUP_API_KEY": "test-key",
            "PATH": f"{fake_bin}{os.pathsep}{env.get('PATH', '')}",
        }
    )
    result = subprocess.run(
        ["bash", str(scripts_dir / "install-nami-mcp-mac.sh")],
        cwd=fake_repo,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr + result.stdout
    return config.read_text(encoding="utf-8")


def test_install_nami_mcp_fallback_creates_nested_mcp_server(tmp_path: Path) -> None:
    config = _run_installer_fallback(tmp_path)

    assert config.startswith("mcp_servers:\n  linkup:\n")
    assert "\n    command: /bin/bash\n" in config
    assert "\n    connect_timeout: 120\n" in config


def test_install_nami_mcp_fallback_repairs_top_level_linkup(tmp_path: Path) -> None:
    config = _run_installer_fallback(
        tmp_path,
        existing_config=textwrap.dedent(
            """
            profile: nami
            mcp_servers:
              other:
                command: /bin/true
            linkup:
              command: /bad/top-level
            """
        ).lstrip(),
    )

    assert "mcp_servers:\n  linkup:\n    command: /bin/bash\n" in config
    assert "\n  other:\n    command: /bin/true\n" in config
    assert "\nlinkup:\n  command: /bad/top-level\n" in config


def test_start_nami_gateway_does_not_kill_by_process_name() -> None:
    script = (REPO_ROOT / "scripts" / "start-nami-gateway.sh").read_text(encoding="utf-8")

    assert "pkill" not in script
    assert "killall" not in script
    assert "not killing by process name" in script
