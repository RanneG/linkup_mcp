#!/usr/bin/env python3
"""Generate lightweight SVG placeholder frames for the scroll-frames demo."""
from __future__ import annotations

import argparse
from pathlib import Path

FRAMES = 24
SIZE = 800


def frame_svg(index: int, total: int) -> str:
    t = index / max(total - 1, 1)
    hue = int(220 + 80 * t)
    cx = 120 + (SIZE - 240) * t
    cy = SIZE // 2 + int(40 * (t - 0.5))
    r = 48 + int(24 * abs(0.5 - t))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" viewBox="0 0 {SIZE} {SIZE}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="hsl({hue}, 70%, 18%)"/>
      <stop offset="100%" stop-color="hsl({hue + 30}, 80%, 32%)"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="{cx:.0f}" cy="{cy}" r="{r}" fill="hsl({hue + 50}, 90%, 62%)" opacity="0.9"/>
  <text x="50%" y="52%" text-anchor="middle" fill="white" font-family="system-ui,sans-serif" font-size="42" font-weight="600">{index + 1}/{total}</text>
  <text x="50%" y="62%" text-anchor="middle" fill="rgba(255,255,255,0.75)" font-family="system-ui,sans-serif" font-size="16">scroll frame demo</text>
</svg>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Write SVG frames into demos/scroll-frames/frames/")
    parser.add_argument("--count", type=int, default=FRAMES)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()

    out_dir = args.out or Path(__file__).resolve().parent / "frames"
    out_dir.mkdir(parents=True, exist_ok=True)
    for i in range(args.count):
        (out_dir / f"frame_{i:03d}.svg").write_text(frame_svg(i, args.count), encoding="utf-8")
    print(f"Wrote {args.count} frames -> {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
