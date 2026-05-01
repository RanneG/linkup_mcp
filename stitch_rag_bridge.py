"""
Local HTTP bridge so the Stitch desktop app (or any UI) can call PDF RAG
without going through Cursor MCP stdio, plus local face verification endpoints.

Run from repo root (use the project venv so deps resolve):

    .\\.venv\\Scripts\\python.exe stitch_rag_bridge.py

Defaults: http://127.0.0.1:8765
  GET  /api/health       (same payload as GET /health — use under Vite `/api` proxy)
  POST /api/rag/stitch  JSON {"query":"..."}
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
"""
from __future__ import annotations

import asyncio
import logging
import os
import threading

import numpy as np
from flask import Flask, has_request_context, jsonify, request
from werkzeug.exceptions import HTTPException, InternalServerError

logger = logging.getLogger(__name__)

# Enrollment sends multiple base64 JPEGs; cap to keep requests and DeepFace work bounded.
_MAX_ENROLL_IMAGES = int(os.getenv("STITCH_FACE_MAX_ENROLL_IMAGES", "5"))
_DEFAULT_ALLOWED_ORIGINS = "http://127.0.0.1:1420,http://localhost:1420,http://127.0.0.1:5173,http://localhost:5173"


def _parse_allowed_origins(raw: str) -> set[str]:
    origins = {(item or "").strip() for item in raw.split(",")}
    return {origin for origin in origins if origin}


_ALLOWED_ORIGINS = _parse_allowed_origins(os.getenv("STITCH_ALLOWED_ORIGINS", _DEFAULT_ALLOWED_ORIGINS))

from server import _ensure_rag_ready, _to_stitch_view

app = Flask(__name__)
# Large enroll POSTs (multiple base64 JPEGs); explicit cap avoids silent proxy/Werkzeug oddities on huge bodies.
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("STITCH_RAG_BRIDGE_MAX_BODY_BYTES", str(64 * 1024 * 1024)))
_query_lock = threading.Lock()
_face_lock = threading.Lock()


@app.after_request
def _cors(resp):
    origin = request.headers.get("Origin", "").strip() if has_request_context() else ""
    if origin and origin in _ALLOWED_ORIGINS:
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Vary"] = "Origin"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return resp


@app.route("/api/rag/stitch", methods=["OPTIONS"])
def rag_stitch_options():
    return "", 204


@app.route("/api/rag/stitch", methods=["POST"])
def rag_stitch_http():
    body = request.get_json(silent=True) or {}
    query = (body.get("query") or "").strip()
    if not query:
        return jsonify({"error": "missing query"}), 400

    async def _run_query() -> dict:
        wf = await _ensure_rag_ready()
        return await wf.query(query)

    with _query_lock:
        payload = asyncio.run(_run_query())

    if not isinstance(payload, dict):
        return jsonify({"error": "unexpected payload", "raw": str(payload)}), 500

    return jsonify(_to_stitch_view(payload))


@app.route("/health", methods=["GET"])
def health():
    try:
        from stitch_auth import google_client as _gc

        google_oauth = _gc.oauth_configured()
    except Exception:
        google_oauth = False
    return jsonify({"ok": True, "service": "stitch-rag-bridge", "google_oauth": google_oauth})


@app.route("/api/health", methods=["GET"])
def api_health():
    """Same as /health but under /api so Vite can proxy only `/api` and the UI still reaches liveness."""
    try:
        from stitch_auth import google_client as _gc

        google_oauth = _gc.oauth_configured()
    except Exception:
        google_oauth = False
    return jsonify({"ok": True, "service": "stitch-rag-bridge", "google_oauth": google_oauth})


# --- Face verification (local DeepFace + OpenCV liveness) ---


