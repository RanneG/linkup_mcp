"""
Identity core: ASC/U2SSO-aligned verifier, nullifier store, claim validation.

For hackathon prototype: supports mock mode (no real U2SSO) and U2SSO-backed mode.
"""

from identity_core.schemas import (
    RegistrationRequest,
    RegistrationResponse,
    AuthRequest,
    AuthResponse,
    RoleClaim,
    AuthStatus,
)
from identity_core.nullifier_store import NullifierStore
from identity_core.auth import AuthVerifier

__all__ = [
    "RegistrationRequest",
    "RegistrationResponse",
    "AuthRequest",
    "AuthResponse",
    "RoleClaim",
    "AuthStatus",
    "NullifierStore",
    "AuthVerifier",
]
