# Hermes + Nami — honest status

Last reviewed: 2026-06-27.

## Architecture mode

**Current:** PC-local runtime + build ([PC_SETUP.md](./PC_SETUP.md)).  
**Future:** VPS for 24/7 — [VPS_MIGRATION.md](./VPS_MIGRATION.md) (not provisioned).

## Scorecard (1–5)

| Area | Score | Notes |
|------|-------|-------|
| **Runtime host (PC)** | 2/5 | Docs + scripts ready; Hermes reinstall on PC todo |
| **PC mobile build bridge** | 4/5 | Merged; localhost enqueue |
| **linkup_mcp ↔ Hermes MCP** | 3/5 | `install-nami-mcp-pc.ps1` — run after Hermes install |
| **RAG corpus** | 4/5 | `nami_corpus.sync` |
| **Gateway reliability** | 2/5 | Manual start; PC off = Nami off (accepted) |
| **VPS migration plan** | 4/5 | [VPS_MIGRATION.md](./VPS_MIGRATION.md) + [VPS_SETUP.md](./VPS_SETUP.md) |

## Todo (PC local — now)

- [ ] `iex (irm https://hermes-agent.nousresearch.com/install.ps1)`
- [ ] `.\scripts\install-nami-stack-pc.ps1`
- [ ] `hermes gateway setup` + `Start-NamiGateway.ps1`
- [ ] `%LOCALAPPDATA%\hermes\.env` — mobile build localhost ([MOBILE_BUILD_PC.env.example](./MOBILE_BUILD_PC.env.example))
- [ ] Stop Mac gateway if same bot token (avoid duplicates)

## Todo (VPS — when needed)

- [ ] Read [VPS_MIGRATION.md](./VPS_MIGRATION.md) triggers
- [ ] Provision Hetzner CPX22+ / follow [VPS_SETUP.md](./VPS_SETUP.md)
- [ ] Cutover + stop PC gateway

## Verify (PC)

```powershell
hermes doctor
hermes gateway status
hermes mcp test linkup
```
