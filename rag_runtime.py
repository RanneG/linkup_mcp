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
            import os
            from pathlib import Path

            model = os.getenv("RAG_LLM_MODEL", "llama3.2")
            _rag_workflow = RAGWorkflow(model_name=model)
            data_dir = Path(os.getenv("RAG_DATA_DIR", "data"))
            if not data_dir.is_dir():
                data_dir.mkdir(parents=True, exist_ok=True)
            await _rag_workflow.ingest_documents(str(data_dir))
        return _rag_workflow
