# SSO-First Implementation Plan

**Merged from:** Mac branch (DECISIONS, NEXT_STEPS, PROJECT_CONTEXT, SECURITY_PRIVACY_CONSIDERATIONS) + Windows hackathon planning (Props/U2SSO/TEE architecture, cloud design).

---

## 1. Build Order (Identity-First)

Per [DECISIONS.md](DECISIONS.md): Authentication/privacy identity is the highest-risk architectural dependency.

**Order:** Identity (SSO) → Ingestion/Privacy Boundary → Aggregation

---

## 2. Component Architecture

| Component | Visibility | Responsibility |
|-----------|------------|-----------------|
| `identity-core` | Private | ASC/U2SSO verifier, nullifier store, claim validation |
| `tee-orchestrator` | Private | Attestation boundary, transcript intake, secure processing calls |
| `analytics-engine` | Private | Blocker/velocity/theme aggregation with output guardrails |
| `demo-app` | Public | API/UI that stitches components into one end-to-end story |

---

## 3. 8-Day Execution Plan

### Day 1–2: Identity and Interfaces
- [x] Freeze auth flow and message schemas (`identity_core/schemas.py`)
- Implement/clean SSO demo path:
  - Register master identity
  - Register pseudonymous credential for one service
  - Authenticate with proof
- Enforce verifier-scoped nullifier replay checks in demo flow
- Define minimal role-claim payload and verification rule set
- Add tests for registration/auth/replay rejection

### Day 3–5: Private Pipeline
- Implement transcript ingestion path (manual paste or file upload)
- Add trusted boundary abstraction (TEE-ready interface / simulated enclave)
- Generate role-level aggregate outputs only (Props policy filter)
- Reuse [rag.py](rag.py) / [rag_enhanced.py](rag_enhanced.py) for extraction inside enclave

### Day 6–7: Hardening + Story
- Add privacy guardrails (minimum cohort thresholds, no raw transcript egress)
- Add observability and audit events
- Build demo script and architecture diagrams
- Design cloud infrastructure (Confidential VMs, API, IdR, attestation)

### Day 8: Final Polish
- Validate end-to-end demo reliability
- Finalize deck and limitation statements
- Freeze submission artifacts

---

## 4. SSO Demo Interface (Immediate Priorities)

1. **Register master identity** — User creates `(Φ, sk, r)`, registers `Φ` in IdR
2. **Register pseudonymous credential** — Per-SP pseudonym via `csk_l = HKDF(r, v_l)`, `ϕ = G^l_auth.Gen(csk_l)`
3. **Authenticate with proof** — User proves ownership, SP verifies
4. **Nullifier enforcement** — Verifier-scoped nullifier registry; reject replay
5. **Role-claim handling** — Minimal signed role claims and verifier checks

**Source:** [BoquilaID/U2SSO](https://github.com/BoquilaID/U2SSO)

---

## 5. Props Pipeline (Post-Identity)

1. **Integrity:** Transcripts authentic (user upload with attestation)
2. **Privacy:** Raw transcripts never leave TEE; only aggregates do
3. **Contextual integrity:** Outputs match intended use (velocity, blockers, themes — no verbatim quotes)

**Flow:** auth → ingest → encrypt → process in TEE → policy filter → structured output only

---

## 6. Security & Privacy (from SECURITY_PRIVACY_CONSIDERATIONS.md)

### Protected Against (Prototype Target)
- Honest-but-curious manager inferring named participants from outputs
- Service-side observers correlating identities across services
- Replay of identity artifacts within one verifier context
- Direct access to raw transcript content outside trusted boundary

### Not Fully Addressed (Known Limits)
- Side-channel resistance for TEE
- Compromise of endpoint devices before encryption
- Full malicious verifier collusion analysis
- Production key lifecycle, incident response, compliance

### Priority Engineering Tasks
1. Nullifier enforcement: strict verifier-scoped registry and replay rejection
2. Role-claim handling: minimal signed role claims and verifier checks
3. TEE boundary hardening: attestation verification, fail-closed defaults
4. Output privacy guardrails: minimum cohort thresholds for aggregates
5. Auditability: append-only event logs for proof verification and aggregation

---

## 7. Definition of Done (Hackathon)

- End-to-end demo runs: **auth → ingest → aggregate → role-level report**
- Replay/nullifier misuse is rejected in demo
- Security assumptions and residual risks documented clearly
- Public claims match actual implementation boundaries

---

## 8. Cloud Architecture (To Be Designed)

For future deployment:
- Confidential VM (TEE) for backend processing
- API gateway and auth layer
- U2SSO IdR placement (Ethereum contract or hosted service)
- Data flow and attestation endpoints
- Diagram: clients → API → TEE boundary → aggregation → policy-filtered output

---

## 9. Research Papers

**Current set:** Props (`2410.20522v1.pdf`), Anonymous Self-Credentials (`2025-618.pdf`, `AnonymousSelfCredentials.pdf`), TEE Threat Model (`2506.14964v1.pdf`), `props_presentation_hackathon.pdf`

---

## 10. Prototype Positioning

**Safe to say:**
- Privacy-preserving coordination pattern using pseudonymous, verifier-scoped auth and trusted processing boundaries
- No raw meeting text or named identities in managerial outputs
- Research/engineering prototype, not production-grade privacy guarantee

**Avoid:**
- "Provably secure end-to-end production system"
- "Complete anonymity under all adversaries"
- "Fully side-channel-resistant TEE deployment"
- "Regulatory/compliance complete"
