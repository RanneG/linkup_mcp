"""Google OAuth 2.0 (PKCE) + Gmail API + naive subscription parsing."""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import re
import secrets
import urllib.parse
from datetime import datetime, timezone
from typing import Any

import requests

logger = logging.getLogger(__name__)

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.readonly",
]

TOKEN_URL = "https://oauth2.googleapis.com/token"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def claims_from_id_token(id_token: str | None) -> dict[str, Any] | None:
    """Decode JWT payload (no signature verify). Safe here because `id_token` came from Google's token endpoint."""
    if not id_token or not isinstance(id_token, str):
        return None
    parts = id_token.split(".")
    if len(parts) != 3:
        return None
    payload_b64 = parts[1]
    pad = "=" * (-len(payload_b64) % 4)
    try:
        raw = base64.urlsafe_b64decode(payload_b64 + pad)
        data = json.loads(raw.decode("utf-8"))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return None
    return data if isinstance(data, dict) else None


def userinfo_from_token_response(token: dict[str, Any]) -> dict[str, Any]:
    """Prefer id_token claims to skip a round-trip to the userinfo endpoint (saves latency on sign-in)."""
    claims = claims_from_id_token(token.get("id_token"))
    if isinstance(claims, dict):
        email = (str(claims.get("email") or "")).strip()
        if email:
            out: dict[str, Any] = {"email": email, "sub": claims.get("sub"), "picture": claims.get("picture")}
            return out
    access = token.get("access_token") or ""
    if not access:
        raise ValueError("missing access_token")
    return fetch_userinfo(access)


def _client_id() -> str:
    return os.getenv("GOOGLE_OAUTH_CLIENT_ID", os.getenv("GOOGLE_CLIENT_ID", "")).strip()


def _client_secret() -> str:
    return os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", os.getenv("GOOGLE_CLIENT_SECRET", "")).strip()


def redirect_uri() -> str:
    return os.getenv(
        "STITCH_GOOGLE_REDIRECT_URI",
        f"http://127.0.0.1:{os.getenv('STITCH_RAG_BRIDGE_PORT', '8765')}/api/auth/google/callback",
    ).strip()


def oauth_configured() -> bool:
    return bool(_client_id() and _client_secret())


def pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).decode().rstrip("=")
    return verifier, challenge


def build_authorize_url(state: str, code_challenge: str) -> str:
    cid = _client_id()
    ru = redirect_uri()
    scope = " ".join(SCOPES)
    q = urllib.parse.urlencode(
        {
            "client_id": cid,
            "redirect_uri": ru,
            "response_type": "code",
            "scope": scope,
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
    )
    return f"{AUTH_URL}?{q}"


def exchange_code(code: str, code_verifier: str) -> dict[str, Any]:
    data = {
        "code": code,
        "client_id": _client_id(),
        "client_secret": _client_secret(),
        "redirect_uri": redirect_uri(),
        "grant_type": "authorization_code",
        "code_verifier": code_verifier,
    }
    r = requests.post(TOKEN_URL, data=data, timeout=30)
    if not r.ok:
        logger.warning("token exchange failed: %s %s", r.status_code, r.text[:500])
        r.raise_for_status()
    return r.json()


def refresh_access(refresh_token: str) -> dict[str, Any]:
    data = {
        "refresh_token": refresh_token,
        "client_id": _client_id(),
        "client_secret": _client_secret(),
        "grant_type": "refresh_token",
    }
    r = requests.post(TOKEN_URL, data=data, timeout=30)
    r.raise_for_status()
    return r.json()


def fetch_userinfo(access_token: str) -> dict[str, Any]:
    r = requests.get(USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}, timeout=20)
    r.raise_for_status()
    return r.json()


def gmail_list_message_ids(access_token: str, q: str, max_results: int = 40) -> list[str]:
    base = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
    params = urllib.parse.urlencode({"q": q, "maxResults": str(max_results)})
    r = requests.get(f"{base}?{params}", headers={"Authorization": f"Bearer {access_token}"}, timeout=40)
    if r.status_code == 429:
        raise RuntimeError("Gmail API quota exceeded — try again later or use cached data.")
    r.raise_for_status()
    data = r.json()
    return [m["id"] for m in data.get("messages") or [] if isinstance(m, dict) and m.get("id")]


def gmail_get_message(access_token: str, mid: str) -> dict[str, Any]:
    url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{mid}"
    r = requests.get(
        url,
        headers={"Authorization": f"Bearer {access_token}"},
        params=[("format", "metadata"), ("metadataHeaders", "Subject"), ("metadataHeaders", "From")],
        timeout=30,
    )
    if r.status_code == 429:
        raise RuntimeError("Gmail API quota exceeded")
    r.raise_for_status()
    return r.json()


