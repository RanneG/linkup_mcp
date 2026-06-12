"""
Internal modules for the Stitch HTTP bridge.

The public entrypoint stays `stitch_rag_bridge.py` at the repo root — it owns
the Flask `app`, loads `.env`, and registers everything here. External code
(e.g. stitch-app's `stitch_gui.py`) must keep importing from
`stitch_rag_bridge`, not from this package.

Layout:
  cors.py         allowed-origins parsing + CORS response headers
  errors.py       JSON error handler for /api/face|auth|subscriptions
  health.py       /health + /api/health (shared payload)
  rag_routes.py   /api/rag/stitch, /api/rag/stitch-help, /api/stitch-user-guide
  voice_routes.py /api/voice/transcribe + STT engine selection
  face_routes.py  /api/face/enroll|verify|status|delete
  spa.py          / (root), /favicon.ico, optional built-SPA serving
"""
