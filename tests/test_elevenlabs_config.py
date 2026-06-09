"""ElevenLabs toolkit config (no API calls)."""

import pytest

from elevenlabs_toolkit.config import default_voice_id, get_api_key


def test_get_api_key_missing(monkeypatch):
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="ELEVENLABS_API_KEY"):
        get_api_key()


def test_get_api_key_present(monkeypatch):
    monkeypatch.setenv("ELEVENLABS_API_KEY", "test-key")
    assert get_api_key() == "test-key"


def test_default_voice_id_fallback(monkeypatch):
    monkeypatch.delenv("ELEVENLABS_VOICE_ID", raising=False)
    assert default_voice_id() == "21m00Tcm4TlvDq8ikWAM"


def test_default_voice_id_override(monkeypatch):
    monkeypatch.setenv("ELEVENLABS_VOICE_ID", "custom-voice")
    assert default_voice_id() == "custom-voice"
