"""
Verifier-scoped nullifier store for Sybil resistance.

Per ASC/U2SSO: one nullifier per (master_identity, verifier) pair.
Replay of the same nullifier within a verifier context is rejected.
"""

from typing import Set
import threading


class NullifierStore:
    """
    In-memory verifier-scoped nullifier registry.

    Rejects registration if nullifier was already used for this verifier.
    Thread-safe for concurrent requests.
    """

    def __init__(self):
        self._store: dict[str, Set[str]] = {}  # verifier_id -> set of nullifiers
        self._lock = threading.Lock()

    def register(self, verifier_id: str, nullifier_hex: str) -> bool:
        """
        Register a nullifier for the verifier. Returns True if accepted, False if replay.
        """
        with self._lock:
            if verifier_id not in self._store:
                self._store[verifier_id] = set()
            if nullifier_hex in self._store[verifier_id]:
                return False  # Replay
            self._store[verifier_id].add(nullifier_hex)
            return True

    def is_used(self, verifier_id: str, nullifier_hex: str) -> bool:
        """Check if nullifier was already used for this verifier."""
        with self._lock:
            return nullifier_hex in self._store.get(verifier_id, set())

    def clear_verifier(self, verifier_id: str) -> None:
        """Clear all nullifiers for a verifier (for testing)."""
        with self._lock:
            if verifier_id in self._store:
                del self._store[verifier_id]
