"""HTTP bridge for mobile build enqueue (Telegram/Hermes → PC worker)."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env", override=True)

try:
    from flask import Flask, jsonify, request
except ImportError as exc:
    raise ImportError(
        "Nami build bridge requires Flask. Install: pip install -e \".[nami-build]\""
    ) from exc

from nami_build.queue import BuildQueue, JobStatus
from nami_build.worker import BuildWorker

log = logging.getLogger(__name__)

_worker: BuildWorker | None = None


def _auth_ok() -> bool:
    token = os.getenv("NAMI_BUILD_TOKEN", "").strip()
    if not token:
        return False
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:].strip() == token
    return request.headers.get("X-Nami-Build-Token", "").strip() == token


def _require_auth():
    if not _auth_ok():
        return jsonify({"ok": False, "error": "Unauthorized"}), 401
    return None


def create_app(*, start_worker: bool = True) -> Flask:
    global _worker
    app = Flask(__name__)
    queue = BuildQueue()

    @app.get("/health")
    @app.get("/api/build/health")
    def health():
        token_set = bool(os.getenv("NAMI_BUILD_TOKEN", "").strip())
        cursor_key = bool(os.getenv("CURSOR_API_KEY", "").strip())
        worker_alive = _worker is not None and _worker._thread is not None and _worker._thread.is_alive()
        pending = len(queue.pending_jobs())
        return jsonify(
            {
                "ok": True,
                "service": "nami-build-bridge",
                "token_configured": token_set,
                "cursor_api_key_set": cursor_key,
                "worker_running": worker_alive,
                "pending_jobs": pending,
            }
        )

    @app.post("/api/build/enqueue")
    def enqueue():
        denied = _require_auth()
        if denied:
            return denied
        body = request.get_json(silent=True) or {}
        task = (body.get("task") or "").strip()
        if not task:
            return jsonify({"ok": False, "error": "task is required"}), 400
        if len(task) > 8000:
            return jsonify({"ok": False, "error": "task too long"}), 400

        job = queue.enqueue(
            task,
            source=str(body.get("source", "telegram")),
            repo=str(body.get("repo", "linkup_mcp")),
            turn_cap=int(body.get("turn_cap", 8)),
        )
        log.info("Enqueued build job %s from %s", job.id, job.source)
        return jsonify({"ok": True, "job": job.to_dict()}), 201

    @app.get("/api/build/jobs/<job_id>")
    def job_status(job_id: str):
        denied = _require_auth()
        if denied:
            return denied
        job = queue.get(job_id)
        if not job:
            return jsonify({"ok": False, "error": "not found"}), 404
        return jsonify({"ok": True, "job": job.to_dict()})

    @app.get("/api/build/jobs")
    def list_jobs():
        denied = _require_auth()
        if denied:
            return denied
        limit = min(int(request.args.get("limit", 10)), 50)
        jobs = queue.list_recent(limit=limit)
        return jsonify({"ok": True, "jobs": [j.to_dict() for j in jobs]})

    if start_worker and os.getenv("NAMI_BUILD_DISABLE_WORKER", "").strip() not in {"1", "true", "yes"}:
        _worker = BuildWorker(poll_seconds=float(os.getenv("NAMI_BUILD_POLL_SECONDS", "15")))
        _worker.start()

    return app


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    host = os.getenv("NAMI_BUILD_HOST", "127.0.0.1")
    port = int(os.getenv("NAMI_BUILD_PORT", "8770"))
    app = create_app()
    print(f"Nami build bridge http://{host}:{port}/api/build/health")
    app.run(host=host, port=port, debug=False, use_reloader=False)


if __name__ == "__main__":
    main()
