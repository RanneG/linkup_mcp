#!/usr/bin/env bash
# Stdio MCP entrypoint for Hermes — runs linkup_mcp server.py with env loaded.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -x "$ROOT/.venv/bin/python" ]]; then
  echo "linkup_mcp venv missing. Run: cd $ROOT && uv sync" >&2
  exit 1
fi

# Hermes stdio MCP passes a filtered env — load secrets here.
set -a
[[ -f "$HOME/.hermes/.env" ]] && source "$HOME/.hermes/.env"
[[ -f "$ROOT/.env" ]] && source "$ROOT/.env"
set +a

if [[ -z "${LINKUP_API_KEY:-}" ]]; then
  echo "LINKUP_API_KEY not set. Add to $ROOT/.env or ~/.hermes/.env" >&2
  exit 1
fi

exec "$ROOT/.venv/bin/python" "$ROOT/server.py"
