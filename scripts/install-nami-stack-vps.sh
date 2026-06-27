#!/usr/bin/env bash
# One-shot Nami stack on Linux VPS: personality, skills, RAG corpus, MCP, model routing, verify.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "WARN: This script targets Linux VPS. On Mac use install-nami-stack-mac.sh" >&2
fi

echo "=== 1/5 Personality + skills ==="
bash "$ROOT/scripts/install-nami-hermes.sh"

echo ""
echo "=== 2/5 RAG corpus ==="
"$ROOT/.venv/bin/python" -m nami_corpus.sync 2>/dev/null || \
  python3 -m nami_corpus.sync

echo ""
echo "=== 3/5 linkup MCP ==="
bash "$ROOT/scripts/install-nami-mcp-mac.sh"

echo ""
echo "=== 4/5 Model routing ==="
if command -v ollama >/dev/null && curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  bash "$ROOT/scripts/apply-nami-model-routing.sh"
else
  echo "Skipping Ollama model routing (no local Ollama — cloud model OK on small VPS)."
fi

echo ""
echo "=== 5/5 Verify ==="
bash "$ROOT/scripts/verify-nami-hermes.sh"

echo ""
echo "Done. Restart gateway: hermes gateway restart"
echo "Or install service: bash scripts/install-nami-gateway-systemd.sh"
echo "Telegram: /reload-mcp then ask Nami a question."
