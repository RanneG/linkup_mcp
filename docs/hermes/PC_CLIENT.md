# Using runtime Nami from Windows PC

Runtime Nami lives on the **Linux VPS** (24/7 Telegram). **Windows PC** = Cursor + git + mobile-build bridge. Hermes is **not** on PC.

Cross-device overview: **[NAMI.md](./NAMI.md)**. VPS setup: **[VPS_SETUP.md](./VPS_SETUP.md)**.

## Option A — Telegram (recommended — phone and PC)

1. Complete **`hermes gateway setup`** on the VPS ([VPS_SETUP.md](./VPS_SETUP.md)).
2. Install [Telegram Desktop](https://desktop.telegram.org/) on Windows (or use web).
3. Message your Nami bot — same memory and skills as on phone.

Works anywhere; VPS stays on — no Mac required.

## Option B — SSH + CLI

When you want the Hermes TUI:

```powershell
ssh nami-vps    # Tailscale or public IP — see VPS_SETUP.md
hermes
```

**Tip:** Add to `~/.ssh/config` on PC:

```
Host nami-vps
  HostName 100.x.x.x
  User nami
```

## Option C — Cursor only (build-time Nami)

For coding in **linkup_mcp**, stay in **Cursor chat** — no Hermes required on PC. Runtime Nami (memory, Telegram) is on the VPS.

## What stays on PC

| Tool | Purpose |
|------|---------|
| **Cursor + Nami chat** | Build, debug, MCP in IDE |
| **linkup_mcp** | Dev clone + MCP in Cursor |
| **nami_build_bridge** | Mobile builds from Telegram ([MOBILE_BUILD.md](./MOBILE_BUILD.md)) |
| **Stitch bridge** | OAuth, Gmail, face on `:8765` |
| **elevenlabs-gen / nami-speak** | Generate Bella MP3s locally if desired |

## PC Hermes removed

Windows install under `%LOCALAPPDATA%\hermes` was removed intentionally. Runtime = VPS. Do not re-install Hermes on PC unless you explicitly want a second brain.
