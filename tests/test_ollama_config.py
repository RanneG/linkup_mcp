"""Tests for shared Ollama model selection."""

from ollama_config import DEFAULT_OLLAMA_MODEL, configured_ollama_model


def test_configured_ollama_model_defaults_to_llama32() -> None:
    assert configured_ollama_model({}) == DEFAULT_OLLAMA_MODEL


def test_configured_ollama_model_uses_env_override() -> None:
    assert configured_ollama_model({"OLLAMA_MODEL": "qwen2.5:7b"}) == "qwen2.5:7b"


def test_configured_ollama_model_strips_empty_override() -> None:
    assert configured_ollama_model({"OLLAMA_MODEL": "   "}) == DEFAULT_OLLAMA_MODEL
