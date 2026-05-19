import io
import wave

import numpy as np

from voice_prompt_tool import VoicePromptTool


def test_wav_bytes_use_actual_recording_settings() -> None:
    tool = object.__new__(VoicePromptTool)
    tool.sample_rate = 16000
    tool.channels = 1
    frames = [np.zeros((480, 1), dtype=np.float32)]

    wav_bytes = tool._wav_bytes_from_frames(frames, sample_rate=48000, channels=1)

    with wave.open(io.BytesIO(wav_bytes), "rb") as wav:
        assert wav.getframerate() == 48000
        assert wav.getnchannels() == 1
