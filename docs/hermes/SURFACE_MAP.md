# Nami surface map — no redundant features

One personality (**Nami**). **PC = runtime + build (now).** VPS = future 24/7 runtime only.

## Who does what

| Job | **Cursor (PC)** | **Hermes (PC / Telegram)** |
|-----|-----------------|----------------------------|
| Edit code, git, PRs | **Primary** | Review after mobile build |
| Mobile build enqueue | **PC bridge** `:8770` | Same PC — localhost POST |
| Web search (Linkup) | MCP `web_search` | Hermes MCP `linkup` |
| RAG over your docs | MCP `rag` | Same via Hermes MCP |
| Stitch (OAuth, Gmail, face) | `stitch_rag_bridge.py` | PC only |
| Long-term memory | `AGENTS.md` in git | `%LOCALAPPDATA%\hermes\memories\` |
| Quick note on phone | — | Telegram (**PC must be on**) |
| 24/7 phone Nami | — | **Future VPS** — [VPS_MIGRATION.md](./VPS_MIGRATION.md) |

## Rule of thumb

- **Building** → Cursor on PC.
- **Living** (Telegram, memory, search) → Hermes on **same PC** while it's on.
- **Later:** move living to VPS; PC keeps building.

## What not to duplicate

| Avoid | Instead |
|-------|---------|
| Mac + PC + VPS all running same Telegram bot | One gateway only |
| Two Telegram bots for same profile | One Nami bot; Koshi separate |
| Provision VPS before you need 24/7 | [VPS_MIGRATION.md](./VPS_MIGRATION.md) triggers |

## Sync after `git pull`

**PC:**

```powershell
cd C:\Users\ranne\Cursor\cursor_linkup_mcp
git pull
.\scripts\install-nami-stack-pc.ps1
hermes gateway restart
```

See [STATUS.md](./STATUS.md).
