# Hermes backlog — Luke Jarvis reel (DZ5H6F1Rz1S)

Ordered **Mac-side** tasks inspired by [Luke's reel critique](https://www.instagram.com/reel/DZ5H6F1Rz1S/) and Ranne's reply transcript (`data/inbox/DZ5H6F1Rz1S.md`). This is **runtime Nami on Hermes**, not a full Jarvis build in Cursor.

See [SURFACE_MAP.md](./SURFACE_MAP.md) for what belongs on Mac vs PC.

**Loop engineering lens:** [LOOP_ENGINEERING.md](./LOOP_ENGINEERING.md) — same backlog items reframed as automations, connectors, sub-agents, memory, and checker-first design (Sabrina article + [YouTube](https://www.youtube.com/watch?v=Ry3YyG22EUc)).

## Priority (actionable on Mac now)

| # | Task | Surface | Effort | Notes |
|---|------|---------|--------|-------|
| 1 | **Hermes voice** — enable built-in talk-to-agent mode | Hermes | ~1–2h | Luke uses Hermes voice instead of typing; aligns with STATUS "Bella voice skill later" but native voice is first |
| 2 | **Browser connect** — Chrome control from Hermes (`/browser` or equivalent) | Hermes | ~1–2h | "Controlling Chrome" on the Mac mini host; document allowlist + security posture |
| 3 | **Sub-agents + skills** — main Nami + scoped workers (e.g. research, build notes) | Hermes | ~2h | Luke's "forklift to sub-agent" pattern; use Hermes skills/connectors, not Claude-only agents |
| 4 | **Daily brief routine** — cron/heartbeat that prepends Telegram context | Hermes | ~1–2h | Skill spec: [daily-brief-loop.md](../../hermes-nami/skills/daily-brief-loop.md) + [loop-checker.md](../../hermes-nami/skills/loop-checker.md); **first closed loop** per [LOOP_ENGINEERING.md](./LOOP_ENGINEERING.md) |
| 5 | **Gateway reliability** — `hermes gateway install` (launchd) | Hermes | ~1h | Already on [STATUS.md](./STATUS.md) todo; blocks 24/7 brief |

## Design / build lane (PC — Cursor)

| Item | Surface | Status |
|------|---------|--------|
| **Claude design → export → Claude Code** for UI mockups | Cursor + external | Optional; Luke uses Claude design then Code — Ranne may prefer Cursor agent + stitch-app for product UI |
| **Scroll-frame landings** | Cursor | Shipped placeholder: `demos/scroll-frames/` |
| **linkup MCP** (search, RAG, whisper) | Hermes + Cursor | Done — re-run `install-nami-stack-mac.sh` after pull |

## Deferred / product-dependent (not Nami infra)

These appear in the reel but are **not** immediate Hermes backlog — wire only when a shipped app needs them:

| Mention | Luke / transcript | Why defer |
|---------|-------------------|-----------|
| **RevenueCat MCP** | App revenue tracking | Tied to mobile app SKU + store accounts |
| **Metricool** | Cross-platform posting | Marketing ops for a specific product |
| **Meta Ads MCP** | Paid ads automation | Campaign spend + Bobby-style agent is product-specific |
| **FAQ markdown → Claude CS** | 90% customer service | Needs 24/7 server + trained support skills — SupplyMe lane, not Nami v1 |
| **Full Jarvis clone** | Multiple sub-agents on Claude | Runtime is **Hermes on Mac**; Cursor builds tools, doesn't host the agent |

## Honest gaps (Luke is right)

- **Customer support via raw Claude** — insufficient without always-on harness, memory, and skills. Defer until SupplyMe or explicit CS scope.
- **"Claude for everything"** — Nami stack already diverges: Hermes + Ollama + linkup MCP + Cursor for code. Don't duplicate Claude Agent SDK on Mac unless there's a clear win.
- **Voice on PC** — ElevenLabs `nami-speak` is build-time/demo; runtime voice = Hermes Mac first.

## Verify after shipping priorities 1–3

```bash
cd ~/Cursor/linkup_mcp
bash scripts/verify-nami-hermes.sh
# Manual: Telegram voice message → Hermes; ask agent to open a browser tab on Mac
```

## Source

- Transcript: `data/inbox/DZ5H6F1Rz1S.md`
- Workflow card: `data/inbox/DZ5H6F1Rz1S.workflow.md`
- Loop engineering: [LOOP_ENGINEERING.md](./LOOP_ENGINEERING.md) — `data/inbox/loop-engineering-sabrina.md`, `data/inbox/Ry3YyG22EUc.md`
- Surface map: [SURFACE_MAP.md](./SURFACE_MAP.md)
- Scorecard: [STATUS.md](./STATUS.md)
