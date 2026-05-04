# Stitch integration — status & next steps

_Last updated: 2026-05-05._

**Production split:** Stitch UI lives in **[RanneG/stitch-app](https://github.com/RanneG/stitch-app)** (`main` has first import + CI). **linkup_mcp** remains **bridge + MCP**. **Inventory and remaining cutover steps:** **[MIGRATION.md](MIGRATION.md)**.

**Quickest launch (no terminal):** double-click **[Stitch.bat](../../Stitch.bat)** at the repo root (bundled GUI: venv, npm build in **stitch-app**, pywebview + Flask). Requires a **[stitch-app](https://github.com/RanneG/stitch-app)** clone (`../stitch-app` or `STITCH_APP_ROOT`) + Python + Node.

## Where things live

| Area | Location |
|------|----------|
| **HTTP bridge** (Flask, default `127.0.0.1:8765`) | `stitch_rag_bridge.py` |
| **Google OAuth + Gmail + sessions** | `stitch_auth/` (`store.py`, `google_client.py`, `flask_routes.py`) |
| **Face enroll / verify** | `face_verification/`, routes under `/api/face/*` on the bridge |
| **Stitch desktop UI** (Tauri + Vite + React) | **[RanneG/stitch-app](https://github.com/RanneG/stitch-app)** — clone beside linkup_mcp or set **`STITCH_APP_ROOT`**. |
| **Bridge-side pointer** | **`integrations/stitch/README.md`** only (no duplicated UI sources in this repo). |

## Done in recent work

- **Face verification:** Guided single-frame enrollment, purchase gate wired to “Upcoming payments” approve flow (`purpose="purchase"` on `FaceVerificationPanel`), bridge enroll/verify APIs.
- **Theme system (desktop):** Lives in **stitch-app** (`apps/desktop`).
- **Google sign-in + Gmail discovery:** Backend routes on bridge (`/api/auth/*`, `/api/subscriptions/*`), SQLite + encrypted refresh tokens, PKCE OAuth, popup callback `postMessage`; UI panels in **stitch-app**.
- **Subscription persistence API:** Bridge stores imported/edited subscriptions in SQLite per active authenticated email (`/api/subscriptions/list|upsert|delete` + persisted `/api/subscriptions/import`).
- **Dashboard wired to persistence:** **stitch-app** `AppShell.tsx` loads with **`GET /api/subscriptions/list`** when a session id exists; mutations use **`POST /api/subscriptions/upsert`** / **`POST /api/subscriptions/delete`**.
- **Voice commands (Stitch):** With **Voice activation** on, Web Speech drives approve + navigation + Gmail discovery + document brain / RAG (see voice intents table and **stitch-app** `voiceCommands.ts`).
- **Health:** `GET /api/health` includes `google_oauth: true|false` when client id/secret are set.
- **Env docs:** `ENV_TEMPLATE.md` — Google OAuth vars documented.

## What you need to run Google sign-in

1. Google Cloud **OAuth Web client** + **Gmail API** enabled.  
2. Redirect URI exactly: `http://127.0.0.1:8765/api/auth/google/callback`  
3. `.env` in repo root: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`  
4. `python stitch_rag_bridge.py` (or venv equivalent) + Stitch dev server with `/api` proxied to `8765`.

## Next steps (priority order)

1. **Tauri / production OAuth** — Today tokens live on the **bridge** machine; client holds session id. For packaged desktop, consider `safeStorage` + deep link or loopback only in the shell, or a tiny local auth service.  
2. **Gmail parsing depth** — Currently metadata + snippet + regex; improve with selective `format=full` for low-confidence rows only (quota-aware).  
3. **Stitch repo hygiene** — UI is canonical in **stitch-app**; linkup_mcp carries **bridge + pointer README** only. Follow **[MIGRATION.md](MIGRATION.md)** for any remaining packaging tasks.  
4. **`uv lock` / CI** — Run `uv lock` after `pyproject.toml` Google deps so lockfile matches (if you use uv in CI).  
5. **Tests** — Smoke test for `/api/auth/status` unauthenticated + mock OAuth (optional).  
6. **Voice (see below)** — Extend intents in Stitch first; Cursor/MCP voice remains a separate track.

---

## Voice roadmap

### Primary surfaces (decision)

| Priority | Surface | Role |
|----------|---------|------|
| **1 — near-term default** | **Stitch + Chromium Web Speech API** | Matches **stitch-app** `AppShell.tsx` (`SpeechRecognition` / `webkitSpeechRecognition`). Best path for rapid iteration in **Vite browser dev** (`/api` proxy to the bridge). |
| **2 — verify, do not assume** | **Stitch Tauri packaged WebView** | May or may not expose the same speech APIs depending on **WebView2** (Windows) / **WKWebView** (macOS). Treat as **compatibility QA** before relying on voice in production builds; if missing, fall back to push-to-talk UI copy or a bridge-based STT route later. |
| **3 — separate product track** | **Cursor + `cursor_linkup_mcp` MCP** | MCP tools are **text-in** today (`server.py` stdio). Voice for “Cursor in general” means a **different client layer**: e.g. OS dictation → chat, **Cursor hooks**, or automation against the Cursor SDK — **not** the Stitch React bundle. Keep scope explicit so Stitch voice work does not block MCP releases. |

**Technology note for Stitch phase 1:** Stay on **browser STT** for new intents until Tauri behavior is validated or you intentionally add **`POST /api/stt`** (or similar) on the bridge for audio uploaded from the shell.

### Voice intents (3–5) mapped to actions

| Intent (example utterance) | Status | Where it runs | Action / API |
|----------------------------|--------|---------------|--------------|
| **Approve pending payment** (“approve”) | **Shipped** | `AppShell.tsx` — Web Speech while **Voice activation** is on; prioritised when a payment is pending | `startApprovalRef` → `startApproval(..., "voice")` (may open face MFA). |
| **Open / focus local document brain (RAG)** | **Shipped** | `AppShell.tsx` + `GamifiedSettingsView` | Phrases like “open document brain”, “open RAG” → Settings **Billing** tab, scroll `#stitch-linkup-rag`. |
| **Run Gmail subscription discovery** | **Shipped** | `GmailSubscriptionDiscovery` via `autoDiscoverSignal` | “Scan Gmail”, “run discovery”, “find subscriptions” → Upcoming view + increment signal (same as **Run discovery** button). |
| **Submit RAG query from speech** | **Shipped** | `LinkupRagPanel` `voiceRunRequest` | “Ask my documents about …”, “search my pdfs …” → Billing tab + **`POST /api/rag/stitch`**. |
| **Global navigation** | **Shipped** | `AppShell` `view` state | “Open settings”, “payment history”, “dashboard”, “account settings”, etc. |

**Pure intent matcher (portable):** [**stitch-app** `voiceCommands.ts`](https://github.com/RanneG/stitch-app/blob/main/apps/desktop/src/components/voiceCommands.ts) — no React imports; suitable to lift into a future **`@your-scope/voice-intents`** (or similar) package alongside a thin Web Speech hook.

**Out of scope for stitch-app in Cursor MCP:** piping voice into **MCP tool calls inside Cursor** — document and implement under hooks/SDK when you pick that track.

---

*Personal scratch notes stay in `NOTES.md` (gitignored). This file is for the repo.*
