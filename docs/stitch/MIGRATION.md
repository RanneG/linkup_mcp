# Stitch → dedicated repository (production split)

_Last updated: 2026-05-04._

**Canonical Stitch app repo:** [github.com/RanneG/stitch-app](https://github.com/RanneG/stitch-app) — `git clone https://github.com/RanneG/stitch-app.git`. Initial **`main`** import landed 2026-05-04.

**linkup_mcp cleanup (2026-05-05):** Duplicated React/TS UI under **`integrations/stitch/`** (and **`integrations/lib/`**, **`integrations/fixtures/`**) was **removed**. This repo keeps **`integrations/stitch/README.md`** as a **pointer** only. Sync scripts **`copy-stitch-desktop-to-integrations.ps1`** and **`sync-integrations-stitch-to-desktop.ps1`** were **deleted** — develop UI only in **stitch-app**.

This document remains the **checklist** for packaging, CI, and optional bridge deployment.

## Target architecture

| Repository | Owns | Consumers |
|------------|------|-----------|
| **[stitch-app](https://github.com/RanneG/stitch-app)** | Tauri app, React components, Vite config, Stitch `package.json`, release CI, app branding | End users; developers run `npm run dev` with `/api` → bridge. |
| **linkup_mcp** (this repo) | `server.py` (MCP), `rag.py`, `data/`, `stitch_rag_bridge.py`, `stitch_auth/`, `face_verification/`, `stitch_gui.py`, `docs/stitch_user_guide.md`, contract tests | Cursor (MCP); Stitch desktop (HTTP to `8765` or deployed bridge URL). |

The **HTTP contract** (paths under `/api/*`) stays stable. Vite proxy notes live in **stitch-app** and in **`integrations/stitch/README.md`** (pointer).

## What stays in linkup_mcp

| Path | Role |
|------|------|
| `server.py`, `rag.py`, `rag_runtime.py`, `rag_stitch_contract.py`, `tests/test_rag_stitch_contract.py` | MCP + RAG; shared lazy RAG init; Stitch JSON contract (no Flask import from bridge → server) |
| `stitch_rag_bridge.py` | Flask `/api` surface for Stitch |
| `stitch_auth/` | Google OAuth, sessions, subscription SQLite on the bridge |
| `face_verification/` | Local enroll/verify + storage |
| `stitch_gui.py` | Bundled window (built SPA + bridge) |
| `stitch_demo_cli.py` | CLI demo of Stitch-shaped JSON |
| `docs/stitch_user_guide.md` | `GET /api/stitch-user-guide`, `POST /api/rag/stitch-help` grounding |
| `docs/stitch/` (this folder) | Handoff docs so the repo root stays MCP-focused |
| `scripts/StitchPaths.ps1`, `scripts/run-stitch-ui.mjs`, `Start-Stitch*.ps1`, `Stitch.bat`, `Stitch-Desktop.bat` | Resolve **`../stitch-app`** or **`STITCH_APP_ROOT`** and run/build UI from linkup_mcp root |

## Python dependency profiles (same repo)

- **Default (`uv sync` / `pip install -e .`):** MCP stdio + LlamaIndex RAG — no Flask, DeepFace, TensorFlow, Google client libs, or SpeechRecognition.
- **`stitch-bridge` extra:** everything needed for **`stitch_rag_bridge.py`** (Flask, face stack, OAuth/Gmail, `SpeechRecognition` for `/api/voice/transcribe`).
- **`stitch-gui` extra:** pywebview for **`stitch_gui.py`**. Bundled single-window flow needs **both** `stitch-bridge` and `stitch-gui`.

## RAG coupling: B2 (current) vs B1 (optional later)

- **B2 — shared library modules (this repo):** `stitch_rag_bridge` and `server` both call **`rag.py`** via **`rag_runtime.ensure_rag_ready()`** and share **`rag_stitch_contract`** for `_to_stitch_view` and in-app help. No HTTP hop between MCP and RAG; optional extras keep Cursor-only installs small.
- **B1 — HTTP RAG sidecar (future):** if you split deployment, the bridge could call a dedicated **`POST …/rag/stitch`** service; keep the same JSON body/response as today so **stitch-app** does not change. Env vars stay **`STITCH_ALLOWED_ORIGINS`** and the bridge base URL the UI proxies to.

## Migration phases (status)

### Phase 1 — Stitch product repo

Done: **stitch-app** on GitHub with CI typecheck, **`docs/BACKEND.md`**, **`docs/RUNNING.md`**.

### Phase 2 — Dual-run validation

Run **linkup_mcp** `stitch_rag_bridge.py` and **stitch-app** `npm run dev:browser`; confirm auth, subscriptions, face, RAG, Help, voice. Tune **`STITCH_ALLOWED_ORIGINS`** if dev ports differ.

### Phase 3 — Cut linkup_mcp coupling

Done: **integrations/** UI snapshot removed; **sync/copy scripts** removed; **`run-stitch-ui.mjs`** uses **stitch-app** only (`STITCH_APP_ROOT` or **`../stitch-app`**).

Optional later: move root **`Stitch*.bat`** into **`scripts/`** only if you add tiny forwarding stubs at the repo root (double-click ergonomics).

### Phase 4 — Production bridge (optional)

Package **`stitch_rag_bridge`** as a service or container; optional **`STITCH_USER_GUIDE_PATH`** for help markdown.

## Quick checklist

- [x] [stitch-app](https://github.com/RanneG/stitch-app) on `main` with CI.
- [x] UI sources removed from linkup_mcp `integrations/` (pointer README kept).
- [x] `run-stitch-ui.mjs` + `StitchPaths.ps1` + launchers use **stitch-app** path resolution.
- [ ] Vite proxy / bridge smoke test when changing ports or CORS.
- [ ] Optional: hosted bridge URL + client env for non-local Stitch builds.

## Related docs

- **[stitch-app docs/RUNNING.md](https://github.com/RanneG/stitch-app/blob/main/docs/RUNNING.md)** — UI-only vs bridge.
- **[integrations/stitch/README.md](../../integrations/stitch/README.md)** — Pointer from linkup_mcp to stitch-app.
- **[STATUS.md](STATUS.md)** — Roadmap.
- **[CHANGELOG.md](../../CHANGELOG.md)** — History.

## linkup_mcp dev helpers

- **`STITCH_APP_ROOT`**: optional absolute path to a **stitch-app** clone.
- If unset, **`../stitch-app`** (sibling of linkup_mcp) is used by **`StitchPaths.ps1`** and **`run-stitch-ui.mjs`**.
