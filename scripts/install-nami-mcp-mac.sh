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

if [[ -z "${LINKUP_API_KEY:-}" ]]; then
  set -a
  # shellcheck disable=SC1091
  [[ -f "$ROOT/.env" ]] && source "$ROOT/.env"
  set +a
fi

if [[ -z "${LINKUP_API_KEY:-}" ]]; then
  echo "ERROR: LINKUP_API_KEY missing." >&2
  echo "  Add to $ROOT/.env or ~/.hermes/.env then re-run." >&2
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
import pathlib, re, textwrap

config = pathlib.Path("$CONFIG")
runner = "$RUNNER"
block = textwrap.dedent(f"""
  linkup:
    command: /bin/bash
    args: [{runner!r}]
    timeout: 180
    connect_timeout: 120
""").strip()

if not config.exists():
    config.write_text("mcp_servers:\n" + block + "\n", encoding="utf-8")
else:
    text = config.read_text(encoding="utf-8")
    if re.search(r"^\\s*linkup:", text, re.M):
        print("mcp_servers.linkup already present in config.yaml — skipped YAML edit")
    elif "mcp_servers:" in text:
        text = text.replace("mcp_servers:", "mcp_servers:\n" + block, 1)
        config.write_text(text, encoding="utf-8")
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
