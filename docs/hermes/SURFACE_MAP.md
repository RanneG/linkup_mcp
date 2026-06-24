# Nami surface map — no redundant features

One personality (**Nami**), three surfaces. Each surface owns **different jobs** so nothing competes or duplicates.

## Who does what

| Job | **Cursor (PC)** | **Hermes (Mac / Telegram)** |
|-----|-----------------|-----------------------------|
| Edit code, git, PRs | **Primary** | No — use SSH + terminal only if needed |
| Web search (Linkup) | MCP `web_search` | Same tool via Hermes MCP `linkup` |
| RAG over your docs | MCP `rag` | Same via Hermes MCP `linkup` |
| Stitch bridge (OAuth, Gmail, face) | Run `stitch_rag_bridge.py` locally | Not on Mac by default — PC dev surface |
| Long-term memory (MEMORY.md) | `AGENTS.md` + rules in git | `~/.hermes/memories/` on Mac |
| Quick note / priority on phone | — | **Telegram → Hermes** |
| Voice (Bella TTS) | `nami-speak` / ElevenLabs CLI | Optional skill later |
| Game lab / localhost UI | **PC** (`nami-play-ui`) | Not needed on Mac |
| SupplyMe / Koshi tenant | Cursor on engine repo | `hermes -p koshi` (isolated profile) |

## Rule of thumb

- **Building** → Cursor + linkup_mcp MCP (full IDE, repo access).
- **Living** (priorities, search, RAG, memory) → Hermes on Mac + Telegram.
- **Same tools, different host:** linkup_mcp MCP is registered **once on the Mac** for runtime Nami; Cursor on PC runs its **own** MCP instance for build-time — not redundant, different machines.

## What not to duplicate

| Avoid | Instead |
|-------|---------|
| Running Hermes on Windows *and* Mac for Nami | Mac = runtime only; PC = Cursor |
| Two Telegram bots for the same profile | One Nami bot; Koshi = separate profile |
| Copying SOUL.md into chat every session | `install-nami-hermes.sh` → `~/.hermes/` |
| Manual PDF dumps for every doc change | `python scripts/build_nami_rag_corpus.py` |

## Sync checklist (after `git pull`)

**On Mac:**

```bash
cd ~/Cursor/linkup_mcp
bash scripts/install-nami-stack-mac.sh
```

**On PC (Cursor):**

```bash
python scripts/build_nami_rag_corpus.py
# Restart Cursor MCP if RAG index was empty
```

See [STATUS.md](./STATUS.md) for current completion.
