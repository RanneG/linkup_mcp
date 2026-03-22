# LLM Context Design

## Goal

Make standup data **fuller and more consumable** by LLMs (ChatGPT, Claude, downstream analysis). The original Props output was sparse: 6 keywords per item, categories, counts. LLMs need narrative, rationale, sequence, and relationships to be useful.

## What Changed

### 1. Richer schema (Props-compliant)

- **`context`** field added per blocker, action item, and decision
- Thematic 1–2 sentence summary (no verbatim quotes, no identity)
- Backend: `extract.py` derives context via `_sanitize_for_context()`
- Backend: `extract_llm.py` prompt asks for context (rationale, impact, dependencies)
- Props filter: passes through `context` when sanitized (keyword-based, max 200 chars)

### 2. Frontend: LLM context export

- **`buildLLMContext(teeResult)`** in `llmContextUtils.js` produces:
  - Markdown-formatted project context
  - Timeline by meeting (when sessions exist)
  - Per-meeting: blockers raised, actions, decisions — with context when present
  - Cumulative view when no sessions
- **"Copy for LLM"** button on Dashboard copies this to clipboard for pasting into ChatGPT/Claude
- **`buildLLMContextJSON()`** for programmatic consumption (APIs, agents)

### 3. Interpretation uses context

- `generateActionsInterpretation`, `generateBlockersInterpretation`, `generateDecisionsInterpretation`
- When `context` exists, it is prepended to the AI-style interpretation
- Gives LLMs and users fuller signal in the dashboard UI

### 4. Mock data

- `dashboardMock.js` includes `context` on sample items so the feature is visible in demo mode

## What an LLM Gets

**Before (sparse):**
```
blocker: "integration: Phala / attestation / enclave"
action: "documentation: OpenAPI / spec"
decision: "scope: REST / transcript"
```

**After (fuller):**
```markdown
### Meeting 1 — lucky_charm_standup_01.tab

**Blockers raised:**
- [integration] Phala attestation — enclave verification failing — Blocking staging deployment and integration tests
- [environment] Staging env flaky for nightly deploys — Nightly runs failing intermittently

**Action items:**
- [documentation] Finish OpenAPI spec for /transcript endpoint (due: Tomorrow) — Unblocks frontend upload integration

**Decisions / agreements:**
- [scope] REST for transcript upload; WebSocket only for live updates — Simplifies client integration and reduces latency
```

## Future work

- **Session-level narrative**: LLM-generated 1–2 sentence summary per meeting ("Meeting 2 focused on integration blockers. Team agreed to scope demo to one bank.")
- **Relationships**: `related_blocker_id`, `unblocks_action_id` for dependency graph
- **Structured export**: JSON schema for API consumption, tool use
