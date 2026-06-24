"""
Pure scoring heuristics for the PDF RAG workflow.

No LlamaIndex / Ollama / embedding imports, so these are unit-testable in the
default install profile (CI) without model downloads. `rag.RAGWorkflow`
delegates here; thresholds remain overridable per-workflow instance.
"""
from __future__ import annotations

import re
from collections.abc import Iterable, Sequence

# Defaults used by RAGWorkflow (kept as instance attributes there so they can
# be tuned without touching this module).
WEAK_EVIDENCE_THRESHOLD = 0.35
HIGH_CONFIDENCE_THRESHOLD = 0.75
MEDIUM_CONFIDENCE_THRESHOLD = 0.5
KEYWORD_COVERAGE_THRESHOLD = 0.12
SNIPPET_MAX_CHARS = 260

STOPWORDS: frozenset[str] = frozenset(
    {
        "what",
        "when",
        "where",
        "which",
        "who",
        "why",
        "how",
        "the",
        "and",
        "for",
        "with",
        "from",
        "that",
        "this",
        "are",
        "was",
        "were",
        "about",
        "into",
        "your",
        "give",
        "exact",
        "official",
    }
)


def make_snippet(text: str, max_chars: int = SNIPPET_MAX_CHARS) -> str:
    """Single-line preview used for source cards (same truncation as v1)."""
    flat = text.strip().replace("\n", " ")
    return flat[:max_chars] + ("..." if len(flat) > max_chars else "")


def is_weak_evidence(
    scores: Iterable[float | None],
    threshold: float = WEAK_EVIDENCE_THRESHOLD,
) -> bool:
    """True when the best retrieval score exists but is below the threshold."""
    present = [s for s in scores if s is not None]
    if not present:
        return False
    return max(present) < threshold


def confidence_label(
    scores: Iterable[float | None],
    high: float = HIGH_CONFIDENCE_THRESHOLD,
    medium: float = MEDIUM_CONFIDENCE_THRESHOLD,
) -> str:
    """Map the best retrieval score to high / medium / low."""
    present = [s for s in scores if s is not None]
    if not present:
        return "low"
    top = max(present)
    if top >= high:
        return "high"
    if top >= medium:
        return "medium"
    return "low"


def keyword_coverage(
    query: str,
    corpus_texts: Sequence[str],
    stopwords: frozenset[str] = STOPWORDS,
) -> float:
    """Fraction of meaningful query terms (len >= 4, non-stopword) present in the corpus.

    Returns 1.0 when the query has no meaningful terms (nothing to check).
    """
    query_terms = {
        token
        for token in re.findall(r"[a-zA-Z0-9]+", query.lower())
        if len(token) >= 4 and token not in stopwords
    }
    if not query_terms:
        return 1.0
    corpus_text = " ".join(text.lower() for text in corpus_texts)
    matched = {term for term in query_terms if term in corpus_text}
    return len(matched) / len(query_terms)
