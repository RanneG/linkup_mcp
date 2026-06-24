#!/usr/bin/env bash
# Copy Nami SOUL/AGENTS + weekly-focus skill into ~/.hermes (run on Mac).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPPLY="${SUPPLYME_CREW_ROOT:-$(dirname "$ROOT")/supplyme-crew}"

mkdir -p "$HOME/.hermes/skills" "$HOME/.hermes/memories"
cp "$ROOT/hermes-nami/SOUL.md" "$HOME/.hermes/SOUL.md"
cp "$ROOT/hermes-nami/AGENTS.md" "$HOME/.hermes/AGENTS.md"

for skill in linkup-mcp.md model-routing.md loop-checker.md daily-brief-loop.md; do
  if [[ -f "$ROOT/hermes-nami/skills/$skill" ]]; then
    cp "$ROOT/hermes-nami/skills/$skill" "$HOME/.hermes/skills/"
  fi
done

if [[ ! -f "$HOME/.hermes/memories/USER.md" ]]; then
  cp "$ROOT/hermes-nami/memories/USER.md" "$HOME/.hermes/memories/USER.md"
fi
if [[ ! -f "$HOME/.hermes/memories/MEMORY.md" ]]; then
  cp "$ROOT/hermes-nami/memories/MEMORY.md" "$HOME/.hermes/memories/MEMORY.md"
fi

if [[ -f "$SUPPLY/skills/weekly-focus.md" ]]; then
  cp "$SUPPLY/skills/weekly-focus.md" "$HOME/.hermes/skills/"
else
  echo "Note: supplyme-crew not at $SUPPLY — skipped weekly-focus skill" >&2
fi

echo "Installed Nami files to ~/.hermes/"
ls -la "$HOME/.hermes/SOUL.md" "$HOME/.hermes/AGENTS.md"

if [[ -x "$ROOT/.venv/bin/python" ]]; then
  "$ROOT/.venv/bin/python" -m nami_corpus.sync || true
elif command -v python3 >/dev/null; then
  python3 -m nami_corpus.sync || true
fi
