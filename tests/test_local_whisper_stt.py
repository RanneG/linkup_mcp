"""Tests for local Whisper WAV input validation."""
from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import local_whisper_stt


class LocalWhisperSttTests(unittest.TestCase):
    def test_transcribe_wav_path_rejects_oversized_file_before_model_load(self) -> None:
        with tempfile.TemporaryDirectory() as td, patch.dict(os.environ, {"STITCH_WHISPER_MAX_WAV_BYTES": "64"}):
            wav = Path(td) / "huge.wav"
            wav.write_bytes(b"RIFF" + b"\0" * 100)

            with patch.object(local_whisper_stt, "_get_model", side_effect=AssertionError("model should not load")):
                with self.assertRaisesRegex(ValueError, "WAV too large"):
                    local_whisper_stt.transcribe_wav_path(str(wav))

    def test_transcribe_wav_bytes_rejects_oversized_payload_before_model_load(self) -> None:
        with patch.dict(os.environ, {"STITCH_WHISPER_MAX_WAV_BYTES": "64"}):
            with patch.object(local_whisper_stt, "_get_model", side_effect=AssertionError("model should not load")):
                with self.assertRaisesRegex(ValueError, "WAV too large"):
                    local_whisper_stt.transcribe_wav_bytes(b"RIFF" + b"\0" * 100)


if __name__ == "__main__":
    unittest.main()
