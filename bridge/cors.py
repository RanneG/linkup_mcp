"""CORS for the local bridge: echo Origin only when allow-listed via STITCH_ALLOWED_ORIGINS."""
from __future__ import annotations

import os

from flask import Flask, has_request_context, request

_DEFAULT_ALLOWED_ORIGINS = (
    "http://127.0.0.1:1420,http://localhost:1420,http://127.0.0.1:5173,http://localhost:5173,"
    "http://127.0.0.1:8765,http://localhost:8765"
)


def parse_allowed_origins(raw: str) -> set[str]:
    origins = {(item or "").strip() for item in raw.split(",")}
    return {origin for origin in origins if origin}


# Read once at import (after the entrypoint's load_dotenv), like the v1 module global.
ALLOWED_ORIGINS = parse_allowed_origins(
    os.getenv("STITCH_ALLOWED_ORIGINS", _DEFAULT_ALLOWED_ORIGINS)
)


def init_app(app: Flask) -> None:
    @app.after_request
    def _cors(resp):
        origin = request.headers.get("Origin", "").strip() if has_request_context() else ""
        if origin and origin in ALLOWED_ORIGINS:
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Vary"] = "Origin"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        return resp
