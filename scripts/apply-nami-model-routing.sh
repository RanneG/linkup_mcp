#!/usr/bin/env bash
# Apply Hermes Ollama defaults for Nami (run on Mac).
set -euo pipefail

if ! command -v hermes >/dev/null; then
  echo "hermes not found — install from https://hermes-agent.nousresearch.com/" >&2
  exit 1
fi

MODEL="${NAMI_OLLAMA_MODEL:-qwen2.5:7b}"
CTX="${NAMI_CONTEXT_LENGTH:-65536}"

echo "Applying Nami model routing: $MODEL ctx=$CTX"

if hermes model 2>/dev/null | head -1 | grep -q .; then
  echo "Current model config:"
  hermes model 2>/dev/null | head -5 || true
fi

hermes config set model.context_length "$CTX" 2>/dev/null || echo "WARN: could not set model.context_length"
hermes config set model.ollama_num_ctx "$CTX" 2>/dev/null || echo "WARN: could not set model.ollama_num_ctx"

echo ""
echo "Ensure Ollama endpoint points at http://127.0.0.1:11434/v1 with model $MODEL"
echo "  ollama pull $MODEL"
echo "  hermes model   # interactive — pick Custom OpenAI → Ollama URL → $MODEL"
echo ""
echo "Cloud escalation (optional): hermes setup --portal"
