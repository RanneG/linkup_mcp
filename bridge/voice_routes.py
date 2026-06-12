"""
POST /api/voice/transcribe — short WAV clips from the Stitch UI (mic), for WebViews
where Web Speech is blocked.

Engine selection (STITCH_VOICE_STT_ENGINE=auto|google|whisper):
  auto prefers local faster-whisper when installed, else Google via SpeechRecognition.
Whisper model env knobs live in `local_whisper_stt` (STITCH_WHISPER_MODEL/DEVICE/COMPUTE_TYPE).
Disable entirely with STITCH_VOICE_TRANSCRIBE=0.
"""
from __future__ import annotations

import logging
import os
import threading

from flask import Blueprint, jsonify, request

import local_whisper_stt

bp = Blueprint("voice", __name__)
logger = logging.getLogger(__name__)

# Serialize STT work — local models and SpeechRecognition are not re-entrant.
_voice_stt_lock = threading.Lock()


def voice_stt_capabilities() -> dict[str, bool]:
    google_ok = False
    try:
        import speech_recognition  # noqa: F401

        google_ok = True
    except Exception:
        pass
    return {"google": google_ok, "whisper": local_whisper_stt.whisper_import_ok()}


def voice_stt_engine_choice() -> str | None:
    """Which backend to use for /api/voice/transcribe, or None if unavailable."""
    if os.getenv("STITCH_VOICE_TRANSCRIBE", "1").strip().lower() in ("0", "false", "off", "no"):
        return None
    caps = voice_stt_capabilities()
    raw = (os.getenv("STITCH_VOICE_STT_ENGINE") or "auto").strip().lower()
    if raw in ("", "auto"):
        if caps["whisper"]:
            return "whisper"
        if caps["google"]:
            return "google"
        return None
    if raw == "whisper":
        return "whisper" if caps["whisper"] else None
    if raw == "google":
        return "google" if caps["google"] else None
    logger.warning("Unknown STITCH_VOICE_STT_ENGINE=%r; falling back to auto", raw)
    if caps["whisper"]:
        return "whisper"
    if caps["google"]:
        return "google"
    return None


def voice_stt_status() -> dict:
    """Whether POST /api/voice/transcribe is available (Google and/or local Whisper)."""
    caps = voice_stt_capabilities()
    if os.getenv("STITCH_VOICE_TRANSCRIBE", "1").strip().lower() in ("0", "false", "off", "no"):
        return {"ok": False, "engine": None, "engines": caps, "reason": "disabled_by_env"}
    choice = voice_stt_engine_choice()
    if choice is None:
        return {"ok": False, "engine": None, "engines": caps, "reason": "no_stt_backend"}
    return {"ok": True, "engine": choice, "engines": caps}


@bp.route("/api/voice/transcribe", methods=["OPTIONS"])
def voice_transcribe_options():
    return "", 204


@bp.route("/api/voice/transcribe", methods=["POST"])
def voice_transcribe():
    st = voice_stt_status()
    if not st.get("ok"):
        return jsonify({"error": "voice transcribe unavailable", "voice_stt": st}), 503
    engine = st.get("engine")
    raw = request.get_data(cache=False, as_text=False)
    if not raw or len(raw) < 200:
        return jsonify({"error": "body too small for wav"}), 400
    if len(raw) > 2 * 1024 * 1024:
        return jsonify({"error": "audio too large"}), 413
    if raw[:4] != b"RIFF" or raw[8:12] != b"WAVE":
        return jsonify({"error": "expected audio/wav (RIFF WAVE)"}), 415

    if engine == "whisper":
        try:
            with _voice_stt_lock:
                # Shared loader/caching in local_whisper_stt (same env knobs as before).
                text = local_whisper_stt.transcribe_wav_bytes(raw, language="en")
            return jsonify({"text": (text or "").strip(), "engine": "whisper"})
        except Exception as e:
            logger.exception("whisper transcribe failed")
            return jsonify({"error": str(e)}), 500

    try:
        import io

        import speech_recognition as sr
    except ImportError as e:
        return jsonify({"error": str(e)}), 503

    r = sr.Recognizer()
    r.dynamic_energy_threshold = True
    try:
        with _voice_stt_lock:
            with sr.AudioFile(io.BytesIO(raw)) as source:
                audio = r.record(source)
            try:
                text = r.recognize_google(audio, language="en-US")
            except sr.UnknownValueError:
                return jsonify({"text": "", "engine": "google", "note": "unintelligible"})
            except sr.RequestError as e:
                return jsonify({"error": f"google_stt: {e}"}), 502
    except Exception as e:
        logger.exception("voice transcribe failed")
        return jsonify({"error": str(e)}), 500

    return jsonify({"text": (text or "").strip(), "engine": "google"})
