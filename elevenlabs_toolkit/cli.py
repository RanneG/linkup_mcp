"""CLI: ``uv run elevenlabs-gen`` (after ``uv sync --extra elevenlabs``)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from elevenlabs_toolkit.music import compose_music
from elevenlabs_toolkit.tts import generate_speech, list_voices


def _cmd_voices(_: argparse.Namespace) -> int:
    for row in list_voices():
        print(f"{row['voice_id']}\t{row['category']}\t{row['name']}")
    return 0


def _cmd_tts(args: argparse.Namespace) -> int:
    out = generate_speech(
        args.text,
        Path(args.output),
        voice_id=args.voice_id,
        model_id=args.model,
    )
    print(f"Wrote {out.resolve()}")
    return 0


def _cmd_music(args: argparse.Namespace) -> int:
    out = compose_music(
        args.prompt,
        Path(args.output),
        music_length_ms=args.length_ms,
    )
    print(f"Wrote {out.resolve()}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="elevenlabs-gen",
        description="Pre-bake ElevenLabs voice and music assets (API key in .env).",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    voices_p = sub.add_parser("voices", help="List voices on your ElevenLabs account")
    voices_p.set_defaults(func=_cmd_voices)

    tts_p = sub.add_parser("tts", help="Text-to-speech → MP3 file")
    tts_p.add_argument("text", help="Text to speak")
    tts_p.add_argument("-o", "--output", required=True, help="Output .mp3 path")
    tts_p.add_argument("--voice-id", default=None, help="Voice ID (default: ELEVENLABS_VOICE_ID)")
    tts_p.add_argument("--model", default="eleven_multilingual_v2", help="TTS model id")
    tts_p.set_defaults(func=_cmd_tts)

    music_p = sub.add_parser("music", help="Prompt → music MP3 file")
    music_p.add_argument("prompt", help="Music prompt (genre, mood, instruments)")
    music_p.add_argument("-o", "--output", required=True, help="Output .mp3 path")
    music_p.add_argument(
        "--length-ms",
        type=int,
        default=30_000,
        help="Track length in ms (3000–300000)",
    )
    music_p.set_defaults(func=_cmd_music)

    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
