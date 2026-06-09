# Hermes + Nami on Mac (runtime host)

**Hermes runs on the MacBook only.** Windows PC = Cursor + linkup_mcp (build-time Nami). Use runtime Nami from PC via **Telegram** or **SSH**.

## Architecture

```
┌─────────────────┐         ┌──────────────────────────────┐
│  Windows PC     │         │  MacBook                     │
│  Cursor + MCP   │         │  Hermes (~/.hermes)          │
│  linkup_mcp dev │         │  memory, skills, gateway     │
└────────┬────────┘         └──────────────┬───────────────┘
         │                                 │
         │    Telegram (primary)           │
         └──────────────►──────────────────┤
         │    SSH: ssh mac → hermes        │
         └──────────────►──────────────────┘
```

## 1. Install Hermes (Mac)

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.zshrc   # or ~/.bashrc
hermes --version
hermes doctor
```

## 2. Nous Portal (model + Tool Gateway)

```bash
hermes setup --portal
```

Press Enter on a free curated model for v1; change later with `hermes model`.

## 3. Install Nami personality (from linkup_mcp clone)

Assumes repos beside each other (`~/Cursor/linkup_mcp`, `~/Cursor/supplyme-crew` — adjust paths):

```bash
LINKUP=~/Cursor/linkup_mcp
SUPPLY=~/Cursor/supplyme-crew

mkdir -p ~/.hermes/skills
cp "$LINKUP/hermes-nami/SOUL.md" ~/.hermes/SOUL.md
cp "$LINKUP/hermes-nami/AGENTS.md" ~/.hermes/AGENTS.md
cp "$SUPPLY/skills/weekly-focus.md" ~/.hermes/skills/
```

Or run from linkup_mcp:

```bash
cd ~/Cursor/linkup_mcp
bash scripts/install-nami-hermes.sh
```

## 4. Smoke test (Mac terminal)

```bash
hermes
```

Try: *"What should I focus on this week?"*

Memory: [MEMORY.md](./MEMORY.md). No email/social in v1 (`hermes-nami/config.yaml`).

## 5. Use from Windows PC

See **[PC_CLIENT.md](./PC_CLIENT.md)** — Telegram (recommended) or SSH into Mac.

## 6. Telegram gateway (when ready)

On **Mac only**:

```bash
hermes gateway setup    # BotFather token, allowlist your user id
hermes gateway start
# Optional: hermes gateway install   # launchd — survives logout
```

Then message the bot from **Telegram Desktop on PC** or phone — same runtime Nami.

No Gmail/WhatsApp until you flip `channels` in `hermes-nami/config.yaml`.

## 7. linkup_mcp MCP (next)

Clone linkup_mcp on Mac if not already. Add MCP server per [Hermes MCP docs](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp) pointing at `server.py` (stdio). Same tools as Cursor: search + RAG.

## 8. Bella voice (optional)

ElevenLabs stays in linkup_mcp `.env` on whichever machine runs `nami-speak`. Wire as a Hermes skill/shell hook later — not required for v1.

## Clone paths on Mac

```bash
git clone https://github.com/RanneG/linkup_mcp.git ~/Cursor/linkup_mcp
git clone https://github.com/RanneG/supplyme-crew.git ~/Cursor/supplyme-crew
```

Keep `hermes-nami/` in git — Mac pulls updates via `git pull`, re-run `install-nami-hermes.sh`.
