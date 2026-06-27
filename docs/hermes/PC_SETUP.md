# Hermes + Nami on Windows PC (current runtime)

**Decision (2026-06):** Everything runs on your **Windows PC** while you're at the desk — Cursor, Hermes gateway, mobile-build bridge, Stitch. Phone Nami works **when the PC is on**. Migrate to a VPS later for 24/7 — [VPS_MIGRATION.md](./VPS_MIGRATION.md).

## Architecture (today)

```
📱 Phone (Telegram)
       ↓
💻 PC — Hermes gateway + Ollama/cloud LLM + linkup MCP
       ↓ localhost
💻 PC — nami_build_bridge :8770, Cursor, stitch :8765
```

| Surface | When it works |
|---------|----------------|
| Cursor Nami | PC on |
| Telegram Nami | PC on + gateway running |
| Mobile build from phone | PC on + gateway + bridge |
| Mac / VPS | Not required |

**Tradeoff you accept:** No Telegram Nami while PC is off, sleeping, or rebooting. That's fine until VPS migration.

---

## 1. Prerequisites (PC)

- **Cursor** + this repo cloned (`cursor_linkup_mcp`)
- **Python 3.12+** + project venv (`uv sync` or `pip install -e .`)
- **`.env`** with `LINKUP_API_KEY` (optional for RAG; needed for web search)
- **Ollama for Windows** (optional) — [ollama.com/download](https://ollama.com/download) — or cloud model via `hermes setup`

---

## 2. Install Hermes (Windows native)

Official installer (early beta, but gateway + Telegram work natively):

```powershell
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
```

Open a **new** terminal, then:

```powershell
hermes --version
hermes doctor
hermes setup
```

Data lives under `%LOCALAPPDATA%\hermes\`. See [Hermes Windows guide](https://hermes-agent.nousresearch.com/docs/user-guide/windows-native).

**WSL2 alternative:** If native Windows is flaky, install Hermes inside WSL and use `bash scripts/install-nami-stack-vps.sh` there — still one PC, no cloud VPS.

---

## 3. One-shot Nami stack (PC)

From repo root in PowerShell:

```powershell
cd C:\Users\ranne\Cursor\cursor_linkup_mcp
.\scripts\install-nami-stack-pc.ps1
```

This copies SOUL/skills/memories, syncs RAG corpus, registers linkup MCP, runs verify.

---

## 4. Telegram gateway

First time:

```powershell
hermes gateway setup
```

Start after reboot:

```powershell
.\scripts\Start-NamiGateway.ps1
```

Or: `hermes gateway start`

**Optional:** Task Scheduler to run `Start-NamiGateway.ps1` at logon (still only while PC is on).

Test: message Nami bot → `/reload-mcp` → ask a question.

---

## 5. Mobile build (same machine)

No VPS hop — Hermes and bridge both on PC.

**PC `.env`** (already have most of this):

```bash
NAMI_BUILD_TOKEN=long-random-secret
NAMI_BUILD_HOST=127.0.0.1
CURSOR_API_KEY=crsr_...
```

**`%LOCALAPPDATA%\hermes\.env`** (or `HERMES_HOME`):

```bash
NAMI_BUILD_PC_URL=http://127.0.0.1:8770
NAMI_BUILD_TOKEN=same-as-pc-dot-env
```

See [MOBILE_BUILD.md](./MOBILE_BUILD.md) and [MOBILE_BUILD_PC.env.example](./MOBILE_BUILD_PC.env.example).

Start bridge when you want phone builds:

```powershell
.\scripts\Start-NamiBuildBridge.ps1
```

---

## 6. Daily startup (PC on)

```powershell
# Optional — Telegram Nami
.\scripts\Start-NamiGateway.ps1

# Optional — phone → build jobs
.\scripts\Start-NamiBuildBridge.ps1

# Normal dev
# Open Cursor, Stitch.bat, etc.
```

---

## 7. After `git pull`

```powershell
cd C:\Users\ranne\Cursor\cursor_linkup_mcp
git pull
.\scripts\install-nami-stack-pc.ps1
hermes gateway restart
```

---

## 8. Security (local PC)

| Do | Why |
|----|-----|
| Telegram **allowlist** in Hermes | Only you can talk to the bot |
| Keep `.env` out of git | API keys |
| `NAMI_BUILD_HOST=127.0.0.1` unless you need Tailscale | Don't expose build bridge to LAN/internet casually |
| Separate **Koshi** profile / bot token | SupplyMe isolation |

Running Hermes on your daily gaming PC is **convenient but wider blast radius** than a dedicated VPS — acceptable for now; revisit at migration.

---

## Related

- [NAMI.md](./NAMI.md) — surface map
- [VPS_MIGRATION.md](./VPS_MIGRATION.md) — when you want 24/7
- [VPS_SETUP.md](./VPS_SETUP.md) — future host install (don't provision yet)
- [PC_CLIENT.md](./PC_CLIENT.md) — how surfaces fit together
