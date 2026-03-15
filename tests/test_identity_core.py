"""
Tests for identity-core: registration, auth, replay rejection.
"""

import pytest
from identity_core import (
    AuthVerifier,
    NullifierStore,
    RegistrationRequest,
    AuthRequest,
    AuthStatus,
)


@pytest.fixture
def nullifier_store():
    return NullifierStore()


@pytest.fixture
def verifier(nullifier_store):
    return AuthVerifier(nullifier_store=nullifier_store, mock=True)


def test_registration_success(verifier):
    req = RegistrationRequest(
        username="alice",
        spk_hex="a" * 64,
        nullifier_hex="n1" * 32,
        proof_hex="p" * 64,
        ring_size_n=2,
        challenge_hex="c" * 64,
        service_name_hex="s" * 64,
    )
    resp = verifier.verify_registration(req)
    assert resp.status == AuthStatus.SUCCESS


def test_registration_replay_rejected(verifier):
    req = RegistrationRequest(
        username="alice",
        spk_hex="a" * 64,
        nullifier_hex="same_nullifier",
        proof_hex="p" * 64,
        ring_size_n=2,
        challenge_hex="c" * 64,
        service_name_hex="s" * 64,
    )
    resp1 = verifier.verify_registration(req)
    assert resp1.status == AuthStatus.SUCCESS

    # Same nullifier again = replay
    resp2 = verifier.verify_registration(req)
    assert resp2.status == AuthStatus.REPLAY
    assert "Nullifier already used" in resp2.message


def test_registration_different_nullifier_allowed(verifier):
    req1 = RegistrationRequest(
        username="alice",
        spk_hex="spk1" * 16,
        nullifier_hex="null1",
        proof_hex="p" * 64,
        ring_size_n=2,
        challenge_hex="c" * 64,
        service_name_hex="s" * 64,
    )
    req2 = RegistrationRequest(
        username="bob",
        spk_hex="spk2" * 16,
        nullifier_hex="null2",
        proof_hex="p" * 64,
        ring_size_n=2,
        challenge_hex="c" * 64,
        service_name_hex="s" * 64,
    )
    assert verifier.verify_registration(req1).status == AuthStatus.SUCCESS
    assert verifier.verify_registration(req2).status == AuthStatus.SUCCESS


def test_auth_requires_registration(verifier):
    req = AuthRequest(
        username="alice",
        spk_hex="unknown_spk",
        signature_hex="sig" * 32,
        challenge_hex="c" * 64,
        service_name_hex="s" * 64,
    )
    resp = verifier.verify_auth(req)
    assert resp.status == AuthStatus.FAILED
    assert "not registered" in resp.message


def test_auth_success_after_registration(verifier):
    reg_req = RegistrationRequest(
        username="alice",
        spk_hex="my_spk" * 16,
        nullifier_hex="n1",
        proof_hex="p" * 64,
        ring_size_n=2,
        challenge_hex="c" * 64,
        service_name_hex="s" * 64,
    )
    verifier.verify_registration(reg_req)

    auth_req = AuthRequest(
        username="alice",
        spk_hex="my_spk" * 16,
        signature_hex="sig" * 32,
        challenge_hex="c" * 64,
        service_name_hex="s" * 64,
    )
    resp = verifier.verify_auth(auth_req)
    assert resp.status == AuthStatus.SUCCESS
    assert resp.session_token is not None


def test_nullifier_store_verifier_scoped(nullifier_store):
    """Nullifier reuse in one verifier = replay; different verifier = allowed."""
    nullifier_store.register("verifier_a", "n1")
    assert nullifier_store.register("verifier_a", "n1") is False  # replay
    assert nullifier_store.register("verifier_b", "n1") is True  # different verifier
