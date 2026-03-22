"""
Audit logging inside the TEE.
Logs high-level events only: ingestion, aggregation, policy output. No raw transcript or identity.
Events go to stdout for container log capture. No disk persistence.
"""
import json
import os
from datetime import datetime, timezone


def _emit(event: dict) -> None:
    """Emit audit event to stdout (structured JSON)."""
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "event": event,
    }
    # Only emit if audit is enabled (default on in TEE)
    if os.environ.get("AUDIT_ENABLED", "true").lower() == "true":
        print(f"AUDIT:{json.dumps(record)}", flush=True)


def audit_hash_verification(hash_verified: bool | None) -> None:
    """Log transcript hash verification (Props integrity). True=verified, False=mismatch, None=not sent."""
    _emit({
        "type": "hash_verification",
        "hash_verified": hash_verified,
    })


def audit_ingestion(participant_id: str | None = None, has_transcript: bool = True) -> None:
    """Log transcript ingestion (no content, no identity)."""
    _emit({
        "type": "ingestion",
        "participant_id_present": bool(participant_id),
        "has_transcript": has_transcript,
    })


def audit_aggregation(
    blocker_count: int = 0,
    action_count: int = 0,
    decision_count: int = 0,
) -> None:
    """Log aggregation run (counts only)."""
    _emit({
        "type": "aggregation",
        "blocker_count": blocker_count,
        "action_count": action_count,
        "decision_count": decision_count,
    })


def audit_policy_output(themes_count: int = 0, velocity_blockers: int = 0) -> None:
    """Log policy-filter output (no verbatim)."""
    _emit({
        "type": "policy_output",
        "themes_count": themes_count,
        "velocity_blockers": velocity_blockers,
    })
