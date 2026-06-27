## Summary

- Harden Stitch subscription upserts so client IDs cannot take over another owner's row (from Bugbot PR #1).
- Add Nami/Hermes helper script regression tests and CI wiring (from Bugbot PR #31).
- Add **mobile build bridge**: Telegram/Hermes enqueue → PC Cursor Agent CLI → pytest → review in Cursor.
- Add Claude Code sidecar docs (optional; no extra subscription required).
- Add PR triage doc + script to close 29 duplicate `cursor/critical-*` Bugbot PRs after merge.

## Test plan

- [ ] `python -m pytest tests/test_subscription_store.py tests/test_nami_mcp_scripts.py tests/test_nami_build.py -q`
- [ ] `.\scripts\Test-NamiBuildEnqueue.ps1` with bridge running → `completed`
- [ ] After merge: `.\scripts\Close-StaleBugbotPrs.ps1 -DryRun` then close stale PRs

## Not included (stay local / follow-up PRs)

- `roblox/`, `music-videos/`, `dev_dashboard/`, `nami_game_lab/`
