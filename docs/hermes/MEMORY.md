# How Nami's memory works (Hermes)

## Not Mubit (by default)

**Mubit** appears in **supplyme-crew** skills and roadmap as a **future** optional layer (hackathon sponsor — operational memory across runs). It is **not** required for your personal Nami and is **not** installed today.

If you meant **Mem0**: Hermes can optionally use **Mem0** (and Honcho, Hindsight, etc.) as an **external memory provider** — alongside built-in memory, not instead of it:

```bash
hermes memory setup
hermes memory status
```

Start with **built-in only**; add Mem0/Mubit later if you outgrow the limits.

## Built-in Hermes memory (what you get out of the box)

Two small files, injected every session:

| File | Purpose | Limit |
|------|---------|-------|
| `~/.hermes/memories/MEMORY.md` | Agent notes — projects, env, lessons | ~2,200 chars |
| `~/.hermes/memories/USER.md` | Your profile — preferences, style | ~1,375 chars |

The agent curates these with the `memory` tool (add / replace / remove). Think **sticky notes in the system prompt**, not a full database.

## Session search (long-term recall)

All past chats are stored in SQLite (`~/.hermes/state.db`) with full-text search. The agent can use `session_search` to find old conversations even when they're not in MEMORY.md.

| | Built-in memory | Session search |
|--|-----------------|----------------|
| Always in context | Yes | No — on demand |
| Size | ~1.3k tokens total | All sessions |
| Best for | "User prefers Bella voice" | "What did we decide about SupplyMe last Tuesday?" |

## SupplyMe adds (optional, later)

- **Google Sheet** as ground truth (streams, outreach, weekly focus)
- **Mubit** (v3 roadmap) for cross-run operational learning
- **linkup_mcp MCP** for RAG / search

Your v1 Nami: **Hermes built-in memory + session search + SOUL.md/AGENTS.md** — no sheet, no Mubit, no email.
