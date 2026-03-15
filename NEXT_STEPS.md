# Next Steps

**Consolidated plan:** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (merged Mac + Windows)

## Day 1-2 Progress (SSO Demo)
- [x] `identity_core` module: schemas, nullifier store, auth verifier
- [x] `demo_app`: signup/login UI with mock mode
- [x] Verifier-scoped nullifier replay checks
- [x] Tests for registration/auth/replay rejection
- [ ] Wire to real U2SSO (see `docs/U2SSO_SETUP.md`)

## Day 3-5 Progress (Transcript Ingestion)
- [x] `processing_boundary`: TEE-ready abstraction (runs locally; partner adds TEE)
- [x] `analytics_engine`: blocker/velocity/theme extraction (rule-based, no LLM)
- [x] Transcript submit + team report (role-level only, no raw transcript)
- [ ] TEE implementation (partner)

**Run demo:** `python run_demo.py` → http://localhost:5000

## Immediate Priorities (SSO-First)
1. Finalize minimal SSO demo interface:
   - Register master identity
   - Register pseudonymous credential for one service
   - Authenticate with proof
2. Enforce verifier-scoped nullifier replay checks in demo flow.
3. Define minimal role-claim payload and verification rule set.

## Suggested Component Plan
- `identity-core` (private): ASC/U2SSO verifier, nullifier store, claim validation.
- `tee-orchestrator` (private): attestation boundary, transcript intake, secure processing calls.
- `analytics-engine` (private): blocker/velocity/theme aggregation with output guardrails.
- `demo-app` (public): API/UI that stitches components into one end-to-end story.

## 8-Day Execution Plan (Practical)
### Day 1-2: Identity and Interfaces
- Freeze auth flow and message schemas.
- Implement/clean SSO demo path.
- Add tests for registration/auth/replay rejection.

### Day 3-5: Private Pipeline
- Implement transcript ingestion path.
- Add trusted boundary abstraction (TEE-ready interface).
- Generate role-level aggregate outputs only.

### Day 6-7: Hardening + Story
- Add privacy guardrails (minimum cohort thresholds, no raw transcript egress).
- Add observability and audit events.
- Build demo script and architecture diagrams.

### Day 8: Final Polish
- Validate end-to-end demo reliability.
- Finalize deck and limitation statements.
- Freeze submission artifacts.

## Definition of Done (Hackathon)
- End-to-end demo runs from auth -> ingest -> aggregate -> role-level report.
- Replay/nullifier misuse is rejected in demo.
- Security assumptions and residual risks are documented clearly.
- Public claims match actual implementation boundaries.
