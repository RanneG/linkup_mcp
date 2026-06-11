#!/usr/bin/env bash
# Register linkup_mcp as a Hermes MCP server on the default (Nami) profile.
# Run on Mac after: uv sync, LINKUP_API_KEY in .env, Ollama for RAG optional.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RUNNER="$ROOT/scripts/run-linkup-mcp-stdio.sh"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
CONFIG="$HERMES_HOME/config.yaml"

chmod +x "$RUNNER"

dotenv_has_linkup_key() {
  local dotenv_file="$1"
  [[ -f "$dotenv_file" ]] || return 1
  DOTENV_FILE="$dotenv_file" python3 - <<'PY'
import os
import pathlib
import sys

path = pathlib.Path(os.environ["DOTENV_FILE"])
try:
    lines = path.read_text(encoding="utf-8").splitlines()
except OSError:
    sys.exit(1)

for raw in lines:
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    if key.strip() == "LINKUP_API_KEY" and value.strip() and not value.strip().startswith("#"):
        sys.exit(0)

sys.exit(1)
PY
}

if [[ ! -x "$ROOT/.venv/bin/python" ]]; then
  echo "Creating venv and installing linkup_mcp..."
  if command -v uv >/dev/null; then
    uv sync
  else
    echo "uv not found — using python3 -m venv + pip (or: curl -LsSf https://astral.sh/uv/install.sh | sh)"
    python3 -m venv "$ROOT/.venv"
    "$ROOT/.venv/bin/pip" install -q -U pip
    "$ROOT/.venv/bin/pip" install -q -e "$ROOT"
  fi
fi

if [[ -z "${LINKUP_API_KEY:-}" ]] && ! dotenv_has_linkup_key "$ROOT/.env"; then
  echo "ERROR: LINKUP_API_KEY missing." >&2
  echo "  Export LINKUP_API_KEY or add it to $ROOT/.env, then re-run." >&2
  exit 1
fi

mkdir -p "$HERMES_HOME"

if [[ ! -f "$CONFIG" ]]; then
  echo "WARN: $CONFIG not found — run hermes setup first." >&2
fi

# Prefer CLI if available; fall back to idempotent YAML block.
# Use bash explicitly — Hermes probes the subprocess at add time.
if hermes mcp add linkup --command /bin/bash --args "$RUNNER" 2>/dev/null; then
  echo "Registered via: hermes mcp add linkup (bash → runner)"
else
  python3 <<PY
import pathlib
import re

config = pathlib.Path("$CONFIG")
runner = "$RUNNER"
block = f"""\
  linkup:
    command: /bin/bash
    args: [{runner!r}]
    timeout: 180
    connect_timeout: 120
"""


def has_linkup_server(text: str) -> bool:
    in_mcp_servers = False
    mcp_indent = 0
    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(raw_line) - len(raw_line.lstrip(" "))
        if stripped == "mcp_servers:":
            in_mcp_servers = True
            mcp_indent = indent
            continue
        if in_mcp_servers and indent <= mcp_indent:
            in_mcp_servers = False
        if in_mcp_servers and stripped == "linkup:":
            return True
    return False

if not config.exists():
    config.write_text("mcp_servers:\n" + block + "\n", encoding="utf-8")
else:
    text = config.read_text(encoding="utf-8")
    if has_linkup_server(text):
        print("mcp_servers.linkup already present in config.yaml — skipped YAML edit")
    elif re.search(r"(?m)^\\s*mcp_servers:\\s*$", text):
        text = re.sub(
            r"(?m)^(\\s*mcp_servers:\\s*)$",
            lambda match: match.group(1) + "\n" + block.rstrip(),
            text,
            count=1,
        )
        config.write_text(text.rstrip() + "\n", encoding="utf-8")
        print("Appended linkup under mcp_servers in config.yaml")
    else:
        config.write_text(text.rstrip() + "\\n\\nmcp_servers:\\n" + block + "\\n", encoding="utf-8")
        print("Added mcp_servers.linkup to config.yaml")
PY
fi

echo ""
echo "Done. Restart gateway and test from Telegram:"
echo "  hermes gateway restart"
echo "  # or: hermes gateway stop && hermes gateway start"
echo "In chat: /reload-mcp  then ask Nami to search the web or query data/ RAG."
