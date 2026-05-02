"""SQLite persistence for OAuth state, encrypted refresh tokens, and opaque sessions."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import sqlite3
import threading
import time
import uuid
from pathlib import Path

from cryptography.fernet import Fernet

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def _db_path() -> Path:
    raw = os.getenv("STITCH_AUTH_DB", "").strip()
    if raw:
        return Path(raw)
    return Path.home() / ".stitch" / "stitch_auth.db"


def _fernet() -> Fernet:
    key_env = os.getenv("STITCH_GOOGLE_FERNET_KEY", "").strip()
    if key_env:
        key = key_env.encode()
        if len(key) != 44:
            key = base64.urlsafe_b64encode(hashlib.sha256(key).digest())
        return Fernet(key)
    path = Path.home() / ".stitch" / ".google_fernet_key"
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_bytes(Fernet.generate_key())
    return Fernet(path.read_bytes())


def _get_conn() -> sqlite3.Connection:
    global _conn
    with _lock:
        if _conn is None:
            p = _db_path()
            p.parent.mkdir(parents=True, exist_ok=True)
            _conn = sqlite3.connect(str(p), check_same_thread=False)
            _conn.row_factory = sqlite3.Row
            _migrate(_conn)
        return _conn


def _migrate(c: sqlite3.Connection) -> None:
    c.executescript(
        """
        CREATE TABLE IF NOT EXISTS oauth_pending (
            state TEXT PRIMARY KEY,
            code_verifier TEXT NOT NULL,
            client_origin TEXT NOT NULL,
            linking_session_id TEXT,
            created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS google_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            google_sub TEXT,
            refresh_token_enc BLOB NOT NULL,
            picture_url TEXT,
            created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            created_at REAL NOT NULL,
            expires_at REAL NOT NULL,
            active_email TEXT,
            payload_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS subscriptions (
            id TEXT PRIMARY KEY,
            owner_email TEXT NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            amount_usd REAL NOT NULL,
            due_date_iso TEXT NOT NULL,
            status TEXT NOT NULL,
            source_email TEXT,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_subscriptions_owner_email
            ON subscriptions(owner_email);
        """
    )
    c.commit()


def oauth_pending_save(
    state: str,
    code_verifier: str,
    client_origin: str,
    linking_session_id: str | None,
) -> None:
    c = _get_conn()
    now = time.time()
    with _lock:
        c.execute("DELETE FROM oauth_pending WHERE created_at < ?", (now - 900,))
        c.execute(
            "INSERT OR REPLACE INTO oauth_pending (state, code_verifier, client_origin, linking_session_id, created_at) VALUES (?,?,?,?,?)",
            (state, code_verifier, client_origin, linking_session_id, now),
        )
        c.commit()


def oauth_pending_pop(state: str) -> dict | None:
    c = _get_conn()
    with _lock:
        row = c.execute("SELECT * FROM oauth_pending WHERE state = ?", (state,)).fetchone()
        if row is None:
            return None
        c.execute("DELETE FROM oauth_pending WHERE state = ?", (state,))
        c.commit()
        return dict(row)


def google_account_upsert(email: str, google_sub: str | None, refresh_token: str, picture_url: str | None) -> int:
    f = _fernet()
    blob = f.encrypt(refresh_token.encode())
    c = _get_conn()
    with _lock:
        row = c.execute("SELECT id FROM google_accounts WHERE email = ?", (email,)).fetchone()
        if row:
            aid = int(row["id"])
            c.execute(
                "UPDATE google_accounts SET google_sub = ?, refresh_token_enc = ?, picture_url = ? WHERE id = ?",
                (google_sub, blob, picture_url, aid),
            )
        else:
            cur = c.execute(
                "INSERT INTO google_accounts (email, google_sub, refresh_token_enc, picture_url, created_at) VALUES (?,?,?,?,?)",
                (email, google_sub, blob, picture_url, time.time()),
            )
            aid = int(cur.lastrowid)
        c.commit()
        return aid


def google_account_by_id(account_id: int) -> dict | None:
    c = _get_conn()
    row = c.execute("SELECT * FROM google_accounts WHERE id = ?", (account_id,)).fetchone()
    return dict(row) if row else None


def google_account_by_email(email: str) -> dict | None:
    c = _get_conn()
    row = c.execute("SELECT * FROM google_accounts WHERE email = ?", (email,)).fetchone()
    return dict(row) if row else None


def decrypt_refresh(row: dict) -> str:
    return _fernet().decrypt(row["refresh_token_enc"]).decode()


def session_create(account_ids: list[int], active_email: str) -> str:
    sid = uuid.uuid4().hex
    now = time.time()
    ttl = float(os.getenv("STITCH_SESSION_TTL_SEC", str(30 * 24 * 3600)))
    payload = {"account_ids": account_ids, "active_email": active_email}
    c = _get_conn()
    with _lock:
        c.execute(
            "INSERT INTO sessions (id, created_at, expires_at, active_email, payload_json) VALUES (?,?,?,?,?)",
            (sid, now, now + ttl, active_email, json.dumps(payload)),
        )
        c.commit()
    return sid


def session_load(session_id: str) -> dict | None:
    c = _get_conn()
    row = c.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    if row is None:
        return None
    if time.time() > float(row["expires_at"]):
        with _lock:
            c.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            c.commit()
        return None
    payload = json.loads(row["payload_json"])
    return {"id": row["id"], "active_email": row["active_email"], **payload}


def session_update(session_id: str, account_ids: list[int], active_email: str) -> None:
    payload = {"account_ids": account_ids, "active_email": active_email}
    c = _get_conn()
    with _lock:
        c.execute(
            "UPDATE sessions SET active_email = ?, payload_json = ? WHERE id = ?",
            (active_email, json.dumps(payload), session_id),
        )
        c.commit()


def session_delete(session_id: str) -> None:
    c = _get_conn()
    with _lock:
        c.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        c.commit()


def session_accounts_detail(session_id: str) -> list[dict]:
    s = session_load(session_id)
    if not s:
        return []
    out: list[dict] = []
    for aid in s.get("account_ids") or []:
        row = google_account_by_id(int(aid))
        if row:
            out.append(
                {
                    "id": row["id"],
                    "email": row["email"],
                    "pictureUrl": row.get("picture_url"),
                }
            )
    return out


def subscriptions_list(owner_email: str) -> list[dict]:
    c = _get_conn()
    rows = c.execute(
        """
        SELECT id, owner_email, name, category, amount_usd, due_date_iso, status, source_email, created_at, updated_at
        FROM subscriptions
        WHERE owner_email = ?
        ORDER BY due_date_iso ASC, name COLLATE NOCASE ASC
        """,
        (owner_email,),
    ).fetchall()
    return [
        {
            "id": str(r["id"]),
            "ownerEmail": str(r["owner_email"]),
            "name": str(r["name"]),
            "category": str(r["category"]),
            "amountUsd": round(float(r["amount_usd"]), 2),
            "dueDateIso": str(r["due_date_iso"]),
            "status": str(r["status"]),
            "sourceEmail": r["source_email"],
            "createdAt": float(r["created_at"]),
            "updatedAt": float(r["updated_at"]),
        }
        for r in rows
    ]


def subscriptions_upsert_many(owner_email: str, items: list[dict]) -> list[dict]:
    c = _get_conn()
    now = time.time()
    out: list[dict] = []
    with _lock:
        for item in items:
            sub_id = str(item.get("id") or uuid.uuid4().hex)
            existing = c.execute("SELECT owner_email FROM subscriptions WHERE id = ?", (sub_id,)).fetchone()
            if existing is not None and str(existing["owner_email"]) != owner_email:
                # IDs come from the desktop client. Never let a colliding client ID move
                # another account's row to the active owner.
                while True:
                    sub_id = uuid.uuid4().hex
                    collision = c.execute("SELECT 1 FROM subscriptions WHERE id = ?", (sub_id,)).fetchone()
                    if collision is None:
                        break
            row = {
                "id": sub_id,
                "owner_email": owner_email,
                "name": str(item.get("name") or "").strip(),
                "category": str(item.get("category") or "software").strip(),
                "amount_usd": round(float(item.get("amountUsd") or 0.0), 2),
                "due_date_iso": str(item.get("dueDateIso") or time.strftime("%Y-%m-%d")).strip(),
                "status": str(item.get("status") or "pending").strip(),
                "source_email": item.get("sourceEmail"),
                "created_at": now,
                "updated_at": now,
            }
            c.execute(
                """
                INSERT INTO subscriptions
                    (id, owner_email, name, category, amount_usd, due_date_iso, status, source_email, created_at, updated_at)
                VALUES
                    (:id, :owner_email, :name, :category, :amount_usd, :due_date_iso, :status, :source_email, :created_at, :updated_at)
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,
                    category=excluded.category,
                    amount_usd=excluded.amount_usd,
                    due_date_iso=excluded.due_date_iso,
                    status=excluded.status,
                    source_email=excluded.source_email,
                    updated_at=excluded.updated_at
                """,
                row,
            )
            out.append(
                {
                    "id": row["id"],
                    "name": row["name"],
                    "category": row["category"],
                    "amountUsd": row["amount_usd"],
                    "dueDateIso": row["due_date_iso"],
                    "status": row["status"],
                    "sourceEmail": row["source_email"],
                }
            )
        c.commit()
    return out


def subscription_delete(owner_email: str, sub_id: str) -> bool:
    c = _get_conn()
    with _lock:
        cur = c.execute(
            "DELETE FROM subscriptions WHERE owner_email = ? AND id = ?",
            (owner_email, sub_id),
        )
        c.commit()
        return int(cur.rowcount or 0) > 0
