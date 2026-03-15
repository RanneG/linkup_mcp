# TEE Integration Guide (For Partner)

The processing boundary is designed so you can swap in a TEE-backed implementation without changing the demo app.

## Current Architecture

```
User → demo_app (Flask) → ProcessingBoundary → AnalyticsEngine
                              ↓
                    (runs locally; no TEE)
```

## TEE-Ready Interface

The `ProcessingBoundary` in `processing_boundary/boundary.py`:

- **Input:** `TranscriptSubmission(participant_id, transcript, submitted_at)`
- **Output:** `AggregatedReport(total_standups, unique_participants, all_blockers, all_completed, themes)`
- **Contract:** Raw transcript is never stored or returned. Only extracted metrics.

## What to Replace

1. **`ProcessingBoundary`** — Implement the same interface but:
   - Run inside a Confidential VM (Intel TDX, AMD SEV-SNP) or enclave
   - Add attestation so clients can verify they're talking to the real TEE
   - Ensure transcript decryption/processing happens only inside the boundary

2. **`StandupExtractor`** — Can stay as-is or move into TEE. It's pure Python, no secrets.

3. **Storage** — Currently in-memory. For TEE: encrypted storage inside enclave, or ephemeral (process and discard).

## Integration Points

In `demo_app/app.py`:

```python
from processing_boundary import ProcessingBoundary
boundary = ProcessingBoundary()  # Replace with TEE-backed impl
```

Replace with something like:

```python
from tee_orchestrator import TEEProcessingBoundary
boundary = TEEProcessingBoundary(attestation_url="...")
```

The `TEEProcessingBoundary` should implement:

- `process(submission: TranscriptSubmission) -> AggregatedReport`
- `get_report() -> AggregatedReport`

## References

- TEE threat model: `data/2506.14964v1.pdf`
- Props paper: `data/2410.20522v1.pdf`
