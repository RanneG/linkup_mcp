"""
Local face verification endpoints (DeepFace + OpenCV liveness, no cloud APIs):
  POST /api/face/enroll   single-frame (default) or multi-angle (`enroll_mode:"multi"`)
  POST /api/face/verify   probe image + liveness burst frames
  GET  /api/face/status   ?email=...
  POST /api/face/delete   {"email":"..."}

DeepFace/TensorFlow imports are deferred until first use so the bridge starts fast.
"""
from __future__ import annotations

import logging
import os
import threading

import numpy as np
from flask import Blueprint, jsonify, request

bp = Blueprint("face", __name__)
logger = logging.getLogger(__name__)

# Enrollment sends multiple base64 JPEGs; cap to keep requests and DeepFace work bounded.
_MAX_ENROLL_IMAGES = int(os.getenv("STITCH_FACE_MAX_ENROLL_IMAGES", "5"))

# DeepFace embedding work is heavy and not re-entrant on typical local setups.
_face_lock = threading.Lock()


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


@bp.route("/api/face/enroll", methods=["OPTIONS"])
def face_enroll_options():
    return "", 204


@bp.route("/api/face/enroll", methods=["POST"])
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


@bp.route("/api/face/verify", methods=["OPTIONS"])
def face_verify_options():
    return "", 204


@bp.route("/api/face/verify", methods=["POST"])
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
            for lb in liveness_frames_b64:
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


@bp.route("/api/face/status", methods=["OPTIONS"])
def face_status_options():
    return "", 204


@bp.route("/api/face/status", methods=["GET"])
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


@bp.route("/api/face/delete", methods=["OPTIONS"])
def face_delete_options():
    return "", 204


@bp.route("/api/face/delete", methods=["POST"])
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
