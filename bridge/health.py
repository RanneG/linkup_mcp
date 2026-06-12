"""GET /health and GET /api/health — identical payloads (the /api twin exists for Vite's `/api` proxy)."""
from __future__ import annotations

from flask import Blueprint, jsonify

from bridge.spa import get_stitch_spa_dist
from bridge.voice_routes import voice_stt_status

bp = Blueprint("health", __name__)


def health_payload() -> dict:
    try:
        from stitch_auth import google_client as _gc

        google_oauth = _gc.oauth_configured()
    except Exception:
        google_oauth = False
    spa = get_stitch_spa_dist()
    return {
        "ok": True,
        "service": "stitch-rag-bridge",
        "google_oauth": google_oauth,
        "voice_stt": voice_stt_status(),
        "stitch_spa": {"serving": bool(spa)},
    }


@bp.route("/health", methods=["GET"])
def health():
    return jsonify(health_payload())


@bp.route("/api/health", methods=["GET"])
def api_health():
    return jsonify(health_payload())
