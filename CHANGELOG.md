# Changelog — Stitch desktop + linkup_mcp bridge

This document summarizes **Stitch desktop** work (now canonical in **[stitch-app](https://github.com/RanneG/stitch-app)**) plus the **HTTP bridge** changes in this repo that power Google auth and subscription APIs. It is meant for **cold-start handoff** (developers or hackathon judges).

## 2026-05-05 — linkup_mcp Stitch cleanup

- **Removed** duplicated UI from **`integrations/stitch/`** (and **`integrations/lib/`**, **`integrations/fixtures/`**); **`integrations/stitch/README.md`** is a **pointer** to **stitch-app** only.
- **Deleted** **`scripts/sync-integrations-stitch-to-desktop.ps1`** and **`scripts/copy-stitch-desktop-to-integrations.ps1`**; removed **`sync:stitch`** npm script.
- **`run-stitch-ui.mjs`** now resolves **`STITCH_APP_ROOT`** or sibling **`../stitch-app`** only (no `temp_repo` fallback). **`StitchPaths.ps1`** matches. **Start-StitchBundledGui** / **Start-StitchDesktop** no longer run a sync step.
- **Docs/code:** **AGENTS.md**, **README.md**, **STITCH_STATUS.md**, **STITCH_MIGRATION.md**, **stitch_gui.py**, **stitch_rag_bridge.py** root HTML hint, **ENV_TEMPLATE.md** — references updated for **stitch-app** paths.
- **Docs layout:** Stitch handoff lives under **[docs/stitch/](docs/stitch/)** (**MIGRATION.md**, **STATUS.md**); root **`STITCH_*.md`** removed; duplicate **`Stitch-Bundled-Gui.bat`** removed (use **`Stitch.bat`**).

## 2026-05-04 — Migration prep

- Added **STITCH_MIGRATION.md** (now **[docs/stitch/MIGRATION.md](docs/stitch/MIGRATION.md)**) as the canonical **Stitch product vs linkup_mcp** split playbook (what moves, what stays, phased checklist).
- Tightened **[integrations/stitch/README.md](integrations/stitch/README.md)** (migration banner, help API routes, clearer face MFA vs verification section numbering).
- **STITCH_STATUS.md** (now **[docs/stitch/STATUS.md](docs/stitch/STATUS.md)**) / **[AGENTS.md](AGENTS.md)** / **[README.md](README.md)** now point at the migration doc; **STITCH_STATUS** “parking” blurb removed as stale.
- Canonical product remote: **[github.com/RanneG/stitch-app](https://github.com/RanneG/stitch-app)** — **initial `main` push** from local `temp_repo/stitch` (post-`sync-integrations-stitch-to-desktop`); repo includes `docs/BACKEND.md` and Actions CI for typecheck. Migration doc updated for completed Phase 1 import.
- **stitch-app** [docs/RUNNING.md](https://github.com/RanneG/stitch-app/blob/main/docs/RUNNING.md) explains UI-only vs **linkup_mcp** bridge. **linkup_mcp:** `scripts/run-stitch-ui.mjs` + **`STITCH_APP_ROOT`** / sibling **`stitch-app`** for `npm run dev:browser` etc.; **`scripts/StitchPaths.ps1`** for bundled/Tauri launchers; **Start-StitchBundledGui** / **Start-StitchDesktop** resolve desktop path the same way.

## Scope

- **Desktop UI:** **[stitch-app](https://github.com/RanneG/stitch-app)** `apps/desktop/` (separate clone; optional local **`temp_repo/stitch`** is **gitignored** legacy only).
- **Portable copies / PR prep (historical):** UI snapshots once lived under `integrations/stitch/`; **2026-05-05** removed them in favor of **[stitch-app](https://github.com/RanneG/stitch-app)**.
- **Backend:** `stitch_rag_bridge.py`, `stitch_auth/` (Flask routes + SQLite).

---

## Files touched in `temp_repo/stitch` (from `git status`)

Paths are relative to `temp_repo/stitch/`.

### Added (untracked / new in this workspace)

| Path | Notes |
|------|--------|
| `apps/desktop/src/components/GmailSubscriptionDiscovery.tsx` | Gmail discovery UI + import (mock by default). |
| `apps/desktop/src/components/GoogleSignInPanel.tsx` | Google OAuth popup + session + profile header. |
| `apps/desktop/src/components/FaceVerificationPanel.tsx` | Local face verify (bridge); wired from settings. |
| `apps/desktop/src/components/LinkupRagPanel.tsx` | Local RAG panel (bridge). |
| `apps/desktop/src/components/AppearanceSection.tsx` | Theme / appearance UI. |
| `apps/desktop/src/context/` | Theme context (directory). |
| `apps/desktop/src/lib/` | **`stitchBridge.ts`** — bridge origin, session keys, `authHeaders`, JSON helpers. |

### Modified

| Path | Notes |
|------|--------|
| `apps/desktop/src/components/AppShell.tsx` | Dashboard: Google session, subscription list CRUD, add form, Gmail discovery embed, demo “Pay now” modal, toasts. |
| `apps/desktop/src/App.tsx` | Shell / routing glue (as in clone). |
| `apps/desktop/vite.config.ts` | `/api` (and often `/health`) proxy to `127.0.0.1:8765`. |
| `apps/desktop/package.json` | Dependencies (e.g. Mediapipe / desktop stack). |
| `apps/desktop/src/index.css` | Theme tokens / layout. |
| `apps/desktop/src/fixtures/subscriptions.ts` | Types / defaults; **live data** comes from API, not fixtures. |
| `apps/desktop/src/vite-env.d.ts` | Vite env typings (`VITE_*`). |
| `apps/desktop/src/renderer/message-block-stubs.tsx` | Renderer stubs (if touched in clone). |
| `apps/desktop/src/components/ItineraryModal.tsx` | Modal component (clone churn). |
| `apps/desktop/src/components/SavedTrips.tsx` | Trips UI (clone churn). |
| `apps/desktop/src/components/TripSwitcher.tsx` | Trips UI (clone churn). |
| `package-lock.json` | Lockfile at monorepo root. |

> **Note:** The clone may carry **unrelated** modified files (trips, lockfile). For an upstream PR, copy only the **integration-critical** paths (see script below) and re-run lint/typecheck in the Stitch repo.

---

## Features (desktop)

### 1. Google Auth

- **Sign in with Google** via bridge: `POST /api/auth/google/url`, popup callback, `postMessage` with `session_id`.
- Session stored in **`localStorage`** (`stitchBridge.ts` keys); **`GET /api/auth/status`** drives avatar + email.
- **`onAuthSessionChange`** refreshes subscription list after sign-in / sign-out / invalid session.

### 2. Subscriptions CRUD (bridge-backed)

- **`GET /api/subscriptions/list`** after auth (and on session change).
- **Add** form → **`POST /api/subscriptions/upsert`**.
- **Delete** → **`POST /api/subscriptions/delete`**.
- **Approve (mark paid)** → upsert + list refresh.
- **Loading** + **error toasts**; **success toast** for Gmail import success.

### 3. Gmail discovery UI

- Component: **`GmailSubscriptionDiscovery.tsx`**.
- **“Find subscriptions from my email”** → discovery checklist + **Import selected** → **`POST /api/subscriptions/import`**.
- **Mock discovery:** `USE_MOCK_DISCOVERY = true` (default) in `GmailSubscriptionDiscovery.tsx` — shows **three hard-coded** candidates; **no Gmail API traffic** in that mode.
- **Real discovery:** set **`USE_MOCK_DISCOVERY = false`** to call **`GET /api/subscriptions/from-gmail`** (requires Gmail scope + working refresh token on the bridge).

### 4. Demo payments (no Stripe / no compliance)

- **“Pay now”** on each subscription row opens a **modal only**: demo copy + “Stripe Connect in production” + **Close**.
- Section badge: **“Demo — no real money moves”**.

---

## Backend (this repo) — summary

| Area | Role |
|------|------|
| `stitch_rag_bridge.py` | Flask app: RAG, face routes, mounts `stitch_auth` routes. |
| `stitch_auth/flask_routes.py` | Google OAuth (PKCE), `/api/auth/google/url`, callback, status, logout; Gmail discover; subscription list/upsert/delete/import. |
| `stitch_auth/store.py` | SQLite: OAuth pending, Google accounts (encrypted refresh), **sessions**, **subscriptions** table. |
| `stitch_auth/google_client.py` | OAuth helpers + Gmail discovery + naive parsing (when live). |

See **`ENV_TEMPLATE.md`** for `GOOGLE_OAUTH_CLIENT_*`, redirect URI, optional `STITCH_AUTH_DB`, etc.

---

## UI PR workflow (current)

1. Clone **[RanneG/stitch-app](https://github.com/RanneG/stitch-app)** and work under `apps/desktop/`.
2. Open PRs **on stitch-app** for UI changes. **linkup_mcp** PRs are for **bridge / MCP / Python** only.

---

## Version / date

- **Document:** 2026-04-30 — reflects Stitch desktop + bridge work through the session that added demo payments, Gmail discovery UI, and subscription persistence.
