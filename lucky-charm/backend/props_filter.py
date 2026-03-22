"""
Props policy filter: enforce contextual integrity.
Only metrics, themes, and velocity leave the TEE. No verbatim quotes.
Produces per-item sanitized summaries (keyword-derived) for collaboration.
Strict schema: categories must be from allowlist; unknown values map to "other".
"""
import re
from typing import Any

# Strict allowlist — only these values leave the TEE (reduces leakage)
ALLOWED_BLOCKER_CATEGORIES = frozenset({
    "integration", "environment", "resource", "task", "other",
})
ALLOWED_ACTION_THEMES = frozenset({
    "documentation", "review", "coordination", "commitment",
    "scoping", "feature", "role", "other",
})
ALLOWED_DECISION_THEMES = frozenset({
    "scope", "agreement", "next_steps", "topic", "other",
})


def _validate_category(value: str, allowed: frozenset[str], default: str = "other") -> str:
    """Map value to schema; reject unknown → default."""
    if not value or not isinstance(value, str):
        return default
    norm = value.lower().strip()
    return norm if norm in allowed else default


# Stopwords and pronouns — never appear in summaries (no identity/verbatim)
_STOPWORDS = frozenset({
    "i", "we", "you", "they", "he", "she", "it", "me", "us", "them",
    "my", "our", "your", "their", "his", "her",
    "will", "would", "do", "does", "did", "can", "could", "shall", "should",
    "am", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "the", "a", "an", "to", "of", "in", "for", "on",
    "with", "at", "by", "from", "as", "this", "that", "what", "who", "how",
    "just", "so", "yeah", "ok", "okay", "like", "say", "said", "get", "got",
    "someone", "something", "take", "make", "need", "want", "think", "going",
    "and", "or", "but", "if", "then", "let", "lets",
})

# Blocker category keywords for classification (no verbatim content)
BLOCKER_CATEGORIES = {
    "integration": ["blocking integration", "blocked by", "blocked on", "waiting on"],
    "environment": ["env down", "rate limit"],
    "resource": ["blocking", "blocked", "stuck", "impediment"],
    "task": ["task", "allocation", "role", "scoping", "goal"],
}

# Action item themes for classification (aligned with ALLOWED_ACTION_THEMES)
ACTION_THEMES = {
    "documentation": ["update", "write", "docs"],
    "review": ["review", "finish"],
    "coordination": ["someone take", "who's doing", "we need to"],
    "commitment": ["I'll", "I will", "to do"],
    "scoping": ["scope", "scoping", "define scope"],
    "feature": ["feature", "implement", "build"],
    "role": ["backend", "frontend", "assign", "ownership"],
}

# Decision themes (aligned with ALLOWED_DECISION_THEMES)
DECISION_THEMES = {
    "scope": ["scope to", "convergence", "scope"],
    "agreement": ["sounds good", "we decided", "agreed"],
    "next_steps": ["let's", "we're going to", "write this down", "get the repo"],
    "topic": ["topic", "direction", "focus", "convergence onto topic"],
}


def _classify_into_category(content: str, mapping: dict[str, list[str]]) -> str:
    """Map content to a theme/category without leaking verbatim text."""
    lower = content.lower()
    for category, keywords in mapping.items():
        if any(kw in lower for kw in keywords):
            return category
    return "other"


def _sanitize_summary(content: str, max_words: int = 6, max_len: int = 60) -> str:
    """
    Extract keyword-only summary from content. No verbatim quotes.
    Takes significant words (4+ chars, not stopwords), joins with " / ".
    Props-compliant: useful for collaboration without leaking identity or quotes.
    """
    if not content or not content.strip():
        return "—"
    # Tokenize: alphanumeric segments
    words = re.findall(r"[a-zA-Z0-9]+", content.lower())
    kept = []
    for w in words:
        if len(w) >= 2 and w not in _STOPWORDS:
            # Keep short domain terms (api, pr, etc.) or words 3+ chars
            if len(w) >= 3 or w in ("api", "pr", "ui", "ux", "db", "auth"):
                kept.append(w)
        if len(kept) >= max_words:
            break
    if not kept:
        return "—"
    summary = " / ".join(kept[:max_words])
    return summary[:max_len].rstrip(" /") if len(summary) > max_len else summary


def _sanitize_context(content: str, max_len: int = 200) -> str | None:
    """
    Sanitize extended context for LLM consumption. Props-compliant: no verbatim quotes,
    no identity. Uses keyword extraction for 1-2 sentence thematic context.
    """
    if not content or not content.strip():
        return None
    sanitized = _sanitize_summary(content, max_words=20, max_len=max_len)
    return sanitized if sanitized and sanitized != "—" else None


