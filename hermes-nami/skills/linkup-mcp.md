# Skill — linkup_mcp tools (Hermes MCP server `linkup`)

Use when Ranne needs **grounded** answers about his stack, not guesses.

## When to use which tool

| Need | Tool | Example |
|------|------|---------|
| Live web facts, news, docs outside repo | `web_search` | "Latest Roblox DataModel API change" |
| Ranne's repos, Hermes setup, Stitch, env vars | `rag` | "What port is the Stitch bridge on?" |
| Stitch UI JSON shape | `rag_stitch` | Same corpus, UI-oriented payload |
| Multi-step research + synthesis | `spawn_agent` (type `research` or `document`) | "Compare X vs Y using search then docs" |

## RAG corpus

Indexed from **`data/nami-corpus/`** (generated from git docs). If RAG returns fallback/low confidence:

1. Tell Ranne the doc may be missing from corpus.
2. Suggest: `python scripts/build_nami_rag_corpus.py` on linkup_mcp clone, restart gateway.

## Secrets

- `LINKUP_API_KEY` required for **web_search** only.
- RAG uses local Ollama — no cloud key.

## Do not

- Invent deploy URLs, API keys, or "already shipped" status — use RAG or ask.
- Duplicate Cursor's job (editing code) unless Ranne explicitly asks from Telegram.
