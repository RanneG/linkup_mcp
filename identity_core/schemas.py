"""
Frozen auth flow and message schemas for SSO demo.

Aligned with U2SSO/ASC: master identity, per-SP pseudonym, nullifier, proof.
"""

from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class AuthStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    REPLAY = "replay"
    INVALID_PROOF = "invalid_proof"


@dataclass(frozen=True)
class RegistrationRequest:
    """Sign-up request from client. Aligned with U2SSO signup form."""

    username: str
    spk_hex: str  # Public key (spk) for the pseudonymous account
    nullifier_hex: str  # Verifier-scoped nullifier for Sybil resistance
    proof_hex: str  # Membership proof
    ring_size_n: int  # Ring size (N)
    challenge_hex: str
    service_name_hex: str


@dataclass
class RegistrationResponse:
    """Response from registration verification."""

    status: AuthStatus
    message: str = ""


@dataclass(frozen=True)
class AuthRequest:
    """Login request from client. Aligned with U2SSO login form."""

    username: str
    spk_hex: str  # Public key for the account
    signature_hex: str  # Auth proof (digital signature)
    challenge_hex: str
    service_name_hex: str


@dataclass
class AuthResponse:
    """Response from auth verification."""

    status: AuthStatus
    message: str = ""
    session_token: Optional[str] = None


@dataclass(frozen=True)
class RoleClaim:
    """Minimal role claim for standup bot. Extensible for future."""

    role: str  # e.g. "participant", "manager"
    verifier_id: str  # Service/verifier ID
