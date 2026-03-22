"""
Extract blockers, action items, and decisions from meeting transcript text.
Output format matches the Lucky Charm dashboard (Team Lead / Team Member / Hackathon Host views).
Includes optional context field for LLM consumption (Props-compliant, thematic only).
"""
import re
from typing import Any


def _sanitize_for_context(text: str, max_len: int = 120) -> str | None:
    """Extract keyword-rich thematic context (no identity, Props-safe)."""
    if not text or len(text) < 15:
        return None
    # Keep significant words only
    words = re.findall(r"[a-zA-Z0-9]+", text.lower())
    stop = {"i", "we", "you", "they", "my", "our", "the", "a", "an", "to", "of", "in", "for", "on", "with", "at", "by"}
    kept = [w for w in words if len(w) >= 3 and w not in stop][:25]
    if len(kept) < 3:
        return None
    joined = " ".join(kept)
    return joined[:max_len] + ("…" if len(joined) > max_len else "")


def _lines_from_transcript(transcript: str) -> list[str]:
    """Normalize transcript into lines of content (speech or plain text)."""
    if not (transcript or transcript.strip()):
        return []
    lines = []
    # Tab-separated format: ... \t "Speech Segment" \t ...
    for raw in transcript.strip().splitlines():
        line = raw.strip()
        if not line:
            continue
        # If line looks like TSV, take the Speech Segment column (index 3, 0-based)
        if "\t" in line:
            parts = [p.strip().strip('"') for p in line.split("\t")]
            if len(parts) >= 4:
                lines.append(parts[3])
                continue
        lines.append(line)
    return lines


def _contains_any(s: str, *substrings: str) -> bool:
    lower = s.lower()
    return any(x.lower() in lower for x in substrings)


def extract_blockers(transcript: str) -> list[dict[str, Any]]:
    """Extract blocker-like items (team, title, since) for Team Lead / Team Member views."""
    lines = _lines_from_transcript(transcript)
    blockers = []
    seen = set()
    for i, line in enumerate(lines):
        if not line or len(line) < 10:
            continue
        # Phrases that suggest a blocker
        if _contains_any(
            line,
            "blocking",
            "blocked",
            "waiting on",
            "stuck",
            "can't",
            "won't work",
            "blocker",
            "blocking us",
            "blocked by",
            "blocked on",
            "impediment",
            "blocking integration",
            "env down",
            "rate limit",
        ):
            title = line[:200].strip()
            if title not in seen:
                seen.add(title)
                # Richer context for LLM: thematic expansion (Props-safe, no verbatim)
                ctx = _sanitize_for_context(title, max_len=120)
                b = {
                    "id": f"b-{len(blockers)}",
                    "team": "Team",
                    "title": title,
                    "since": "—",
                    "reported_by": "Team member (from transcript)",
                }
                if ctx:
                    b["context"] = ctx
                blockers.append(b)
    # If nothing matched, derive a couple from "Open code(s)" / task-like lines
    if not blockers and lines:
        for i, line in enumerate(lines[:30]):
            if _contains_any(line, "task", "allocation", "role", "scoping", "goal"):
                title = line[:200].strip()
                if title not in seen:
                    seen.add(title)
                    ctx = _sanitize_for_context(title, max_len=120)
                    b = {
                        "id": f"b-{len(blockers)}",
                        "team": "Team",
                        "title": title,
                        "since": "—",
                        "reported_by": "Team member (from transcript)",
                    }
                    if ctx:
                        b["context"] = ctx
                    blockers.append(b)
    return blockers[:20]


def extract_action_items(transcript: str) -> list[dict[str, Any]]:
    """Extract action items (text, due) for Team Member view."""
    lines = _lines_from_transcript(transcript)
    actions = []
    seen = set()
    due_map = ("Today", "Tomorrow", "This week", "Next week")
    for i, line in enumerate(lines):
        if not line or len(line) < 6:
            continue
        # "I'll do X", "I will X", "we need to X", "take X", "do X"
        if re.search(r"\b(I'll|I will|we need to|someone take|who's doing)\b", line, re.I):
            # Clean and shorten
            text = line[:180].strip()
            if text not in seen:
                seen.add(text)
                due = due_map[len(actions) % len(due_map)]
                assignee = (
                    "Speaker (self)"
                    if re.search(r"\b(I'll|I will)\b", line, re.I)
                    else "Team (unassigned)"
                )
                ctx = _sanitize_for_context(text, max_len=120)
                a = {
                    "id": f"a-{len(actions)}",
                    "text": text,
                    "due": due,
                    "assignee": assignee,
                }
                if ctx:
                    a["context"] = ctx
                actions.append(a)
        elif _contains_any(line, "action item", "to do", "finish", "review", "update", "write"):
            text = line[:180].strip()
            if text not in seen:
                seen.add(text)
                due = due_map[len(actions) % len(due_map)]
                ctx = _sanitize_for_context(text, max_len=120)
                a = {
                    "id": f"a-{len(actions)}",
                    "text": text,
                    "due": due,
                    "assignee": "Team (from transcript)",
                }
                if ctx:
                    a["context"] = ctx
                actions.append(a)
    return actions[:15]


def extract_decisions(transcript: str) -> list[dict[str, Any]]:
    """Extract decisions (text, date) for Team Lead / Team Member views."""
    lines = _lines_from_transcript(transcript)
    decisions = []
    seen = set()
    for i, line in enumerate(lines):
        if not line or len(line) < 6:
            continue
        if _contains_any(
            line,
            "sounds good",
            "let's",
            "we're going to",
            "we decided",
            "agreed",
            "convergence",
            "scope to",
            "write this down",
            "get the repo",
        ):
            text = line[:200].strip()
            if text not in seen and len(text) > 10:
                seen.add(text)
                ctx = _sanitize_for_context(text, max_len=120)
                d = {
                    "id": f"d-{len(decisions)}",
                    "text": text,
                    "date": "—",
                    "decided_by": "Team (from transcript)",
                }
                if ctx:
                    d["context"] = ctx
                decisions.append(d)
    return decisions[:15]


def extract_from_transcript(transcript: str) -> dict[str, Any]:
    """Run extraction and return payload matching dashboard format."""
    return {
        "blockers": extract_blockers(transcript),
        "action_items": extract_action_items(transcript),
        "decisions": extract_decisions(transcript),
    }
