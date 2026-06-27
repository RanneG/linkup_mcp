# Claude Code sidecar (Windows PC)

**Cursor** = default IDE agent (features, diffs, MCP in chat).  
**Claude Code** = terminal sidecar for **closed loops** (CI fix, reel ingest, council).  
**Hermes** = runtime on Mac (Telegram, briefs) — not Claude Routines.

Surface map: [SURFACE_MAP.md](../hermes/SURFACE_MAP.md). Loop pattern: [LOOP_ENGINEERING.md](../hermes/LOOP_ENGINEERING.md).

## Install

1. Install [Claude Code](https://docs.anthropic.com/en/docs/claude-code) on Windows.
2. Confirm CLI: `claude --version`
3. From repo root: `cd C:\Users\ranne\Cursor\cursor_linkup_mcp` then `claude`
4. Project instructions load from repo-root **`CLAUDE.md`** automatically.

## Billing split (important)

| Usage | Billing |
|-------|---------|
| Cursor feature work | Cursor subscription |
| Claude.ai chat | Claude Pro/Max |
| **Unattended CI / ingest loops** | Prefer **`ANTHROPIC_API_KEY`** (separate API budget) |
| Hermes / Ollama | Local on Mac |

Pro/Max shared pools can burn interactive budget on 8-turn CI loops. Use **`scripts/Start-ClaudeCiLoop.ps1 -UseApiKey`** for Lane A so subscription stays for watched work.

Optional: add `ANTHROPIC_API_KEY=...` to `.env` (gitignored); the script loads it only when `-UseApiKey` is set.

## MCP (mirror Cursor)

Add to Claude Code MCP config (user or project — see Anthropic docs for path). Mirror Cursor’s `linkup-server`:

```json
{
  "mcpServers": {
    "linkup-server": {
      "command": "C:\\Users\\ranne\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe",
      "args": [
        "-m", "uv", "run",
        "--directory", "C:\\Users\\ranne\\Cursor\\cursor_linkup_mcp",
        "python", "server.py"
      ],
      "cwd": "C:\\Users\\ranne\\Cursor\\cursor_linkup_mcp"
    }
  }
}
```

Adjust Python path and `--directory` if your clone path differs. Requires Ollama + `llama3.2` for RAG tools.

Tools: **`web_search`** (Linkup key in `.env`), **`rag`** (local docs under `data/`).

## Job routing

| Task | Tool |
|------|------|
| Multi-file features, Stitch/Tauri, inline review | **Cursor** |
| CI until green, reel → inbox, git worktree slices | **Claude Code** |
| Daily brief, Telegram, scheduled memory | **Hermes (Mac)** |

### Lane A — CI loop (start here)

```powershell
.\scripts\Start-ClaudeCiLoop.ps1
# API billing for unattended loops:
.\scripts\Start-ClaudeCiLoop.ps1 -UseApiKey
```

Or manually in `claude`:

```text
/goal Fix failing tests on this branch. Done = pytest exits 0.
Turn cap: 8. Read-only on .env. Run pytest after each fix. Read CLAUDE.md.
Do not commit unless Ranne asks.
```

### Lane B — Reel ingest

```text
Transcribe <instagram-or-youtube-url> with: python scripts/transcribe_reel.py "<url>"
Summarize lessons in 5 bullets. Done = data/inbox/{slug}.md + .workflow.md exist.
Do not commit binary media.
```

### Lane C — Council (hard decisions only)

Read-only. Architecture, security, tool choice — not bugfixes.

Optional skill: [tenfoldmarc/llm-council-skill](https://github.com/tenfoldmarc/llm-council-skill).  
Karpathy reference: [karpathy/llm-council](https://github.com/karpathy/llm-council).

## Two-week experiment

| Week | Task | Tool | Pass criteria |
|------|------|------|---------------|
| 1 | One CI fix loop | Claude Code (`-UseApiKey`) | Green pytest; ≤2 manual interventions |
| 1 | One feature slice | Cursor | Merged as usual |
| 2 | One reel ingest | Claude Code | Useful `data/inbox/*.workflow.md` |
| 2 | One council review | Claude Code | Synthesis only; no stray edits |

Track: minutes to green, intervention count, “would use again?”

**Exit rule:** If Claude Code does not beat Cursor on Lane A, drop the sidecar — keep Cursor + Hermes only.

## Defer (phase 2)

- Claude Routines on a schedule (Hermes owns cron)
- Mac SSH Claude Code sessions
- Council skill installed by default
- Multi-worktree orchestration scripts

## Related files

- **`CLAUDE.md`** — agent instructions at repo root
- **`scripts/Start-ClaudeCiLoop.ps1`** — prefilled CI loop launcher
- **`hermes-nami/skills/loop-checker.md`** — checker format before “done”
