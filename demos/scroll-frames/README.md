# Scroll-frame demo

Minimal proof of **scroll position → frame index** playback, inspired by the Instagram reel workflow ([DW7lN7sj2ow](https://www.instagram.com/reels/DW7lN7sj2ow/)):

| Reel step | This demo |
|-----------|-----------|
| Whisk — start/end stills | `generate_frames.py` writes 24 SVG placeholders |
| Google Flow — in-between video | Skipped (use real assets when you have them) |
| ezgif — video → frame zip @ 30 FPS | Run on your clip; drop PNGs into `frames/` |
| AI coding tool — scroll-synced site | `index.html` + `main.js` |

## Quick start

```bash
# Regenerate placeholder frames (optional — 24 SVGs are committed)
python demos/scroll-frames/generate_frames.py

# Serve locally (any static server)
cd demos/scroll-frames
python -m http.server 8080
# Open http://127.0.0.1:8080/
```

Scroll the page: the sticky canvas scrubs `frame_000` … `frame_023`.

## Swap in real frames

1. Export from [ezgif](https://ezgif.com/split) (or ffmpeg) as `frame_000.png`, `frame_001.png`, …
2. Replace or add files under `frames/`.
3. In `main.js`, set `FRAME_COUNT` and change the extension in `frameSrc()` if needed.

For hundreds of PNGs, keep them **outside git** (zip on disk) and copy into `frames/` when demoing.

## Related repo files

- Transcript: `data/inbox/DW7lN7sj2ow.md` (slug after re-transcribe with fixed `/reels/` regex)
- Workflow card: `data/inbox/*.workflow.md` from `scripts/transcribe_reel.py`
