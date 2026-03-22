"""
Participant-based aggregation: store Props output metrics by participant_id + date.
No raw transcript; only counts (blockers, actions, decisions) for trend charts.
In-memory MVP with TTL to prevent unbounded growth.
"""
from collections import OrderedDict
from datetime import datetime, timedelta
import os

# In-memory: (participant_id, date) -> { blocker_count, action_count, decision_count }
_store: dict[tuple[str, str], dict] = OrderedDict()
_max_entries = int(os.environ.get("AGGREGATION_MAX_ENTRIES", "1000"))
_ttl_days = int(os.environ.get("AGGREGATION_TTL_DAYS", "30"))


def _today() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")


def _evict_old():
    """Remove oldest entries if over limit; also drop entries older than TTL."""
    cutoff = (datetime.utcnow() - timedelta(days=_ttl_days)).strftime("%Y-%m-%d")
    to_remove = []
    for (pid, date), _ in _store.items():
        if date < cutoff:
            to_remove.append((pid, date))
    for k in to_remove:
        _store.pop(k, None)
    while len(_store) > _max_entries:
        _store.popitem(last=False)


def append(participant_id: str, blocker_count: int, action_count: int, decision_count: int, date: str | None = None):
    """Append one day's metrics for a participant. Idempotent per (participant_id, date) — sums if already exists."""
    if not participant_id or not participant_id.strip():
        return
    pid = participant_id.strip()
    dt = (date or _today()).strip() or _today()
    key = (pid, dt)
    existing = _store.get(key, {"blocker_count": 0, "action_count": 0, "decision_count": 0})
    _store[key] = {
        "blocker_count": existing["blocker_count"] + blocker_count,
        "action_count": existing["action_count"] + action_count,
        "decision_count": existing["decision_count"] + decision_count,
    }
    _store.move_to_end(key)
    _evict_old()


def get_aggregates(participant_id: str) -> list[dict]:
    """Return time-series for participant: [{ date, blocker_count, action_count, decision_count }, ...] sorted by date."""
    if not participant_id or not participant_id.strip():
        return []
    pid = participant_id.strip()
    rows = []
    for (p, date), counts in _store.items():
        if p == pid:
            rows.append({
                "date": date,
                "blocker_count": counts["blocker_count"],
                "action_count": counts["action_count"],
                "decision_count": counts["decision_count"],
            })
    rows.sort(key=lambda r: r["date"])
    return rows
