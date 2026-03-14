# Next Steps

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
