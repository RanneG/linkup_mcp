#!/usr/bin/env bash
# Copy Nami SOUL/AGENTS + weekly-focus skill into ~/.hermes (run on Mac).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPPLY="${SUPPLYME_CREW_ROOT:-$(dirname "$ROOT")/supplyme-crew}"

mkdir -p "$HOME/.hermes/skills"
cp "$ROOT/hermes-nami/SOUL.md" "$HOME/.hermes/SOUL.md"
cp "$ROOT/hermes-nami/AGENTS.md" "$HOME/.hermes/AGENTS.md"

if [[ -f "$SUPPLY/skills/weekly-focus.md" ]]; then
  cp "$SUPPLY/skills/weekly-focus.md" "$HOME/.hermes/skills/"
else
  echo "Note: supplyme-crew not at $SUPPLY — skipped weekly-focus skill" >&2
fi

echo "Installed Nami files to ~/.hermes/"
ls -la "$HOME/.hermes/SOUL.md" "$HOME/.hermes/AGENTS.md"
