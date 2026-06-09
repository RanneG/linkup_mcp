# ElevenLabs toolkit

Pre-bake **voice** and **music** assets for **pixel-portfolio**, **Stitch**, and demos. Keys stay in **`.env`** at the linkup_mcp repo root — never commit them, never expose them in the browser.

## Setup

1. Copy **`ELEVENLABS_API_KEY`** into **`.env`** (see **[ENV_TEMPLATE.md](../../ENV_TEMPLATE.md)**).
2. Install the optional profile:

   ```bash
   uv sync --extra elevenlabs
   ```

   Or: `pip install -e ".[elevenlabs]"`

3. Optional: set **`ELEVENLABS_VOICE_ID`** (run `voices` below to pick one).

## Nami (spoken assistant)

Jarvis-style stock voices for OpenClaw/Mac confirmations — separate from portfolio boot audio. See **[NAMI.md](NAMI.md)**.

```bash
uv run elevenlabs-gen nami-voices
uv run elevenlabs-gen nami-audition --all --confirm
uv run elevenlabs-gen nami-speak "Task complete." -o data/nami-voice/last.mp3
```

Set **`NAMI_VOICE_ID`** in `.env` after you pick a preset.

## CLI

From **linkup_mcp** root:

```bash
# List voices on your account
uv run elevenlabs-gen voices

# BIOS / login lines → portfolio public audio
uv run elevenlabs-gen tts "Welcome to my portfolio website." -o ../pixel-portfolio/public/audio/bios-welcome.mp3

uv run elevenlabs-gen tts "Loading portfolio." -o ../pixel-portfolio/public/audio/bios-loading.mp3

# Win98 desktop loop → music.json
uv run elevenlabs-gen music "Windows 98 desktop ambient, soft synth, nostalgic, instrumental, seamless loop" -o ../pixel-portfolio/public/audio/desktop-fm.mp3 --length-ms 45000
```

Then point **`pixel-portfolio/public/data/music.json`** at local files (`/audio/...`) instead of external URLs.

## Python API

```python
from pathlib import Path
from elevenlabs_toolkit import compose_music, generate_speech, list_voices

generate_speech("Confirm.", Path("out/login.mp3"))
compose_music("Chiptune menu theme, 90s game", Path("out/menu.mp3"), music_length_ms=20_000)
```

## When to pre-bake vs call the API live

| Pattern | Use |
|--------|-----|
| **Pre-bake MP3** (this toolkit) | Portfolio boot, UI stings, demo reels — **recommended** |
| **Server proxy** | Dynamic TTS (e.g. Stitch reading subscription names) — add a bridge route later, key server-side only |
| **Browser direct** | **Avoid** — exposes API key and burns credits per visitor |

## Products

| ElevenLabs product | Toolkit command | Notes |
|--------------------|-----------------|-------|
| **Text-to-speech** | `elevenlabs-gen tts` | Multilingual v2 default |
| **Music** | `elevenlabs-gen music` | Music v1 API; check [music terms](https://elevenlabs.io/eleven-music-v1-terms) for your plan |
| **Sound effects** | — | Use ElevenLabs UI for now; add `sfx` subcommand when needed |

## Free tier limits (2026)

- **TTS** works on the free plan (~10k credits/month).
- **Music API** returns `402 paid_plan_required` on free — use a placeholder loop in `pixel-portfolio/public/audio/` until Starter, or generate music in the ElevenLabs web UI and export manually.

## Windows note

If `pip install -e ".[elevenlabs]"` fails with a **long path** error, enable [Windows long paths](https://pip.pypa.io/warnings/enable-long-paths) or use a shorter venv path (e.g. `C:\dev\linkup_mcp\.venv`). The **`music`** command only needs `requests`; **`tts`** needs the full `elevenlabs` package.

## Docs

- [ElevenLabs API](https://elevenlabs.io/docs)
- [Python SDK](https://elevenlabs.io/docs/eleven-agents/libraries/python)
- [Music compose API](https://elevenlabs.io/docs/api-reference/music/compose)
