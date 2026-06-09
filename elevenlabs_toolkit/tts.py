"""Text-to-speech via ElevenLabs."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from elevenlabs_toolkit.config import default_voice_id, get_api_key


def _write_audio_stream(stream: Any, out_path: Path) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("wb") as f:
        if isinstance(stream, (bytes, bytearray)):
            f.write(stream)
        else:
            for chunk in stream:
                if chunk:
                    f.write(chunk)
    return out_path


def generate_speech(
    text: str,
    out_path: Path,
    *,
    voice_id: str | None = None,
    model_id: str = "eleven_multilingual_v2",
    output_format: str = "mp3_44100_128",
) -> Path:
    """Generate speech MP3 and write to ``out_path``."""
    from elevenlabs import ElevenLabs

    client = ElevenLabs(api_key=get_api_key())
    audio = client.text_to_speech.convert(
        voice_id=voice_id or default_voice_id(),
        text=text,
        model_id=model_id,
        output_format=output_format,
    )
    return _write_audio_stream(audio, Path(out_path))


def list_voices() -> list[dict[str, str]]:
    """Return ``[{voice_id, name, category}, ...]`` for CLI / discovery."""
    from elevenlabs import ElevenLabs

    client = ElevenLabs(api_key=get_api_key())
    response = client.voices.search()
    voices = getattr(response, "voices", None) or []
    rows: list[dict[str, str]] = []
    for v in voices:
        rows.append(
            {
                "voice_id": getattr(v, "voice_id", "") or "",
                "name": getattr(v, "name", "") or "",
                "category": getattr(v, "category", "") or "",
            }
        )
    return rows
