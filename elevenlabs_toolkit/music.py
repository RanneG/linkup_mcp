"""Music generation via ElevenLabs Music API."""

from __future__ import annotations

from pathlib import Path

import requests

from elevenlabs_toolkit.config import get_api_key

_MUSIC_URL = "https://api.elevenlabs.io/v1/music"
_MIN_MS = 3_000
_MAX_MS = 300_000


def compose_music(
    prompt: str,
    out_path: Path,
    *,
    music_length_ms: int = 30_000,
    output_format: str = "mp3_44100_128",
) -> Path:
    """Compose music from a text prompt and write audio to ``out_path``."""
    length = max(_MIN_MS, min(music_length_ms, _MAX_MS))
    response = requests.post(
        _MUSIC_URL,
        headers={
            "xi-api-key": get_api_key(),
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        json={
            "prompt": prompt,
            "music_length_ms": length,
            "model_id": "music_v1",
        },
        params={"output_format": output_format},
        timeout=300,
    )
    if not response.ok:
        detail = response.text[:500]
        raise RuntimeError(f"ElevenLabs music API failed ({response.status_code}): {detail}")

    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(response.content)
    return out
