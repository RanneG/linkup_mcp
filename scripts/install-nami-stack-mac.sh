#!/usr/bin/env bash
# One-shot Nami stack on Mac: personality, skills, RAG corpus, MCP, model routing, verify.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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
bash "$ROOT/scripts/apply-nami-model-routing.sh"

echo ""
echo "=== 5/5 Verify ==="
bash "$ROOT/scripts/verify-nami-hermes.sh"

echo ""
echo "Done. Restart gateway: hermes gateway restart"
echo "Telegram: /reload-mcp then ask Nami a RAG question (e.g. Stitch bridge port)."
