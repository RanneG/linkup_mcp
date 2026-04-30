# Environment Variables Template

Create a `.env` file in the project root with the following variables:

```bash
# Linkup API Key — get your key from https://www.linkup.so/
LINKUP_API_KEY=your_linkup_api_key_here

# OpenAI API Key — only if you wire features that need it
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Stitch HTTP bridge (stitch_rag_bridge.py)
# STITCH_RAG_BRIDGE_PORT=8765

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
# Create an OAuth 2.0 Web client in Google Cloud Console and add authorized redirect URI:
#   http://127.0.0.1:8765/api/auth/google/callback
# Enable Gmail API for the project. Scopes are requested by the bridge (readonly Gmail + profile email).
# GOOGLE_OAUTH_CLIENT_ID=
# GOOGLE_OAUTH_CLIENT_SECRET=
# Optional: override redirect (must match Console exactly)
# STITCH_GOOGLE_REDIRECT_URI=http://127.0.0.1:8765/api/auth/google/callback
# Optional: SQLite DB path (default ~/.stitch/stitch_auth.db)
# STITCH_AUTH_DB=
# Optional: Fernet key for refresh tokens (default: auto-generated file ~/.stitch/.google_fernet_key)
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

Never commit `.env`; it is listed in `.gitignore`.

For Ollama: install from https://ollama.ai/download, then `ollama pull llama3.2` (see **README.md**).
