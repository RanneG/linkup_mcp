import io
import unittest
import wave

try:
    import numpy as np

    from voice_prompt_tool import VoicePromptTool

    _IMPORT_ERROR = None
except Exception as exc:  # pragma: no cover - dependency-gated test module
    np = None  # type: ignore[assignment]
    VoicePromptTool = None  # type: ignore[assignment]
    _IMPORT_ERROR = exc


@unittest.skipIf(_IMPORT_ERROR is not None, f"voice prompt dependencies unavailable: {_IMPORT_ERROR}")
class VoicePromptToolWavTests(unittest.TestCase):
    def test_wav_header_uses_actual_stream_settings(self) -> None:
        tool = object.__new__(VoicePromptTool)
        tool.channels = 1
        tool.sample_rate = 16000
        tool._recording_channels = 2
        tool._recording_sample_rate = 48000

        frames = [np.full((10, 2), 0.25, dtype=np.float32)]

        wav_bytes = tool._wav_bytes_from_frames(frames, channels=2, sample_rate=48000)

        with wave.open(io.BytesIO(wav_bytes), "rb") as wav_file:
            self.assertEqual(wav_file.getnchannels(), 2)
            self.assertEqual(wav_file.getframerate(), 48000)
            self.assertEqual(wav_file.getnframes(), 10)

    def test_wav_header_prefers_frame_channel_count_over_stale_metadata(self) -> None:
        tool = object.__new__(VoicePromptTool)
        tool.channels = 1
        tool.sample_rate = 16000
        tool._recording_channels = 1
        tool._recording_sample_rate = 48000

        frames = [np.full((5, 2), -0.5, dtype=np.float32)]

        wav_bytes = tool._wav_bytes_from_frames(frames, channels=1, sample_rate=48000)

        with wave.open(io.BytesIO(wav_bytes), "rb") as wav_file:
            self.assertEqual(wav_file.getnchannels(), 2)
            self.assertEqual(wav_file.getframerate(), 48000)
            self.assertEqual(wav_file.getnframes(), 5)


if __name__ == "__main__":
    unittest.main()
