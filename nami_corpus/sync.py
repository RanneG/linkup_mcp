"""Sync git-tracked docs into data/nami-corpus/ for RAG."""

from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "nami-corpus"

CORPUS_SOURCES: tuple[str, ...] = (
    "AGENTS.md",
    "README.md",
    "ENV_TEMPLATE.md",
    "CHANGELOG.md",
    "hermes-nami/SOUL.md",
    "hermes-nami/AGENTS.md",
    "hermes-nami/config.yaml",
    "hermes-nami/memories/MEMORY.md",
    "hermes-nami/memories/USER.md",
    "docs/hermes/NAMI.md",
    "docs/hermes/MAC_SETUP.md",
    "docs/hermes/PC_CLIENT.md",
    "docs/hermes/MEMORY.md",
    "docs/hermes/SURFACE_MAP.md",
    "docs/hermes/STATUS.md",
    "docs/hermes/LOOP_ENGINEERING.md",
    "docs/hermes/REEL_BACKLOG.md",
    "hermes-nami/skills/loop-checker.md",
    "hermes-nami/skills/daily-brief-loop.md",
    "hermes-nami/skills/linkup-mcp.md",
    "hermes-nami/skills/model-routing.md",
    "hermes-nami/skills/mobile-build-request.md",
    "docs/hermes/MOBILE_BUILD.md",
    "docs/stitch/MIGRATION.md",
    "docs/stitch/STATUS.md",
    "docs/stitch_user_guide.md",
    "docs/nami-game-lab/README.md",
    "docs/elevenlabs/NAMI.md",
    "docs/elevenlabs/README.md",
    "docs/supplyme/README.md",
)


def _dest_name(rel: str) -> str:
    return rel.replace("/", "__").replace("\\", "__")


def sync_corpus(*, dry_run: bool = False) -> dict[str, int]:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / ".manifest.txt"
    previous: dict[str, str] = {}
    if manifest_path.exists():
        for line in manifest_path.read_text(encoding="utf-8").splitlines():
            if "|" in line:
                name, digest = line.split("|", 1)
                previous[name] = digest

    copied = skipped = missing = 0
    manifest_lines: list[str] = []

    for rel in CORPUS_SOURCES:
        src = ROOT / rel
        if not src.is_file():
            missing += 1
            continue
        text = src.read_text(encoding="utf-8")
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
        dest_name = _dest_name(rel)
        manifest_lines.append(f"{dest_name}|{digest}")

        if previous.get(dest_name) == digest and (OUT / dest_name).exists():
            skipped += 1
            continue

        if not dry_run:
            dest = OUT / dest_name
            if src.suffix.lower() in {".md", ".yaml", ".yml"}:
                dest.write_text(text, encoding="utf-8")
            else:
                shutil.copy2(src, dest)
        copied += 1

    if not dry_run:
        manifest_path.write_text("\n".join(manifest_lines) + "\n", encoding="utf-8")
        (OUT / "README.md").write_text(
            "# Nami RAG corpus (generated)\n\n"
            "Run `python -m nami_corpus.sync` after updating source docs.\n",
            encoding="utf-8",
        )

    return {
        "copied": copied,
        "skipped": skipped,
        "missing": missing,
        "total_sources": len(CORPUS_SOURCES),
    }


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Sync markdown into data/nami-corpus/")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    stats = sync_corpus(dry_run=args.dry_run)
    label = "Would sync" if args.dry_run else "Synced"
    print(
        f"{label} nami-corpus: copied={stats['copied']} skipped={stats['skipped']} "
        f"missing={stats['missing']} sources={stats['total_sources']} -> {OUT}"
    )
    return 0 if stats["missing"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
