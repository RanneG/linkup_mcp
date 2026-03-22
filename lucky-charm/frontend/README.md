# Lucky Charm — frontend

## Run locally (no Vercel)

From this folder:

```bash
npm install
npm run dev
```

Then open **http://localhost:3000** (see `vite.config.js` — dev server port is `3000`, **strict** — it will not move to 3001).

### Sign-in (`/login`)

The app **requires a session** (except the login page). Use:

| Role        | Email             | Password   | Team   |
| ----------- | ----------------- | ---------- | ------ |
| Team Lead   | `lead@demo.com`   | `lead123`  | Team 1 |
| Team Member | `member@demo.com` | `member123`| Team 1 |
| Host        | `host@demo.com`   | `host123`  | (all)  |

- **Mock accounts** are seeded into **`lucky-charm-mock-credentials`** in `localStorage` (editable for demos).
- After login, the session is stored in **`lucky-charm-auth`** (or **sessionStorage** if “Remember me” is off): `email`, `dashboardRole`, `teamId`, `displayName`, etc.
- **Demo mode** on the login page bypasses credentials (presentation shortcut).
- **Redirects:** Team Lead → **`/team`**, Team Member → **`/team`** (join code first; then Upload/Dashboard), Host → **`/host-console`**.
- **Log out** clears the session and returns to **`/login`**.

Participant routes (after sign-in): **`/team`** · **`/upload`** · **`/dashboard`**. **`/`** sends hosts to **`/host-console`**; others go to **`/team`** if they have no team, otherwise **`/upload`**. Nav order in the header is Team → Upload → Dashboard.

**Presentations (isolated browsers / incognito):** On the Team page, use **Demo mode** (accept any join code after local lookup fails) or **Join as demo member** to get a synthetic Team Member session in that browser only. Real cross-window joins still require the same `localStorage` (same profile).

### Hackathon host console (optional)

Organizers sign in as **Host** and open **`http://localhost:3000/host-console`** (legacy **`/host`** redirects there) for an **aggregated view** (charts from uploaded transcripts + teams and TEE snapshot in **this browser’s** storage). Non-host roles are redirected away from the host console.

**Port 3000 already in use?** Your app and **localStorage** (teams, TEE cache, demo auth) are tied to **`http://localhost:3000`**. Free the port, then start again — you do **not** lose saved files in the repo:

```bash
cd frontend
npm run free-3000    # macOS/Linux: stops the process listening on 3000
npm run dev
```

If `localhost:3001` is blank, that URL is usually **not** this Vite app (or an old stray process). Use **only** the URL printed by `npm run dev` (should be **3000** after freeing the port).

## SSO (U2SSO proof-of-concept)

### If you’re confused — use the mock (no blockchain)

The **real** `sso-poc` Go server needs **Ganache + a deployed contract**; without that it never starts listening. For Lucky Charm only, use this **two-terminal** flow:

**Terminal 1 — mock SSO (same JSON shape as the real API):**

```bash
cd /path/to/LUCKY\ CHARM/frontend
npm run sso:mock
```

(Or: `cd sso-poc-stub && pip install -r requirements.txt && python sso_stub.py`)

**Terminal 2 — frontend:**

```bash
cd frontend
npm run dev
```

Create `frontend/.env` from `.env.example` and set `VITE_SSO_BASE_URL=/sso-api` so the SSO option appears and the Vite proxy forwards to the stub. Open **http://localhost:3000**. On the sign-in screen, use **Get login challenge**, then you can paste **any** placeholder hex strings for `spk` and **signature** if you only want to test navigation — **or** use real values from `clientapp` if you have them. The mock accepts any `POST /api/login` and returns a fake `session_token` plus demo `role` / `display_name`.

To show the sign-in screen again after choosing demo or SSO, clear the **`lucky-charm-auth`** key in the browser’s **Local storage** (DevTools → Application) and refresh.

---

The app can also integrate with your colleague’s **[sso-poc](https://github.com/RanneG/sso-poc)** server (`proof-of-concept/server.go`), which exposes:

- `GET /api/challenge/login` → `{ challenge, sname }`
- `POST /api/login` → `{ success, session_token, ... }`
- `POST /api/submission/nullifier` → `{ nullifier }` (U2SSO: one per submission; TEE rejects duplicates)

1. Run the SSO server on a free port. The Vite dev proxy defaults to **`http://localhost:8081`** so it doesn’t clash with other apps often bound to **8080** (e.g. another local project).
2. Copy `.env.example` to `.env` and set `VITE_SSO_BASE_URL=/sso-api`. If your U2SSO server listens elsewhere, set **`VITE_SSO_PROXY_TARGET`** (e.g. `http://localhost:9090`).
3. Start Lucky Charm — you’ll get a **Sign in** screen: complete login with **clientapp** outputs (spk + signature), or **Continue in Demo Mode**.

### Aligning U2SSO with `VITE_SSO_PROXY_TARGET`

**What the env var means:** `VITE_SSO_PROXY_TARGET` is the **origin** (protocol + host + port) where the **U2SSO Go server** from `sso-poc/proof-of-concept/server.go` is actually listening. Vite only forwards browser calls from `http://localhost:3000/sso-api/...` to that origin — it does **not** start U2SSO for you.

**Stock `sso-poc` listens on `:8080` by default** (`http.ListenAndServe(":8080", nil)`). Our proxy default is **8081** so it won’t collide with other apps on 8080 — you must either:

- **Option A — Run U2SSO on 8081:** In `server.go`, change `:8080` to `:8081`, then from `proof-of-concept/` run `go run .` (or your usual command). Keep `VITE_SSO_PROXY_TARGET=http://localhost:8081` (or omit it to use the default).
- **Option B — Run U2SSO on 8080:** Stop whatever else uses 8080, run `sso-poc` unchanged, and set in `.env`:
  ```bash
  VITE_SSO_PROXY_TARGET=http://localhost:8080
  ```

**If you see 404 on `http://localhost:PORT/api/challenge/login`:** Something on that port is **not** the U2SSO server (wrong app, old binary, or server not started). U2SSO must register that path; a 404 means the process bound to that port doesn’t have it.

**Sanity check (must return JSON, not HTML “Not Found”):**

```bash
curl -sS http://localhost:8081/api/challenge/login
# expect: {"challenge":"...","sname":"..."}
```

Use the **same host/port** in `VITE_SSO_PROXY_TARGET` as in that `curl`. After changing `.env`, restart `npm run dev`.

**Role & team from SSO:** stock `sso-poc` only returns `session_token`. To wire **Team Lead / Team Member / Hackathon Host** and team membership, extend the JSON success payload, for example:

```json
{
  "success": true,
  "session_token": "...",
  "role": "team-lead",
  "display_name": "Alex",
  "user_id": "optional-stable-id",
  "team": {
    "team_id": "t_123",
    "team_name": "Lucky Charm",
    "join_code": "ABC123"
  }
}
```

Or nest under `lucky_charm`. Supported role strings include `team-lead`, `team-member`, `hackathon-host` (aliases like `Team Lead`, `host` are normalized). If `role` is omitted, the app defaults to **Team Member** after SSO login.

- **Team Leads:** on **Dashboard** with **Team Lead** selected, expand **TEE Status &amp; Settings** at the bottom for mock/live TEE, endpoint, test connection, credit saver, and attestation link.
- **Team** (header tab) → create/join a team with join codes (stored in `localStorage` for demo).
- **Dashboard** → switch **Team Lead**, **Team Member**, or **Hackathon Host** in the role selector (syncs with Team page behavior).

## Production build

```bash
npm run build
npm run preview   # optional: test the built app locally
```
