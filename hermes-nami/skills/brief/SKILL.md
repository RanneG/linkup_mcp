---
name: brief
description: "Read-only daily digest: Build, Products, This week."
version: 1.0.0
author: RanneG
metadata:
  hermes:
    tags: [nami, loop, telegram]
    category: productivity
---

# Daily brief (closed loop)

Read-only morning digest for Ranne on Telegram.

**Starts when:** Ranne sends `/brief` or cron job `nami-daily-brief`.

## Done looks like

- Exactly **3 bullets** (Build, Products, This week — one line each).
- **0** outbound actions besides one Telegram message (no email, browser, or file writes except LOOP_LOG).
- Each bullet grounded in **RAG** (`rag` tool on nami-corpus) and/or `%LOCALAPPDATA%\hermes\memories\` — not invented.

## Execution steps

1. Read `MEMORY.md` and `LOOP_LOG.md` with **`read_file`** or memory tools only — **no terminal/bash**.
2. Call MCP tool **`rag`** with: "What is Ranne's current focus and open todos?"
3. Skip **`web_search`** unless USER.md explicitly asks for live news.
4. Draft 3 bullets (each <= 120 chars). Prefer **This week** lines from MEMORY over generic repo lists.
5. Load **`/loop-checker`** and run checker pass on the draft.
6. On **PASS**: send **one** Telegram message (template below). On **FAIL**: one short FAIL note only.

**Turn cap:** 8 tool rounds. Stop and report partial if cap hit.

**Writes:** append **only** one line to `memories/LOOP_LOG.md` after verdict — no other `write_file` calls.

## Telegram template (PASS)

```text
Daily brief

- Build: …
- Products: …
- This week: …

(read-only - corpus + memory)
```

## Memory log

Append one line to `LOOP_LOG.md`:

```text
YYYY-MM-DD daily-brief PASS|FAIL - <6-word summary>
```

## Do not

- Open-ended research loops.
- Browser, email, or **terminal** for v1.
- Send the brief more than once per `/brief` invocation.
- Send on FAIL or without loop-checker PASS.
