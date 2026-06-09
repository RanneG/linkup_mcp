# Nami voice (spoken assistant)

**Nami** is your build partner in Cursor; **spoken Nami** is optional TTS for OpenClaw/Mac confirmations — Jarvis-*style*, not movie voice clone.

## Free tier is enough to start

Stock ElevenLabs voices beat most open-source TTS. Pick one preset, set `NAMI_VOICE_ID`, use `nami-speak` for occasional lines.

| Preset | Voice ID | Vibe |
|--------|----------|------|
| **george** (default) | `JBFqnCBsd6RMkjVDRZzb` | Warm British — closest “calm assistant” |
| callum | `N2lVS1w4EtoT3dr4eOWO` | Deeper, dramatic |
| roger | `CwhRBWXzGAHq8TQ4Fs17` | Laid-back butler |
| charlie | `IKne3meq5aSn9XLyUdCD` | Deep, energetic briefing |

Portfolio boot audio can keep **Sarah** via `ELEVENLABS_VOICE_ID`; Nami uses **`NAMI_VOICE_ID`** separately.

## Setup

In **linkup_mcp** `.env`:

```bash
ELEVENLABS_API_KEY=...
NAMI_VOICE_ID=JBFqnCBsd6RMkjVDRZzb   # George — change after audition
```

```bash
uv sync --extra elevenlabs
uv run elevenlabs-gen nami-voices
uv run elevenlabs-gen nami-audition --all --confirm
# Listen in data/nami-voice/samples/
```

Pick a preset, then:

```bash
# .env: NAMI_VOICE_ID=<voice_id from preset>
uv run elevenlabs-gen nami-speak "Task complete." -o data/nami-voice/last.mp3
```

## Architecture (OpenClaw / Mac)

- **Text first** — Nami in Cursor stays chat; spoken lines are highlights.
- **Server-side only** — OpenClaw skill or script calls `nami-speak`; never expose the API key in a browser.
- **Pre-bake fixed phrases** — boot stings, “task done”, morning brief opener.
- **Dynamic TTS sparingly** — count characters; free ~10k/month is not “every reply spoken.”

## When to upgrade Starter

- Clone **your** voice (not stock Jarvis-style)
- Speak **most** agent replies aloud
- Heavy regen / music API

## Commands

| Command | Purpose |
|---------|---------|
| `nami-voices` | List presets + default |
| `nami-audition` | Generate sample MP3s (`--all`, `--preset george`, `--confirm`) |
| `nami-speak` | One-off line with `NAMI_VOICE_ID` |
