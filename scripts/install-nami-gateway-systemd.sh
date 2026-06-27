#!/usr/bin/env bash
# Install persistent Hermes Telegram gateway on Linux VPS.
# Prefers: hermes gateway install. Fallback: systemd user unit.
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "Linux VPS only." >&2
  exit 1
fi

if ! command -v hermes >/dev/null; then
  echo "hermes not on PATH." >&2
  exit 1
fi

if hermes gateway install 2>/dev/null; then
  echo "Installed via: hermes gateway install"
  hermes gateway status || true
  exit 0
fi

echo "hermes gateway install unavailable — writing systemd user unit..." >&2

HERMES_BIN="$(command -v hermes)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_FILE="$UNIT_DIR/nami-hermes-gateway.service"

mkdir -p "$UNIT_DIR"

cat >"$UNIT_FILE" <<EOF
[Unit]
Description=Nami Hermes Telegram gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${HERMES_BIN} gateway start
ExecStop=${HERMES_BIN} gateway stop
Restart=on-failure
RestartSec=15
Environment=HOME=${HOME}

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable nami-hermes-gateway.service

echo "Installed $UNIT_FILE"
echo ""
echo "Enable lingering so gateway runs without an SSH session:"
echo "  loginctl enable-linger \$USER"
echo ""
echo "Start now:"
echo "  systemctl --user start nami-hermes-gateway"
echo "  systemctl --user status nami-hermes-gateway"
