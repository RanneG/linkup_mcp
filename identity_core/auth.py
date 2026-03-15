"""
Auth verifier: ASC/U2SSO-aligned registration and authentication.

Supports:
- Mock mode: accepts valid-form requests without crypto verification (for demo).
- U2SSO mode: delegates to U2SSO server (future).
"""

from identity_core.schemas import (
    RegistrationRequest,
    RegistrationResponse,
    AuthRequest,
    AuthResponse,
    AuthStatus,
)
from identity_core.nullifier_store import NullifierStore


# Service name for standup bot (matches U2SSO sname format)
STANDUP_BOT_SERVICE = "standup_bot"


def _service_name_hex(service: str) -> str:
    """Hash service name to hex (simplified; U2SSO uses SHA256)."""
    import hashlib
    return hashlib.sha256(service.encode()).hexdigest()


class AuthVerifier:
    """
    Verifies registration and auth requests. Enforces nullifier replay rejection.
    """

    def __init__(self, nullifier_store: NullifierStore | None = None, mock: bool = True):
        self.nullifier_store = nullifier_store or NullifierStore()
        self.mock = mock  # If True, skip crypto verification (accept valid form)
        self._registered_spk: set[str] = set()  # For login: spk must be registered

    def verify_registration(self, req: RegistrationRequest) -> RegistrationResponse:
        """
        Verify registration. Enforces:
        1. Nullifier not previously used (replay rejection)
        2. Proof valid (mock: accept; real: call U2SSO)
        """
        verifier_id = req.service_name_hex
        if self.nullifier_store.is_used(verifier_id, req.nullifier_hex):
            return RegistrationResponse(
                status=AuthStatus.REPLAY,
                message="Nullifier already used for this service. Sybil resistance: one registration per identity.",
            )

        if self.mock:
            # Accept valid-form requests
            if not req.spk_hex or not req.proof_hex or req.ring_size_n < 2:
                return RegistrationResponse(
                    status=AuthStatus.INVALID_PROOF,
                    message="Invalid registration: spk, proof, and ring_size_n required.",
                )
            self.nullifier_store.register(verifier_id, req.nullifier_hex)
            self._registered_spk.add(req.spk_hex)
            return RegistrationResponse(
                status=AuthStatus.SUCCESS,
                message="Registration successful.",
            )

        # TODO: real U2SSO: call server's RegistrationVerify, then register nullifier
        return RegistrationResponse(
            status=AuthStatus.INVALID_PROOF,
            message="U2SSO backend not configured. Use mock mode.",
        )

    def verify_auth(self, req: AuthRequest) -> AuthResponse:
        """
        Verify login. Enforces:
        1. spk was previously registered
        2. Signature valid (mock: accept; real: call U2SSO AuthVerify)
        """
        if req.spk_hex not in self._registered_spk:
            return AuthResponse(
                status=AuthStatus.FAILED,
                message="Account not registered. Sign up first.",
            )

        if self.mock:
            if not req.signature_hex:
                return AuthResponse(
                    status=AuthStatus.INVALID_PROOF,
                    message="Invalid auth: signature required.",
                )
            import secrets
            return AuthResponse(
                status=AuthStatus.SUCCESS,
                message="Login successful.",
                session_token=secrets.token_hex(32),
            )

        # TODO: real U2SSO: call server's AuthVerify
        return AuthResponse(
            status=AuthStatus.INVALID_PROOF,
            message="U2SSO backend not configured. Use mock mode.",
        )
