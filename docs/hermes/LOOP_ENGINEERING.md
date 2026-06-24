# Loop engineering — mapped to Nami stack

Concept sources:

- [Sabrina Ramonov — Loop engineering + Claude Code `/goal` + Routines](https://www.sabrina.dev/p/loop-engineering-claude-code-goal-routines) → `data/inbox/loop-engineering-sabrina.md`
- [YouTube walkthrough](https://www.youtube.com/watch?v=Ry3YyG22EUc) → `data/inbox/Ry3YyG22EUc.md`

Complements [REEL_BACKLOG.md](./REEL_BACKLOG.md) (Luke Jarvis / Hermes runtime) — same *shape*, different vocabulary.

---

## What it is

**Prompt engineering** = one good message at a time; *you* are the loop (type → read → type).

**Loop engineering** = design the system that prompts the AI: **do work → check → repeat** until a verifiable goal is met, optionally on a **schedule** without you present.

Named by **Addy Osmani** (June 2026). The hard part is not the model — it is the **checker**: a clear “done” state and a proof the AI can run.

### Six parts (Sabrina / Claude Code)

| Part | Meaning |
|------|---------|
| Automations | Trigger on timer or event |
| Worktrees | Isolated areas for parallel work |
| Skills | Saved playbooks for recurring tasks |
| Connectors | Real tools (Gmail, Slack, MCP, browser) |
| Sub-agents | Doer + separate checker |
| Memory | State outside the chat thread |

### Closed vs open loops (video)

| Type | Behavior | When to use |
|------|----------|-------------|
| **Closed** | Bounded goal, visible path, check each step | Default — token-safe, predictable |
| **Open** | Agent discovers its own next work | High budget only; easy runaway |

Always **cap iterations** (turn limit, time box, or “stop after N tool calls”).

---

## Claude Code vs Ranne stack

Sabrina’s stack is **Claude Code `/goal` + cloud Routines**. Ranne’s runtime is **Hermes + Ollama on Mac**; build-time is **Cursor + linkup_mcp**. Same loop *pattern*, different hosts.

| Loop part | Claude Code | **Hermes (Mac runtime)** | **Cursor (build-time Nami)** |
|-----------|-------------|--------------------------|------------------------------|
| Automations | Routines @ claude.ai | Heartbeat / cron / `hermes gateway install` | `.cursor` rules, skills, optional Automations |
| Goal + check | `/goal` + fast verifier | Skill with explicit done criteria + sub-agent review | Agent task with test/lint as checker |
| Skills | Claude skills | `hermes-nami/skills/*.md` | `.cursor/skills/`, `AGENTS.md` |
| Connectors | Gmail, Slack plugins | MCP `linkup` (search, RAG), browser (`/browser`) | MCP `web_search`, `rag`, repo tools |
| Sub-agents | Spawned sessions | Hermes workers (research, build notes) | Cursor `Task` subagents |
| Memory | Repo / notes file | `~/.hermes/memories/`, `MEMORY.md` | Git `AGENTS.md`, rules, `data/nami-corpus/` |
| Worktrees | Claude worktrees | Parallel Hermes tasks / isolated profiles (`koshi`) | Git branches, worktrees, PR slices |

**Do not duplicate:** Claude Routines on Mac *and* Hermes heartbeats for the same job. Pick **one runtime loop host** — Hermes for living (Telegram, brief, memory); Cursor for shipping code.

---

## How this complements the reel backlog

[REEL_BACKLOG.md](./REEL_BACKLOG.md) items are loop ingredients:

| Reel backlog item | Loop role |
|-------------------|-----------|
| Hermes voice | Lower friction to *start* a loop from phone |
| Browser connect | Connector for research / read-only checks |
| Sub-agents + skills | Doer + checker split |
| Daily brief routine | **Automation + closed loop** — the first real loop |
| Gateway launchd | Loop must survive reboot (24/7 timer) |

Loop engineering gives **design language** for those tasks: every routine needs **starts when**, **done looks like**, **the check**, **turn cap**, **read-only first**.

---

## Ranked next actions (leverage)

### Mac Hermes (runtime loops)

| # | Action | Why |
|---|--------|-----|
| 1 | **Ship daily brief as first closed loop** — skill: [daily-brief-loop.md](../../hermes-nami/skills/daily-brief-loop.md); read-only Telegram digest from RAG + memory; done = “3 bullets + 0 sends” | Smallest autonomous agent; matches Sabrina routine + Luke “brief by sit-down” |
| 2 | **`hermes gateway install` (launchd)** | Without reliable timer, loops die on reboot |
| 3 | **Checker skill** — [loop-checker.md](../../hermes-nami/skills/loop-checker.md): verify goal before posting/sending | Implements “don’t grade your own homework” |
| 4 | **Sub-agent split** — main Nami delegates research scout; orchestrator synthesizes (video pattern) | After brief works; reuse for weekly RAG eval summary |
| 5 | **Browser + voice** | Connectors that make loops useful beyond chat |

### Cursor / PC (build-time loops)

| # | Action | Why |
|---|--------|-----|
| 1 | **Corpus sync after doc changes** — `build_nami_rag_corpus.py` | Memory layer for Hermes loops |
| 2 | **Reel → workflow pipeline** — `transcribe_reel.py` | Ingest loop-engineering sources into RAG inbox |
| 3 | **Explicit done criteria in rules** — e.g. “run tests before claiming done” | Cursor-native checker |
| 4 | **Optional:** small `slug_from_url` YouTube ID fix | Cleaner `data/inbox/{videoId}.md` names |

### Defer (product or Claude-specific)

- Claude Code `/goal` and cloud Routines — useful reference, not Nami v1 host
- Open-ended orchestrator fleets (pickleball demo scale) — after one closed loop ships
- RevenueCat / ads / CS loops — [REEL_BACKLOG.md](./REEL_BACKLOG.md) deferred lane

---

## First loop template (copy to Hermes skill)

**Shipped specs:** [daily-brief-loop.md](../../hermes-nami/skills/daily-brief-loop.md) (routine) + [loop-checker.md](../../hermes-nami/skills/loop-checker.md) (checker pass).

Generic scaffold for **new** routines:

```markdown
## Loop: <name>

**Starts when:** <cron / heartbeat / Telegram command>
**Done looks like:** <verifiable end state>
**The check:** <how agent proves done — counts, file exists, template filled>
**Turn cap:** <max tool rounds or time>
**Limits:** read-only; do not send email; do not delete
**Memory:** append summary to ~/.hermes/memories/LOOP_LOG.md
**Checker:** <separate skill or sub-agent pass before Telegram send>
```

Sabrina cheatsheet maps 1:1: Cheatsheet 1 → goal sentence; Cheatsheet 2 → `/goal` style finish line; Cheatsheet 3 → routine with connectors.

---

## Hermes install/config vs Cursor rules

| Lives on Mac Hermes | Lives in Cursor / git |
|---------------------|------------------------|
| Heartbeat / cron / launchd gateway | `AGENTS.md`, `.cursor/rules/` |
| `~/.hermes/memories/` curation | `hermes-nami/memories/` seeds |
| Telegram allowlist + runtime skills | `hermes-nami/skills/` (sync via install script) |
| MCP `linkup` registration | `server.py`, MCP `mcp.json` on PC |
| Browser allowlist + security posture | Docs only (`REEL_BACKLOG`, this file) |
| Loop execution logs | `data/inbox/*.workflow.md`, corpus for RAG |

**Install path (Mac):** after pulling — `bash scripts/install-nami-stack-mac.sh` (syncs skills), then wire heartbeat/cron to [daily-brief-loop.md](../../hermes-nami/skills/daily-brief-loop.md).

---

## Verify

```bash
cd ~/Cursor/linkup_mcp
bash scripts/verify-nami-hermes.sh
# Manual: trigger daily brief once; confirm read-only output on Telegram
```

See [STATUS.md](./STATUS.md) for scorecard and [SURFACE_MAP.md](./SURFACE_MAP.md) for surface ownership.
