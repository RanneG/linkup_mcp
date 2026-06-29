---
name: linkup-mcp
description: "When to use linkup MCP: web_search, rag, spawn_agent."
version: 1.0.0
author: RanneG
metadata:
  hermes:
    tags: [nami, mcp, rag]
    category: devops
---

# linkup_mcp tools (MCP server `linkup`)

Use when Ranne needs **grounded** answers about his stack, not guesses.

## When to use which tool

| Need | Tool | Example |
|------|------|---------|
| Live web facts | `web_search` | Latest API changes |
| Repo docs, Hermes, Stitch | `rag` | Stitch bridge port |
| Stitch UI JSON shape | `rag_stitch` | UI-oriented RAG |
| Multi-step research | `spawn_agent` | Compare X vs Y |

## RAG corpus

From `data/nami-corpus/`. If weak: suggest `python -m nami_corpus.sync` on linkup_mcp clone.

## Secrets

- `LINKUP_API_KEY` for **web_search** only.
- RAG works without cloud keys.

## Do not

- Invent deploy status or API keys.
- Edit code from Telegram unless mobile-build skill applies.