def _face_imports():
    from face_verification.camera import decode_image_base64
    from face_verification.core import (
        DEFAULT_MATCH_THRESHOLD,
        DEFAULT_MODEL_NAME,
        build_single_frame_enrollment_embeddings,
        diagnose_enrollment_failure,
        embed_bgr,
        embed_bgr_enrollment_mode,
        enrollment_consistency_score,
        match_embeddings,
    )
    from face_verification.liveness import evaluate_liveness_sequence
    from face_verification import storage

    return (
        decode_image_base64,
        DEFAULT_MATCH_THRESHOLD,
        DEFAULT_MODEL_NAME,
        embed_bgr,
        embed_bgr_enrollment_mode,
        diagnose_enrollment_failure,
        build_single_frame_enrollment_embeddings,
        enrollment_consistency_score,
        match_embeddings,
        evaluate_liveness_sequence,
        storage,
    )


@app.route("/api/face/enroll", methods=["OPTIONS"])
def face_enroll_options():
    return "", 204


@app.route("/api/face/enroll", methods=["POST"])
def face_enroll():
    try:
        (
            decode_image_base64,
            _thr,
            DEFAULT_MODEL_NAME,
            _embed_bgr,
            embed_bgr_enrollment_mode,
            diagnose_enrollment_failure,
            build_single_frame_enrollment_embeddings,
            enrollment_consistency_score,
            _match,
            _liv,
            storage,
        ) = _face_imports()
    except Exception as e:
        logger.exception("face_enroll: face modules failed to import")
        return jsonify({"ok": False, "error": str(e)}), 503

    try:
        body = request.get_json(silent=True) or {}
        email = (body.get("email") or "").strip()
        if not email:
            return jsonify({"ok": False, "error": "missing email"}), 400

        quality_check = (body.get("quality_check") or "lenient").strip().lower()
        if quality_check not in ("lenient", "strict"):
            quality_check = "lenient"
        enroll_mode = (body.get("enroll_mode") or "").strip().lower()

        single_b64 = body.get("image") or body.get("frame")
        images = body.get("images") or body.get("image_b64_list") or []

        use_simple = False
        if isinstance(single_b64, str) and single_b64.strip():
            use_simple = True
        elif enroll_mode == "simple":
            use_simple = True
        elif isinstance(images, list) and len(images) == 1 and enroll_mode != "multi":
            use_simple = True

        with _face_lock:
            if use_simple:
                b64 = single_b64 if (isinstance(single_b64, str) and single_b64.strip()) else (
                    images[0] if isinstance(images, list) and len(images) == 1 else ""
                )
                if not isinstance(b64, str) or not b64.strip():
                    return jsonify({"ok": False, "error": "missing image (base64 data URL or raw base64)"}), 400
                img = decode_image_base64(b64)
                if img is None:
                    return jsonify({"ok": False, "error": "could not decode enrollment image"}), 400
                embeddings, confidence_score, err = build_single_frame_enrollment_embeddings(
                    img, quality_check=quality_check
                )
                if err:
                    return jsonify({"ok": False, "error": err, "confidence_score": confidence_score}), 400
                try:
                    storage.save_enrollment(email, embeddings, model_name=DEFAULT_MODEL_NAME)
                except ValueError as e:
                    return jsonify({"ok": False, "error": str(e)}), 400
                return jsonify(
                    {
                        "ok": True,
                        "enroll_mode": "simple",
                        "stored_templates": len(embeddings),
                        "confidence_score": confidence_score,
                        "warning": None,
                    }
                )

            if not isinstance(images, list) or len(images) < 1:
                return jsonify(
                    {
                        "ok": False,
                        "error": "Send `image` for guided single-frame enroll, or `images` (list) for multi-angle mode.",
                    }
                ), 400
            if len(images) > _MAX_ENROLL_IMAGES:
                images = images[-_MAX_ENROLL_IMAGES:]

            decoded: list = []
            for i, b64 in enumerate(images):
                if not isinstance(b64, str):
                    return jsonify({"ok": False, "error": f"image {i} must be a string"}), 400
                im = decode_image_base64(b64)
                if im is None:
                    return jsonify({"ok": False, "error": f"could not decode image {i}"}), 400
                decoded.append(im)

            embeddings_multi: list = []
            for idx, im in enumerate(decoded):
                emb = embed_bgr_enrollment_mode(im, quality_check=quality_check)
                if emb is None:
                    hint = diagnose_enrollment_failure(im)
                    return jsonify({"ok": False, "error": f"Image {idx + 1}: {hint}"}), 400
                embeddings_multi.append(emb)
            try:
                storage.save_enrollment(email, embeddings_multi, model_name=DEFAULT_MODEL_NAME)
            except ValueError as e:
                return jsonify({"ok": False, "error": str(e)}), 400

            conf = enrollment_consistency_score(embeddings_multi)
            return jsonify(
                {
                    "ok": True,
                    "enroll_mode": "multi",
                    "stored_templates": len(embeddings_multi),
                    "confidence_score": conf,
                    "warning": None
                    if len(embeddings_multi) >= 2
                    else "Only one angle stored — add another capture for better robustness.",
                }
            )
    except Exception as e:  # noqa: BLE001 — never return Flask HTML 500 for this route
        logger.exception("face_enroll failed")
        return jsonify({"ok": False, "error": str(e) or e.__class__.__name__}), 500


