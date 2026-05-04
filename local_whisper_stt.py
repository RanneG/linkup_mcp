"""
Local faster-whisper STT for MCP testing (no Flask, no Stitch UI).

Uses the same env knobs as stitch_rag_bridge: STITCH_WHISPER_MODEL, STITCH_WHISPER_DEVICE,
STITCH_WHISPER_COMPUTE_TYPE. Install optional deps: pip install -e ".[stitch-whisper]"
"""
from __future__ import annotations

import logging
import os
import tempfile
import threading

logger = logging.getLogger(__name__)

_model = None
_model_key: str | None = None
_model_lock = threading.Lock()


def whisper_import_ok() -> bool:
    try:
        import faster_whisper  # noqa: F401

        return True
    except Exception:
        return False


def _get_model():
    global _model, _model_key
    model_name = (os.getenv("STITCH_WHISPER_MODEL") or "tiny.en").strip() or "tiny.en"
    device = (os.getenv("STITCH_WHISPER_DEVICE") or "cpu").strip() or "cpu"
    compute = (os.getenv("STITCH_WHISPER_COMPUTE_TYPE") or "int8").strip() or "int8"
    key = f"{model_name}|{device}|{compute}"
    with _model_lock:
        if _model is not None and _model_key == key:
            return _model
        from faster_whisper import WhisperModel

        logger.info("Loading Whisper model %s device=%s compute_type=%s", model_name, device, compute)
        _model = WhisperModel(model_name, device=device, compute_type=compute)
        _model_key = key
        return _model


def transcribe_wav_bytes(raw: bytes, *, language: str = "en") -> str:
    """RIFF WAVE bytes in, plain text out."""
    if len(raw) < 44:
        raise ValueError("WAV too small")
    if raw[:4] != b"RIFF" or raw[8:12] != b"WAVE":
        raise ValueError("Not a RIFF WAVE file")
    model = _get_model()
    path: str | None = None
    try:
        fd, path = tempfile.mkstemp(suffix=".wav")
        with os.fdopen(fd, "wb") as wf:
            wf.write(raw)
        segments, _info = model.transcribe(path, language=language.strip() or "en", beam_size=1)
        parts: list[str] = []
        for seg in segments:
            t = (seg.text or "").strip()
            if t:
                parts.append(t)
        return " ".join(parts).strip()
    finally:
        if path:
            try:
                os.unlink(path)
            except OSError:
                pass


def transcribe_wav_path(path: str, *, language: str = "en") -> str:
    p = os.path.abspath(os.path.expanduser(path.strip()))
    if not os.path.isfile(p):
        raise FileNotFoundError(f"Not a file: {p}")
    with open(p, "rb") as f:
        raw = f.read()
    return transcribe_wav_bytes(raw, language=language)
