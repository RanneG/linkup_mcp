#!/usr/bin/env bash
# Copy Nami SOUL/AGENTS + agentskills.io skill dirs into ~/.hermes
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPPLY="${SUPPLYME_CREW_ROOT:-$(dirname "$ROOT")/supplyme-crew}"
SKILLS_SRC="$ROOT/hermes-nami/skills"
SKILLS_DEST="$HOME/.hermes/skills"

mkdir -p "$SKILLS_DEST" "$HOME/.hermes/memories"
cp "$ROOT/hermes-nami/SOUL.md" "$HOME/.hermes/SOUL.md"
cp "$ROOT/hermes-nami/AGENTS.md" "$HOME/.hermes/AGENTS.md"

for skill in brief loop-checker linkup-mcp mobile-build-request model-routing; do
  if [[ -f "$SKILLS_SRC/$skill/SKILL.md" ]]; then
    mkdir -p "$SKILLS_DEST/$skill"
    cp "$SKILLS_SRC/$skill/SKILL.md" "$SKILLS_DEST/$skill/SKILL.md"
  fi
done

for legacy in daily-brief-loop.md loop-checker.md linkup-mcp.md mobile-build-request.md model-routing.md; do
  rm -f "$SKILLS_DEST/$legacy"
done

if [[ ! -f "$HOME/.hermes/memories/USER.md" ]]; then
  cp "$ROOT/hermes-nami/memories/USER.md" "$HOME/.hermes/memories/USER.md"
fi
if [[ ! -f "$HOME/.hermes/memories/MEMORY.md" ]]; then
  cp "$ROOT/hermes-nami/memories/MEMORY.md" "$HOME/.hermes/memories/MEMORY.md"
fi
if [[ ! -f "$HOME/.hermes/memories/LOOP_LOG.md" ]]; then
  cp "$ROOT/hermes-nami/memories/LOOP_LOG.md" "$HOME/.hermes/memories/LOOP_LOG.md"
fi

if [[ -f "$SUPPLY/skills/weekly-focus.md" ]]; then
  mkdir -p "$SKILLS_DEST/weekly-focus"
  if [[ ! -f "$SKILLS_DEST/weekly-focus/SKILL.md" ]]; then
    {
      echo "---"
      echo "name: weekly-focus"
      echo 'description: "Weekly priority and park list for Ranne."'
      echo "version: 1.0.0"
      echo "---"
      echo ""
      cat "$SUPPLY/skills/weekly-focus.md"
    } >"$SKILLS_DEST/weekly-focus/SKILL.md"
  fi
  rm -f "$SKILLS_DEST/weekly-focus.md"
else
  echo "Note: supplyme-crew not at $SUPPLY — skipped weekly-focus skill" >&2
fi

echo "Installed Nami files to ~/.hermes/ (skills: brief, loop-checker, …)"
ls -la "$HOME/.hermes/SOUL.md" "$HOME/.hermes/AGENTS.md"

if [[ -x "$ROOT/.venv/bin/python" ]]; then
  "$ROOT/.venv/bin/python" -m nami_corpus.sync || true
elif command -v python3 >/dev/null; then
  python3 -m nami_corpus.sync || true
fi
