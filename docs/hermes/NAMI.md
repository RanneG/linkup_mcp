# Nami — personal assistant (phone, PC)

One **Nami** personality. **Windows PC** = runtime + build (for now). **VPS** = future 24/7 migration — [VPS_MIGRATION.md](./VPS_MIGRATION.md).

## Surfaces

| Device | How you talk to Nami | What she can do |
|--------|----------------------|-----------------|
| **Phone** | Telegram → Nami bot | Memory, skills, MCP — **when PC + gateway are on** |
| **PC** | Cursor + Telegram + Hermes TUI | Full IDE, runtime gateway, mobile-build bridge |
| **Mac** | Optional | Not required — can stay off |
| **VPS** | Future | 24/7 Telegram — see migration plan |

**Runtime host (now):** **Windows PC** — [PC_SETUP.md](./PC_SETUP.md).  
**Build host:** Same PC — Cursor, git, `nami_build_bridge`, Stitch.

```
                    ┌─────────────────────────────────┐
                    │  Windows PC (when on)            │
                    │  Hermes + gateway → Telegram     │
                    │  Cursor + build bridge :8770     │
                    │  linkup_mcp MCP                  │
                    └───────────────┬─────────────────┘
                                    │
              📱 Phone ── Telegram ──┘
              💻 Cursor chat (same box)
```

**Separate:** `koshi` profile = Koshi Crew. Never share bot tokens with Nami.

---

## Current state

| Item | Status |
|------|--------|
| Hermes on PC (default = Nami) | **Todo** — [PC_SETUP.md](./PC_SETUP.md) |
| Telegram Nami while PC on | Target mode |
| Telegram Nami while PC off | **Deferred** — [VPS_MIGRATION.md](./VPS_MIGRATION.md) |
| PC mobile build bridge | Done — [MOBILE_BUILD.md](./MOBILE_BUILD.md) |
| Mac runtime | Retired unless you turn Mac back on |
| VPS runtime | Planned — [VPS_SETUP.md](./VPS_SETUP.md) |

---

## Phase 1 — PC stack

```powershell
cd C:\Users\ranne\Cursor\cursor_linkup_mcp
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
.\scripts\install-nami-stack-pc.ps1
hermes gateway setup
.\scripts\Start-NamiGateway.ps1
```

Details: [PC_SETUP.md](./PC_SETUP.md).

---

## Phase 2 — Memory

| File | Location |
|------|----------|
| `MEMORY.md` | `%LOCALAPPDATA%\hermes\memories\` |
| `USER.md` | same |

Seed: `install-nami-hermes.ps1`. Details: [MEMORY.md](./MEMORY.md).

---

## Phase 3 — Mobile build (localhost)

Hermes and bridge on the **same PC** — `NAMI_BUILD_PC_URL=http://127.0.0.1:8770`.  
See [MOBILE_BUILD_PC.env.example](./MOBILE_BUILD_PC.env.example).

---

## Daily use

| I want to… | Do this |
|------------|---------|
| Quick note on the go | Telegram → Nami (**PC must be on**) |
| Build from phone | PC on + gateway + `Start-NamiBuildBridge.ps1` |
| Code | Cursor |
| Hermes TUI | `hermes` in terminal |
| Plan 24/7 phone Nami | Read [VPS_MIGRATION.md](./VPS_MIGRATION.md) |

---

## Related docs

- **[PC_SETUP.md](./PC_SETUP.md)** — current runtime
- **[VPS_MIGRATION.md](./VPS_MIGRATION.md)** — when to move gateway to cloud
- [PC_CLIENT.md](./PC_CLIENT.md) — how surfaces fit together
- [MOBILE_BUILD.md](./MOBILE_BUILD.md) — async builds