@app.route("/api/face/verify", methods=["OPTIONS"])
def face_verify_options():
    return "", 204


@app.route("/api/face/verify", methods=["POST"])
def face_verify():
    try:
        (
            decode_image_base64,
            DEFAULT_MATCH_THRESHOLD,
            DEFAULT_MODEL_NAME,
            embed_bgr,
            _embed_bgr_enrollment_mode,
            _diagnose_enrollment_failure,
            _build_single_frame_enrollment_embeddings,
            _enrollment_consistency_score,
            match_embeddings,
            evaluate_liveness_sequence,
            storage,
        ) = _face_imports()
    except Exception as e:
        logger.exception("face_verify: face modules failed to import")
        return jsonify({"verified": False, "confidence": 0.0, "liveness_passed": False, "error": str(e)}), 503

    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip()
    threshold = float(body.get("threshold") or DEFAULT_MATCH_THRESHOLD)
    liveness_frames_b64 = body.get("liveness_frames") or []
    main_b64 = body.get("image") or body.get("frame")

    if not email:
        return jsonify(
            {
                "verified": False,
                "match": False,
                "confidence": 0.0,
                "liveness_passed": False,
                "error": "missing email",
            }
        ), 400
    if not isinstance(main_b64, str) or not main_b64.strip():
        return jsonify(
            {
                "verified": False,
                "match": False,
                "confidence": 0.0,
                "liveness_passed": False,
                "error": "missing image (base64)",
            }
        ), 400

    dev_skip = os.getenv("STITCH_FACE_DEV_SKIP_LIVENESS") == "1"

    with _face_lock:
        rec = storage.load_enrollment(email)
        if rec is None:
            return jsonify(
                {
                    "verified": False,
                    "match": False,
                    "confidence": 0.0,
                    "liveness_passed": False,
                    "error": "no enrollment for this email",
                }
            ), 404

        gallery = [np.asarray(e, dtype=np.float64) for e in rec.embeddings]

        liv_passed = False
        liv_msg = "Liveness not evaluated."
        liv_dbg: dict = {}
        if dev_skip:
            liv_passed = True
            liv_msg = "dev_skip_liveness"
        elif not isinstance(liveness_frames_b64, list) or len(liveness_frames_b64) < 1:
            liv_passed = False
            liv_msg = "liveness_frames required (short burst of frames from the client)."
        else:
            liv_imgs: list = []
            for j, lb in enumerate(liveness_frames_b64):
                if not isinstance(lb, str):
                    continue
                im = decode_image_base64(lb)
                if im is not None:
                    liv_imgs.append(im)
            liv_passed, liv_msg, liv_dbg = evaluate_liveness_sequence(liv_imgs)

        main_img = decode_image_base64(main_b64)
        if main_img is None:
            return jsonify(
                {
                    "verified": False,
                    "match": False,
                    "confidence": 0.0,
                    "liveness_passed": liv_passed,
                    "liveness_detail": liv_msg,
                    "error": "could not decode main image",
                }
            ), 400

        probe = embed_bgr(main_img)
        if probe is None:
            return jsonify(
                {
                    "verified": False,
                    "match": False,
                    "confidence": 0.0,
                    "liveness_passed": liv_passed,
                    "liveness_detail": liv_msg,
                    "error": "No face detected — move closer or improve lighting.",
                }
            ), 400

        confidence, match_ok = match_embeddings(probe, list(gallery), threshold=threshold)
        overall = bool(match_ok and liv_passed)
        if overall:
            storage.touch_last_verified(email)

    return jsonify(
        {
            "verified": overall,
            "match": match_ok,
            "confidence": round(confidence, 4),
            "liveness_passed": liv_passed,
            "liveness_detail": liv_msg,
            "liveness_debug": liv_dbg,
            "threshold": threshold,
            "model": rec.model_name or DEFAULT_MODEL_NAME,
        }
    )


