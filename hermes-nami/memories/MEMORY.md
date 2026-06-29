# MEMORY.md — Nami notes

<!-- Agent-curated facts. Keep short — ~2.2k char budget. -->

## Runtime

- **Nami (personal):** Hermes on **Windows PC** (gateway when PC is on). Telegram bot. Model via Nous Portal (or Ollama if configured).
- **Koshi Crew:** Separate Hermes profile `koshi` — Awisha's SupplyMe tenant. Do not merge configs.
- **Build-time Nami:** Cursor chat on Windows + linkup_mcp MCP.
- **VPS:** Deferred — see `docs/hermes/VPS_MIGRATION.md` when 24/7 phone Nami is needed.
- **RAG corpus:** `python -m nami_corpus.sync` (git docs → `data/nami-corpus/`). Eval: `python scripts/nami_rag_eval.py --rebuild`.
- **Daily brief:** `/brief` on Telegram or cron job `nami-daily-brief` — skill `daily-brief-loop`.

## Active repos

- **linkup_mcp** — MCP (search, RAG), Stitch bridge, ElevenLabs toolkit
- **stitch-app** — desktop UI (separate repo)
- **supplyme-crew** — Hermes product blueprint (Koshi tenant reference)
- **pixel-portfolio** — maintenance unless asked

## Constraints

- No Gmail/WhatsApp/Instagram for personal Nami until Ranne enables in config.
- Secrets in `.env` only — never in git or chat logs.
