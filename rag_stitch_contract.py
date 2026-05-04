"""
Stitch-shaped RAG JSON contract + in-app help (no MCP / Flask).

Shared by `server.py` (MCP `rag_stitch`) and `stitch_rag_bridge.py` without importing the full MCP server.
"""
from __future__ import annotations

import os

from llama_index.llms.ollama import Ollama


def _to_stitch_view(payload: dict) -> dict:
    """Adapt RAG payload to Stitch-like UI contract."""
    fallback = bool(payload.get("fallback"))
    sources = payload.get("sources") or []
    show_debug = os.getenv("STITCH_RAG_DEBUG", "").lower() in ("1", "true", "yes")
    view = {
        "state": "fallback" if fallback else "answered",
        "answer": payload.get("answer", ""),
        "confidence": payload.get("confidence", "unknown"),
        "source_cards": [] if fallback else sources,
        "show_sources": bool(sources) and not fallback,
    }
    if fallback and show_debug and sources:
        view["debug_retrieval_cards"] = sources
    return view


def read_stitch_user_guide_text() -> str:
    """Plain-text / markdown for the in-app Help tab and Ask Stitch grounding."""
    root = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(root, "docs", "stitch_user_guide.md")
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        return ""


async def rag_stitch_help_query(query_text: str) -> dict:
    """
    Answer a support question using only docs/stitch_user_guide.md (no PDF RAG index).
    Returns the same shape as RAGWorkflow.query before _to_stitch_view.
    """
    guide = read_stitch_user_guide_text().strip()
    if not guide:
        return {
            "answer": (
                "The Stitch user guide file is missing on the server "
                "(expected docs/stitch_user_guide.md next to linkup_mcp)."
            ),
            "confidence": "low",
            "fallback": True,
            "sources": [],
        }
    model = (os.getenv("OLLAMA_MODEL") or "llama3.2").strip() or "llama3.2"
    llm = Ollama(model=model)
    prompt = (
        "You are in-app support for the Stitch desktop app. Answer the user's question using ONLY "
        "the information in the USER_GUIDE below. If the guide does not cover the topic, say you "
        "do not find that in the official Stitch user guide and suggest the closest relevant section "
        "title from the guide. Do not invent URLs, keyboard shortcuts, or features not mentioned in "
        "the guide. Keep the reply under 220 words.\n\n"
        f"USER_GUIDE:\n{guide}\n\n---\nUser question: {query_text}\n\nAnswer:"
    )
    try:
        response = await llm.acomplete(prompt)
    except Exception as exc:
        return {
            "answer": (
                f"The help model could not run ({type(exc).__name__}: {exc}). "
                f"Check that Ollama is running and the model `{model}` is available."
            ),
            "confidence": "low",
            "fallback": True,
            "sources": [],
        }
    answer = str(response).strip()
    sources = [
        {
            "rank": 1,
            "source_id": "stitch_user_guide.md",
            "score": 1.0,
            "snippet": "Grounded on bundled Stitch user guide.",
        }
    ]
    return {"answer": answer, "confidence": "medium", "fallback": False, "sources": sources}
