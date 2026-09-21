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

## Bridge API and queue contract

Source of truth: `nami_build/http.py`, `nami_build/queue.py`, `nami_build/worker.py`, and
`nami_build/agent_runner.py`.

### HTTP routes

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /health` | No | Alias for local readiness checks. |
| `GET /api/build/health` | No | Returns service readiness, token/key presence, worker state, and pending count. |
| `POST /api/build/enqueue` | Yes | Create a queued build job. |
| `GET /api/build/jobs/<job_id>` | Yes | Fetch one job and its result/error fields. |
| `GET /api/build/jobs?limit=10` | Yes | List recent jobs; `limit` is capped at `50`. |

Auth accepts either:

```http
Authorization: Bearer <NAMI_BUILD_TOKEN>
```

or:

```http
X-Nami-Build-Token: <NAMI_BUILD_TOKEN>
```

Health is intentionally unauthenticated so local launch scripts can confirm the bridge is up. It does
not return token values or secrets.

### Enqueue payload

```json
{
  "task": "Add a /health detail row to dev_dashboard for Nami build bridge status.",
  "source": "telegram",
  "repo": "linkup_mcp",
  "turn_cap": 8
}
```

Constraints:

- `task` is required, trimmed, and rejected above `8000` characters.
- `source` defaults to `telegram`.
- `repo` defaults to `linkup_mcp`; the worker also accepts a local directory path.
- `turn_cap` defaults to `8` and is clamped from `1` to `20`.
- Successful enqueue returns `201` with `{ "ok": true, "job": ... }`.

### Job lifecycle

Jobs are JSON files under `data/build-queue/`:

```
pending/<job_id>.json
running/<job_id>.json
completed/<job_id>.json
failed/<job_id>.json
```

The bridge starts a background worker unless `NAMI_BUILD_DISABLE_WORKER=1` (or `true` / `yes`).
The worker:

1. Polls `pending/` every `NAMI_BUILD_POLL_SECONDS` (default `15`).
2. Runs one job at a time through `python -m nami_build.run_job`.
3. Moves the job to `running/`.
4. Creates `nami/build-<job_id>` only when the repo tree is clean.
5. Runs Cursor Agent via CLI/SDK.
6. Runs pytest.
7. Moves the job to `completed/` or `failed/` with `result_summary`, `branch`, `error`, and
   `test_output` fields for review.

If the repo has uncommitted changes, the worker stays on the current branch and reports that in the
job summary. The agent prompt explicitly tells the build agent not to commit; Ranne reviews the diff
in Cursor.

### Worker and test knobs

| Env var | Default | Notes |
|---------|---------|-------|
| `NAMI_BUILD_RUNNER` | `auto` | `auto` uses Cursor Agent CLI on Windows and SDK elsewhere; also accepts `cli` or `sdk`. |
| `NAMI_BUILD_AGENT_CMD` | `agent` | Override path to `agent`, `agent.cmd`, or `agent.ps1`. |
| `NAMI_BUILD_AGENT_TIMEOUT` | `3600` | Seconds before the Cursor agent step times out. |
| `NAMI_BUILD_JOB_TIMEOUT` | `3600` | Seconds before the worker subprocess times out. |
| `NAMI_BUILD_PYTEST` | `tests/test_nami_build.py` | Space-separated pytest targets for worker verification. |
| `NAMI_BUILD_DISABLE_WORKER` | unset | Set to `1`, `true`, or `yes` to run API-only mode for tests/debugging. |

### 5. Tailscale (only after VPS migration)

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

Start the bridge first:

```powershell
.\scripts\Start-NamiBuildBridge.ps1
```

Then run the smoke-test helper from another terminal:

```powershell
.\scripts\Test-NamiBuildEnqueue.ps1 `
  -Task "Add a one-line module docstring note that jobs live under data/build-queue/." `
  -TurnCap 5
```

The helper reads `NAMI_BUILD_TOKEN` and `NAMI_BUILD_PORT` from `.env`, checks health, enqueues a job,
polls until `completed` or `failed`, and prints the final job JSON.

Raw API equivalent:

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

When `status` is `completed`, open Cursor and review the diff on the reported branch.
When `status` is `failed`, read `error`, `result_summary`, and the tail of `test_output`.

---

## Costs

| Item | Notes |
|------|-------|
| Cursor subscription | You already have — build agent uses **CURSOR_API_KEY** through Cursor Agent CLI/SDK |
| Claude Pro | **Not required** for this path |
| Mac Ollama | VPS Hermes triage only — no extra cost |
| PC electricity | Bridge runs while PC is on |

---

## Limits (honest)

- PC must be **on** with bridge running (no cloud worker in v1).
- Not a phone IDE — async **describe → build → review**.
- Stitch OAuth / face flows still **PC-local** during review.
- Dirty git tree: worker stays on current branch (see `nami_build/agent_runner.py`).
- Worker pytest defaults to `tests/test_nami_build.py`; widen with `NAMI_BUILD_PYTEST` when the task
  touches more code.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `401 Unauthorized` | Token mismatch Hermes `.env` vs PC `.env` |
| `CURSOR_API_KEY not set` | Add to PC `.env`, restart bridge |
| `Cursor agent CLI not found` | Install once: `irm 'https://cursor.com/install?win32=true' \| iex`, or set `NAMI_BUILD_AGENT_CMD` |
| `cursor-sdk not installed` | Set `NAMI_BUILD_RUNNER=cli` on Windows, or `pip install cursor-sdk` when using SDK mode |
| Job stuck `pending` | Bridge worker not running — restart `Start-NamiBuildBridge.ps1` |
| Job stays `failed` after code edits | Check `test_output`; update `NAMI_BUILD_PYTEST` if the task needs broader tests |
| Enqueue fails | PC gateway running? Bridge on :8770? |

---

## Related

- [SURFACE_MAP.md](./SURFACE_MAP.md)
- [LOOP_ENGINEERING.md](./LOOP_ENGINEERING.md)
- [CLAUDE_CODE.md](../dev/CLAUDE_CODE.md) — deferred sidecar; mobile build uses Cursor SDK instead
