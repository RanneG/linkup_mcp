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

# Hermes prints "Gateway is not running" when stopped. That line contains the
# substring "running", so a bare match would skip start and leave Telegram down.
status="$(hermes gateway status 2>/dev/null || true)"
if ! printf '%s\n' "$status" | grep -qi 'not running' \
  && printf '%s\n' "$status" | grep -qi 'running'; then
  echo "Gateway already running."
  exit 0
fi

hermes gateway stop 2>/dev/null || true
sleep 1
hermes gateway start
echo ""
echo "Test: message your Nami bot on Telegram, or: hermes -z 'Reply OK'"
