# Skill — model routing (fast default, strong when needed)

## Hermes (runtime Nami on Mac)

**Default:** local Ollama `qwen2.5:7b` — Telegram, quick Q&A, memory, RAG, search.

**Escalate** (tell Ranne to use Cursor or run cloud model) when:

- Large refactor or architecture spanning many files
- Security audit of non-trivial code
- "Think step by step" debug with full repo context

Apply baseline config on Mac:

```bash
bash scripts/apply-nami-model-routing.sh
```

Optional cloud: `hermes setup --portal` — use for hard reasoning only; local stays default for privacy/cost.

## Cursor (build-time Nami on PC)

| Task type | Prefer |
|-----------|--------|
| Small edits, scripts, tests | Fast model (Composer) |
| Architecture, subtle bugs, multi-file refactor | Strong model (Opus / Sonnet thinking) |
| Voice dictation / quick fixes | Same thread — don't over-switch |

Ranne can say **"go deep"** or **"fast pass"** to steer; no automatic router in Cursor yet.

## Automation

- Mac: `apply-nami-model-routing.sh` sets Hermes Ollama defaults.
- PC: `.cursor/rules/model-routing.mdc` reminds the agent.
- Weekly: if many Telegram tasks need code, suggest Cursor session instead of forcing Mac LLM.
