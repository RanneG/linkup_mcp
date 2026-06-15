"""Shared Ollama model configuration for MCP and bridge RAG paths."""

from __future__ import annotations

import os
from collections.abc import Mapping

DEFAULT_OLLAMA_MODEL = "llama3.2"


def configured_ollama_model(env: Mapping[str, str] | None = None) -> str:
    """Return the configured Ollama model, preserving the historical default."""
    values = os.environ if env is None else env
    return (values.get("OLLAMA_MODEL") or DEFAULT_OLLAMA_MODEL).strip() or DEFAULT_OLLAMA_MODEL
