"""Root page, favicon, and optional built-SPA serving (STITCH_DESKTOP_DIST / STITCH_SPA_ROOT)."""
from __future__ import annotations

import os

from flask import Blueprint, Flask, Response, abort, current_app, jsonify, request, send_file

bp = Blueprint("spa", __name__)

_spa_extra_routes_registered = False

_BRIDGE_ROOT_HTML = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>Stitch RAG bridge</title>
<style>body{font-family:system-ui,sans-serif;max-width:42rem;margin:2rem;line-height:1.5}
code{background:#eee;padding:.1rem .35rem;border-radius:4px}a{color:#06c}</style></head><body>
<h1>Stitch RAG bridge is running</h1>
<p><strong>This tab is not the Stitch app.</strong> Port <code>8765</code> is only the Flask API
(RAG, Google auth, subscriptions, face). The UI runs elsewhere.</p>
<h2>Open the real Stitch UI</h2>
<ul>
  <li><strong>One bundled window (UI + API):</strong> double-click <code>Stitch.bat</code> at the
    <code>linkup_mcp</code> repo root (needs Python + Node + a <strong>stitch-app</strong> clone beside the repo; see <code>STITCH_APP_ROOT</code> / <code>../stitch-app</code>).</li>
  <li><strong>Tauri desktop:</strong> from the <code>linkup_mcp</code> repo run
    <code>Stitch-Desktop.bat</code> or <code>npm run launch:stitch</code> (native window).</li>
  <li><strong>Browser dev:</strong> after <code>npm run dev:browser</code>, open
    <a href="http://localhost:5173/">http://localhost:5173/</a> (Vite default) or the URL printed in the terminal.</li>
  <li><strong>Tauri dev</strong> often uses <a href="http://localhost:1420/">http://localhost:1420/</a> for the webview — use the window Tauri opens.</li>
</ul>
<p>API check: <a href="/api/health">GET /api/health</a> (JSON)</p>
</body></html>"""


def get_stitch_spa_dist() -> str | None:
    """When set to a Vite `dist` folder (index.html + assets/), Flask also serves the Stitch SPA from this process."""
    raw = (
        str(current_app.config.get("STITCH_SPA_ROOT") or "").strip()
        or (os.environ.get("STITCH_DESKTOP_DIST") or "").strip()
    )
    if not raw:
        return None
    try:
        root = os.path.abspath(raw)
    except OSError:
        return None
    if not os.path.isdir(root) or not os.path.isfile(os.path.join(root, "index.html")):
        return None
    return root


def register_stitch_spa_routes(app: Flask) -> None:
    """Register /assets/* and SPA fallback when a dist path is configured (see stitch_gui.py). Safe to call twice."""
    global _spa_extra_routes_registered
    if _spa_extra_routes_registered:
        return
    with app.app_context():
        if not get_stitch_spa_dist():
            return

    @app.route("/assets/<path:rel>", methods=["GET"])
    def stitch_spa_assets(rel: str):
        root = get_stitch_spa_dist()
        if not root:
            abort(404)
        base = os.path.normpath(os.path.join(root, "assets"))
        if not os.path.isdir(base):
            abort(404)
        candidate = os.path.normpath(os.path.join(base, rel))
        if not candidate.startswith(base) or not os.path.isfile(candidate):
            abort(404)
        return send_file(candidate)

    @app.route("/<path:path>", methods=["GET"])
    def stitch_spa_history(path: str):
        root = get_stitch_spa_dist()
        if not root:
            abort(404)
        if path.startswith("api/"):
            abort(404)
        candidate = os.path.normpath(os.path.join(root, path))
        rootn = os.path.normpath(root)
        if not candidate.startswith(rootn):
            abort(404)
        if os.path.isfile(candidate):
            return send_file(candidate)
        return send_file(os.path.join(root, "index.html"))

    _spa_extra_routes_registered = True


@bp.route("/", methods=["GET"])
def bridge_root():
    """With STITCH_DESKTOP_DIST, serve the built Stitch SPA; else explainer HTML or JSON."""
    spa = get_stitch_spa_dist()
    if spa:
        resp = send_file(os.path.join(spa, "index.html"))
        resp.headers["Cache-Control"] = "no-store"
        return resp
    accept = (request.headers.get("Accept") or "").lower()
    if "text/html" in accept:
        return Response(_BRIDGE_ROOT_HTML, mimetype="text/html; charset=utf-8")
    return jsonify(
        {
            "ok": True,
            "service": "stitch-rag-bridge",
            "hint": "This process is an API bridge for Stitch, not the Stitch UI. Open Tauri/Vite (see repo README).",
            "try": [
                "GET /api/health",
                "POST /api/rag/stitch with JSON {\"query\":\"...\"}",
                "GET /api/stitch-user-guide",
                "POST /api/rag/stitch-help with JSON {\"query\":\"...\"}",
            ],
        }
    )


@bp.route("/favicon.ico", methods=["GET"])
def favicon():
    return "", 204
