# Mock Lucky Charm Meeting Datasets

This folder contains **21 mock** Lucky Charm project meeting transcript datasets (`.tab` format). Each file **adds to the dashboard** when uploaded in **Mock mode** — the dashboard accumulates data across meetings.

**One cohesive story:** no plan → concept → goals → planning → execution → finished product.

| File | Phase | Content |
|------|-------|---------|
| 01 | No plan | Ideation — "What should we build? Standup tool?" |
| 02 | Concept | Lucky Charm idea — capture blockers, actions, TEE, LLM export |
| 03 | Goals | Goals lock — categories, assignees, Copy for LLM, Download JSON |
| 04 | Planning | Integration points — OpenAPI, attestation, staging, docs |
| 05 | Execution | Blockers emerge — attestation, staging flaky, design tokens |
| 06 | Finished | Decisions wrap-up — REST, privacy, MVP toggle, DevPost |
| 07–21 | Cycle | Repeats phases 1–6 for extended demos |

- **Format:** Tab-separated, columns: `Index`, `Time`, `Speaker`, `Speech Segment`, `Open code(s)`, `Axial code(s)`.
- **Flow:** Upload 01 → 02 → 03 → 04 → 05 → 06 to see the full arc. Dashboard and JSON export tell the story.

**Regenerating transcripts:** From project root run:
```bash
python scripts/generate_mock_hackathon_tabs.py
```
