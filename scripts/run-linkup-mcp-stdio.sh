#!/usr/bin/env bash
# Stdio MCP entrypoint for Hermes — runs linkup_mcp server.py with env loaded.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -x "$ROOT/.venv/bin/python" ]]; then
  echo "linkup_mcp venv missing. Run: cd $ROOT && python3 -m venv .venv && .venv/bin/pip install -e ." >&2
  exit 1
fi

# Do not `source` any .env here — Hermes and hand-edited .env files often break bash
# (bare UUIDs, unquoted Chrome paths). server.py calls load_dotenv() from the repo root.
exec "$ROOT/.venv/bin/python" -u "$ROOT/server.py"
