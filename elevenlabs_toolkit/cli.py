"""CLI: ``uv run elevenlabs-gen`` (after ``uv sync --extra elevenlabs``)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from elevenlabs_toolkit.config import nami_voice_id
from elevenlabs_toolkit.music import compose_music
from elevenlabs_toolkit.nami_voices import (
    NAMI_CONFIRM_LINE,
    NAMI_SAMPLE_LINE,
    NAMI_VOICE_PRESETS,
    default_nami_preset,
    nami_preset_by_id,
)
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


def _cmd_nami_voices(_: argparse.Namespace) -> int:
    for preset in NAMI_VOICE_PRESETS:
        print(f"{preset.id}\t{preset.voice_id}\t{preset.name} — {preset.vibe}")
    print(f"\nDefault: {default_nami_preset().id} (override with NAMI_VOICE_ID in .env)")
    return 0


def _cmd_nami_audition(args: argparse.Namespace) -> int:
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    presets = NAMI_VOICE_PRESETS if args.all else [default_nami_preset()]
    if args.preset:
        picked = nami_preset_by_id(args.preset)
        if picked is None:
            raise RuntimeError(f"Unknown preset {args.preset!r}. Run: elevenlabs-gen nami-voices")
        presets = [picked]

    line = args.text or NAMI_SAMPLE_LINE
    for preset in presets:
        dest = out_dir / f"nami-{preset.id}-sample.mp3"
        generate_speech(line, dest, voice_id=preset.voice_id)
        print(f"Wrote {dest.resolve()}")
        if args.confirm:
            confirm_dest = out_dir / f"nami-{preset.id}-confirm.mp3"
            generate_speech(NAMI_CONFIRM_LINE, confirm_dest, voice_id=preset.voice_id)
            print(f"Wrote {confirm_dest.resolve()}")
    return 0


def _cmd_nami_speak(args: argparse.Namespace) -> int:
    voice = args.voice_id or nami_voice_id()
    out = generate_speech(args.text, Path(args.output), voice_id=voice)
    print(f"Wrote {out.resolve()} (voice {voice})")
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

    nami_voices_p = sub.add_parser("nami-voices", help="List Jarvis-style presets for Nami assistant")
    nami_voices_p.set_defaults(func=_cmd_nami_voices)

    nami_audition_p = sub.add_parser(
        "nami-audition",
        help="Generate sample MP3s for Nami voice presets",
    )
    nami_audition_p.add_argument(
        "-o",
        "--output-dir",
        default="data/nami-voice/samples",
        help="Output directory for audition clips",
    )
    nami_audition_p.add_argument("--preset", default=None, help="Single preset id (george, callum, …)")
    nami_audition_p.add_argument("--all", action="store_true", help="Audition every preset")
    nami_audition_p.add_argument("--text", default=None, help="Custom line (default: Nami briefing sample)")
    nami_audition_p.add_argument(
        "--confirm",
        action="store_true",
        help="Also generate a short 'Task complete' clip per preset",
    )
    nami_audition_p.set_defaults(func=_cmd_nami_audition)

    nami_speak_p = sub.add_parser("nami-speak", help="TTS with NAMI_VOICE_ID (or --voice-id)")
    nami_speak_p.add_argument("text", help="Text for Nami to speak")
    nami_speak_p.add_argument("-o", "--output", required=True, help="Output .mp3 path")
    nami_speak_p.add_argument("--voice-id", default=None, help="Override NAMI_VOICE_ID")
    nami_speak_p.set_defaults(func=_cmd_nami_speak)

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
