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
| linkup_mcp MCP on Mac for runtime Nami | **Next** — `scripts/install-nami-mcp-mac.sh` |
| MEMORY.md / USER.md seeded | Todo |
| Telegram topic desks (Build / Products / This week) | Todo |
| Nami gateway launchd (auto-start) | Todo (koshi launchd works; default is background) |
| Tailscale (Mac reachable away from home Wi‑Fi) | Todo |
| Bella voice (ElevenLabs) on Telegram | Later |

---

## Phase 1 — MCP on Mac (search + RAG in Telegram)

Same tools as Cursor, on runtime Nami.

**On the Mac** (after `linkup_mcp` clone + `.env` with `LINKUP_API_KEY`):

```bash
cd ~/Cursor/linkup_mcp
git pull
bash scripts/install-nami-mcp-mac.sh
hermes gateway restart   # or: hermes gateway stop && hermes gateway start
```

In Telegram, ask Nami something that needs web search or your `data/` docs.  
If tools fail: `/reload-mcp` in chat, then check `~/.hermes/logs/gateway.log`.

**Secrets:** Copy `LINKUP_API_KEY` from PC `.env` into Mac `~/Cursor/linkup_mcp/.env` or `~/.hermes/.env` (never commit).

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

**At home:** Mac awake + `hermes gateway start` (or fix launchd for default profile like koshi).

**After reboot:**

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
| Refresh personality from git | `cd ~/Cursor/linkup_mcp && bash scripts/install-nami-hermes.sh` |
| Check both bots | `hermes profile list` |

---

## Related docs

- [MAC_SETUP.md](./MAC_SETUP.md) — install, Ollama, gateway
- [PC_CLIENT.md](./PC_CLIENT.md) — Telegram + SSH from Windows
- [MEMORY.md](./MEMORY.md) — how recall works
- [../supplyme/README.md](../supplyme/README.md) — Koshi / SupplyMe (separate product)
