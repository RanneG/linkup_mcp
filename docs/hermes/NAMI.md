# Nami — personal assistant (phone, PC, VPS)

One **Nami** personality, three surfaces. Same partner on each device; different **capabilities** per surface.

## Surfaces

| Device | How you talk to Nami | What she can do |
|--------|----------------------|-----------------|
| **Phone** | Telegram → Nami bot | Memory, skills, MCP; **mobile build enqueue** → PC worker |
| **PC** | **Cursor chat** (build) + **Telegram** (runtime) | Cursor: full IDE + MCP. Telegram: same runtime as phone |
| **VPS** | Hermes gateway (always on) | Telegram, memory, MCP search/RAG — **runtime host** |
| **Mac** | Optional | Spare — not required if VPS is live |

**Runtime host:** **Linux VPS** (`~/.hermes/`, default profile). Setup: **[VPS_SETUP.md](./VPS_SETUP.md)**.  
**Build host:** **Windows PC** — Cursor, git, mobile-build bridge.  
**Not on PC:** Hermes gateway — see [PC_CLIENT.md](./PC_CLIENT.md).

```
                    ┌─────────────────────────────────┐
                    │  VPS (24/7)                      │
                    │  Hermes default = Nami             │
                    │  Ollama or cloud LLM             │
                    │  gateway → Telegram              │
                    │  linkup_mcp MCP (search + RAG)   │
                    └───────────────┬─────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
    📱 Phone                   💻 PC (when on)            🖥 Mac (optional)
    Telegram                   Cursor + build bridge      ssh → VPS
```

**Separate:** `koshi` profile = Koshi Crew (Awisha). Never share bot tokens with Nami.

---

## Current state (update as you ship)

| Item | Status |
|------|--------|
| Hermes on VPS (default = Nami) | **Todo — [VPS_SETUP.md](./VPS_SETUP.md)** |
| Telegram Nami bot + allowlist | Migrate from Mac → VPS |
| Local LLM (Ollama) or cloud model on VPS | Pick tier in VPS_SETUP |
| Koshi isolated (`hermes -p koshi`) | Same pattern on VPS if needed |
| linkup_mcp MCP on VPS | `bash scripts/install-nami-stack-vps.sh` |
| RAG over Nami docs | **`python -m nami_corpus.sync`** → `data/nami-corpus/` |
| MEMORY.md / USER.md seeded | `install-nami-hermes.sh` on VPS |
| Gateway survives reboot | `hermes gateway install` or systemd on VPS |
| Tailscale VPS ↔ PC | Todo — mobile build + SSH |
| PC mobile build bridge | Done — [MOBILE_BUILD.md](./MOBILE_BUILD.md) |
| Mac runtime | **Retired** unless Mac stays on (see [MAC_SETUP.md](./MAC_SETUP.md)) |

---

## Phase 1 — MCP on VPS (search + RAG in Telegram)

Registered as Hermes MCP server **`linkup`**: `web_search`, `rag`, `rag_stitch`, whisper tools, `spawn_agent`.

**One-shot install / refresh** (SSH on VPS):

```bash
cd ~/Cursor/linkup_mcp
git pull
bash scripts/install-nami-stack-vps.sh
hermes gateway restart
```

Or step-by-step: `install-nami-hermes.sh` → `python -m nami_corpus.sync` → `install-nami-mcp-mac.sh`.

**Non-redundant surfaces:** [SURFACE_MAP.md](./SURFACE_MAP.md). **Honest scorecard:** [STATUS.md](./STATUS.md).

In Telegram: **`/reload-mcp`**, then ask Nami to search or use RAG.

**Secrets:** `LINKUP_API_KEY=...` in `~/Cursor/linkup_mcp/.env`. Mobile build: `~/.hermes/.env` — [MOBILE_BUILD_VPS.env.example](./MOBILE_BUILD_VPS.env.example).

**Runner:** `scripts/run-linkup-mcp-stdio.sh` — Python `load_dotenv()` only.

---

## Phase 2 — Memory that sticks

Hermes built-in files (curated by the agent over time):

| File | Purpose |
|------|---------|
| `~/.hermes/memories/MEMORY.md` | Projects, env, lessons |
| `~/.hermes/memories/USER.md` | Your preferences, timezone, style |

Seed templates: [hermes-nami/memories/](../../hermes-nami/memories/) (on VPS).

Long recall: agent uses **session_search** across past chats — no extra install.

Details: [MEMORY.md](./MEMORY.md).

---

## Phase 3 — Reliable gateway (VPS)

After provisioning:

```bash
hermes gateway setup
bash scripts/install-nami-gateway-systemd.sh
loginctl enable-linger $USER
```

**Away from home:** Tailscale on VPS + PC → Telegram always works; PC build bridge reachable via Tailscale when PC is on.

---

## Phase 4 — Telegram desks (optional)

Topic supergroup matching [hermes-nami/config.yaml](../../hermes-nami/config.yaml):

- Build · Products · This week

Configure via `hermes gateway setup` when ready.

---

## Phase 5 — Voice (optional)

Bella (`NAMI_VOICE_ID` in linkup_mcp `.env`) via `elevenlabs-gen` / `nami-speak` on PC.  
Wire to Hermes as a skill/shell hook later — text-first for v1.

---

## Daily use

| I want to… | Do this |
|------------|---------|
| Quick note / priority on the go | Telegram → Nami (VPS) |
| Build from phone (async) | Telegram → VPS enqueues → PC bridge — [MOBILE_BUILD.md](./MOBILE_BUILD.md) |
| Code + repo work | Cursor on PC |
| Hermes TUI | `ssh nami-vps` → `hermes` |
| Refresh personality from git | On VPS: `bash scripts/install-nami-hermes.sh` |
| Check both bots | `hermes profile list` (on VPS) |

---

## Related docs

- **[VPS_SETUP.md](./VPS_SETUP.md)** — primary runtime install
- [PC_CLIENT.md](./PC_CLIENT.md) — Telegram + SSH from Windows
- [MAC_SETUP.md](./MAC_SETUP.md) — legacy Mac host (optional)
- [MEMORY.md](./MEMORY.md) — how recall works
- [../supplyme/README.md](../supplyme/README.md) — Koshi / SupplyMe
