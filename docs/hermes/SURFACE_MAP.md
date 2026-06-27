# Nami surface map — no redundant features

One personality (**Nami**), three surfaces. Each surface owns **different jobs** so nothing competes or duplicates.

## Who does what

| Job | **Cursor (PC)** | **Hermes (VPS / Telegram)** |
|-----|-----------------|-----------------------------|
| Edit code, git, PRs | **Primary** | Review after PC mobile build — [MOBILE_BUILD.md](./MOBILE_BUILD.md) |
| Mobile build enqueue | **PC bridge** `:8770` | VPS skill → HTTP POST to PC |
| Web search (Linkup) | MCP `web_search` | Same tool via Hermes MCP `linkup` |
| RAG over your docs | MCP `rag` | Same via Hermes MCP `linkup` |
| Stitch bridge (OAuth, Gmail, face) | Run `stitch_rag_bridge.py` locally | Not on VPS by default — PC dev surface |
| Long-term memory (MEMORY.md) | `AGENTS.md` + rules in git | `~/.hermes/memories/` on VPS |
| Quick note / priority on phone | — | **Telegram → Hermes (VPS)** |
| Voice (Bella TTS) | `nami-speak` / ElevenLabs CLI | Optional skill later |
| Game lab / localhost UI | **PC** (`nami-play-ui`) | Not on VPS |
| SupplyMe / Koshi tenant | Cursor on engine repo | `hermes -p koshi` (isolated profile on VPS) |

## Rule of thumb

- **Building** → Cursor + linkup_mcp MCP on PC (full IDE, repo access).
- **Living** (priorities, search, RAG, memory, Telegram 24/7) → Hermes on **VPS**.
- **Same tools, different host:** linkup_mcp MCP on VPS for runtime; Cursor on PC runs its **own** MCP for build-time.

## What not to duplicate

| Avoid | Instead |
|-------|---------|
| Running Hermes on Windows *and* VPS for Nami | VPS = runtime; PC = Cursor only |
| Mac + VPS both as Telegram gateway | Pick **VPS**; Mac optional spare |
| Two Telegram bots for the same profile | One Nami bot; Koshi = separate profile |
| Manual PDF dumps for every doc change | `python -m nami_corpus.sync` |

## Sync checklist (after `git pull`)

**On VPS:**

```bash
cd ~/Cursor/linkup_mcp
bash scripts/install-nami-stack-vps.sh
hermes gateway restart
```

**On PC (Cursor):**

```bash
git pull
# Restart Cursor MCP if needed; run Nami-Build-Bridge when using mobile builds
```

See [STATUS.md](./STATUS.md) for current completion.
