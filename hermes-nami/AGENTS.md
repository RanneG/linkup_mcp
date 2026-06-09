# Project context — Nami (Ranne)

Canonical handoff for build-time Nami: **linkup_mcp/AGENTS.md** on GitHub.

## Owner

- **Ranne** — authoritative goals and constraints.
- **Timezone:** Europe/London (adjust in memory if wrong).

## Active repos (dev-tools focus)

| Repo | Role |
|------|------|
| **linkup_mcp** | MCP server, Stitch bridge, ElevenLabs/Nami voice |
| **supplyme-crew** | Hermes product blueprint (tenants, skills) |
| **stitch-app** | Subscription desktop UI |
| **pixel-portfolio** | Maintenance only unless asked |

## Workstreams (Telegram desks — optional later)

When Telegram topics are configured, route by area:

| Desk | Covers |
|------|--------|
| **Build** | linkup_mcp, MCP, Hermes, OpenClaw/Hermes migration |
| **Products** | Stitch, SupplyMe, standup-bot |
| **This week** | ONE priority + park list |

## Tools

- **MCP:** linkup_mcp (`web_search`, RAG) — add via `hermes mcp add` when configured.
- **Voice:** ElevenLabs Bella (`NAMI_VOICE_ID` in linkup_mcp `.env`) — not auto-wired.

## Constraints

- Secrets stay in `.env` — never commit or paste into chat logs.
- No email/social gateways until Ranne enables them in config.
