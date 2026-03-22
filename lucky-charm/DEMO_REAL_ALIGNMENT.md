# Demo vs Real Mode Alignment

This document describes how the **demo/mock** flow aligns with the **real (Live TEE)** flow. Both modes share the same UI, navigation, and feature set.

---

## Shared Flow (Both Modes)

| Step | Demo (Mock) | Real (Live TEE) |
|------|-------------|-----------------|
| 1. Clear cache | ✅ | ✅ |
| 2. Sign in | Demo / mock credentials | Real SSO or mock |
| 3. Create/join team | ✅ | ✅ |
| 4. Create Project | Gate: must name deliverable first | Same |
| 5. Upload | `getMockResultForFile()` → `setTEEResult()` | `processTranscript()` → TEE API → `setTEEResult()` |
| 6. Dashboard | Same UI, real data from mock lookup | Same UI, data from TEE response |
| 7. Deliverables | Same (phases, archive, previous) | Same |
| 8. Copy/Download | Same | Same |
| 9. TEE Settings | Collapsed below content, data source toggle | Same + attestation, endpoint |

---

## Data Source Toggle

- **Mock**: Uses `mockHackathonResults.js` — maps `lucky_charm_standup_XX.tab` → MEETING_1..6. No backend calls. Stored in `lucky-charm-data-source`.
- **Live TEE**: Calls `/process`, `checkTEEHealth`, attestation. Same `setTEEResult()` and `teeResultStorage` merge logic.

---

## UI Parity Checklist

| Feature | Demo | Real |
|---------|------|------|
| Create Project gate on Upload | ✅ | ✅ |
| Deliverable dropdown (current + archived) | ✅ | ✅ |
| Mark deliverable complete | ✅ | ✅ |
| Archive deliverable (remove) | ✅ | ✅ |
| Empty state (no meetings) | ✅ | ✅ |
| TEE Status indicator | "Demo mode" | "TEE connected" / "TEE offline" |
| TEE Status & Settings position | Below main content | Same |
| Copy for LLM | ✅ | ✅ |
| Download JSON | ✅ | ✅ |
| Clear all | ✅ | ✅ |
| Clear cache & start fresh | ✅ | ✅ |

---

## Code Paths

### Upload

- **Mock**: `dataSource === 'mock'` → `getMockResultForFile(file.name)` → `adaptTEEResponse()` → `setTEEResult()`
- **Real**: `checkTEEHealth()` → `processTranscript()` → `adaptTEEResponse()` → `setTEEResult()`

Both use `adaptTEEResponse()` and `setTEEResult()`. Same storage format.

### Dashboard

- No branching by data source for layout or deliverables.
- `showEmptyState` when no `teeResult` (both modes).
- Role views (`TeamLeadView`, `TeamMemberView`) receive same `teeResult` shape.

### Phase / Deliverable Storage

- `phaseStorage.js` — same for both modes.
- `createFirstDeliverable`, `markDeliverableComplete`, `getArchivedPhases` — data-source agnostic.

---

## Production Readiness

To align production with this demo:

1. **Backend**: Ensure `/process` returns Props-compliant schema matching `adaptTEEResponse` expectations.
2. **Transcript hash**: Already implemented (hash before upload); backend verifies.
3. **transcriptHistoryStorage**: Stub in place; implement `appendTranscriptRecord` for audit.
4. **Auth**: Wire real SSO when available; pseudonym mode ready.
5. **Data source default**: `mock` for demos; set `real` for production or via env.

---

## Files to Review for Real Alignment

- `frontend/src/services/teeService.js` — TEE endpoints, health, process
- `frontend/src/utils/propsResultAdapter.js` — response → dashboard format
- `frontend/src/utils/teeResultStorage.js` — merge logic (same for both)
- `backend/app.py` — `/process` implementation, hash verification
