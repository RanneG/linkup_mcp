"""
Liveness heuristics for hackathon demos: blink (primary) or subtle head turn (fallback).

Uses OpenCV Haar cascades only (no cloud). Glasses / lighting can reduce blink reliability —
the UI should offer the confirmation-code fallback.
"""
from __future__ import annotations

import os
from typing import Any

import cv2
import numpy as np


def _cascade(name: str) -> cv2.CascadeClassifier:
    path = os.path.join(cv2.data.haarcascades, name)
    clf = cv2.CascadeClassifier(path)
    if clf.empty():
        raise RuntimeError(f"missing cascade: {path}")
    return clf


_face_cascade: cv2.CascadeClassifier | None = None
_eye_cascade: cv2.CascadeClassifier | None = None


def _face_det() -> cv2.CascadeClassifier:
    global _face_cascade  # noqa: PLW0603
    if _face_cascade is None:
        _face_cascade = _cascade("haarcascade_frontalface_default.xml")
    return _face_cascade


def _eye_det() -> cv2.CascadeClassifier:
    global _eye_cascade  # noqa: PLW0603
    if _eye_cascade is None:
        _eye_cascade = _cascade("haarcascade_eye.xml")
    return _eye_cascade


def _face_roi(bgr: np.ndarray) -> tuple[int, int, int, int] | None:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    faces = _face_det().detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(48, 48))
    if len(faces) == 0:
        return None
    x, y, w, h = max(faces, key=lambda r: r[2] * r[3])
    return int(x), int(y), int(w), int(h)


def _eye_openness_metric(bgr: np.ndarray) -> float | None:
    """
    Heuristic: inside face ROI, count detected eyes and use their combined height / face height.
    Lower values often correspond to closed or partially closed eyes (blink).
    """
    roi = _face_roi(bgr)
    if roi is None:
        return None
    x, y, w, h = roi
    face_crop = bgr[y : y + h, x : x + w]
    if face_crop.size == 0:
        return None
    gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    eyes = _eye_det().detectMultiScale(gray, scaleFactor=1.08, minNeighbors=3, minSize=(12, 12))
    if len(eyes) == 0:
        return 0.02
    total_h = sum(int(e[3]) for e in eyes)
    return float(total_h) / float(max(h, 1))


def _face_center_x(bgr: np.ndarray) -> float | None:
    roi = _face_roi(bgr)
    if roi is None:
        return None
    x, y, w, h = roi
    return (x + w * 0.5) / float(bgr.shape[1])


def evaluate_liveness_sequence(
    frames_bgr: list[np.ndarray],
    *,
    min_frames: int | None = None,
) -> tuple[bool, str, dict[str, Any]]:
    """
    Analyze a short burst of frames for blink pattern or horizontal head movement.

    Returns (passed, message, debug_dict).
    """
    min_f = min_frames or int(os.getenv("STITCH_FACE_LIVENESS_MIN_FRAMES", "8"))
    if len(frames_bgr) < min_f:
        return False, f"Need at least {min_f} frames for liveness (got {len(frames_bgr)}).", {"min_frames": min_f}

    metrics: list[float] = []
    centers: list[float] = []
    for fr in frames_bgr:
        m = _eye_openness_metric(fr)
        if m is not None:
            metrics.append(m)
        cx = _face_center_x(fr)
        if cx is not None:
            centers.append(cx)

    dbg: dict[str, Any] = {"frames": len(frames_bgr), "metrics_n": len(metrics), "centers_n": len(centers)}

    # --- Blink: look for a dip then recovery in openness metric ---
    if len(metrics) >= 5:
        arr = np.asarray(metrics, dtype=np.float64)
        baseline = float(np.quantile(arr, 0.85))
        trough = float(np.quantile(arr, 0.15))
        # Blink closes eyes -> metric drops; reopen -> rises
        if baseline > 0.05 and trough < baseline * 0.55:
            dbg["blink"] = {"baseline": baseline, "trough": trough}
            return True, "Blink pattern detected.", dbg

    # --- Head turn: horizontal movement of face center across sequence ---
    if len(centers) >= 6:
        span = float(max(centers) - min(centers))
        dbg["head_span_norm"] = span
        if span >= float(os.getenv("STITCH_FACE_HEAD_TURN_MIN", "0.06")):
            return True, "Head movement detected.", dbg

    return False, "No blink or head movement detected — try again or use the code fallback.", dbg
