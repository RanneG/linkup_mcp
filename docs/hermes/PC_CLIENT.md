# Using Nami from your Windows PC

**Runtime Nami lives on this PC** for now (Hermes gateway when the machine is on). **VPS migration** when you want 24/7 phone access — [VPS_MIGRATION.md](./VPS_MIGRATION.md).

Setup: **[PC_SETUP.md](./PC_SETUP.md)**.

## Telegram (phone + PC)

1. Install Hermes + run `install-nami-stack-pc.ps1` ([PC_SETUP.md](./PC_SETUP.md)).
2. `hermes gateway setup` + `Start-NamiGateway.ps1`.
3. Message Nami bot from phone or Telegram Desktop.

**Limit:** Telegram Nami is **offline when this PC is off**.

## Cursor (build-time Nami)

Full IDE + linkup_mcp MCP — no Hermes required for coding, but same repo and `.env`.

## Mobile build

Same PC — Hermes enqueues to `http://127.0.0.1:8770`. See [MOBILE_BUILD.md](./MOBILE_BUILD.md).

## What stays on PC

| Tool | Purpose |
|------|---------|
| **Hermes gateway** | Telegram runtime (while PC on) |
| **Cursor** | Build, debug, MCP |
| **nami_build_bridge** | Phone → agent jobs |
| **Stitch bridge** | OAuth, Gmail, face |

## Mac / VPS

- **Mac:** optional; stop its gateway if you duplicate the same Telegram bot.
- **VPS:** not provisioned yet — follow [VPS_MIGRATION.md](./VPS_MIGRATION.md) when ready.
