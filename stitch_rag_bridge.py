"""
Local HTTP bridge so the Stitch desktop app (or any UI) can call PDF RAG
without going through Cursor MCP stdio, plus local face verification endpoints.

Run from repo root (use the project venv so deps resolve):

    .\\.venv\\Scripts\\python.exe stitch_rag_bridge.py

Loads **``.env``** from the same directory as this file (repo root) so ``GOOGLE_OAUTH_*`` and other bridge vars apply without exporting them in the shell.

Defaults: http://127.0.0.1:8765
  GET  /                 (HTML hint, JSON, or built SPA when STITCH_DESKTOP_DIST or app STITCH_SPA_ROOT is set — stitch_gui.py sets both)
  GET  /api/health       (same payload as GET /health — use under Vite `/api` proxy)
  POST /api/rag/stitch  JSON {"query":"..."}
  POST /api/rag/stitch-help  JSON {"query":"..."}  (answers from docs/stitch_user_guide.md via Ollama)
  GET  /api/stitch-user-guide  JSON {"markdown":"..."}  (same file for the Help tab)
  POST /api/face/enroll  JSON single-frame (default): {"email","image","quality_check":"lenient"|"strict","enroll_mode":"simple"}
                              multi-angle: {"email","images":[...],"enroll_mode":"multi","quality_check":...}
  POST /api/face/verify JSON {"email":"...","image":"base64","liveness_frames":["base64",...]}
  GET  /api/face/status  ?email=...
  POST /api/face/delete  JSON {"email":"..."}
  POST /api/auth/google           JSON {"client_origin":"http://localhost:1420"}  -> { auth_url, state }
  GET  /api/auth/google/callback  OAuth redirect (opens in popup; postMessage to client_origin)
  GET  /api/auth/status           Header Authorization: Bearer <session_id>
  POST /api/auth/logout           same header
  POST /api/auth/active-email     JSON {"email":"..."}  primary for notifications
  GET  /api/subscriptions/from-gmail  (session) optional ?account_id=
  POST /api/subscriptions/import    JSON {"selections":[{serviceName, amountUsd, renewalDateIso, category, sourceEmail}]}
  GET  /api/subscriptions/list      (session) persisted subscriptions for active account
  POST /api/subscriptions/upsert    JSON {"subscriptions":[{id?, name, amountUsd, dueDateIso, category, status}]}
  POST /api/subscriptions/delete    JSON {"id":"sub-..."}
  POST /api/voice/transcribe  raw PCM WAV (16-bit mono), Content-Type: audio/wav - JSON {"text":"...","engine":"google"|"whisper"}
                              Env: STITCH_VOICE_STT_ENGINE=auto|google|whisper (auto prefers local Whisper if installed).
                              Optional: pip install -e ".[stitch-whisper]"  (faster-whisper; models download on first use).

Route implementations live in the `bridge/` package (one module per concern);
this file stays the entrypoint and owns the Flask `app`. External consumers
(e.g. stitch-app's stitch_gui.py) import `app` and `register_stitch_spa_routes`
from here — keep those names stable.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

# Repo-root `.env` (same folder as this file); must run before any `os.getenv` used by routes or helpers.
load_dotenv(Path(__file__).resolve().parent / ".env")

try:
    from flask import Flask
except ImportError as exc:  # pragma: no cover - exercised when stitch-bridge extra not installed
    raise ImportError(
        'Stitch HTTP bridge requires optional dependencies. Install: '
        'uv sync --extra stitch-bridge   or   pip install -e ".[stitch-bridge]"'
    ) from exc

# Bridge modules read env at import time (origins, caps) — import after load_dotenv.
from bridge import cors, errors, face_routes, health, rag_routes, spa, voice_routes

logger = logging.getLogger(__name__)

app = Flask(__name__)
# Large enroll POSTs (multiple base64 JPEGs); explicit cap avoids silent proxy/Werkzeug oddities on huge bodies.
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("STITCH_RAG_BRIDGE_MAX_BODY_BYTES", str(64 * 1024 * 1024)))

cors.init_app(app)
errors.init_app(app)
app.register_blueprint(rag_routes.bp)
app.register_blueprint(voice_routes.bp)
app.register_blueprint(face_routes.bp)
app.register_blueprint(health.bp)
app.register_blueprint(spa.bp)


def register_stitch_spa_routes() -> None:
    """Register /assets/* and SPA fallback when a dist path is configured (see stitch_gui.py). Safe to call twice."""
    spa.register_stitch_spa_routes(app)


try:
    from stitch_auth.flask_routes import register_stitch_auth_routes

    register_stitch_auth_routes(app)
except Exception as _auth_exc:  # noqa: BLE001
    logger.warning("Stitch Google auth routes not registered: %s", _auth_exc)


register_stitch_spa_routes()


if __name__ == "__main__":
    port = int(os.getenv("STITCH_RAG_BRIDGE_PORT", "8765"))
    print(
        f"[stitch_rag_bridge] http://127.0.0.1:{port}  MAX_CONTENT_LENGTH={app.config.get('MAX_CONTENT_LENGTH')}",
        flush=True,
    )
    # Threaded server keeps lightweight endpoints responsive during long local ops.
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)
