# Using Mac Hermes from Windows PC

Hermes is **not installed on PC**. Runtime Nami lives on the **MacBook**.

Cross-device overview: **[NAMI.md](./NAMI.md)** (phone + PC + Mac).

## Option A — Telegram (recommended — phone and PC)

1. Complete **`hermes gateway setup`** on the Mac ([MAC_SETUP.md](./MAC_SETUP.md)).
2. Install [Telegram Desktop](https://desktop.telegram.org/) on Windows (or use web).
3. Message your Nami bot — same memory and skills as on Mac.

Works anywhere; Mac must be on and gateway running (or use `hermes gateway install` on Mac for background service).

## Option B — SSH + CLI

When Mac is on the same network (or via Tailscale):

```powershell
ssh youruser@your-mac-hostname
hermes
```

Use Mac login / SSH key. Full TUI runs on Mac; PC terminal is just the window.

**Tip:** Add to `~/.ssh/config` on PC:

```
Host nami-mac
  HostName 192.168.x.x
  User ranne
```

Then: `ssh nami-mac` → `hermes`

## Option C — Cursor only (build-time Nami)

For coding in **linkup_mcp**, stay in **Cursor chat** — no Hermes required on PC. Runtime Nami (memory, weekly focus, Telegram) is separate.

## What stays on PC

| Tool | Purpose |
|------|---------|
| **Cursor + Nami chat** | Build, debug, MCP in IDE |
| **linkup_mcp** | Dev + MCP server (Mac will also clone for Hermes MCP) |
| **elevenlabs-gen / nami-speak** | Generate Bella MP3s locally if desired |

## PC Hermes removed

Windows install under `%LOCALAPPDATA%\hermes` was removed intentionally. Do not re-run the Windows installer unless you want a second brain on PC.
