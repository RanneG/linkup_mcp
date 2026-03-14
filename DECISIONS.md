# Decisions Log

## Format
- Date: YYYY-MM-DD
- Decision
- Reason
- Impact
- Status: Proposed | Accepted | Superseded

---

## 2026-03-14
### Decision
Treat macOS branch state as source of truth for current hackathon research corpus.

### Reason
Local Mac contained the newest relevant papers and removed outdated `DeepSeek.pdf`.

### Impact
Data corpus now reflects current hackathon direction.

### Status
Accepted

---

## 2026-03-14
### Decision
Use SSO (ASC/U2SSO-aligned) as first concrete working demo slice.

### Reason
Authentication/privacy identity is the highest-risk architectural dependency.

### Impact
Build order is identity-first, then ingestion/privacy boundary, then aggregation.

### Status
Accepted

---

## 2026-03-14
### Decision
Position project as a privacy-first prototype with explicit assumptions, not production claims.

### Reason
8-day timeline and unresolved hard problems (TEE side channels, full oracle guarantees).

### Impact
Improves technical credibility and avoids overclaiming.

### Status
Accepted

---

## 2026-03-14
### Decision
Split implementation into modular components/repos (private internals + public integration/demo).

### Reason
Improves scalability, clean boundaries, and selective open-sourcing.

### Impact
Enables independent iteration on identity, TEE, and analytics without blocking demo app.

### Status
Accepted
