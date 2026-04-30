"""Decode and normalize camera frames for face pipelines (OpenCV)."""
from __future__ import annotations

import base64
import binascii
from typing import Any

import cv2
import numpy as np


def decode_image_base64(data: str) -> np.ndarray | None:
    """
    Decode a base64 string (optionally data-URL) into a BGR uint8 image.
    Returns None if decoding fails.
    """
    if not data or not isinstance(data, str):
        return None
    payload = data.split(",", 1)[-1].strip()
    try:
        raw = base64.b64decode(payload, validate=False)
    except (binascii.Error, ValueError):
        return None
    if not raw:
        return None
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None or img.size == 0:
        return None
    return img


def resize_max_side(bgr: np.ndarray, max_side: int = 320) -> np.ndarray:
    """Downscale so the longest edge is at most max_side (keeps aspect ratio)."""
    h, w = bgr.shape[:2]
    m = max(h, w)
    if m <= max_side:
        return bgr
    scale = max_side / float(m)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    return cv2.resize(bgr, (nw, nh), interpolation=cv2.INTER_AREA)


def bgr_to_jpeg_bytes(bgr: np.ndarray, quality: int = 85) -> bytes:
    """Encode BGR image to JPEG bytes."""
    ok, buf = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise ValueError("jpeg encode failed")
    return bytes(buf)


def ensure_uint8_bgr(img: Any) -> np.ndarray | None:
    if img is None:
        return None
    arr = np.asarray(img)
    if arr.ndim != 3 or arr.shape[2] < 3:
        return None
    if arr.dtype != np.uint8:
        arr = np.clip(arr, 0, 255).astype(np.uint8)
    return arr[:, :, :3].copy()
