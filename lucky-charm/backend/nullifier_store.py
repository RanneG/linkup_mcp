"""
U2SSO nullifier store: prevent duplicate submissions per (participant_id, nullifier).
ASC paper (2025-618): nullifiers provide Sybil resistance — one-time use per submission.
"""

from __future__ import annotations

# In-memory: set for O(1) lookup; list for eviction order
_used_set: set[tuple[str, str]] = set()
_used_list: list[tuple[str, str]] = []
_MAX_ENTRIES = 10_000


def is_nullifier_used(participant_id: str, nullifier: str) -> bool:
    """Check if this (participant_id, nullifier) pair has already been used."""
    if not participant_id or not nullifier:
        return False
    pid = participant_id.strip()
    nf = nullifier.strip()
    if not pid or not nf:
        return False
    return (pid, nf) in _used_set


def mark_nullifier_used(participant_id: str, nullifier: str) -> None:
    """Record that this (participant_id, nullifier) has been used."""
    if not participant_id or not nullifier:
        return
    pid = participant_id.strip()
    nf = nullifier.strip()
    if not pid or not nf:
        return
    pair = (pid, nf)
    if pair in _used_set:
        return
    _used_set.add(pair)
    _used_list.append(pair)
    while len(_used_list) > _MAX_ENTRIES:
        old = _used_list.pop(0)
        _used_set.discard(old)