_MONEY = re.compile(r"\$\s*([0-9]{1,4}(?:[.,][0-9]{2})?)")
_DATE_ISO = re.compile(r"\b(20[2-3][0-9])-([01][0-9])-([0-3][0-9])\b")
_DATE_US = re.compile(r"\b([A-Za-z]{3,9})\s+([0-3]?[0-9]),?\s+(20[2-3][0-9])\b")

_SERVICE_HINTS = [
    (re.compile(r"netflix", re.I), "Netflix", "streaming"),
    (re.compile(r"spotify", re.I), "Spotify", "music"),
    (re.compile(r"hulu", re.I), "Hulu", "streaming"),
    (re.compile(r"amazon\s*prime|prime\s*video", re.I), "Amazon Prime", "shopping"),
    (re.compile(r"apple\s*(tv|music|one)?", re.I), "Apple Services", "software"),
    (re.compile(r"youtube\s*premium|google\s*one", re.I), "Google / YouTube", "software"),
    (re.compile(r"disney\+?", re.I), "Disney+", "streaming"),
    (re.compile(r"adobe", re.I), "Adobe", "software"),
    (re.compile(r"microsoft\s*365|office\s*365", re.I), "Microsoft 365", "software"),
    (re.compile(r"dropbox", re.I), "Dropbox", "software"),
    (re.compile(r"notion", re.I), "Notion", "software"),
    (re.compile(r"peloton", re.I), "Peloton", "fitness"),
]


def _parse_date_from_text(text: str) -> str | None:
    m = _DATE_ISO.search(text)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = _DATE_US.search(text)
    if m:
        try:
            dt = datetime.strptime(f"{m.group(1)} {m.group(2)} {m.group(3)}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            try:
                dt = datetime.strptime(f"{m.group(1)[:3]} {m.group(2)} {m.group(3)}", "%b %d %Y")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                return None
    return None


def _service_from_text(text: str) -> tuple[str, str] | None:
    for rx, name, cat in _SERVICE_HINTS:
        if rx.search(text):
            return name, cat
    return None


def parse_subscription_candidate(subject: str, snippet: str, from_header: str, account_email: str) -> dict[str, Any] | None:
    blob = f"{subject}\n{snippet}\n{from_header}".lower()
    keywords = (
        "subscription",
        "renewal",
        "receipt",
        "invoice",
        "billing",
        "your plan",
        "payment",
        "charged",
        "membership",
    )
    if not any(k in blob for k in keywords):
        return None
    svc = _service_from_text(blob)
    if not svc:
        return None
    name, category = svc
    money = _MONEY.search(subject + " " + snippet)
    amount = float(money.group(1).replace(",", "")) if money else None
    due = _parse_date_from_text(subject + " " + snippet)
    if not due:
        due = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    conf = 0.45
    if amount is not None:
        conf += 0.2
    if _DATE_ISO.search(subject + snippet) or _DATE_US.search(subject + snippet):
        conf += 0.15
    conf = min(0.95, conf)
    return {
        "serviceName": name,
        "planName": subject[:120],
        "amountUsd": amount,
        "renewalDateIso": due,
        "category": category,
        "confidence": round(conf, 2),
        "sourceEmail": account_email,
        "fromPreview": from_header[:160],
        "needsReview": conf < 0.65 or amount is None,
    }


def gmail_search_query() -> str:
    """Broad Gmail search; we filter in Python."""
    senders = (
        "from:netflix.com OR from:spotify.com OR from:hulu.com OR from:apple.com OR from:google.com "
        "OR from:amazon.com OR from:disney.com OR from:adobe.com OR from:microsoft.com OR from:paypal.com"
    )
    terms = (
        "(subscription OR renewal OR receipt OR invoice OR billing OR receipt OR charged OR membership OR "
        "\"your plan\" OR \"auto-renew\")"
    )
    return f"newer_than:90d {senders} {terms}"


def discover_subscriptions(access_token: str, account_email: str) -> list[dict[str, Any]]:
    q = gmail_search_query()
    try:
        ids = gmail_list_message_ids(access_token, q, max_results=35)
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code in (401, 403):
            raise RuntimeError("Permission missing — re-authenticate with Gmail scope.") from e
        raise
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str | None]] = set()
    for mid in ids:
        try:
            msg = gmail_get_message(access_token, mid)
        except Exception as e:  # noqa: BLE001
            logger.debug("skip message %s: %s", mid, e)
            continue
        headers = {h["name"].lower(): h.get("value", "") for h in msg.get("payload", {}).get("headers", []) if isinstance(h, dict)}
        subj = headers.get("subject", "(no subject)")
        snippet = msg.get("snippet", "") or ""
        frm = headers.get("from", "")
        cand = parse_subscription_candidate(subj, snippet, frm, account_email)
        if not cand:
            continue
        key = (cand["serviceName"], cand.get("amountUsd"))
        if key in seen:
            continue
        seen.add(key)
        cand["messageId"] = mid
        out.append(cand)
    return out
