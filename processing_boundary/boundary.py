"""
Processing boundary: receives transcripts, returns only aggregates.

TEE-ready: designed to run inside a trusted boundary. For now runs locally.
Partner can replace this with a TEE-backed implementation.

Props-aligned: raw transcript is processed and discarded; only aggregates persist.
"""

from collections import defaultdict
from datetime import datetime
from typing import Dict, List

from analytics_engine import StandupExtractor
from processing_boundary.schemas import TranscriptSubmission, AggregatedReport


class ProcessingBoundary:
    """
    Trusted processing boundary. Ingests transcripts, outputs role-level aggregates only.

    No raw transcript is stored or returned. Only extracted metrics are accumulated.
    """

    def __init__(self):
        self.extractor = StandupExtractor()
        # Accumulated metrics by participant (for aggregation). No raw text.
        self._metrics_by_participant: Dict[str, List[dict]] = defaultdict(list)

    def process(self, submission: TranscriptSubmission) -> AggregatedReport:
        """
        Process transcript and return updated team aggregate.
        Raw transcript is never stored.
        """
        metrics = self.extractor.extract(submission.transcript)
        # Store only structured metrics, not raw transcript
        self._metrics_by_participant[submission.participant_id].append({
            "blockers": metrics.blockers,
            "completed": metrics.completed,
            "themes": metrics.themes,
            "word_count": metrics.word_count,
        })
        return self._build_report()

    def get_report(self) -> AggregatedReport:
        """Return current aggregated report without processing new transcript."""
        return self._build_report()

    def _build_report(self) -> AggregatedReport:
        """Build role-level aggregate. No participant identifiers in output."""
        all_blockers: List[str] = []
        all_completed: List[str] = []
        all_themes: List[str] = []
        for participant_metrics in self._metrics_by_participant.values():
            for m in participant_metrics:
                all_blockers.extend(m["blockers"])
                all_completed.extend(m["completed"])
                all_themes.extend(m["themes"])

        # Deduplicate while preserving order
        seen_b, seen_c, seen_t = set(), set(), set()
        blockers = [x for x in all_blockers if x not in seen_b and not seen_b.add(x)]
        completed = [x for x in all_completed if x not in seen_c and not seen_c.add(x)]
        themes = [x for x in all_themes if x not in seen_t and not seen_t.add(x)][:15]

        total = sum(len(m) for m in self._metrics_by_participant.values())
        return AggregatedReport(
            total_standups=total,
            unique_participants=len(self._metrics_by_participant),
            all_blockers=blockers,
            all_completed=completed,
            themes=themes,
            generated_at=datetime.utcnow(),
        )
