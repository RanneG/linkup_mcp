# PR triage — linkup_mcp (2026-06-27)

**Situation:** 29 open PRs, all `cursor/critical-bug-*` branches (automated Bugbot / agent runs). Many overlap (5× Nami scripts, 5× voice prompt, 7× Stitch).

**Recommendation:** Close all 29 on GitHub after merging **one consolidated fix branch** (`chore/consolidate-bugbot-and-mobile-build`).

## Open PRs (newest first)

| # | Branch | Title | Action |
|---|--------|-------|--------|
| 31 | cursor/critical-bug-investigation-9934 | Nami Hermes helper script safety | **Merge tests** → consolidated branch |
| 30 | cursor/critical-bug-investigation-debf | Honor Ollama model in MCP RAG | Review diff; merge if not on main |
| 29–26 | cursor/critical-bug-investigation-* | Nami gateway/script safety (duplicates) | Close (superseded by #31) |
| 25–20 | cursor/critical-bug-investigation-* | Voice prompt fixes (5 PRs) | Close; cherry-pick later if needed |
| 19 | cursor/critical-bug-investigation-46be | OAuth refresh + WAV guard | Close for now |
| 18–15 | cursor/critical-* | RAG init / data dir | Close for now |
| 17–5 | cursor/critical-* | Stitch auth / face / bridge | Close for now; batch in follow-up PR |
| 2–1 | cursor/critical-bug-inspection-* | Subscription ownership | **Merge fix** → consolidated branch |

## Local untracked (not in consolidated PR)

| Path | Note |
|------|------|
| `roblox/` | Side project — keep local or separate repo |
| `music-videos/` | Asset pipeline — separate PR when ready |
| `data/_award_pdf_extract.txt` | Generated — gitignored |
| `data/inbox/*.info.json` | Reel metadata — optional commit `.md` only |

## Close PRs on GitHub (after consolidated PR merges)

```powershell
gh auth login
.\scripts\Close-StaleBugbotPrs.ps1 -DryRun
.\scripts\Close-StaleBugbotPrs.ps1
```

## Push consolidated branch

```powershell
git push -u origin chore/consolidate-bugbot-and-mobile-build
gh pr create --title "Mobile build bridge + subscription ownership hardening" --body-file docs/dev/PR_CONSOLIDATED_BODY.md
```
