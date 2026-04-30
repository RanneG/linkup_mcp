# Stitch integration — status & next steps

_Last updated: 2026-04-30 (end of session)._

## Where things live

| Area | Location |
|------|----------|
| **HTTP bridge** (Flask, default `127.0.0.1:8765`) | `stitch_rag_bridge.py` |
| **Google OAuth + Gmail + sessions** | `stitch_auth/` (`store.py`, `google_client.py`, `flask_routes.py`) |
| **Face enroll / verify** | `face_verification/`, routes under `/api/face/*` on the bridge |
| **Shareable React panels** (copy into Stitch app) | `integrations/stitch/` (`FaceVerificationPanel.tsx`, `LinkupRagPanel.tsx`, …) |
| **Full Stitch desktop UI** (Tauri + Vite) | *Local only:* `temp_repo/stitch/` is **gitignored** here — mirror changes from `integrations/stitch/` or re-copy panels when you sync repos. |

## Done in recent work

- **Face verification:** Guided single-frame enrollment, purchase gate wired to “Upcoming payments” approve flow (`purpose="purchase"` on `FaceVerificationPanel`), bridge enroll/verify APIs.
- **Theme system (desktop):** Implemented under `temp_repo/stitch/…` — not in this git tree; `integrations/stitch` is the portable reference if you copy files back.
- **Google sign-in + Gmail discovery:** Backend routes on bridge (`/api/auth/*`, `/api/subscriptions/*`), SQLite + encrypted refresh tokens, PKCE OAuth, popup callback `postMessage`, `GoogleSignInPanel` + `lib/stitchBridge.ts` in **local** Stitch app (`temp_repo`).
- **Health:** `GET /api/health` includes `google_oauth: true|false` when client id/secret are set.
- **Env docs:** `ENV_TEMPLATE.md` — Google OAuth vars documented.

## What you need to run Google sign-in

1. Google Cloud **OAuth Web client** + **Gmail API** enabled.  
2. Redirect URI exactly: `http://127.0.0.1:8765/api/auth/google/callback`  
3. `.env` in repo root: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`  
4. `python stitch_rag_bridge.py` (or venv equivalent) + Stitch dev server with `/api` proxied to `8765`.

## Next steps (priority order)

1. **Persist Stitch subscriptions** — Imports and dashboard edits are in-memory; add `localStorage` or SQLite sync if you want reload survival.  
2. **Tauri / production OAuth** — Today tokens live on the **bridge** machine; client holds session id. For packaged desktop, consider `safeStorage` + deep link or loopback only in the shell, or a tiny local auth service.  
3. **Gmail parsing depth** — Currently metadata + snippet + regex; improve with selective `format=full` for low-confidence rows only (quota-aware).  
4. **Sync `temp_repo/stitch` ↔ git** — Either stop gitignoring a slim `apps/desktop` subtree or maintain `integrations/stitch` as source of truth and document copy steps in README/AGENTS.  
5. **`uv lock` / CI** — Run `uv lock` after `pyproject.toml` Google deps so lockfile matches (if you use uv in CI).  
6. **Tests** — Smoke test for `/api/auth/status` unauthenticated + mock OAuth (optional).

## Uncommitted / parking (from `git status`)

Other modified or untracked files (e.g. `rag.py`, `server.py`, `data/*.pdf`, `README.md`) may still need triage before a single “everything” commit — this file only tracks **Stitch** trajectory.

---

*Personal scratch notes stay in `NOTES.md` (gitignored). This file is for the repo.*
