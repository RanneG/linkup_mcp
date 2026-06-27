# Hermes + Nami — honest status

Last reviewed: 2026-06-27. Update this file when you ship a phase.

## Scorecard (1–5)

| Area | Score | Notes |
|------|-------|-------|
| **Runtime host (VPS)** | 1/5 → target 5/5 | Migrating from Mac — [VPS_SETUP.md](./VPS_SETUP.md) |
| **linkup_mcp ↔ Hermes MCP** | 4/5 | Same scripts on Linux VPS; re-run after `git pull` |
| **RAG over *your* docs** | 4/5 | `nami_corpus.sync` → `data/nami-corpus/` |
| **Memory (MEMORY/USER)** | 2/5 | Templates exist; agent must curate over time |
| **Gateway reliability** | 2/5 → target 5/5 | systemd / `hermes gateway install` on VPS |
| **Feedback loops** | 3/5 | Skills + [LOOP_ENGINEERING.md](./LOOP_ENGINEERING.md) |
| **Model routing** | 3/5 | Ollama on 8GB+ VPS or cloud model on small VPS |
| **Non-redundant surfaces** | 4/5 | [SURFACE_MAP.md](./SURFACE_MAP.md) |
| **PC mobile build bridge** | 4/5 | [MOBILE_BUILD.md](./MOBILE_BUILD.md) — wired on PC |

## Done

- [x] Architecture decision: **VPS runtime + PC build** (Mac optional)
- [x] VPS docs + `install-nami-stack-vps.sh` + gateway systemd helper
- [x] PC mobile build bridge + tests merged (PR #32)
- [x] linkup MCP server `linkup` (tools list unchanged)
- [x] Koshi isolated profile pattern
- [x] PC client path (Telegram + SSH) — [PC_CLIENT.md](./PC_CLIENT.md)

## Todo (high leverage — VPS migration)

- [ ] Provision VPS + Tailscale — [VPS_SETUP.md](./VPS_SETUP.md)
- [ ] `bash scripts/install-nami-stack-vps.sh` on VPS
- [ ] `hermes gateway setup` + `install-nami-gateway-systemd.sh`
- [ ] Copy `~/.hermes/memories/` from Mac if you want continuity
- [ ] VPS `~/.hermes/.env`: `NAMI_BUILD_*` → PC Tailscale IP
- [ ] PC: `NAMI_BUILD_HOST=0.0.0.0` + bridge running when builds needed
- [ ] Decommission Mac gateway (stop Mac `hermes gateway` to avoid duplicate bots)

## Todo (later)

- [ ] Telegram topic desks (Build / Products / This week)
- [ ] Bella voice skill on Hermes
- [ ] Weekly: `python scripts/nami_rag_eval.py` after doc changes
- [ ] RevenueCat / ads MCP — [REEL_BACKLOG.md](./REEL_BACKLOG.md)

## Verify (VPS)

```bash
cd ~/Cursor/linkup_mcp
bash scripts/verify-nami-hermes.sh
```

Expected: gateway running, `hermes mcp test linkup` passes, corpus in `data/nami-corpus/`.
