"""Nami assistant voice presets — female stock voices (free tier)."""

from __future__ import annotations

from dataclasses import dataclass

# Premade voices — audition with: uv run elevenlabs-gen nami-audition
NAMI_SAMPLE_LINE = (
    "Good morning. I've charted your day — calendar's clear until noon. "
    "Want me to start with the portfolio deploy, or OpenClaw setup?"
)

NAMI_CONFIRM_LINE = "All set. What's next?"


@dataclass(frozen=True)
class NamiVoicePreset:
    id: str
    name: str
    voice_id: str
    vibe: str


NAMI_VOICE_PRESETS: tuple[NamiVoicePreset, ...] = (
    NamiVoicePreset(
        id="bella",
        name="Bella",
        voice_id="hpp4J3VqNfWAUOO0d1Us",
        vibe="Professional, bright, warm — default Nami voice",
    ),
    NamiVoicePreset(
        id="sarah",
        name="Sarah",
        voice_id="EXAVITQu4vr4xnSDxMaL",
        vibe="Mature, reassuring, confident — steady navigator tone",
    ),
    NamiVoicePreset(
        id="laura",
        name="Laura",
        voice_id="FGY2WhTYpPnrIDTdsKH5",
        vibe="Enthusiastic, quirky — more playful energy",
    ),
    NamiVoicePreset(
        id="river",
        name="River",
        voice_id="SAz9YHcvj6GT2YYXdXww",
        vibe="Relaxed, neutral, informative — calm and steady",
    ),
)

_DEFAULT_NAMI_PRESET_ID = "bella"


def nami_preset_by_id(preset_id: str) -> NamiVoicePreset | None:
    key = preset_id.strip().lower()
    for preset in NAMI_VOICE_PRESETS:
        if preset.id == key:
            return preset
    return None


def default_nami_preset() -> NamiVoicePreset:
    preset = nami_preset_by_id(_DEFAULT_NAMI_PRESET_ID)
    assert preset is not None
    return preset