def _props_filter_blockers(blockers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Per-item output with sanitized summary + optional context (no verbatim). Schema-validated."""
    result = []
    for i, b in enumerate(blockers):
        raw = b.get("title", "") or b.get("description", "")
        summary = _sanitize_summary(raw)
        llm_cat = b.get("category")
        cat = _validate_category(llm_cat, ALLOWED_BLOCKER_CATEGORIES) if llm_cat else _classify_into_category(raw, BLOCKER_CATEGORIES)
        cat = _validate_category(cat, ALLOWED_BLOCKER_CATEGORIES)  # enforce schema
        ctx = _sanitize_context(b.get("context", "") or raw)
        out = {
            "id": b.get("id", f"b-{i}"),
            "category": cat,
            "summary": summary if summary != "—" else cat,
            "status": b.get("status", "In progress"),
            "since": b.get("since", "—"),
            "reported_by": "Team (from transcript)",
        }
        if ctx:
            out["context"] = ctx
        result.append(out)
    return result


def _props_filter_action_items(actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Per-item output with sanitized summary + optional context (no verbatim). Schema-validated."""
    result = []
    for i, a in enumerate(actions):
        raw = a.get("text", "") or a.get("title", "")
        summary = _sanitize_summary(raw)
        llm_theme = a.get("theme")
        theme = _validate_category(llm_theme, ALLOWED_ACTION_THEMES) if llm_theme else _classify_into_category(raw, ACTION_THEMES)
        theme = _validate_category(theme, ALLOWED_ACTION_THEMES)
        ctx = _sanitize_context(a.get("context", "") or raw)
        out = {
            "id": a.get("id", f"a-{i}"),
            "theme": theme,
            "summary": summary,
            "due": a.get("due", "—"),
            "assignee": "Team (from transcript)",
        }
        if ctx:
            out["context"] = ctx
        result.append(out)
    return result


def _props_filter_decisions(decisions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Per-item output with sanitized summary + optional context (no verbatim). Schema-validated."""
    result = []
    for i, d in enumerate(decisions):
        raw = d.get("text", "") or d.get("title", "")
        summary = _sanitize_summary(raw)
        llm_theme = d.get("theme")
        theme = _validate_category(llm_theme, ALLOWED_DECISION_THEMES) if llm_theme else _classify_into_category(raw, DECISION_THEMES)
        theme = _validate_category(theme, ALLOWED_DECISION_THEMES)
        ctx = _sanitize_context(d.get("context", "") or raw)
        out = {
            "id": d.get("id", f"d-{i}"),
            "theme": theme,
            "summary": summary,
            "date": d.get("date", "—"),
            "decided_by": "Team (from transcript)",
        }
        if ctx:
            out["context"] = ctx
        result.append(out)
    return result


def _aggregate_blockers_by_category(blockers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Aggregate blockers into category + count (no verbatim)."""
    by_cat: dict[str, dict[str, Any]] = {}
    for b in blockers:
        cat = _classify_into_category(b.get("title", ""), BLOCKER_CATEGORIES)
        if cat not in by_cat:
            by_cat[cat] = {"id": f"b-{cat}", "category": cat, "count": 0}
        by_cat[cat]["count"] += 1
    return list(by_cat.values())


def _apply_props_filter_action_items(actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Replace verbatim text with theme; keep due for velocity."""
    by_theme: dict[str, dict[str, Any]] = {}
    for a in actions:
        theme = _classify_into_category(a.get("text", ""), ACTION_THEMES)
        if theme not in by_theme:
            by_theme[theme] = {"id": f"a-{theme}", "theme": theme, "count": 0, "due_distribution": {}}
        by_theme[theme]["count"] += 1
        due = a.get("due", "—")
        by_theme[theme]["due_distribution"][due] = by_theme[theme]["due_distribution"].get(due, 0) + 1
    return list(by_theme.values())


def _apply_props_filter_decisions(decisions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Replace verbatim text with theme."""
    by_theme: dict[str, dict[str, Any]] = {}
    for d in decisions:
        theme = _classify_into_category(d.get("text", ""), DECISION_THEMES)
        if theme not in by_theme:
            by_theme[theme] = {"id": f"d-{theme}", "theme": theme, "count": 0}
        by_theme[theme]["count"] += 1
    return list(by_theme.values())


def apply_props_filter(raw_result: dict[str, Any]) -> dict[str, Any]:
    """
    Props policy filter: per-item sanitized summaries for collaboration.
    No verbatim quotes; keyword-derived summaries only.
    """
    blockers = _props_filter_blockers(raw_result.get("blockers", []))
    action_items = _props_filter_action_items(raw_result.get("action_items", []))
    decisions = _props_filter_decisions(raw_result.get("decisions", []))
    return {
        "blockers": blockers,
        "action_items": action_items,
        "decisions": decisions,
        "velocity": {
            "blocker_count": len(blockers),
            "action_item_count": len(action_items),
            "decision_count": len(decisions),
        },
        "themes": _compute_themes(raw_result),
    }


def _compute_themes(raw_result: dict[str, Any]) -> list[str]:
    """Extract high-level themes (no verbatim) from the result. Schema-validated."""
    themes = set()
    for b in raw_result.get("blockers", []):
        cat = b.get("category") or _classify_into_category(b.get("title", ""), BLOCKER_CATEGORIES)
        themes.add(_validate_category(cat, ALLOWED_BLOCKER_CATEGORIES))
    for a in raw_result.get("action_items", []):
        th = a.get("theme") or _classify_into_category(a.get("text", ""), ACTION_THEMES)
        themes.add(_validate_category(th, ALLOWED_ACTION_THEMES))
    for d in raw_result.get("decisions", []):
        th = d.get("theme") or _classify_into_category(d.get("text", ""), DECISION_THEMES)
        themes.add(_validate_category(th, ALLOWED_DECISION_THEMES))
    return list(themes)
