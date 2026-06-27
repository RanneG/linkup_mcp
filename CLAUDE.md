# Claude Code — sidecar context (linkup_mcp)

Read **`AGENTS.md`** first. You are **build-time sidecar** — **Cursor** remains default for interactive feature work (diffs, UI, Stitch/Tauri).

Runtime Nami lives on **Hermes (Mac + Telegram)** — do not duplicate scheduled loops here.

Full setup: **`docs/dev/CLAUDE_CODE.md`**.

## Your lanes (Claude Code only)

| Lane | Job | Done looks like |
|------|-----|-----------------|
| **A — CI loop** | Fix tests until green | `pytest` exit 0; evidence in output |
| **B — Reel ingest** | `scripts/transcribe_reel.py <url>` | `data/inbox/{slug}.md` + `.workflow.md` |
| **C — Council** | Hard decisions only (architecture, security, tool choice) | Read-only synthesis; **no file edits** |

**Not your lane:** feature UI, Hermes skills, Telegram sends, commits (unless Ranne explicitly asks).

## Council discipline

Use council (multi-persona or chairman synthesis) only when Ranne invokes it. Never for one-line fixes or routine refactors — token-heavy, low marginal value.

## Checker (before claiming done)

Run a loop-check pass using **`hermes-nami/skills/loop-checker.md`** format:

1. Restate goal in one sentence.
2. List done criteria with evidence (test output, file paths).
3. Confirm turn cap honored.
4. Verdict: PASS or FAIL.

Do not grade your own homework in one pass — fix, re-run tests, then check.

## Billing

Unattended loops (Lane A/B) should use a **separate `ANTHROPIC_API_KEY`** when possible — see `scripts/Start-ClaudeCiLoop.ps1 -UseApiKey`. Interactive subscription budget is for watched work.

## Constraints

- Secrets stay in **`.env`** — never print or commit keys.
- **Read-only on `.env`** unless Ranne asks to add a documented var from `ENV_TEMPLATE.md`.
- Match existing code style; minimal diffs.
- Run **`pytest`** (or the loop’s stated checker) before saying done.
- **Never `git commit`** unless Ranne explicitly requests it.

## MCP

If `linkup-server` is configured, you may use **`web_search`** and **`rag`** — same tools as Cursor. Mirror config in `docs/dev/CLAUDE_CODE.md`.
