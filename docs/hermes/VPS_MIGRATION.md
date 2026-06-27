# VPS migration plan (PC → cloud runtime)

**Current:** Hermes + Telegram + MCP on **Windows PC** ([PC_SETUP.md](./PC_SETUP.md)).  
**Future:** Move **runtime only** to a small Linux VPS for 24/7 phone Nami. **PC stays** the build machine (Cursor, bridge, Stitch).

---

## When to migrate

Migrate when **any** of these hurt:

- You want Telegram Nami while PC is off or gaming
- You're tired of restarting gateway after reboot
- You want Hermes secrets off your daily-driver PC
- Mac is off and PC sleep breaks phone workflows

**Don't migrate yet if:** PC is on most of the day and desk-only Nami is enough.

---

## Target architecture (after migration)

```
📱 Phone → ☁️ VPS (Hermes 24/7) → 💻 PC (build bridge when on)
```

PC unchanged: Cursor, `nami_build_bridge`, Stitch. VPS takes gateway + memory + MCP.

Full install: [VPS_SETUP.md](./VPS_SETUP.md).

---

## Migration checklist

### Before (on PC today)

- [ ] PC stack healthy — `hermes gateway status`, `hermes mcp test linkup`
- [ ] Note what's in `%LOCALAPPDATA%\hermes\` (config, memories, skills)
- [ ] Export/copy:
  - `memories/MEMORY.md`, `memories/USER.md`
  - `config.yaml` (redact secrets into VPS `.env` instead of committing)
  - Telegram bot token (same bot — **stop PC gateway before starting VPS**)
- [ ] Document PC Tailscale IP if using mobile build away from home

### Provision VPS

- [ ] Ubuntu 24.04, 4 GB (cloud LLM) or 8 GB (Ollama) — see VPS recommendations in chat / VPS_SETUP
- [ ] SSH keys, UFW, Tailscale
- [ ] Clone repo, `.env` with `LINKUP_API_KEY`

### Install on VPS

```bash
cd ~/Cursor/linkup_mcp
bash scripts/install-nami-stack-vps.sh
hermes gateway setup   # same bot OR new bot — pick one gateway only
bash scripts/install-nami-gateway-systemd.sh
loginctl enable-linger $USER
```

- [ ] Copy memory files into `~/.hermes/memories/`
- [ ] Set `~/.hermes/.env`: `NAMI_BUILD_PC_URL` → PC Tailscale IP when PC is on
- [ ] `hermes gateway restart`

### Cutover

- [ ] **Stop PC gateway:** `hermes gateway stop` (avoid duplicate Telegram handlers)
- [ ] Test phone → Nami (PC can be off)
- [ ] PC on → test mobile build enqueue from Telegram
- [ ] Update mental model: PC = build only; VPS = runtime

### Decommission PC runtime (optional)

- [ ] Leave Hermes installed for local TUI debugging, or uninstall if you want zero runtime on PC
- [ ] Keep `install-nami-stack-pc.ps1` for emergencies

---

## What moves vs stays

| Moves to VPS | Stays on PC |
|--------------|-------------|
| Telegram gateway | Cursor + MCP (build-time) |
| `~/.hermes/memories/` | git repos, branches |
| linkup MCP (runtime) | `nami_build_bridge` |
| Scheduled Hermes loops | Stitch OAuth / face |
| `LINKUP_API_KEY` (runtime copy) | `CURSOR_API_KEY` |

---

## Cost trigger

| Mode | Approx cost |
|------|-------------|
| **PC-only (now)** | $0 extra — marginal electricity while PC runs |
| **VPS (later)** | ~€8–14/mo — buys 24/7, not more CPU than your PC |

---

## Rollback

If VPS is worse:

1. Stop VPS gateway / shut down VPS
2. PC: `.\scripts\Start-NamiGateway.ps1`
3. Restore `%LOCALAPPDATA%\hermes\` from backup if needed

---

## Doc updates after migration

Edit [AGENTS.md](../../AGENTS.md) runtime host line, [NAMI.md](./NAMI.md) status table, and [STATUS.md](./STATUS.md) scorecard — or ask Nami in Cursor to do it in one PR.
