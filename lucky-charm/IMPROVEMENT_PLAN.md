# Lucky Charm — Improvement Plan

Improvements based on gap analysis, research alignment (Props, ASC, TEE Threat Model), and current implementation.

---

## Phase 1: Quick Wins (1–2 days)

### 1.1 Transcript Input Integrity (Props) ✓ Done
**Goal:** Add assurance that transcripts are authentic and unmodified.

| Task | Effort | Owner | Details |
|------|--------|-------|---------|
| Client-side SHA-256 hash of transcript before upload | S | Dev | `transcriptHash.js` + `teeService.js` |
| Include `transcript_hash` in form/JSON payload | S | Dev | FormData includes `transcript_hash` |
| Backend verify hash, log in audit | S | Dev | `app.py` verifies; `audit_hash_verification` |
| Document hash flow in `PRIVACY_POLICY.md` | XS | Dev | Added transcript hash section |

**Files:** `frontend/src/utils/transcriptHash.js`, `frontend/src/services/teeService.js`, `backend/app.py`, `backend/audit.py`, `backend/PRIVACY_POLICY.md`

---

### 1.2 Sample Transcript for Demo Mode ✓ Done
**Goal:** Mock mode shows realistic output during demos.

| Task | Effort | Owner | Details |
|------|--------|-------|---------|
| Add "Load sample transcript" button on Upload page | S | Dev | When Mock data selected, prefills `lucky_charm_standup_01.tab` |
| Use `lucky_charm_standup_01.tab` or similar as default | XS | Dev | Served from `/mock_hackathon_data/` (frontend/public) |
| Ensure mock flow populates dashboard with plausible data | S | Dev | Mock lookup via `getMockResultForFile()`; dashboard shows Meeting 1 output |

**Files:** `frontend/src/pages/UploadPage.jsx`, `frontend/public/mock_hackathon_data/lucky_charm_standup_01.tab`

---

### 1.3 Error Handling and UX ✓ Done
**Goal:** Clearer feedback when TEE is unreachable or attestation fails.

| Task | Effort | Owner | Details |
|------|--------|-------|---------|
| Retry with exponential backoff for `/process` | S | Dev | `teeService.js`: 2–3 retries with 1s, 2s delay |
| Loading state for attestation fetch | XS | Dev | Spinner + disabled + "Fetching…" while loading |
| Tooltip or help text for "Fetch attestation report" | XS | Dev | Section copy + `title` attribute explain attestation |

**Files:** `frontend/src/services/teeService.js`, `frontend/src/components/TeamLeadTeeSettings.jsx`, `TeamLeadTeeSettings.css`

---

## Phase 2: Props and Privacy Hardening (2–3 days)

### 2.1 Semantic Props Filter (LLM-assisted) ✓ Done
**Goal:** Use LLM to classify into predefined categories when available; reduce leakage.

| Task | Effort | Owner | Details |
|------|--------|-------|---------|
| Define allowed output schema (categories only) | S | Dev | `props_filter.py`: ALLOWED_BLOCKER_CATEGORIES, ALLOWED_ACTION_THEMES, ALLOWED_DECISION_THEMES |
| When `OLLAMA_URL` set: LLM classifies to schema only | M | Dev | `extract_llm.py`: prompt enforces category/theme from allowlist |
| Validation layer: reject any output not in schema | S | Dev | `_validate_category()` maps unknown → "other" |
| Fallback to keyword-based when LLM unavailable | XS | Dev | Current behavior (extract_from_transcript → apply_props_filter) |

**Files:** `backend/extract_llm.py`, `backend/props_filter.py`

---

### 2.2 Client-Side Envelope Encryption (Optional)
**Goal:** Encrypt transcript client-side so only TEE can decrypt; raw never in plaintext on wire.

| Task | Effort | Owner | Details |
|------|--------|-------|---------|
| TEE exposes ephemeral public key (or use static key in env) | M | Dev | `GET /encryption-key` or bundle public key in build |
| Client: generate session key, encrypt transcript with AES-GCM | M | Dev | Web Crypto API |
| Send `{ encrypted_transcript, nonce, ciphertext }` | S | Dev | Update `teeService.js` and `app.py` |
| Backend: decrypt inside TEE, process as usual | M | Dev | Use `cryptography` or PyNaCl |
| Document in `PRIVACY_POLICY.md` | XS | Dev | |

**Files:** `frontend/src/services/teeService.js`, `frontend/src/utils/encryptionUtils.js`, `backend/app.py`, `backend/requirements.txt`

**Dependency:** Requires crypto lib in backend (e.g. `pycryptodome`).

---

## Phase 3: Participant Aggregation and U2SSO (3–5 days)

### 3.1 Participant-Based Aggregation ✓ Done
**Goal:** Aggregate metrics by `participant_id` over time for standup trends.

| Task | Effort | Owner | Details |
|------|--------|-------|---------|
| Backend: optional in-memory store keyed by `participant_id` + date | M | Dev | `aggregation_store.py` — in-memory OrderedDict, TTL + max entries |
| `/process` appends to store when `participant_id` present | S | Dev | Appends Props velocity (blocker/action/decision counts) only |
| New endpoint: `GET /aggregates?participant_id=` (optional) | M | Dev | Returns time-series sorted by date |
| Frontend: trend chart for Team Lead view | M | Dev | "Participant trend (you)" stacked bar chart when data available |
| Clear store on session end or add TTL | S | Dev | AGGREGATION_TTL_DAYS (30), AGGREGATION_MAX_ENTRIES (1000) |

