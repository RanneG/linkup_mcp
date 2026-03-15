"""Schemas for transcript ingestion and aggregation."""

from dataclasses import dataclass, field
from typing import List
from datetime import datetime


@dataclass
class TranscriptSubmission:
    """Incoming transcript from an authenticated participant."""

    participant_id: str  # Pseudonym (spk or session-bound)
    transcript: str
    submitted_at: datetime | None = None


@dataclass
class AggregatedReport:
    """Role-level aggregate only. No participant names or raw transcript."""

    total_standups: int
    unique_participants: int
    all_blockers: List[str]
    all_completed: List[str]
    themes: List[str]
    generated_at: datetime = field(default_factory=datetime.utcnow)
