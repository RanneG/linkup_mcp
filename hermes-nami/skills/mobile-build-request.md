# Skill — mobile build requests (Telegram → PC worker)

When Ranne asks to **build**, **implement**, **add a feature**, or **fix code in a repo** from Telegram — not just Q&A — use the **mobile build loop**.

Full setup: [MOBILE_BUILD.md](../../docs/hermes/MOBILE_BUILD.md).

## When to use

| Ranne says | Action |
|------------|--------|
| "Add X to linkup_mcp / stitch / …" | Enqueue build |
| "Fix the failing tests" (from phone) | Enqueue build with repo + task |
| "What port is the bridge?" | **RAG only** — not a build |
| "Remember this priority" | **Memory** — not a build |

## Preconditions

1. PC build bridge running (`nami_build_bridge.py` on port **8770**).
2. **`NAMI_BUILD_PC_URL`** and **`NAMI_BUILD_TOKEN`** in Mac Hermes env (see MOBILE_BUILD.md).
3. PC reachable (Tailscale when away from home).

If bridge unreachable: say so clearly; offer to capture the task in memory for later — do **not** pretend code was changed on Mac.

## Enqueue (shell on Mac)

```bash
curl -sS -X POST "${NAMI_BUILD_PC_URL}/api/build/enqueue" \
  -H "Authorization: Bearer ${NAMI_BUILD_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"task":"TASK HERE","source":"telegram","repo":"linkup_mcp","turn_cap":8}'
```

Replace `TASK HERE` with Ranne's exact request, scoped and concrete.

## Poll status

```bash
curl -sS "${NAMI_BUILD_PC_URL}/api/build/jobs/JOB_ID" \
  -H "Authorization: Bearer ${NAMI_BUILD_TOKEN}"
```

Poll every ~30s until `status` is `completed` or `failed` (max ~15 min, then stop and report partial).

## Telegram reply format

**On enqueue:**

> Build queued (`abc123`). PC will run Cursor agent + pytest. I'll update when done.

**On completed:**

> Build ready — review in Cursor on branch `nami/build-abc123`.
> Summary: …
> Tests: green

**On failed:**

> Build failed (`abc123`): …
> Check PC: CURSOR_API_KEY, cursor-sdk, pytest output.

## Limits

- **Turn cap:** default 8 — do not raise above 12 without Ranne asking.
- **No auto-commit** — Ranne reviews diff in Cursor.
- **Repos:** default `linkup_mcp`; other repos only if Ranne names path and PC has clone.
- **Do not** run long builds on Mac Ollama — execution is **PC only**.

## Checker before telling Ranne "done"

1. Job status is `completed` or `failed` (not `pending`/`running`).
2. Cite `result_summary` from job JSON — no invented file lists.
3. If tests failed, verdict is **FAIL** — do not say ready for review.

## Pair with

- [linkup-mcp.md](./linkup-mcp.md) — RAG/search when scoping the task first.
- [loop-checker.md](./loop-checker.md) — before claiming build done.
