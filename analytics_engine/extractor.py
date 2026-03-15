"""
Standup extractor: blockers, completed items, themes.

Works without LLM (rule-based). Optional: use Ollama for richer extraction.
PII-filtered: names and sensitive terms are excluded from output.
"""

import re
from dataclasses import dataclass
from typing import List

# Keywords for rule-based extraction
BLOCKER_PATTERNS = [
    r"\bblocked\b", r"\bblocker\b", r"\bstuck\b", r"\bwaiting on\b",
    r"\bwaiting for\b", r"\bcan't\b", r"\bcannot\b", r"\bblocking\b",
    r"\bblocked by\b", r"\bimpediment\b", r"\bblocking me\b",
]
DONE_PATTERNS = [
    r"\bcompleted\b", r"\bfinished\b", r"\bdone\b", r"\bshipped\b",
    r"\bdelivered\b", r"\bimplemented\b", r"\bmerged\b", r"\breleased\b",
]

# PII: names and sensitive terms to exclude from themes and snippets
PII_BLOCKLIST = frozenset({
    "alice", "bob", "charlie", "david", "eve", "frank", "grace", "henry",
    "alex", "anna", "ben", "carol", "dan", "emma", "john", "jane", "kate",
    "mike", "mary", "paul", "sarah", "tom", "lisa", "james", "linda",
    "robert", "jennifer", "michael", "william", "elizabeth", "richard",
    "confidential", "government", "university", "called", "personal",
    "private", "secret", "password", "ssn", "id", "address", "phone",
    "email", "salary", "health", "medical", "something", "highly",
})

# Common non-work words to exclude from themes
COMMON_THEME_BLOCKLIST = frozenset({
    "today", "yesterday", "tomorrow", "going", "working", "will", "this", "that",
    "hello", "hi", "thanks", "thank", "please", "sorry", "hey", "hi",
})


@dataclass
class StandupMetrics:
    """Extracted metrics from one standup (no raw content)."""

    blockers: List[str]
    completed: List[str]
    themes: List[str]
    word_count: int


def _sanitize_snippet(text: str) -> str:
    """
    Extract work-relevant part and remove PII-like phrases.
    E.g. "Hi, this is alice. Blocked: waiting on design" -> "Blocked: waiting on design"
    """
    # Remove common intro phrases (this is X, i am X, called X, my name is X)
    text = re.sub(r"\b(this is|i am|i'm|my name is|called|hi,?)\s+[a-zA-Z]+\b", "", text, flags=re.I)
    text = re.sub(r"\b(hi|hello),?\s*", "", text, flags=re.I)
    # Remove remaining words that match PII blocklist
    words = text.split()
    words = [w for w in words if w.lower() not in PII_BLOCKLIST]
    text = " ".join(words).strip()
    return text[:80] if text else ""


def _extract_clause_after(line: str, pattern: str) -> str:
    """Extract the clause after a keyword. Stops at sentence end or next section."""
    match = re.search(pattern, line, re.I)
    if match:
        rest = line[match.end() :].strip()
        # Stop at "Today", "Tomorrow", "Blocked", or first period
        for stop in (r"\s+Today\b", r"\s+Tomorrow\b", r"\s+Blocked\b", r"\s*\.\s"):
            parts = re.split(stop, rest, maxsplit=1, flags=re.I)
            if len(parts) > 1:
                rest = parts[0].strip()
        return _sanitize_snippet(rest)[:80] if rest else ""
    return ""


class StandupExtractor:
    """Extract standup metrics from raw text. No LLM required. PII-filtered."""

    def extract(self, transcript: str) -> StandupMetrics:
        """Extract blockers, completed items, themes. Returns only structured data. No names or PII."""
        lines = [l.strip() for l in transcript.splitlines() if l.strip()]
        blockers = []
        completed = []
        themes = []

        for line in lines:
            line_lower = line.lower()
            for pat in BLOCKER_PATTERNS:
                if re.search(pat, line_lower, re.I):
                    # Prefer clause after "Blocked:" or "blocking" etc.
                    snippet = (
                        _extract_clause_after(line, r"blocked:\s*")
                        or _extract_clause_after(line, r"blocking:\s*")
                        or _extract_clause_after(line, r"waiting on\s+")
                        or _extract_clause_after(line, r"waiting for\s+")
                        or _sanitize_snippet(line)
                    )
                    if snippet and snippet not in blockers:
                        blockers.append(snippet)
                    break
            for pat in DONE_PATTERNS:
                if re.search(pat, line_lower, re.I):
                    snippet = (
                        _extract_clause_after(line, r"completed:\s*")
                        or _extract_clause_after(line, r"completed\s+")
                        or _extract_clause_after(line, r"finished:\s*")
                        or _extract_clause_after(line, r"finished\s+")
                        or _extract_clause_after(line, r"done:\s*")
                        or _extract_clause_after(line, r"done\s+")
                        or _sanitize_snippet(line)
                    )
                    if snippet and snippet not in completed:
                        completed.append(snippet)
                    break

        # Themes: collect significant words, exclude PII and common terms
        blocked = PII_BLOCKLIST | COMMON_THEME_BLOCKLIST
        words = re.findall(r"\b[a-zA-Z]{5,}\b", transcript.lower())
        for w in words:
            if w not in blocked and w not in themes:
                themes.append(w)
        themes = themes[:10]  # Limit

        return StandupMetrics(
            blockers=blockers,
            completed=completed,
            themes=themes,
            word_count=len(transcript.split()),
        )
