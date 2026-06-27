"""
Mobile build bridge — enqueue from Telegram/Hermes; PC worker runs Cursor agent.

Run from repo root:

    python nami_build_bridge.py

Or: pip install -e ".[nami-build]" && nami-build-bridge

Default: http://127.0.0.1:8770
  GET  /api/build/health
  POST /api/build/enqueue   Authorization: Bearer <NAMI_BUILD_TOKEN>
  GET  /api/build/jobs/<id>
  GET  /api/build/jobs?limit=10

See docs/hermes/MOBILE_BUILD.md
"""
from nami_build.http import main

if __name__ == "__main__":
    main()
