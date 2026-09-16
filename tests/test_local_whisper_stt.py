"""Tests for local Whisper WAV input validation (no faster-whisper / model download)."""
from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import local_whisper_stt


class LocalWhisperSttTests(unittest.TestCase):
    def test_transcribe_wav_path_rejects_oversized_file_before_read_or_model_load(self) -> None:
        with tempfile.TemporaryDirectory() as td, patch.dict(os.environ, {"STITCH_WHISPER_MAX_WAV_BYTES": "64"}):
            wav = Path(td) / "huge.mp4"
            wav.write_bytes(b"ftyp" + b"\0" * 100)

            with (
                patch.object(local_whisper_stt, "_get_model", side_effect=AssertionError("model should not load")),
                patch("builtins.open", side_effect=AssertionError("must not open oversized files")),
            ):
                with self.assertRaisesRegex(ValueError, "WAV too large"):
                    local_whisper_stt.transcribe_wav_path(str(wav))

    def test_transcribe_wav_path_rejects_non_wav_header_before_model_load(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            media = Path(td) / "clip.mp4"
            media.write_bytes(b"ftypisom" + b"\0" * 40)

            with patch.object(local_whisper_stt, "_get_model", side_effect=AssertionError("model should not load")):
                with self.assertRaisesRegex(ValueError, "Not a RIFF WAVE file"):
                    local_whisper_stt.transcribe_wav_path(str(media))

    def test_transcribe_wav_bytes_rejects_oversized_payload_before_model_load(self) -> None:
        with patch.dict(os.environ, {"STITCH_WHISPER_MAX_WAV_BYTES": "64"}):
            with patch.object(local_whisper_stt, "_get_model", side_effect=AssertionError("model should not load")):
                with self.assertRaisesRegex(ValueError, "WAV too large"):
                    local_whisper_stt.transcribe_wav_bytes(b"RIFF" + b"\0" * 4 + b"WAVE" + b"\0" * 100)


if __name__ == "__main__":
    unittest.main()
