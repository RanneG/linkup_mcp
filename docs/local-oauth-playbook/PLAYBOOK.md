# Loopback Google OAuth — checklist

Use for any **local dev** or **desktop shell** that opens a browser for Google sign-in and receives the callback on **127.0.0.1**.

## 1. Google Cloud Console

1. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.**
2. **Authorized redirect URIs** — add the **exact** callback your app will use, e.g.  
   `http://127.0.0.1:8765/api/auth/google/callback`  
   Use **127.0.0.1**, not `localhost`, unless you also register `localhost` and your app matches it byte-for-byte.
3. **OAuth consent screen** — set app name, support email, scopes your server will request (e.g. `openid`, `email`, `profile`, Gmail readonly if needed).
4. Enable **APIs** your token will call (e.g. **Gmail API** for mail read).

## 2. Application env (never commit)

- **Client ID** and **client secret** from the Web client (store in `.env` or OS secret store).
- Optional: explicit **redirect override** if port or path differs from defaults.
- Load `.env` **before** reading config (see `load_dotenv` in **linkup_mcp** `stitch_rag_bridge.py`).

Example names (see [examples/oauth.env.example](examples/oauth.env.example)):

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `STITCH_GOOGLE_REDIRECT_URI` (optional if you implement the same pattern as Stitch)

## 3. Server behavior (reference: Stitch)

- **PKCE** — `code_challenge` + `S256` on authorize; send `code_verifier` on token exchange (see `stitch_auth/google_client.py`).
- **State** — bind CSRF `state` to the browser session or client origin before redirect; validate on callback.
- **Callback** — exchange `code` for tokens server-side; never put **client_secret** in the SPA bundle.
- **Popup flow** — callback page can `postMessage` result to `opener` and close; restrict `targetOrigin` to your dev origins.

## 4. CORS and origins

Allow only known dev origins (e.g. `http://127.0.0.1:1420`, `http://localhost:5173`) on token/session APIs. Stitch uses **`STITCH_ALLOWED_ORIGINS`** on the bridge.

## 5. Verify

1. Restart the server after changing `.env`.
2. `GET /api/health` (or your equivalent) should show OAuth configured when ID + secret are present.
3. Complete one full sign-in in an incognito window to catch redirect mismatches.

## 6. Production later

Loopback is for **dev** and **trusted local** shells. Packaged desktop often needs **custom URL scheme**, **loopback with random port**, or **hosted callback** on a domain you control—plan before shipping.
