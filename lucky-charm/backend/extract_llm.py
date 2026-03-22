"""
Optional LLM-based extraction using Ollama.
Enable with OLLAMA_URL (e.g. http://localhost:11434). Uses rule-based fallback if unavailable.
When enabled, LLM must output categories/themes from the strict schema only (Props compliance).
"""
import json
import os
import re
from typing import Any
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

from extract import extract_from_transcript
from props_filter import (
    ALLOWED_BLOCKER_CATEGORIES,
    ALLOWED_ACTION_THEMES,
    ALLOWED_DECISION_THEMES,
)

_BLOCKER_OPTS = ", ".join(sorted(ALLOWED_BLOCKER_CATEGORIES))
_ACTION_OPTS = ", ".join(sorted(ALLOWED_ACTION_THEMES))
_DECISION_OPTS = ", ".join(sorted(ALLOWED_DECISION_THEMES))

EXTRACT_PROMPT = """Extract structured information from this meeting transcript.
Return ONLY valid JSON with exactly these keys (no other text):
{
  "blockers": [{"id": "b-0", "team": "Team", "title": "<keyword summary>", "category": "<MUST be one of: """ + _BLOCKER_OPTS + """", "context": "<1-2 sentence thematic summary, no names/quotes>", "since": "—", "reported_by": "Team"}],
  "action_items": [{"id": "a-0", "text": "<keyword summary>", "theme": "<MUST be one of: """ + _ACTION_OPTS + """", "context": "<why it matters>", "due": "This week", "assignee": "Team"}],
  "decisions": [{"id": "d-0", "text": "<keyword summary>", "theme": "<MUST be one of: """ + _DECISION_OPTS + """", "context": "<impact or rationale>", "date": "—", "decided_by": "Team"}]
}
RULES:
- category (blockers) and theme (action_items, decisions) MUST be from the allowed lists above. Use "other" if unsure.
- No verbatim quotes, no names. Use keyword-derived summaries only.
- context: 1-2 sentence thematic (e.g. "blocking staging deployment"). If none, omit or use empty string.
- If nothing found, use empty arrays [].
Transcript:
---
{transcript}
---"""


def _call_ollama(transcript: str, base_url: str, model: str = "llama3.2", timeout: int = 60) -> str | None:
    """Call Ollama /api/generate and return response text."""
    url = f"{base_url.rstrip('/')}/api/generate"
    body = json.dumps({
        "model": model,
        "prompt": EXTRACT_PROMPT.format(transcript=transcript[:8000]),  # truncate for token limit
        "stream": False,
    }).encode("utf-8")
    req = Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=timeout) as res:
            data = json.loads(res.read().decode("utf-8"))
            return data.get("response")
    except (URLError, HTTPError, json.JSONDecodeError, OSError):
        return None


def _parse_llm_response(text: str | None) -> dict[str, Any] | None:
    """Parse LLM output as JSON. Handle markdown code blocks."""
    if not text or not text.strip():
        return None
    cleaned = text.strip()
    # Remove markdown code fences
    for pattern in [r"```json\s*(.*?)\s*```", r"```\s*(.*?)\s*```"]:
        m = re.search(pattern, cleaned, re.DOTALL | re.IGNORECASE)
        if m:
            cleaned = m.group(1).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


def extract_with_llm(transcript: str) -> dict[str, Any]:
    """
    Try LLM extraction first; fall back to rule-based.
    Set OLLAMA_URL (e.g. http://localhost:11434) to enable.
    """
    base_url = os.environ.get("OLLAMA_URL", "").strip()
    if not base_url:
        return extract_from_transcript(transcript)

    model = os.environ.get("OLLAMA_MODEL", "llama3.2")
    timeout = int(os.environ.get("OLLAMA_TIMEOUT", "60"))

    response_text = _call_ollama(transcript, base_url, model=model, timeout=timeout)
    parsed = _parse_llm_response(response_text)

    if parsed and isinstance(parsed, dict):
        # Ensure required keys and structure
        return {
            "blockers": parsed.get("blockers") if isinstance(parsed.get("blockers"), list) else [],
            "action_items": parsed.get("action_items") if isinstance(parsed.get("action_items"), list) else [],
            "decisions": parsed.get("decisions") if isinstance(parsed.get("decisions"), list) else [],
        }

    return extract_from_transcript(transcript)
