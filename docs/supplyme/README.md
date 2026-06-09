# SupplyMe (pointer)

| Repo | Role | Local path |
|------|------|------------|
| [supplyme-site](https://github.com/RanneG/supplyme-site) | Public landing + waitlist | `../supplyme-site` |
| **[supplyme-crew](https://github.com/RanneG/supplyme-crew)** | **Product engine** — Hermes skills, tenants, ops | `../supplyme-crew` |

**Runtime:** [Hermes Agent](https://hermes-agent.nousresearch.com/docs/) (not OpenClaw). Each customer = isolated tenant (`~/.hermes-tenants/{id}/`).

## Architecture (from supplyme-crew)

```
Gmail / WhatsApp / Formspree  →  Hermes (skills + memory + sheet)  →  Telegram topic desks
```

**Skills:** `inbox-classify`, `weekly-focus`, `trade-outreach-log`, `draft-reply`  
**Ground truth:** Google Sheet (`streams`, `outreach_log`, `weekly_focus`)  
**Personality:** `SOUL.md` + tenant `config.yaml`

Full diagram: **`../supplyme-crew/docs/ARCHITECTURE.md`**

## linkup_mcp relationship

- **Not merged into this repo** — SupplyMe is a Hermes deployment + skills, not a fork of linkup_mcp.
- **Shared pattern:** MCP for tools (search, RAG). Add via `hermes mcp add` pointing at this repo’s `server.py` when a tenant needs document Q&A or web search.
- **ElevenLabs / Nami voice:** optional layer on Hermes (Bella / `NAMI_VOICE_ID` in linkup_mcp `.env`) — not wired in supplyme-crew yet.

## Jarvis lesson (personal vs product)

SupplyMe is the **productized** version of “holistic assistant”:

| Jarvis layer | SupplyMe implementation | Ranne personal (Nami) |
|--------------|-------------------------|------------------------|
| Channel | Telegram topics | Hermes Telegram + Cursor chat |
| Brain | Hermes + SOUL.md | Hermes (Mac/VPS) + Cursor agent |
| Memory | Hermes memory + Google Sheet | Hermes memory; Cursor per-session |
| Tools | Hermes skills + gateways | linkup_mcp MCP + Stitch bridge |
| Voice | (not in crew yet) | ElevenLabs Bella (`nami-speak`) |

Personal Nami can reuse **skills + tenant pattern** from supplyme-crew without the multi-tenant GTM shell — e.g. one `tenants/ranne/` with your desks, not Koshi’s.

## Quick start (engine)

See **`../supplyme-crew/README.md`** — install Hermes, `hermes gateway setup`, copy `skills/` and rendered tenant config.
