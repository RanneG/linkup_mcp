# Environment Variables Template

Create a `.env` file in the project root with the following variables:

Python install profiles (see **README** Quick Start): default **`uv sync`** is MCP + RAG only. For **`stitch_rag_bridge.py`** / face / OAuth / server STT use **`uv sync --extra stitch-bridge`**; for **`stitch_gui.py`** add **`--extra stitch-gui`**.

```bash
# Linkup API Key — get your key from https://www.linkup.so/
LINKUP_API_KEY=your_linkup_api_key_here

# OpenAI API Key — only if you wire features that need it
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Stitch HTTP bridge (stitch_rag_bridge.py)
# STITCH_RAG_BRIDGE_PORT=8765
# STITCH_VOICE_TRANSCRIBE=0   # set to 0 to disable POST /api/voice/transcribe (server-side STT for desktop WebView)
# STITCH_VOICE_STT_ENGINE=auto   # auto | google | whisper  (auto prefers local Whisper if `pip install -e ".[stitch-whisper]"`)
# STITCH_WHISPER_MODEL=tiny.en   # faster-whisper model id (e.g. base.en, small.en); first run downloads weights
# STITCH_WHISPER_DEVICE=cpu      # cpu or cuda
# STITCH_WHISPER_COMPUTE_TYPE=int8
# STITCH_ALLOWED_ORIGINS=http://127.0.0.1:1420,http://localhost:1420
# STITCH_DESKTOP_DIST=C:/path/to/stitch-app/apps/desktop/dist   # stitch_gui.py: serve built SPA from same process

# Optional: include debug_retrieval_cards on rag_stitch / bridge fallback responses
# STITCH_RAG_DEBUG=1

# --- Local face verification (stitch_rag_bridge.py /face_verification) ---
# STITCH_FACE_DB_DIR=         # override default ~/.stitch/face_db/
# STITCH_FACE_PASSPHRASE=     # optional extra secret mixed into Fernet key derivation
# STITCH_FACE_MATCH_THRESHOLD=0.6   # cosine similarity gate (0–1)
# STITCH_FACE_MODEL=Facenet         # DeepFace model name
# STITCH_FACE_DETECTOR=opencv       # DeepFace detector backend (faster CPU)
# STITCH_FACE_MAX_SIDE=320          # downscale before embed (latency)
# STITCH_FACE_LIVENESS_MIN_FRAMES=8
# STITCH_FACE_HEAD_TURN_MIN=0.06    # normalized horizontal movement for head-turn liveness
# STITCH_FACE_DEV_SKIP_LIVENESS=1   # dev only: bypass liveness in POST /api/face/verify

# --- Google OAuth + Gmail (Stitch bridge /api/auth/*, /api/subscriptions/*) ---
# See "Google OAuth (Stitch)" below for setup. Uncomment and fill when using Stitch desktop + bridge.
# GOOGLE_OAUTH_CLIENT_ID=your_client_id.apps.googleusercontent.com
# GOOGLE_OAUTH_CLIENT_SECRET=your_secret
# STITCH_GOOGLE_REDIRECT_URI=http://127.0.0.1:8765/api/auth/google/callback   # optional; must match Console
# STITCH_AUTH_DB=
# STITCH_GOOGLE_FERNET_KEY=
# STITCH_SESSION_TTL_SEC=2592000
```

## Getting API Keys

### Linkup API Key

1. Visit https://www.linkup.so/
2. Sign up and open the dashboard
3. Create or copy your API key

### OpenAI API Key

1. Visit https://platform.openai.com/
2. Open **API keys** and create a key

### Google OAuth (Stitch sign-in + Gmail discovery)

Used by `stitch_rag_bridge.py` for `/api/auth/google/*`, sessions, and `/api/subscriptions/from-gmail`.

1. **Google Cloud Console** — Create (or pick) a project → **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID** → Application type **Web application**. Under **Authorized redirect URIs**, add exactly:
   - `http://127.0.0.1:8765/api/auth/google/callback`  
   Enable **Gmail API** (and Google People / userinfo if prompted) for the same project so the bridge can read subscription mail with the scopes it requests.
   Under **OAuth consent screen**, set the user-facing **App name** (e.g. “Stitch”) so Google’s sign-in pages do not show a generic placeholder like “Test”.

2. **Root `.env`** (same folder as `stitch_rag_bridge.py`, i.e. this repo root — never commit it):

   ```bash
   GOOGLE_OAUTH_CLIENT_ID=your_client_id.apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=your_secret
   ```

3. **Restart the bridge** so it reloads env (from repo root, with `uv`):

   ```bash
   uv run python stitch_rag_bridge.py
   ```

   If you use a venv instead: `.\.venv\Scripts\python.exe stitch_rag_bridge.py` (Windows) or `.venv/bin/python stitch_rag_bridge.py` (macOS/Linux).

The Stitch UI calls the bridge on **127.0.0.1:8765** in local dev; the redirect URI in Console must match what the bridge uses (default above).

Never commit `.env`; it is listed in `.gitignore`.

For Ollama: install from https://ollama.ai/download, then `ollama pull llama3.2` (see **README.md**).
