#!/usr/bin/env bash
# Start Nami (default Hermes profile) Telegram gateway after reboot or SSH session.
# Koshi uses launchd separately: koshi gateway status
set -euo pipefail

if ! command -v hermes >/dev/null; then
  echo "hermes not on PATH. Open a new shell or: source ~/.zshrc" >&2
  exit 1
fi

echo "=== Nami (default profile) ==="
hermes profile list 2>/dev/null | head -5 || true

if hermes gateway status 2>/dev/null | grep -qi running; then
  echo "Gateway already running."
  exit 0
fi

hermes gateway stop 2>/dev/null || true
hermes gateway start
echo ""
echo "Test: message your Nami bot on Telegram, or: hermes -z 'Reply OK'"
