# Skill — loop checker (verify before send)

Use on **every closed loop** before posting to Telegram, writing files outside memory, or claiming "done."

Design reference: [LOOP_ENGINEERING.md](../../docs/hermes/LOOP_ENGINEERING.md).

## When to run

| Trigger | Action |
|---------|--------|
| Loop about to send Telegram message | Run checklist below; abort send if any fail |
| Loop hit turn cap without passing check | Stop; report partial state to Ranne — do not improvise more work |
| Ranne asks "is this loop done?" | Re-run against the loop's **Done looks like** criteria |

## Checker pass (do not skip)

1. **Goal restated** — one sentence: what was this loop supposed to deliver?
2. **Done criteria** — each item from the loop spec is **measurable and met** (counts, booleans, template fields).
3. **Limits honored** — read-only means: no email, no deletes, no outbound posts except the allowed Telegram digest.
4. **Evidence** — cite RAG hits, memory lines, or tool outputs used; no invented status.
5. **Turn budget** — confirm loop stayed within **Turn cap**; if not, say so explicitly.

## Output format (internal)

```markdown
## Loop check: <loop name>

- Goal: …
- Done criteria: [x] … [x] … [ ] …
- Limits: OK / VIOLATION — …
- Turns used: N / cap
- Verdict: PASS | FAIL — reason
```

**PASS** → proceed with the single allowed Telegram send (if any).  
**FAIL** → do not send; reply to Ranne with FAIL reason and what is missing.

## Pair with

- **[daily-brief-loop.md](./daily-brief-loop.md)** — first closed loop; checker runs after draft, before Telegram.
- **Sub-agent split (later):** main Nami drafts; checker pass can be a separate Hermes worker with only this skill loaded.

## Do not

- Grade your own homework in one pass — draft work, then checker pass, then send.
- Expand scope when check fails ("I'll just also…").
- Send on FAIL or partial criteria.
