"""
Single-window Stitch: built Vite UI + Flask API in one process (pywebview shell).

Prerequisites
-------------
1. Build the Stitch desktop bundle (from your clone, e.g. temp_repo/stitch):

       cd temp_repo/stitch/apps/desktop
       npm install
       npm run build

   This produces ``dist/`` with ``index.html`` and ``assets/``.

2. Install the optional GUI dependency (repo root, venv active):

       uv sync --extra stitch-gui
   or
       pip install "pywebview>=5,<6"

3. Run (repo root):

       .\\.venv\\Scripts\\python.exe stitch_gui.py --dist temp_repo\\stitch\\apps\\desktop\\dist

   Or double-click ``Stitch-Bundled-Gui.bat`` after a successful ``npm run build``.

Google OAuth redirect stays ``http://127.0.0.1:8765/api/auth/google/callback`` (same as the plain bridge).
"""
from __future__ import annotations

import argparse
import os
import sys
import threading
import time
import urllib.error
import urllib.request


def _extend_allowed_origins() -> None:
    for origin in ("http://127.0.0.1:8765", "http://localhost:8765"):
        cur = os.environ.get("STITCH_ALLOWED_ORIGINS", "").strip()
        if origin in cur:
            continue
        os.environ["STITCH_ALLOWED_ORIGINS"] = f"{cur},{origin}".strip(",") if cur else origin


def main() -> None:
    parser = argparse.ArgumentParser(description="Stitch SPA + RAG bridge in one pywebview window.")
    parser.add_argument(
        "--dist",
        default=os.environ.get("STITCH_DESKTOP_DIST", "").strip(),
        help="Path to apps/desktop/dist (from npm run build)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("STITCH_RAG_BRIDGE_PORT", "8765")),
        help="Port for the embedded Flask server (default 8765)",
    )
    args = parser.parse_args()
    dist = os.path.abspath(args.dist)
    if not os.path.isdir(dist) or not os.path.isfile(os.path.join(dist, "index.html")):
        print(
            "Missing Vite build. Run:\n"
            "  cd temp_repo\\stitch\\apps\\desktop\n"
            "  npm install && npm run build\n"
            "Then pass --dist to that folder's dist path.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    os.environ["STITCH_DESKTOP_DIST"] = dist
    os.environ["STITCH_RAG_BRIDGE_PORT"] = str(args.port)
    _extend_allowed_origins()

    try:
        import webview  # type: ignore[import-not-found]
    except ImportError:
        print("Install pywebview:  uv sync --extra stitch-gui   or   pip install pywebview", file=sys.stderr)
        raise SystemExit(1) from None

    # Import after env so stitch_rag_bridge registers SPA routes.
    from stitch_rag_bridge import app  # noqa: WPS433
    from werkzeug.serving import make_server

    port = args.port
    httpd = make_server("127.0.0.1", port, app, threaded=True)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()

    for _ in range(300):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=0.5)
            break
        except (urllib.error.URLError, OSError):
            time.sleep(0.05)
    else:
        print("Flask failed to become ready on port", port, file=sys.stderr)
        httpd.shutdown()
        raise SystemExit(1)

    print(f"[stitch_gui] http://127.0.0.1:{port}/  (dist={dist})", flush=True)
    try:
        webview.create_window("Stitch", f"http://127.0.0.1:{port}/", width=1280, height=840)
        webview.start()
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
