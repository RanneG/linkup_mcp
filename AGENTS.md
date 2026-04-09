# Agent handoff (Ranne ↔ Nami)

This file is the **source of truth** for who is in the loop and how to work in this repo when a chat session starts cold. If something important changes (stack, MCP name, your preferences), update this file in the same PR as the change.

## People

| Role | Name | Notes |
|------|------|--------|
| Human | **Ranne** | Owner; treat goals and constraints as authoritative. |
| AI assistant in Cursor | **Nami** | Operate like a capable build partner: execute with tools, prefer doing over lecturing, stay precise and honest about limits. |

The **Jarvis / Iron Man** framing is about partnership and execution quality—not comic roleplay. Keep tone professional, warm, and concise.

## Project in one paragraph

**cursor_linkup_mcp** is a Python MCP server for Cursor: **web search** via Linkup, **RAG** over `data/` via LlamaIndex + Ollama (`server.py`, `rag.py`). Package and commands are in `README.md` and `.cursorrules`. Reuse libraries from Ranne’s GitHub ecosystem when building adjacent features (see `.cursorrules`).

## Where else to look

- **`.cursorrules`** — detailed setup, MCP tool list, Cursor `mcp.json` snippet, related repos.
- **`.cursor/rules/*.mdc`** — short rules Cursor loads automatically (identity, defaults).
- **`ENV_TEMPLATE.md`** — env vars if present.

## Continuity checklist (for Nami in a new thread)

1. Read this file first when Ranne says “handoff”, “cold start”, or scope is unclear.
2. Prefer **repo truth** over guessing (read files, run commands).
3. **`user-linkup-server`** MCP may be available in this workspace—check tool schemas before calling.
4. When Ranne asks to **remember something across sessions**, persist it here or in `.cursor/rules/` (concise, actionable), not only in chat.

## OpenClaw (separate from this repo)

Ranne is moving personal agent / PKM work to **OpenClaw**, with a **dedicated Mac** as a risk-aware host (see prior discussions on separation). This MCP repo stays focused on Cursor Linkup + RAG; OpenClaw is orchestration, channels, and skills elsewhere.

**Status:** Day-to-day work may be on **Windows**; **OpenClaw is meant to be installed on the Mac**, not assumed on this machine. When Ranne is on the Mac, he will use the **official site / docs** (and may paste the docs link into chat)—treat that as authoritative over videos or old notes.

**Official entry points (bookmark on the Mac):**

- Site + install options: https://openclaw.ai/ (Quick Start: `curl -fsSL https://openclaw.ai/install.sh | bash`, or `npm i -g openclaw` then `openclaw onboard`; site notes the one-liner can install Node and that **on macOS the first run may need an Administrator for Homebrew**).
- Docs: https://docs.openclaw.ai/getting-started  
- Companion **.app** (menubar): https://github.com/openclaw/openclaw/releases/latest — page states **macOS 15+**, Universal Binary.

**Mac prep *before* downloading OpenClaw (check docs again on the day—you want the current requirements):**

1. **macOS** — Update to a supported version; if you plan to use the **GitHub companion app**, plan for **macOS 15+** per releases page.
2. **Admin access** — Know the password for the account that can approve installs; the official install flow may invoke **Homebrew** and need admin on first run.
3. **Disk space** — Comfortable free space (local models via Ollama can consume **tens of GB** later).
4. **Apple ID / recovery** — Ensure you can unlock the machine and recover if FileVault/backup matters to you.
5. **Optional isolation** — Create a **standard (non-admin)** macOS user dedicated to OpenClaw *before* installing, if you want separation without a second machine.
6. **Xcode Command Line Tools** — If you ever use the **git clone + pnpm build** path from the site, install CLT (`xcode-select --install`). Skip if you only use the curl installer or global npm.
7. **Secrets** — Have a **password manager** ready for API keys; do not store keys in this repo.
8. **Baseline security** — **FileVault** on; decide firewall posture before exposing anything beyond localhost.

**Reference videos (Adrian Twarog — content below is from transcripts, not “watching” pixels):**

1. [OpenClaw Tutorial for Beginners — Crash Course](https://www.youtube.com/watch?v=u4ydH-QvPeg) (~8 min) — install, models, TUI vs web UI, WhatsApp/Telegram, Zapier MCP, security callouts, Ollama/local default model, opening the OpenClaw workspace in Cursor.
2. [OpenClaw Use Cases That You Must Try](https://www.youtube.com/watch?v=mTDt_30qAps) (~10 min) — morning brief, proactive research, competitor/market analysis, scheduling, monitoring, VPS vs local, MCP/Zapier for scoped tool access, Ollama for cost/privacy, CMS/shared knowledge for multi-agent.

**Compressed playbook (verify against current OpenClaw docs at install time):**

- Install via project **quick start** CLI; first run walks model provider (e.g. Anthropic API), optional skills skip initially, then **terminal vs web UI**.
- **Channels:** `openclaw channels add` — WhatsApp (QR; presenter recommends non-personal number), Telegram via @BotFather token.
- **MCP pattern:** connect a **broker** (e.g. Zapier MCP) so tool surface is **narrow** (e.g. Gmail read + draft only) vs raw API access—aligns with Ranne’s risk posture. **Third-party skills:** treat as untrusted supply chain; presenter cites scam/honey-pot risk—be skeptical of exact percentages, but the caution is valid.
- **Local models:** Ollama + large local model option to cut cloud cost; trade speed/quality vs API. Matches Mac-mini style isolation in the first video.
- **Workspace:** OpenClaw’s folder in Cursor for config, sessions, MCP, cron-like jobs; optional private Git backup of **non-secret** config (never commit keys).
- **Use-case video** pitches **cloud VPS for 24/7** vs always-on home PC; **Ranne’s dedicated Mac** is a deliberate isolation choice—reconcile with uptime and exposure (localhost gateway, no public admin UI, etc.) per official hardening guides.

When helping Ranne with OpenClaw, **prefer official OpenClaw documentation + his live `openclaw` version** over video details (commands and UIs change).

## Cursor (Nami) vs OpenClaw `AGENTS.md`

- **This file** in the **`cursor_linkup_mcp`** repo is **canonical** for Ranne ↔ **Nami** handoff, MCP setup, GitHub ecosystem links, and anything that should live in **git** and ship to **GitHub**. **On GitHub:** https://github.com/RanneG/linkup_mcp/blob/main/AGENTS.md
- **`~/.openclaw/workspace/AGENTS.md`** begins with a **pointer** to this file (GitHub URL + local clone path), then keeps **OpenClaw-only** runtime: memory layout, heartbeats, cron programs, `TOOLS.md`, channel behavior.

There is **no automatic sync** between apps. When **shared** expectations change, edit **this** `AGENTS.md`, commit, and push; update the OpenClaw workspace only for **gateway-specific** behavior. On a new machine, fix the **local path** in the OpenClaw pointer if the repo is not at the same location.

## Maintenance

- Keep `AGENTS.md` short; link out for long setup steps.
- Avoid secrets in this repo—use `.env` (gitignored).
