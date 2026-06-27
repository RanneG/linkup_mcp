# Hermes + Nami — where things run

| Machine | Role |
|---------|------|
| **Linux VPS** | **Runtime Nami** — Hermes, memory, Telegram gateway 24/7 → [VPS_SETUP.md](./VPS_SETUP.md) |
| **Windows PC** | **Build-time Nami** — Cursor + linkup_mcp + mobile-build bridge → [PC_CLIENT.md](./PC_CLIENT.md) |
| **MacBook** | Optional spare — not required if VPS is live → [MAC_SETUP.md](./MAC_SETUP.md) |

Hermes is **not** installed on Windows (offloaded intentionally).

## Quick links

- **VPS install (primary):** [VPS_SETUP.md](./VPS_SETUP.md)
- **Use from PC:** [PC_CLIENT.md](./PC_CLIENT.md)
- **Memory:** [MEMORY.md](./MEMORY.md)
- **Personality templates:** `hermes-nami/` in repo root

## Windows helper script

`scripts/hermes.ps1` only runs if a local install exists; otherwise it points you to VPS setup.
