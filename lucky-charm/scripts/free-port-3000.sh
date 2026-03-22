#!/usr/bin/env bash
# Stop whatever is listening on TCP 3000 so Lucky Charm Vite can bind there.
# Safe for your repo: this only frees the port; it does not delete project files or git history.
# localStorage for http://localhost:3000 stays in the browser until you clear site data.

set -e
PORT=3000
PIDS=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)

if [ -z "$PIDS" ]; then
  echo "Port $PORT is already free."
  exit 0
fi

echo "Port $PORT is in use by PID(s): $PIDS"
echo "Sending SIGTERM (graceful stop)..."
kill $PIDS 2>/dev/null || true
sleep 1

STILL=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$STILL" ]; then
  echo "Still listening — sending SIGKILL..."
  kill -9 $STILL 2>/dev/null || true
fi

echo "Done. Port $PORT should be free; run: cd frontend && npm run dev"
