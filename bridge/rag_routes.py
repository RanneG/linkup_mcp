"""
RAG endpoints for the Stitch UI:
  POST /api/rag/stitch        — PDF-corpus RAG, Stitch view JSON (same shape as MCP `rag_stitch`)
  POST /api/rag/stitch-help   — guide-grounded help (docs/stitch_user_guide.md via Ollama)
  GET  /api/stitch-user-guide — raw guide markdown for the Help tab
"""
from __future__ import annotations

import asyncio
import threading

from flask import Blueprint, jsonify, request

from rag_runtime import ensure_rag_ready
from rag_stitch_contract import _to_stitch_view, rag_stitch_help_query, read_stitch_user_guide_text

bp = Blueprint("rag", __name__)

# Serialize LLM work: Ollama answers one prompt at a time on typical local setups.
_query_lock = threading.Lock()
_help_lock = threading.Lock()


@bp.route("/api/rag/stitch", methods=["OPTIONS"])
def rag_stitch_options():
    return "", 204


@bp.route("/api/rag/stitch", methods=["POST"])
def rag_stitch_http():
    body = request.get_json(silent=True) or {}
    query = (body.get("query") or "").strip()
    if not query:
        return jsonify({"error": "missing query"}), 400

    async def _run_query() -> dict:
        wf = await ensure_rag_ready()
        return await wf.query(query)

    with _query_lock:
        payload = asyncio.run(_run_query())

    if not isinstance(payload, dict):
        return jsonify({"error": "unexpected payload", "raw": str(payload)}), 500

    return jsonify(_to_stitch_view(payload))


@bp.route("/api/stitch-user-guide", methods=["GET", "OPTIONS"])
def stitch_user_guide_http():
    if request.method == "OPTIONS":
        return "", 204
    text = read_stitch_user_guide_text().strip()
    if not text:
        return jsonify({"markdown": "", "error": "missing_guide"}), 404
    return jsonify({"markdown": text})


@bp.route("/api/rag/stitch-help", methods=["POST", "OPTIONS"])
def rag_stitch_help_http():
    if request.method == "OPTIONS":
        return "", 204
    body = request.get_json(silent=True) or {}
    query = (body.get("query") or "").strip()
    if not query:
        return jsonify({"error": "missing query"}), 400

    with _help_lock:
        payload = asyncio.run(rag_stitch_help_query(query))

    if not isinstance(payload, dict):
        return jsonify({"error": "unexpected payload", "raw": str(payload)}), 500

    return jsonify(_to_stitch_view(payload))
