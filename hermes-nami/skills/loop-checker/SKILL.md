---
name: loop-checker
description: "Verify closed loops before Telegram send or done claims."
version: 1.0.0
author: RanneG
metadata:
  hermes:
    tags: [nami, loop]
    category: productivity
---

# Loop checker

Use on **every closed loop** before posting to Telegram or claiming done.

## When to run

| Trigger | Action |
|---------|--------|
| Loop about to send Telegram message | Run checklist; abort send if any fail |
| Turn cap hit without pass | Stop; report partial — do not improvise |
| Ranne asks if loop is done | Re-run against loop **Done looks like** |

## Checker pass

1. **Goal restated** — one sentence.
2. **Done criteria** — each measurable item met.
3. **Limits honored** — read-only: no email, deletes, or extra posts.
4. **Evidence** — cite RAG, memory, or tool outputs; no invention.
5. **Turn budget** — within cap.

## Output format (internal)

```markdown
## Loop check: <loop name>

- Goal: …
- Done criteria: [x] … [x] … [ ] …
- Limits: OK / VIOLATION - …
- Turns used: N / cap
- Verdict: PASS | FAIL - reason
```

**PASS** -> proceed with allowed Telegram send.  
**FAIL** -> do not send; reply with FAIL reason.

## Do not

- Draft and check in one pass without explicit verdict.
- Expand scope when check fails.
- Send on FAIL.
