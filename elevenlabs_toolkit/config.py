"""Load ElevenLabs credentials from the environment."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Repo root `.env` (linkup_mcp)
_REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_REPO_ROOT / ".env")

# Rachel — clear default from ElevenLabs docs; override via ELEVENLABS_VOICE_ID
_DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"


def get_api_key() -> str:
    key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "ELEVENLABS_API_KEY is not set. Add it to .env (see ENV_TEMPLATE.md and docs/elevenlabs/README.md)."
        )
    return key


def default_voice_id() -> str:
    return os.getenv("ELEVENLABS_VOICE_ID", _DEFAULT_VOICE).strip() or _DEFAULT_VOICE
