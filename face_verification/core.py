"""
Face embedding and 1:1 matching via DeepFace (local inference).

Uses Facenet + OpenCV detector for a reasonable CPU speed / accuracy tradeoff.
Similarity is cosine similarity in [0, 1] after L2-normalizing embeddings.
"""
from __future__ import annotations

import logging
import os
from typing import Any

import cv2
import numpy as np

from face_verification.camera import resize_max_side

logger = logging.getLogger(__name__)

# DeepFace default cosine *distance* threshold for Facenet is ~0.40 (lower = more similar).
# Product spec asks for a *similarity* threshold default 0.6 — we compare cosine similarity directly.
DEFAULT_MATCH_THRESHOLD = float(os.getenv("STITCH_FACE_MATCH_THRESHOLD", "0.6"))
DEFAULT_MODEL_NAME = os.getenv("STITCH_FACE_MODEL", "Facenet")
DEFAULT_DETECTOR_BACKEND = os.getenv("STITCH_FACE_DETECTOR", "opencv")
# Lenient enrollment uses a larger resize so small faces still embed when enforce_detection=False.
_STITCH_FACE_ENROLL_MAX_SIDE_LENIENT = int(os.getenv("STITCH_FACE_ENROLL_MAX_SIDE_LENIENT", "640"))


def _deepface():
    try:
        from deepface import DeepFace  # type: ignore[import-untyped]

        return DeepFace
    except ImportError as e:  # pragma: no cover
        raise RuntimeError(
            'deepface is not installed. Install bridge deps: uv sync --extra stitch-bridge   or   pip install -e ".[stitch-bridge]"'
        ) from e


def embed_bgr(
    bgr: np.ndarray,
    *,
    model_name: str = DEFAULT_MODEL_NAME,
    detector_backend: str = DEFAULT_DETECTOR_BACKEND,
    enforce_detection: bool = True,
    max_side: int | None = None,
) -> np.ndarray | None:
    """
    Return L2-normalized embedding vector, or None if no face / error.
    """
    DeepFace = _deepface()
    if bgr is None or bgr.size == 0:
        return None
    cap = max_side if max_side is not None else int(os.getenv("STITCH_FACE_MAX_SIDE", "320"))
    small = resize_max_side(bgr, cap)
    try:
        reps = DeepFace.represent(
            img_path=small,
            model_name=model_name,
            detector_backend=detector_backend,
            enforce_detection=enforce_detection,
            align=True,
        )
        if not reps:
            return None
        row = reps[0] if isinstance(reps[0], dict) else None
        if not row:
            return None
        vec = row.get("embedding")
        if vec is None:
            return None
        emb = np.asarray(vec, dtype=np.float64).ravel()
        n = float(np.linalg.norm(emb) + 1e-12)
        return emb / n
    except Exception as ex:  # noqa: BLE001 — surface as None for API layer
        logger.debug("embed_bgr failed: %s", ex)
        return None


def diagnose_enrollment_failure(bgr: np.ndarray | None) -> str:
    """
    Heuristic hints when DeepFace cannot produce an embedding (demo-friendly copy).
    """
    if bgr is None or bgr.size == 0:
        return "Move camera — we could not read a frame from the camera."
    try:
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    except Exception:
        return "Could not read the image — try again."
    h, w = gray.shape[:2]
    if h < 20 or w < 20:
        return "Move camera — image is too small; try moving closer."
    mean_lum = float(np.mean(gray))
    if mean_lum < 42.0:
        return "Too dark — turn on a lamp or face a window for more light."
    if mean_lum > 245.0:
        return "Too bright — reduce glare or step out of direct sunlight."
    cascade_path = os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
    if not os.path.isfile(cascade_path):
        return "No face embedding — center your face, hold steady, and try again."
    cascade = cv2.CascadeClassifier(cascade_path)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(28, 28))
    if faces is None or len(faces) == 0:
        return "Move camera — center your face and fill more of the frame."
    areas = [float(fw * fh) / float(max(1, w * h)) for (_x, _y, fw, fh) in faces]
    best = max(areas) if areas else 0.0
    if best < 0.018:
        return "Face too small — move closer so your face fills more of the view."
    return "No face embedding — try again with good lighting and a steady hold."


