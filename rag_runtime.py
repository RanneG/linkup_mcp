"""
Lazy-init PDF RAG workflow shared by MCP (`server.py`) and Stitch HTTP bridge (`stitch_rag_bridge.py`).

Keeps a single process-global index so MCP and bridge do not duplicate ingest when both run (typical dev: bridge only or MCP only).
"""
from __future__ import annotations

import asyncio
from typing import Optional

from rag import RAGWorkflow

_rag_workflow: Optional[RAGWorkflow] = None
_rag_ready_lock = asyncio.Lock()


async def ensure_rag_ready() -> RAGWorkflow:
    """Build embedding index on first use."""
    global _rag_workflow
    if _rag_workflow is not None:
        return _rag_workflow
    async with _rag_ready_lock:
        if _rag_workflow is None:
            _rag_workflow = RAGWorkflow()
            await _rag_workflow.ingest_documents("data")
        return _rag_workflow
