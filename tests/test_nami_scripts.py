"""Safety checks for Nami/Hermes helper scripts."""

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def _script(name: str) -> str:
    return (ROOT / "scripts" / name).read_text(encoding="utf-8")


def test_nami_gateway_helper_does_not_kill_other_profiles():
    text = _script("start-nami-gateway.sh")

    assert "hermes gateway start" in text
    assert "pkill" not in text
    assert "killall" not in text
    assert "hermes gateway stop" not in text


def test_nami_mcp_installer_does_not_source_dotenv_as_shell():
    text = _script("install-nami-mcp-mac.sh")

    assert "source \"$ROOT/.env\"" not in text
    assert "source '$ROOT/.env'" not in text
    assert "~/.hermes/.env" not in text
    assert "has_linkup_api_key" in text


def test_nami_shell_scripts_parse():
    for name in (
        "install-nami-mcp-mac.sh",
        "run-linkup-mcp-stdio.sh",
        "start-nami-gateway.sh",
        "test-linkup-mcp-mac.sh",
    ):
        subprocess.run(["bash", "-n", str(ROOT / "scripts" / name)], check=True)
