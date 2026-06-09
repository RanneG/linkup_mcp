"""Nami assistant voice presets (Jarvis-style stock voices on free tier)."""

from __future__ import annotations

from dataclasses import dataclass

# Premade voices — audition with: uv run elevenlabs-gen nami-audition
NAMI_SAMPLE_LINE = (
    "Good morning. I've reviewed your calendar — you're clear until noon. "
    "Shall I start with the portfolio deploy, or the OpenClaw setup?"
)

NAMI_CONFIRM_LINE = "Task complete. Anything else?"


@dataclass(frozen=True)
class NamiVoicePreset:
    id: str
    name: str
    voice_id: str
    vibe: str


NAMI_VOICE_PRESETS: tuple[NamiVoicePreset, ...] = (
    NamiVoicePreset(
        id="george",
        name="George",
        voice_id="JBFqnCBsd6RMkjVDRZzb",
        vibe="Warm British storyteller — default Jarvis-adjacent pick",
    ),
    NamiVoicePreset(
        id="callum",
        name="Callum",
        voice_id="N2lVS1w4EtoT3dr4eOWO",
        vibe="Deeper, husky — more dramatic assistant",
    ),
    NamiVoicePreset(
        id="roger",
        name="Roger",
        voice_id="CwhRBWXzGAHq8TQ4Fs17",
        vibe="Laid-back, resonant — casual butler",
    ),
    NamiVoicePreset(
        id="charlie",
        name="Charlie",
        voice_id="IKne3meq5aSn9XLyUdCD",
        vibe="Deep, confident — energetic briefing style",
    ),
)

_DEFAULT_NAMI_PRESET_ID = "george"


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
