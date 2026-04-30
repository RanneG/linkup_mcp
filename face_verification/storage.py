"""
Encrypted local storage for face enrollment metadata + embeddings.

Files live under ~/.stitch/face_db/{sha256(email)}.enc (Fernet).
Master key: ~/.stitch/face_db/.master_key (32 url-safe bytes) created on first use.
Optional env STITCH_FACE_PASSPHRASE mixes into key derivation for demos.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import stat
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import numpy as np


STITCH_FACE_DIR = Path(os.getenv("STITCH_FACE_DB_DIR", Path.home() / ".stitch" / "face_db"))
STITCH_FACE_VERSION = 1
STITCH_KDF_ITERATIONS = 480_000


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def email_hash(email: str) -> str:
    return hashlib.sha256(_normalize_email(email).encode("utf-8")).hexdigest()


def _ensure_dir() -> Path:
    STITCH_FACE_DIR.mkdir(parents=True, exist_ok=True)
    try:
        if os.name != "nt":
            os.chmod(STITCH_FACE_DIR, stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)
    except OSError:
        pass
    return STITCH_FACE_DIR


def _master_key_material() -> bytes:
    _ensure_dir()
    key_path = STITCH_FACE_DIR / ".master_key"
    if key_path.exists():
        raw = key_path.read_bytes()
        if len(raw) >= 32:
            return raw[:32]
    material = os.urandom(32)
    key_path.write_bytes(material)
    try:
        if os.name != "nt":
            os.chmod(key_path, stat.S_IRUSR | stat.S_IWUSR)
    except OSError:
        pass
    return material


def _fernet_for_email(email: str) -> Fernet:
    """
    Derive a Fernet key from machine-local material + email + optional passphrase.
    """
    passphrase = (os.getenv("STITCH_FACE_PASSPHRASE") or "").encode("utf-8")
    salt = hashlib.sha256((_normalize_email(email) + "stitch-face-v1").encode()).digest()[:16]
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=STITCH_KDF_ITERATIONS,
    )
    key = kdf.derive(_master_key_material() + passphrase)
    token = base64.urlsafe_b64encode(key)
    return Fernet(token)


@dataclass
class EnrollmentRecord:
    version: int
    enrollment_timestamp: str
    last_verified: str | None
    model_name: str
    embeddings: list[list[float]]

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "enrollment_timestamp": self.enrollment_timestamp,
            "last_verified": self.last_verified,
            "model_name": self.model_name,
            "embeddings": self.embeddings,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> EnrollmentRecord:
        return cls(
            version=int(d.get("version", STITCH_FACE_VERSION)),
            enrollment_timestamp=str(d.get("enrollment_timestamp", "")),
            last_verified=d.get("last_verified"),
            model_name=str(d.get("model_name", "Facenet")),
            embeddings=[list(map(float, row)) for row in d.get("embeddings", [])],
        )


def _path_for_email(email: str) -> Path:
    return _ensure_dir() / f"{email_hash(email)}.enc"


def save_enrollment(email: str, embeddings: list[Any], *, model_name: str) -> None:
    if not embeddings:
        raise ValueError("at least one embedding required")
    now = datetime.now(timezone.utc).isoformat()
    rec = EnrollmentRecord(
        version=STITCH_FACE_VERSION,
        enrollment_timestamp=now,
        last_verified=None,
        model_name=model_name,
        embeddings=[np.asarray(e, dtype=float).tolist() for e in embeddings],
    )
    raw = json.dumps(rec.to_dict(), separators=(",", ":")).encode("utf-8")
    token = _fernet_for_email(email)
    blob = token.encrypt(raw)
    _path_for_email(email).write_bytes(blob)


def load_enrollment(email: str) -> EnrollmentRecord | None:
    path = _path_for_email(email)
    if not path.exists():
        return None
    token = _fernet_for_email(email)
    try:
        raw = token.decrypt(path.read_bytes())
    except Exception:
        return None
    data = json.loads(raw.decode("utf-8"))
    return EnrollmentRecord.from_dict(data)


def is_enrolled(email: str) -> bool:
    return _path_for_email(email).exists()


def delete_enrollment(email: str) -> bool:
    path = _path_for_email(email)
    if not path.exists():
        return False
    path.unlink()
    return True


def touch_last_verified(email: str) -> None:
    rec = load_enrollment(email)
    if rec is None:
        return
    rec.last_verified = datetime.now(timezone.utc).isoformat()
    raw = json.dumps(rec.to_dict(), separators=(",", ":")).encode("utf-8")
    token = _fernet_for_email(email)
    _path_for_email(email).write_bytes(token.encrypt(raw))
