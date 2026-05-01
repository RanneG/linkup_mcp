# Changelog — Stitch desktop + linkup_mcp bridge

This document summarizes **Stitch desktop** work done against a local clone under `temp_repo/stitch/`, plus the **HTTP bridge** changes in this repo that power Google auth and subscription APIs. It is meant for **cold-start handoff** (developers or hackathon judges).

## Scope

- **Desktop UI:** `temp_repo/stitch/apps/desktop/` (local clone; often **gitignored**).
- **Portable copies / PR prep:** `integrations/stitch/` in **this** repo — run `scripts/copy-stitch-desktop-to-integrations.ps1` to sync selected files upstream.
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

## PR workflow (portable patch)

1. Run **`scripts/copy-stitch-desktop-to-integrations.ps1`** from the **linkup_mcp** repo root (PowerShell). It copies: `AppShell.tsx`, `AppearanceSection.tsx`, `GoogleSignInPanel.tsx`, `GmailSubscriptionDiscovery.tsx`, `FaceVerificationPanel.tsx`, `LinkupRagPanel.tsx`, `stitchBridge.ts` into **`integrations/stitch/`** (flat names).
2. Open **`integrations/stitch/README.md`** — copy those files into the **upstream Stitch** repo paths (`apps/desktop/src/components/`, `apps/desktop/src/lib/`) and merge `vite` proxy / `App.tsx` / **`context/`** (theme) wiring as needed; the clone may have extra files not in the script—diff before PR.
3. Open a PR on [kylabuildsthings-oss/stitch](https://github.com/kylabuildsthings-oss/stitch) with the same changes.

---

## Version / date

- **Document:** 2026-04-30 — reflects Stitch desktop + bridge work through the session that added demo payments, Gmail discovery UI, and subscription persistence.
