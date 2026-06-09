# Nami voice (spoken assistant)

**Nami** is your build partner in Cursor (named after the *One Piece* navigator). **Spoken Nami** is optional TTS for OpenClaw/Mac confirmations — a **female** stock voice on the free tier, not a character impersonation.

## Free tier is enough to start

Stock ElevenLabs voices beat most open-source TTS. Pick one preset, set `NAMI_VOICE_ID`, use `nami-speak` for occasional lines.

| Preset | Voice ID | Vibe |
|--------|----------|------|
| **bella** (default) | `hpp4J3VqNfWAUOO0d1Us` | Bright, warm — Nami's voice |
| sarah | `EXAVITQu4vr4xnSDxMaL` | Mature, reassuring — also used for portfolio BIOS |
| laura | `FGY2WhTYpPnrIDTdsKH5` | Enthusiastic, quirky — more playful |
| river | `SAz9YHcvj6GT2YYXdXww` | Relaxed, neutral — calm and even |

Portfolio boot audio can share **Sarah** via `ELEVENLABS_VOICE_ID`, or use a different voice; Nami uses **`NAMI_VOICE_ID`** for spoken assistant lines.

## Listen to the voices

Generate samples, then open the folder and double-click the MP3s:

```bash
uv sync --extra elevenlabs
uv run elevenlabs-gen nami-audition --all --confirm
```

**Windows:** open `linkup_mcp\data\nami-voice\samples\` in File Explorer and play `nami-sarah-sample.mp3`, `nami-bella-sample.mp3`, etc.

## Setup

In **linkup_mcp** `.env`:

```bash
ELEVENLABS_API_KEY=...
NAMI_VOICE_ID=hpp4J3VqNfWAUOO0d1Us   # Bella — change after audition
```

```bash
uv run elevenlabs-gen nami-voices
uv run elevenlabs-gen nami-speak "All set. What's next?" -o data/nami-voice/last.mp3
```

## Architecture (OpenClaw / Mac)

- **Text first** — Nami in Cursor stays chat; spoken lines are highlights.
- **Server-side only** — OpenClaw skill or script calls `nami-speak`; never expose the API key in a browser.
- **Pre-bake fixed phrases** — “task done”, morning brief opener.
- **Dynamic TTS sparingly** — free ~10k/month is not “every reply spoken.”

## When to upgrade Starter

- Clone a **custom** voice (not stock)
- Speak **most** agent replies aloud
- Heavy regen / music API

## Commands

| Command | Purpose |
|---------|---------|
| `nami-voices` | List presets + default |
| `nami-audition` | Generate sample MP3s (`--all`, `--preset sarah`, `--confirm`) |
| `nami-speak` | One-off line with `NAMI_VOICE_ID` |
