"""Local face verification (embeddings + liveness) for Stitch demo — no cloud APIs."""

from __future__ import annotations

from typing import Any

__all__ = [
    "DEFAULT_MATCH_THRESHOLD",
    "embed_bgr",
    "match_embeddings",
    "evaluate_liveness_sequence",
]


def __getattr__(name: str) -> Any:
    if name == "DEFAULT_MATCH_THRESHOLD":
        from face_verification.core import DEFAULT_MATCH_THRESHOLD

        return DEFAULT_MATCH_THRESHOLD
    if name == "embed_bgr":
        from face_verification.core import embed_bgr

        return embed_bgr
    if name == "match_embeddings":
        from face_verification.core import match_embeddings

        return match_embeddings
    if name == "evaluate_liveness_sequence":
        from face_verification.liveness import evaluate_liveness_sequence

        return evaluate_liveness_sequence
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
