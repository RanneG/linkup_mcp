---
name: model-routing
description: "Fast default vs deep reasoning; PC vs runtime."
version: 1.0.0
author: RanneG
metadata:
  hermes:
    tags: [nami]
    category: devops
---

# Model routing

## Hermes (runtime on PC)

**Default:** Nous Portal free model for Telegram triage, memory, RAG.

**Escalate to Cursor** when: large refactors, security audits, multi-file architecture.

## Cursor (build-time)

| Task | Prefer |
|------|--------|
| Small edits, tests | Fast model |
| Architecture, subtle bugs | Strong model |
| Ranne says go deep | Strong model |

## Do not

- Force heavy reasoning on Telegram for shipping work — enqueue mobile build or use Cursor.
