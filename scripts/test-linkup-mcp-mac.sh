#!/usr/bin/env bash
# Quick smoke test for linkup_mcp stdio MCP on Mac (run before hermes mcp add).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RUNNER="$ROOT/scripts/run-linkup-mcp-stdio.sh"

echo "=== .env ==="
if [[ -f "$ROOT/.env" ]] && grep -q '^LINKUP_API_KEY=' "$ROOT/.env" 2>/dev/null; then
  echo "LINKUP_API_KEY: present in $ROOT/.env"
else
  echo "LINKUP_API_KEY: MISSING in $ROOT/.env (web_search will fail; MCP can still start)"
fi

echo "=== python import ==="
"$ROOT/.venv/bin/python" -c "import server; print('server.py import OK')"

echo "=== stdio runner (3s) — should stay alive, not exit immediately ==="
if command -v timeout >/dev/null; then
  timeout 3 bash "$RUNNER" && echo "unexpected: exited 0" || echo "OK: still running or timeout (expected)"
else
  echo "Run manually: bash $RUNNER  (Ctrl+C after a few seconds if no error)"
fi