def embed_bgr_enrollment_mode(
    bgr: np.ndarray,
    *,
    quality_check: str,
    model_name: str = DEFAULT_MODEL_NAME,
    detector_backend: str = DEFAULT_DETECTOR_BACKEND,
) -> np.ndarray | None:
    """
    Enrollment embedding: **lenient** (default) prefers ``enforce_detection=False`` first
    (more forgiving), then falls back to strict detection. **strict** uses detection only.

    Lenient uses a larger resize cap so small faces still embed.
    """
    strict = (quality_check or "lenient").lower() == "strict"
    max_side_strict = int(os.getenv("STITCH_FACE_MAX_SIDE", "320"))
    max_side_loose = max(max_side_strict, _STITCH_FACE_ENROLL_MAX_SIDE_LENIENT)
    if strict:
        return embed_bgr(
            bgr,
            model_name=model_name,
            detector_backend=detector_backend,
            enforce_detection=True,
            max_side=max_side_strict,
        )
    emb = embed_bgr(
        bgr,
        model_name=model_name,
        detector_backend=detector_backend,
        enforce_detection=False,
        max_side=max_side_loose,
    )
    if emb is None:
        emb = embed_bgr(
            bgr,
            model_name=model_name,
            detector_backend=detector_backend,
            enforce_detection=True,
            max_side=max_side_loose,
        )
    return emb


def augment_bgr_for_enrollment_templates(bgr: np.ndarray) -> list[np.ndarray]:
    """
    One capture → a few near-duplicate views (small in-plane rotation) for a more robust gallery,
    similar to single-pose enrollment with synthetic viewpoint spread.
    """
    if bgr is None or bgr.size == 0:
        return []
    h, w = bgr.shape[:2]
    center = (w / 2.0, h / 2.0)
    out: list[np.ndarray] = [bgr.copy()]
    for angle in (-5.0, 5.0):
        m = cv2.getRotationMatrix2D(center, angle, 1.0)
        rot = cv2.warpAffine(bgr, m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        out.append(rot)
    return out[:3]


def enrollment_consistency_score(embeddings: list[np.ndarray]) -> float:
    """0–100 quality heuristic from pairwise cosine similarity between enrollment templates."""
    if len(embeddings) < 2:
        return 88.0
    sims: list[float] = []
    for i in range(len(embeddings)):
        for j in range(i + 1, len(embeddings)):
            sims.append(cosine_similarity(embeddings[i], embeddings[j]))
    avg = float(sum(sims) / max(1, len(sims)))
    return max(0.0, min(100.0, round(avg * 100.0, 1)))


def build_single_frame_enrollment_embeddings(
    bgr: np.ndarray,
    *,
    quality_check: str,
    model_name: str = DEFAULT_MODEL_NAME,
    detector_backend: str = DEFAULT_DETECTOR_BACKEND,
) -> tuple[list[np.ndarray], float, str | None]:
    """
    Build 1–3 templates from one BGR frame (augmented views).
    Returns (embeddings, confidence_score_0_100, error_message_or_none).
    """
    variants = augment_bgr_for_enrollment_templates(bgr)
    if not variants:
        return [], 0.0, diagnose_enrollment_failure(bgr)
    embeddings: list[np.ndarray] = []
    for v in variants:
        emb = embed_bgr_enrollment_mode(
            v,
            quality_check=quality_check,
            model_name=model_name,
            detector_backend=detector_backend,
        )
        if emb is not None:
            embeddings.append(emb)
    if not embeddings:
        return [], 0.0, diagnose_enrollment_failure(bgr)
    score = enrollment_consistency_score(embeddings)
    return embeddings, score, None


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    a = np.asarray(a, dtype=np.float64).ravel()
    b = np.asarray(b, dtype=np.float64).ravel()
    if a.shape != b.shape:
        return 0.0
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))


def match_embeddings(
    probe: np.ndarray,
    gallery: list[np.ndarray],
    *,
    threshold: float = DEFAULT_MATCH_THRESHOLD,
) -> tuple[float, bool]:
    """
    Return (best_similarity_in_0_1, verified) where verified is True if best >= threshold.
    Gallery typically holds 2–3 enrollment templates.
    """
    if not gallery or probe is None:
        return 0.0, False
    scores = [cosine_similarity(probe, g) for g in gallery if g is not None and g.size]
    if not scores:
        return 0.0, False
    best = max(scores)
    return best, bool(best >= threshold)


def verify_pair_distance(
    img1: np.ndarray,
    img2: np.ndarray,
    *,
    model_name: str = DEFAULT_MODEL_NAME,
    detector_backend: str = DEFAULT_DETECTOR_BACKEND,
) -> dict[str, Any]:
    """
    Optional helper wrapping DeepFace.verify (returns distance + DeepFace verified flag).
    """
    DeepFace = _deepface()
    small1 = resize_max_side(img1, 320)
    small2 = resize_max_side(img2, 320)
    return DeepFace.verify(
        img1_path=small1,
        img2_path=small2,
        model_name=model_name,
        detector_backend=detector_backend,
        distance_metric="cosine",
        enforce_detection=True,
        align=True,
        silent=True,
    )
