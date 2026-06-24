# Nami — personal assistant (phone, PC, Mac)

One **Nami** personality, three surfaces. Same partner on each device; different **capabilities** per surface.

## Surfaces

| Device | How you talk to Nami | What she can do |
|--------|----------------------|-----------------|
| **Phone** | Telegram → Nami bot | Memory, skills, MCP (after Mac setup), cron |
| **PC** | **Cursor chat** (build) + **Telegram** (runtime) | Cursor: full IDE + MCP. Telegram: same runtime as phone |
| **Mac** | Terminal `hermes`, Telegram gateway | Host process — gateway + Ollama + MCP |

**Runtime host:** MacBook only (`~/.hermes/`, default profile).  
**Not on PC:** Hermes was removed from Windows on purpose — see [PC_CLIENT.md](./PC_CLIENT.md).

```
                    ┌─────────────────────────────────┐
                    │  MacBook (always-on when open)   │
                    │  Hermes default = Nami             │
                    │  Ollama qwen2.5:7b               │
                    │  gateway → Telegram              │
                    │  linkup_mcp MCP (search + RAG)   │
                    └───────────────┬─────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
    📱 Phone                   💻 PC Telegram              🖥 Mac CLI
    Telegram app               Telegram Desktop            ssh → hermes
```

**Separate:** `koshi` profile = Koshi Crew (Awisha). Never share bot tokens with Nami.

---

## Current state (update as you ship)

| Item | Status |
|------|--------|
| Hermes on Mac (default = Nami) | Done |
| Telegram Nami bot + allowlist | Done |
| Local LLM (Ollama `qwen2.5:7b`) | Done |
| `context_length` / `ollama_num_ctx` 65536 | Set in config — verify with `ollama ps` |
| Koshi isolated (`hermes -p koshi`) | Done |
| linkup_mcp MCP on Mac for runtime Nami | Done — `hermes mcp test linkup`; re-run **`bash scripts/install-nami-stack-mac.sh`** after `git pull` |
| RAG over Nami docs (not PDF-only) | **`python -m nami_corpus.sync`** → `data/nami-corpus/` |
| MEMORY.md / USER.md seeded | Run `install-nami-hermes.sh` if `~/.hermes/memories/` empty |
| Telegram topic desks (Build / Products / This week) | Todo |
| Nami gateway after reboot | Todo — run `bash scripts/start-nami-gateway.sh` |
| Tailscale (Mac reachable away from home Wi‑Fi) | Todo |
| Bella voice (ElevenLabs) on Telegram | Later |

---

## Phase 1 — MCP on Mac (search + RAG in Telegram) ✅

Registered as Hermes MCP server **`linkup`**: `web_search`, `rag`, `rag_stitch`, whisper tools, `spawn_agent`.

**One-shot install / refresh** (SSH on Mac):

```bash
cd ~/Cursor/linkup_mcp
git pull
bash scripts/install-nami-stack-mac.sh
hermes gateway restart
```

Or step-by-step: `install-nami-hermes.sh` → `python -m nami_corpus.sync` → `install-nami-mcp-mac.sh`.

**Non-redundant surfaces:** [SURFACE_MAP.md](./SURFACE_MAP.md). **Honest scorecard:** [STATUS.md](./STATUS.md).

In Telegram: **`/reload-mcp`**, then ask Nami to search or use RAG.

**Secrets:** `LINKUP_API_KEY=...` in `~/Cursor/linkup_mcp/.env` only ( `KEY=value` format ). Optional for RAG; required for web search. Never `source ~/.hermes/.env` in bash.

**Runner:** `scripts/run-linkup-mcp-stdio.sh` — Python `load_dotenv()` only; no bash `.env` sourcing.

---

## Phase 2 — Memory that sticks

Hermes built-in files (curated by the agent over time):

| File | Purpose |
|------|---------|
| `~/.hermes/memories/MEMORY.md` | Projects, env, lessons |
| `~/.hermes/memories/USER.md` | Your preferences, timezone, style |

Seed templates: [hermes-nami/memories/](../../hermes-nami/memories/) (copy to `~/.hermes/memories/` on Mac).

Long recall: agent uses **session_search** across past chats — no extra install.

Details: [MEMORY.md](./MEMORY.md).

---

## Phase 3 — Reliable gateway

**After reboot or when Telegram is silent:**

```bash
cd ~/Cursor/linkup_mcp
bash scripts/start-nami-gateway.sh
```

Or manually:

```bash
hermes gateway status
hermes gateway start    # if not running
```

**Away from home LAN:** Tailscale on Mac + PC/phone → SSH or Telegram still works if Mac is on.

---

## Phase 4 — Telegram desks (optional)

Topic supergroup matching [hermes-nami/config.yaml](../../hermes-nami/config.yaml):

- Build · Products · This week

Same pattern as SupplyMe; personal scope only. Configure via `hermes gateway setup` when ready.

---

## Phase 5 — Voice (optional)

Bella (`NAMI_VOICE_ID` in linkup_mcp `.env`) via `elevenlabs-gen` / `nami-speak` on PC.  
Wire to Hermes as a skill/shell hook later — text-first for v1.

---

## Daily use

| I want to… | Do this |
|------------|---------|
| Quick note / priority on the go | Telegram → Nami |
| Code + repo work | Cursor chat (build-time Nami) |
| Full TUI on Mac | `ssh mac` → `hermes` |
| Refresh personality + memory seeds from git | `cd ~/Cursor/linkup_mcp && bash scripts/install-nami-hermes.sh` |
| Start gateway after Mac reboot | `bash scripts/start-nami-gateway.sh` |
| Check both bots | `hermes profile list` |

---

## Related docs

- [MAC_SETUP.md](./MAC_SETUP.md) — install, Ollama, gateway
- [PC_CLIENT.md](./PC_CLIENT.md) — Telegram + SSH from Windows
- [MEMORY.md](./MEMORY.md) — how recall works
- [../supplyme/README.md](../supplyme/README.md) — Koshi / SupplyMe (separate product)
