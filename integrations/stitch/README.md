# Stitch + cursor_linkup_mcp (local PDF brain)

This folder holds **tracked** UI glue for [Stitch](https://github.com/kylabuildsthings-oss/stitch). The `temp_repo/` clone is gitignored; copy these files into your Stitch repo when opening a PR upstream.

**Sync from a local Stitch clone:** from the **linkup_mcp** repo root run `.\scripts\copy-stitch-desktop-to-integrations.ps1` to refresh the flat files here from `temp_repo/stitch/apps/desktop/src/`. **What changed and why:** see the repo root **[CHANGELOG.md](../../CHANGELOG.md)** (Stitch desktop + bridge summary, `USE_MOCK_DISCOVERY`, demo payments).

## 1. HTTP bridge (this repo)

From `cursor_linkup_mcp` root, with venv active and Ollama running:

```bash
.\.venv\Scripts\python.exe stitch_rag_bridge.py
```

Default: `http://127.0.0.1:8765`

- `POST /api/rag/stitch` — JSON `{"query":"..."}` (same shape as MCP `rag_stitch`)
- **Face verification (local, no cloud APIs for inference):**
  - `POST /api/face/enroll` — JSON `{"email":"...","images":["data:image/jpeg;base64,...", ...]}` (2–3 angles recommended)
  - `POST /api/face/verify` — JSON `{"email":"...","image":"<b64>","liveness_frames":["<b64>",...],"threshold":0.6}` — returns `verified` only if **match** and **liveness_passed**
  - `GET /api/face/status?email=...` — `{ ok, enrolled }`
  - `POST /api/face/delete` — JSON `{"email":"..."}`

Embeddings are stored encrypted under `~/.stitch/face_db/` (see repo `face_verification/storage.py`). **First DeepFace run** may download model weights from the public internet into the local cache — inference stays on-device.

Optional env: see root `ENV_TEMPLATE.md` (`STITCH_FACE_*`, `STITCH_RAG_BRIDGE_PORT`, `STITCH_RAG_DEBUG`).

## 2. Vite proxy (Stitch `apps/desktop`)

Proxy the whole `/api` prefix so RAG and face routes hit the same bridge:

```ts
proxy: {
  "/api": {
    target: "http://127.0.0.1:8765",
    changeOrigin: true,
    timeout: 600_000,
    proxyTimeout: 600_000,
  },
  "/health": {
    target: "http://127.0.0.1:8765",
    changeOrigin: true,
  },
},
```

**Restart** `npm run dev:browser` after any `vite.config.ts` proxy edit — Vite only applies the proxy table on startup. Proxy the full **`/api`** prefix (not only `/api/rag`) so **`/api/face/*`** reaches the bridge; a narrower rule can make Vite serve SPA `index.html` for face routes and trigger confusing JSON parse errors in the UI.

`FaceVerificationPanel` defaults to **`http://127.0.0.1:8765`** when the page is on **`localhost` / `127.0.0.1`** and the port is **`1420`** or **`5173`**, or when `import.meta.env.DEV` is true — so large enroll POSTs bypass the Vite proxy. Set **`VITE_STITCH_RAG_USE_PROXY=1`** in `apps/desktop/.env.local` to force same-origin `/api` through the proxy instead. Optional **`VITE_STITCH_RAG_BRIDGE_ORIGIN`** overrides the bridge origin.

The UI tries **`/api/health`** first, then **`/health`** (older bridges only had the latter). Restart **`stitch_rag_bridge.py`** after pulling so **`GET /api/health`** exists; either way the health check should pass once Vite is restarted with this proxy.

## 3. Settings panel UI

1. Copy `LinkupRagPanel.tsx` to `apps/desktop/src/components/LinkupRagPanel.tsx`.
2. Copy `FaceVerificationPanel.tsx` if you want the full email → enroll/verify → code fallback flow.
3. In `AppShell.tsx`, import panels and render under `SettingsPanel` when `view === "settings"`.

## 3b. Face MFA (subscription flow)

The working clone under `temp_repo/stitch` may include inline `FaceMfaPanel` (presence + confirmation code). That is separate from **§3c** (1:1 embedding verification below).

## 3c. Face verification panel (1:1 + liveness)

`FaceVerificationPanel.tsx` drives the bridge:

- Step 1: email → `GET /api/face/status`
- Step 2: verify with live camera + burst frames for OpenCV liveness (blink / head turn heuristics on the server)
- Step 3: new users enroll 2–3 captures → `POST /api/face/enroll`
- Real-time confidence bar from `POST /api/face/verify`
- Prominent **confirmation code** fallback; session flag `sessionStorage["stitch.face_verified_email"]`

Optional **MediaPipe** bbox overlay (same as face MFA): `npm install @mediapipe/tasks-vision` — see [desktop-dependencies.md](desktop-dependencies.md).

## 4. Run both

Terminal A (this repo): `stitch_rag_bridge.py`  
Terminal B (Stitch): `npm run dev:browser` → Settings → **Local document brain** / **Face verification**.

Python deps: `uv sync` or `pip install -e .` from repo root (includes `deepface`, `tensorflow`, `opencv-python`, `cryptography`).
