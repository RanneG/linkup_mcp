"""Nami voice presets (no API calls)."""

import pytest

from elevenlabs_toolkit.config import nami_voice_id
from elevenlabs_toolkit.nami_voices import (
    NAMI_VOICE_PRESETS,
    default_nami_preset,
    nami_preset_by_id,
)


def test_default_nami_preset_is_bella():
    assert default_nami_preset().id == "bella"


def test_nami_preset_lookup():
    assert nami_preset_by_id("laura") is not None
    assert nami_preset_by_id("unknown") is None


def test_all_presets_have_voice_ids():
    assert len(NAMI_VOICE_PRESETS) >= 3
    for preset in NAMI_VOICE_PRESETS:
        assert len(preset.voice_id) > 8


def test_nami_voice_id_default(monkeypatch):
    monkeypatch.delenv("NAMI_VOICE_ID", raising=False)
    assert nami_voice_id() == "hpp4J3VqNfWAUOO0d1Us"


def test_nami_voice_id_override(monkeypatch):
    monkeypatch.setenv("NAMI_VOICE_ID", "custom-voice")
    assert nami_voice_id() == "custom-voice"
