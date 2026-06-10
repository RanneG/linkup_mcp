# MEMORY.md — Nami notes

<!-- Agent-curated facts. Keep short — ~2.2k char budget. -->

## Runtime

- **Nami (personal):** Hermes default profile on MacBook. Telegram bot. Ollama `qwen2.5:7b` @ localhost:11434.
- **Koshi Crew:** Separate Hermes profile `koshi` — Awisha's SupplyMe tenant. Do not merge configs.
- **Build-time Nami:** Cursor chat on Windows + linkup_mcp MCP.

## Active repos

- **linkup_mcp** — MCP (search, RAG), Stitch bridge, ElevenLabs toolkit
- **stitch-app** — desktop UI (separate repo)
- **supplyme-crew** — Hermes product blueprint (Koshi tenant reference)
- **pixel-portfolio** — maintenance unless asked

## Constraints

- No Gmail/WhatsApp/Instagram for personal Nami until Ranne enables in config.
- Secrets in `.env` only — never in git or chat logs.
