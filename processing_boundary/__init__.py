"""
Processing boundary: transcript intake and aggregation.

TEE-ready abstraction: this module is designed to run inside a trusted boundary.
For now it runs locally; your partner can swap in a TEE implementation later.

Props-aligned: raw transcripts never leave; only role-level aggregates are returned.
"""

from processing_boundary.boundary import ProcessingBoundary
from processing_boundary.schemas import TranscriptSubmission, AggregatedReport

__all__ = ["ProcessingBoundary", "TranscriptSubmission", "AggregatedReport"]
