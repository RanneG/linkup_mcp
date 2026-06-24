# Hermes + Nami — honest status

Last reviewed: 2026-06-23. Update this file when you ship a phase.

## Scorecard (1–5)

| Area | Score | Notes |
|------|-------|-------|
| **Runtime host (Mac)** | 4/5 | Hermes + Ollama + Telegram done per [NAMI.md](./NAMI.md) |
| **linkup_mcp ↔ Hermes MCP** | 4/5 | Wired via `install-nami-mcp-mac.sh`; re-run after `git pull` |
| **RAG over *your* docs** | 2/5 → **4/5 after corpus sync** | Was PDF-only / empty `data/`; use `build_nami_rag_corpus.py` |
| **Memory (MEMORY/USER)** | 2/5 | Templates exist; agent must curate over time |
| **Gateway reliability** | 3/5 | Manual `start-nami-gateway.sh` after reboot — no launchd yet |
| **Feedback loops** | 2/5 → **3/5** | `nami-rag-eval` + persist corrections to git memory; see [LOOP_ENGINEERING.md](./LOOP_ENGINEERING.md) for closed-loop design |
| **Model routing** | 3/5 | Ollama default set; `apply-nami-model-routing.sh` + skill |
| **Non-redundant surfaces** | 4/5 | See [SURFACE_MAP.md](./SURFACE_MAP.md) |

## Done

- [x] Hermes default profile = Nami (`SOUL.md`, `AGENTS.md`)
- [x] Telegram gateway + allowlist
- [x] Ollama `qwen2.5:7b` local model
- [x] linkup MCP server `linkup` (`web_search`, `rag`, agents, whisper tools)
- [x] Koshi isolated profile
- [x] PC client path (Telegram + SSH) — [PC_CLIENT.md](./PC_CLIENT.md)

## Todo (high leverage)

- [ ] Run **`bash scripts/install-nami-stack-mac.sh`** once after this PR (Mac SSH)
- [ ] Seed **`~/.hermes/memories/`** if empty (`install-nami-hermes.sh`)
- [ ] **`hermes gateway install`** (launchd) OR cron `@reboot` → `start-nami-gateway.sh`
- [ ] **Reel backlog (Mac):** Hermes voice → browser connect → sub-agents — [REEL_BACKLOG.md](./REEL_BACKLOG.md)
- [x] Closed-loop skill templates — [daily-brief-loop.md](../../hermes-nami/skills/daily-brief-loop.md) + [loop-checker.md](../../hermes-nami/skills/loop-checker.md)
- [ ] **First closed loop (Mac wire-up):** heartbeat/cron → daily brief; verify read-only Telegram — [LOOP_ENGINEERING.md](./LOOP_ENGINEERING.md)
- [ ] Telegram topic desks (Build / Products / This week) — optional
- [ ] Tailscale on Mac for away-from-home
- [ ] Weekly: run `python scripts/nami_rag_eval.py` after doc changes

## Todo (later)

- [ ] RevenueCat / Metricool / Meta Ads MCP — product-dependent; see [REEL_BACKLOG.md](./REEL_BACKLOG.md)
- [ ] Bella voice skill on Hermes (after native Hermes voice)
- [ ] Mem0 / Mubit (only if built-in memory feels tight)
- [ ] Email desks (off until config enables)

## Verify (Mac)

```bash
cd ~/Cursor/linkup_mcp
bash scripts/verify-nami-hermes.sh
```

Expected: Ollama up, `hermes mcp test linkup` passes, corpus files in `data/nami-corpus/`.
