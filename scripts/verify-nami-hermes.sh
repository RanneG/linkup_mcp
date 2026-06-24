#!/usr/bin/env bash
# Health check for Nami runtime on Mac.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

pass() { echo "  OK  $*"; }
warn() { echo "  WARN $*"; FAIL=1; }
fail() { echo "  FAIL $*"; FAIL=1; }

echo "=== Nami Hermes verify ==="

if command -v hermes >/dev/null; then
  pass "hermes on PATH"
else
  fail "hermes not found"
fi

if command -v ollama >/dev/null && curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  pass "Ollama responding"
else
  warn "Ollama not running (ollama serve)"
fi

if [[ -f "$HOME/.hermes/SOUL.md" ]]; then
  pass "SOUL.md installed"
else
  warn "Run: bash scripts/install-nami-hermes.sh"
fi

if [[ -f "$HOME/.hermes/memories/MEMORY.md" ]]; then
  pass "MEMORY.md present"
else
  warn "Memory not seeded"
fi

CORPUS="$ROOT/data/nami-corpus"
if [[ -d "$CORPUS" ]] && [[ $(find "$CORPUS" -type f ! -name 'README.md' ! -name '.manifest.txt' | wc -l) -ge 5 ]]; then
  pass "RAG corpus ($(find "$CORPUS" -type f ! -name 'README.md' ! -name '.manifest.txt' | wc -l | tr -d ' ') files)"
else
  warn "RAG corpus thin — run: python scripts/build_nami_rag_corpus.py"
fi

if [[ -x "$ROOT/.venv/bin/python" ]]; then
  pass "linkup_mcp venv"
else
  warn "No .venv — install-nami-mcp-mac.sh creates it"
fi

if command -v hermes >/dev/null; then
  if hermes mcp test linkup 2>/dev/null | grep -qi pass; then
    pass "hermes mcp test linkup"
  elif hermes mcp list 2>/dev/null | grep -q linkup; then
    warn "linkup registered but mcp test did not pass — check LINKUP_API_KEY / .venv"
  else
    warn "linkup MCP not registered — run install-nami-mcp-mac.sh"
  fi

  if hermes gateway status 2>/dev/null | grep -qi running; then
    pass "gateway running"
  else
    warn "gateway not running — bash scripts/start-nami-gateway.sh"
  fi
fi

if [[ -f "$ROOT/.env" ]] && grep -q LINKUP_API_KEY "$ROOT/.env" 2>/dev/null; then
  pass "LINKUP_API_KEY in .env"
else
  warn "LINKUP_API_KEY missing — web_search disabled; RAG still works"
fi

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "All critical checks passed."
else
  echo "Some checks failed — see WARN/FAIL above."
  exit 1
fi
