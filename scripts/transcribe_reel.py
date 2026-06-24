#!/usr/bin/env python3
"""Download a reel/video URL, extract audio, transcribe with local faster-whisper."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INBOX = ROOT / "data" / "inbox"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from reel_workflow import slug_from_url, write_workflow_card, workflow_from_transcript_file


def run(cmd: list[str], *, cwd: Path | None = None) -> None:
    proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(f"Command failed ({proc.returncode}): {' '.join(cmd)}\n{err}")


def download(url: str, out_dir: Path, slug: str) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    template = str(out_dir / f"{slug}.%(ext)s")
    run(
        [
            sys.executable,
            "-m",
            "yt_dlp",
            "--no-playlist",
            "-f",
            "best[ext=mp4]/best",
            "-o",
            template,
            url,
        ]
    )
    matches = sorted(out_dir.glob(f"{slug}.*"), key=lambda p: p.stat().st_mtime, reverse=True)
    media = [p for p in matches if p.suffix.lower() in {".mp4", ".webm", ".mkv", ".m4a", ".mp3"}]
    if not media:
        raise FileNotFoundError(f"No media downloaded for {slug} in {out_dir}")
    return media[0]


def extract_wav(media: Path, wav: Path) -> None:
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(media),
            "-ar",
            "16000",
            "-ac",
            "1",
            str(wav),
        ]
    )


def emit_workflow(slug: str, source_url: str, transcript_text: str) -> Path:
    workflow = write_workflow_card(
        inbox_dir=INBOX,
        slug=slug,
        source_url=source_url,
        transcript_text=transcript_text,
    )
    print(f"Workflow card -> {workflow.name}")
    return workflow


def main() -> int:
    parser = argparse.ArgumentParser(description="Download URL and transcribe speech to markdown.")
    parser.add_argument(
        "url",
        nargs="?",
        help="Instagram reel/post or other yt-dlp-supported URL",
    )
    parser.add_argument("--language", default="en")
    parser.add_argument("--model-hint", action="store_true", help="Print whisper model env in output")
    parser.add_argument(
        "--workflow-only",
        metavar="TRANSCRIPT.md",
        help="Regenerate *.workflow.md from an existing transcript (no download/transcribe)",
    )
    args = parser.parse_args()

    if args.workflow_only:
        md_path = Path(args.workflow_only)
        if not md_path.is_absolute():
            md_path = (ROOT / md_path).resolve()
        if not md_path.is_file():
            print(f"Error: transcript not found: {md_path}", file=sys.stderr)
            return 1
        workflow = workflow_from_transcript_file(md_path, inbox_dir=INBOX)
        print(json.dumps({"ok": True, "workflow": str(workflow)}, indent=2))
        return 0

    if not args.url:
        parser.error("url is required unless --workflow-only is set")

    slug = slug_from_url(args.url)
    media = INBOX / f"{slug}.mp4"
    wav = INBOX / f"{slug}.wav"
    md = INBOX / f"{slug}.md"

    print(f"Downloading -> {INBOX}")
    downloaded = download(args.url, INBOX, slug)
    if downloaded != media and downloaded.suffix.lower() != ".mp4":
        media = downloaded

    print(f"Extracting audio -> {wav.name}")
    extract_wav(downloaded, wav)

    import local_whisper_stt as lw

    if not lw.whisper_import_ok():
        print("Error: faster-whisper not installed. Run: pip install -e \".[stitch-whisper]\"", file=sys.stderr)
        return 1

    print("Transcribing (first run may download model weights)...")
    text = lw.transcribe_wav_path(str(wav), language=args.language)

    meta = {
        "source_url": args.url,
        "slug": slug,
        "media": str(downloaded.relative_to(ROOT)).replace("\\", "/"),
        "wav": str(wav.relative_to(ROOT)).replace("\\", "/"),
        "transcribed_at": datetime.now(timezone.utc).isoformat(),
    }
    body = [
        f"# Transcript: {slug}",
        "",
        f"- **Source:** {args.url}",
        f"- **Transcribed:** {meta['transcribed_at']}",
        "",
        "## Transcript",
        "",
        text or "(no speech detected)",
        "",
    ]
    md.write_text("\n".join(body), encoding="utf-8")
    (INBOX / f"{slug}.meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    workflow = emit_workflow(slug, args.url, text or "")

    print(
        json.dumps(
            {
                "ok": True,
                "markdown": str(md),
                "workflow": str(workflow),
                "transcript_chars": len(text),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
