"""ElevenLabs helpers for pre-baking voice and music assets (portfolio, Stitch, demos)."""

from elevenlabs_toolkit.config import default_voice_id, get_api_key
from elevenlabs_toolkit.music import compose_music
from elevenlabs_toolkit.tts import generate_speech, list_voices

__all__ = [
    "compose_music",
    "default_voice_id",
    "generate_speech",
    "get_api_key",
    "list_voices",
]