@app.route("/api/face/status", methods=["OPTIONS"])
def face_status_options():
    return "", 204


@app.route("/api/face/status", methods=["GET"])
def face_status():
    try:
        *_, storage = _face_imports()
    except Exception as e:
        logger.exception("face_status: face modules failed to import")
        return jsonify({"ok": False, "enrolled": False, "error": str(e)}), 503
    email = (request.args.get("email") or "").strip()
    if not email:
        return jsonify({"ok": False, "error": "missing email query param"}), 400
    enrolled = storage.is_enrolled(email)
    return jsonify({"ok": True, "enrolled": enrolled})


@app.route("/api/face/delete", methods=["OPTIONS"])
def face_delete_options():
    return "", 204


@app.route("/api/face/delete", methods=["POST"])
def face_delete():
    try:
        *_, storage = _face_imports()
    except Exception as e:
        logger.exception("face_delete: face modules failed to import")
        return jsonify({"ok": False, "error": str(e)}), 503
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip()
    if not email:
        return jsonify({"ok": False, "error": "missing email"}), 400
    with _face_lock:
        removed = storage.delete_enrollment(email)
    return jsonify({"ok": True, "removed": removed})


@app.errorhandler(Exception)
def _json_for_uncaught_face_api(exc: BaseException):
    """Default Flask 500 is HTML; return JSON for /api/face/* so the browser panel can show the error."""
    if not has_request_context():
        raise exc
    path = request.path
    if not path.startswith("/api/face") and not path.startswith("/api/auth") and not path.startswith("/api/subscriptions"):
        raise exc
    # Client errors (404, etc.) should use normal Werkzeug/Flask responses.
    # InternalServerError is also an HTTPException but must NOT be re-raised or the UI gets HTML 500.
    if isinstance(exc, HTTPException):
        code = getattr(exc, "code", None)
        if code is not None and code < 500:
            raise exc
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


try:
    from stitch_auth.flask_routes import register_stitch_auth_routes

    register_stitch_auth_routes(app)
except Exception as _auth_exc:  # noqa: BLE001
    logger.warning("Stitch Google auth routes not registered: %s", _auth_exc)


if __name__ == "__main__":
    port = int(os.getenv("STITCH_RAG_BRIDGE_PORT", "8765"))
    print(
        f"[stitch_rag_bridge] http://127.0.0.1:{port}  MAX_CONTENT_LENGTH={app.config.get('MAX_CONTENT_LENGTH')}",
        flush=True,
    )
    # Threaded server keeps lightweight endpoints responsive during long local ops.
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)
