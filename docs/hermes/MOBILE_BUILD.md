# Mobile build — Telegram → PC agent

**Goal:** Describe an app change on your phone; **PC runs Cursor agent + pytest**; you **review in Cursor** at your desk.

Phone Nami stays Telegram on **PC Hermes** (same machine). Building on **Windows PC** (Cursor, git, Stitch bridge).

## Architecture

```
📱 Telegram (Ranne)
       ↓
💻 PC Hermes — triage, enqueue (curl → localhost)
       ↓
💻 PC nami_build_bridge :8770
       ↓
   Build worker → Cursor Agent CLI → pytest
       ↓
📱 Telegram summary + branch name
       ↓
💻 Cursor — diff review + merge (you)
```

| Surface | Role |
|---------|------|
| Phone / Telegram | Describe task, get status |
| VPS Hermes | Enqueue via skill (future — [VPS_MIGRATION.md](./VPS_MIGRATION.md)) |
| PC Hermes | Enqueue via skill — **localhost** today |
| PC bridge + worker | Queue, run agent, tests |
| Cursor (PC) | Review diffs |

Runtime VPS setup (future): [VPS_SETUP.md](./VPS_SETUP.md). **Now:** [PC_SETUP.md](./PC_SETUP.md).

---

## Phase 1 — Reliable mobile Nami (parallel)

See [NAMI.md](./NAMI.md) + [PC_SETUP.md](./PC_SETUP.md):

- PC gateway when machine is on
- RAG corpus sync on PC
- Optional: Task Scheduler for gateway at logon
- **Later:** VPS for 24/7 — [VPS_MIGRATION.md](./VPS_MIGRATION.md)

## Phase 2 — PC setup (one-time)

### 1. Install extra

```powershell
cd C:\Users\ranne\Cursor\cursor_linkup_mcp
pip install -e ".[nami-build]"
pip install cursor-sdk
```

### 2. `.env` on PC

```bash
# Shared secret — PC Hermes %LOCALAPPDATA%\hermes\.env uses same value
NAMI_BUILD_TOKEN=generate-a-long-random-string

# Cursor Cloud Agents API key — https://cursor.com/dashboard/integrations
CURSOR_API_KEY=crsr_...

# Windows: use Cursor Agent CLI (Python cursor_sdk bridge fails on native Windows)
# Install once: irm 'https://cursor.com/install?win32=true' | iex
# Default runner on Windows: NAMI_BUILD_RUNNER=auto → agent CLI

# Optional
NAMI_BUILD_PORT=8770
NAMI_BUILD_HOST=127.0.0.1          # use 0.0.0.0 + Tailscale for remote enqueue
NAMI_BUILD_RUNNER=auto             # auto | cli | sdk
NAMI_BUILD_MODEL=composer-2.5
NAMI_BUILD_POLL_SECONDS=15
```

Generate token: `[guid]::NewGuid().ToString('N')` in PowerShell.

### 3. Install Cursor Agent CLI (Windows PC)

```powershell
irm 'https://cursor.com/install?win32=true' | iex
agent --version
```

Uses `CURSOR_API_KEY` from `.env` — same key as above. On Windows this replaces the broken Python `cursor-sdk` local bridge.

### 4. Start bridge (PC must be on)

```powershell
.\scripts\Start-NamiBuildBridge.ps1
```

Or double-click **`Nami-Build-Bridge.bat`** (repo root).

Uses **`.venv`** Python when present (recommended on Windows — avoids `cursor-sdk` long-path install failures). Run once:

```powershell
.\scripts\Setup-NamiBuild.ps1
irm 'https://cursor.com/install?win32=true' | iex   # Cursor Agent CLI (Windows)
```

Health check: `http://127.0.0.1:8770/api/build/health`

### 4. Tailscale (only after VPS migration)

When Hermes runs on VPS and PC is elsewhere: Tailscale + `NAMI_BUILD_HOST=0.0.0.0`.  
See [VPS_MIGRATION.md](./VPS_MIGRATION.md) and [MOBILE_BUILD_VPS.env.example](./MOBILE_BUILD_VPS.env.example).

**PC-local mode (now):** `127.0.0.1` only — next section.

---

## PC Hermes setup (current)

Add to **`%LOCALAPPDATA%\hermes\.env`**:

```bash
NAMI_BUILD_PC_URL=http://127.0.0.1:8770
NAMI_BUILD_TOKEN=same-as-pc
```

Sync skill:

```powershell
cd C:\Users\ranne\Cursor\cursor_linkup_mcp
.\scripts\install-nami-hermes.ps1
hermes gateway restart
```

In Telegram **Build** topic: *"Add a /health detail row to dev_dashboard for nami build bridge status."*

---

## Manual test (before Telegram)

**PC:**

```powershell
$token = "your-token"
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8770/api/build/enqueue" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body '{"task":"Add a one-line comment to nami_build/queue.py module docstring","turn_cap":5}'
```

**Poll:**

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8770/api/build/jobs/JOB_ID" `
  -Headers @{ Authorization = "Bearer $token" }
```

When `status` is `completed`, open Cursor and review diff.

---

## Costs

| Item | Notes |
|------|-------|
| Cursor subscription | You already have — build agent uses **CURSOR_API_KEY** (Cursor SDK) |
| Claude Pro | **Not required** for this path |
| Mac Ollama | VPS Hermes triage only — no extra cost |
| PC electricity | Bridge runs while PC is on |

---

## Limits (honest)

- PC must be **on** with bridge running (no cloud worker in v1).
- Not a phone IDE — async **describe → build → review**.
- Stitch OAuth / face flows still **PC-local** during review.
- Dirty git tree: worker stays on current branch (see agent_runner).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `401 Unauthorized` | Token mismatch Hermes `.env` vs PC `.env` |
| `CURSOR_API_KEY not set` | Add to PC `.env`, restart bridge |
| `cursor-sdk not installed` | `pip install cursor-sdk` on PC |
| Job stuck `pending` | Bridge worker not running — restart `Start-NamiBuildBridge.ps1` |
| Enqueue fails | PC gateway running? Bridge on :8770? |

---

## Related

- [SURFACE_MAP.md](./SURFACE_MAP.md)
- [LOOP_ENGINEERING.md](./LOOP_ENGINEERING.md)
- [CLAUDE_CODE.md](../dev/CLAUDE_CODE.md) — deferred sidecar; mobile build uses Cursor SDK instead
