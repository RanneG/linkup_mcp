"""App-level error handler: JSON (never Flask HTML) for the API prefixes the UI consumes."""
from __future__ import annotations

import logging

from flask import Flask, has_request_context, jsonify, request
from werkzeug.exceptions import HTTPException, InternalServerError

logger = logging.getLogger(__name__)

_JSON_ERROR_PREFIXES = ("/api/face", "/api/auth", "/api/subscriptions")


def init_app(app: Flask) -> None:
    @app.errorhandler(Exception)
    def _json_for_uncaught_face_api(exc: BaseException):
        """Default Flask 500 is HTML; return JSON for /api/face|auth|subscriptions so the panel can show the error."""
        if not has_request_context():
            raise exc
        path = request.path
        if not path.startswith(_JSON_ERROR_PREFIXES):
            # Re-raising HTTPException from inside this handler can surface as 500; return the real status.
            if isinstance(exc, HTTPException):
                return exc.get_response()
            raise exc
        # Client errors (404, etc.) should use normal Werkzeug/Flask responses.
        # InternalServerError is also an HTTPException but must NOT be re-raised or the UI gets HTML 500.
        if isinstance(exc, HTTPException):
            code = getattr(exc, "code", None)
            if code is not None and code < 500:
                return exc.get_response()
        logger.exception("uncaught exception on %s", path)
        root = exc
        if isinstance(exc, InternalServerError):
            orig = getattr(exc, "original_exception", None) or exc.__cause__
            if orig is not None:
                root = orig
        err_msg = str(root) or root.__class__.__name__
        if path.startswith("/api/face/verify"):
            return jsonify(
                {
                    "verified": False,
                    "match": False,
                    "confidence": 0.0,
                    "liveness_passed": False,
                    "error": err_msg,
                }
            ), 500
        return jsonify({"ok": False, "error": err_msg}), 500