**Files:** `backend/app.py`, `backend/aggregation_store.py`, `frontend/src/components/TeamLeadView.jsx`, `frontend/src/services/teeService.js`, `frontend/src/pages/Dashboard.jsx`

---

### 3.2 Full U2SSO Integration (ASC) ✓ Done
**Goal:** Real unlinkable pseudonyms and Sybil resistance per ASC paper.

| Task | Effort | Owner | Details |
|------|--------|-------|---------|
| Deploy sso-poc with Ganache + contract | L | Dev | Optional: full sso-poc; use `sso-poc-stub` for local dev |
| Wire frontend to real SSO (not mock) for demo path | M | Dev | ✓ `VITE_SSO_BASE_URL=/sso-api`; proxy in vite.config |
| Backend: nullifier check per submission | M | Dev | ✓ `nullifier_store.py`; reject duplicate (participant_id, nullifier) |
| Reject duplicate `participant_id` + `nullifier` combinations | S | Dev | ✓ 409 on replay; mark used after success |
| Document U2SSO flow in `ARCHITECTURE.md` | XS | Dev | ✓ U2SSO Flow section |

**Files:** `backend/app.py`, `backend/nullifier_store.py`, `frontend/src/services/ssoService.js`, `sso-poc-stub/`, `ARCHITECTURE.md`

---

## Phase 4: Attestation and Research Alignment (1–2 days)

### 4.1 Richer Attestation
**Goal:** Surface full attestation report; bind to hosting provider where possible.

| Task | Effort | Owner | Details |
|------|--------|-------|---------|
| Call Phala API for CVM attestation (if available) | M | Dev | Check Phala docs for attestation endpoint |
| Display CVM ID, provider, runtime in attestation UI | S | Dev | Parse and show in `TeamLeadTeeSettings` |
| "Verify TEE before first upload" flow | S | Dev | Optional gate: fetch attestation, then enable upload |
| Link to TEE Threat Model paper in docs | XS | Dev | 2506.14964 |

**Files:** `backend/app.py`, `frontend/src/components/TeamLeadTeeSettings.jsx`, `ARCHITECTURE.md`

---

### 4.2 Research Alignment Documentation ✓ Done
**Goal:** Explicitly map features to papers.

| Task | Effort | Owner | Details |
|------|--------|-------|---------|
| Add "Research Alignment" section to `ARCHITECTURE.md` | S | Dev | Table: Props, ASC, TEE — what we do, what we defer |
| Link each feature to paper (arxiv/iacr IDs) | XS | Dev | 2410.20522, 2025-618, 2506.14964 |
| Update `DEMO_SCRIPT.md` with research talking points | XS | Dev | Props script, Research row, limitation refs |

**Files:** `ARCHITECTURE.md`, `DEMO_SCRIPT.md`

---

### 4.3 Audit Visibility (Optional)
**Goal:** Host can see audit trail (high-level only).

| Task | Effort | Owner | Details |
|------|--------|-------|---------|
| `GET /audit` endpoint (admin/host only) | M | Dev | Return last N events; no transcript, no identity |
| Host console: "Recent audit events" section | M | Dev | Fetch and display |
| Or: stream audit to external log aggregator | L | Dev | e.g. Grafana Loki; out of scope for MVP |

**Files:** `backend/app.py`, `backend/audit.py`, `frontend/src/pages/HostConsolePage.jsx`

---

## Summary: Implementation Order

| Phase | Focus | Status | Dependencies |
|-------|-------|--------|--------------|
| 1 | Quick wins: integrity, demo UX, errors | ✓ Done | — |
| 2 | Props hardening: semantic filter, encryption | 2.1 ✓ / 2.2 optional | Phase 1 |
| 3 | Aggregation, U2SSO | 3.1 ✓ / 3.2 ✓ | sso-poc-stub for local dev |
| 4 | Attestation, docs | 4.2 ✓ / 4.1 pending | — |

---

## What's Next

| Priority | Item | Phase | Effort |
|----------|------|-------|--------|
| 1 | Research alignment docs | 4.2 | ✓ Done |
| 2 | ~~Participant aggregation~~ | 3.1 | ✓ Done |
| 3 | **Richer attestation** | 4.1 | Medium |
| 4 | Envelope encryption (optional) | 2.2 | Medium |
| 5 | ~~Full U2SSO + nullifiers~~ | 3.2 | ✓ Done |
| 6 | Audit visibility (optional) | 4.3 | Medium |

---

## Priority Matrix

| Improvement | Impact | Effort | Status |
|-------------|--------|--------|--------|
| Transcript hash | High (Props) | Low | ✓ Done |
| Sample transcript for demo | Medium (UX) | Low | ✓ Done |
| Semantic Props filter | High (Props) | Medium | ✓ Done |
| Participant aggregation | High (feature) | Medium | ✓ Done |
| Envelope encryption | High (privacy) | Medium | Optional |
| Full U2SSO + nullifiers | High (ASC) | — | ✓ Done |
| Richer attestation | Medium (TEE) | Medium | Phase 4 |
| Research alignment docs | Medium (credibility) | Low | ✓ Done |

---

## Success Criteria

- **Props:** Hash verification + strict schema output; no verbatim quotes.
- **ASC:** U2SSO flow with nullifiers; sso-poc-stub or real sso-poc for Sybil resistance.
- **TEE:** Attestation visible in UI; threat model documented.
- **Demo:** One-click sample transcript; smooth flow for judges.
