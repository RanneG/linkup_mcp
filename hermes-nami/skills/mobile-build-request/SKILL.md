---
name: mobile-build-request
description: "Enqueue PC Cursor agent jobs from Telegram."
version: 1.0.0
author: RanneG
metadata:
  hermes:
    tags: [nami, build]
    category: devops
---

# Mobile build requests (Telegram to PC worker)

When Ranne asks to **build**, **implement**, or **fix code** from Telegram — not Q&A.

## When to use

| Ranne says | Action |
|------------|--------|
| Add X to linkup_mcp / stitch | Enqueue build |
| Fix failing tests from phone | Enqueue build |
| What port is the bridge? | **RAG only** |
| Remember this priority | **Memory only** |

## Preconditions

1. PC bridge on port **8770**.
2. `NAMI_BUILD_PC_URL` + `NAMI_BUILD_TOKEN` in Hermes `.env` (usually `http://127.0.0.1:8770`).
3. PC on.

## Enqueue

```bash
curl -sS -X POST "${NAMI_BUILD_PC_URL}/api/build/enqueue" \
  -H "Authorization: Bearer ${NAMI_BUILD_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"task":"TASK","source":"telegram","repo":"linkup_mcp","turn_cap":8}'
```

Poll job until `completed` or `failed` (max ~15 min).

## Do not

- Pretend code changed if bridge unreachable.
- Run builds on Hermes host — execution is PC only.
