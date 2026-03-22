# Transcript processing backend (Flask)

Minimal Flask app used by the Lucky Charm frontend when "Live TEE" is selected and pointed at this server.

**Deploy to Phala Cloud CPU TEE:** see [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step instructions using the Phala CLI.

## Ports

| Context | Port | Meaning |
|--------|------|--------|
| **Docker (all compose files)** | `8080:8080` | Container listens on 8080; host port 8080 maps to it. Use `http://localhost:8080` when the app runs via Docker. |
| **Phala Cloud** | `8080:8080` | Same mapping; Phala exposes the app as `https://<cvm-id>-8080....` |
| **Local Flask (no Docker)** | 5001 | Default when you run `flask run -p 5001` or `python app.py` without `PORT` set. Frontend Vite proxy points here. |
| **Local Docker, 8080 busy** | `8081:8080` | Optional: run `docker run -p 8081:8080 ...` and use `http://localhost:8081`. |

The app always listens on **8080** inside the container (set by `ENV PORT=8080` in the Dockerfile). The left side of `host:container` is what you use in the browser or for `VITE_TEE_URL`.

## Optional: LLM extraction (Ollama)

Set `OLLAMA_URL` (e.g. `http://localhost:11434`) to use Ollama for richer extraction. Falls back to rule-based if unset or unavailable.

## Endpoints

- **GET /health** — Returns `{"status": "running"}`. Used for connection checks.
- **GET /attestation** — Returns attestation info for TEE verification.
- **POST /process** — Accepts either:
  - **JSON:** `{"transcript": "<full transcript text>", "transcript_hash": "<sha256 hex>", "participant_id": "..."}`
  - **Multipart:** form fields `transcript` (file), `transcript_hash` (SHA-256 hex), `participant_id` (optional)
  - `transcript_hash` is verified for integrity (Props); mismatch returns 400.
  
  Runs blocker / action item / decision extraction and returns JSON:

  ```json
  {
    "blockers": [{"id": "...", "team": "...", "title": "...", "since": "..."}],
    "action_items": [{"id": "...", "text": "...", "due": "..."}],
    "decisions": [{"id": "...", "text": "...", "date": "..."}]
  }
  ```

## Run with Docker

```bash
cd backend
docker compose up --build
```

The `app` service listens on port 8080. To point the frontend at it, set `VITE_TEE_URL=http://localhost:8080` (or proxy `/api/tee` to `http://localhost:8080`).

## Run locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
flask --app app run -p 5001
```

Or:

```bash
pip install -r requirements.txt
python app.py
```

(Default port is 5001 to avoid conflict with macOS AirPlay Receiver on 5000.)

With the frontend’s Vite proxy (see `frontend/vite.config.js`), requests to `/api/tee/health` and `/api/tee/process` are forwarded to `http://localhost:5001/health` and `http://localhost:5001/process`. Run the frontend with `npm run dev` and the backend on port 5001; use **Live TEE** in the Dev tab to hit this backend.
