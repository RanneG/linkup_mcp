"""
Minimal Flask app for transcript processing.
- GET /health -> {"status": "running"}
- POST /process -> JSON with transcript (or multipart file "transcript"); returns blockers, action_items, decisions.
- Raw transcript is processed in-memory only; never logged or persisted. See PRIVACY_POLICY.md.
- transcript_hash: client sends SHA-256 hex; backend verifies for Props integrity.
"""
import hashlib
import os
from flask import Flask, request, jsonify
from flask_cors import CORS

from extract import extract_from_transcript
from extract_llm import extract_with_llm
from props_filter import apply_props_filter
from audit import audit_ingestion, audit_aggregation, audit_policy_output, audit_hash_verification
from aggregation_store import append as append_aggregation, get_aggregates
from nullifier_store import is_nullifier_used, mark_nullifier_used

app = Flask(__name__)
# Allow frontend (e.g. localhost or deployed app) to call this TEE from the browser
CORS(app, origins=["*"], supports_credentials=False)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "running"})


@app.route("/attestation", methods=["GET"])
def attestation():
    """Return attestation info for client verification of TEE identity."""
    return jsonify({
        "status": "running",
        "tee_type": "phala_cvm",
        "message": (
            "This endpoint runs inside a Phala CVM (Confidential VM). "
            "To verify attestation, use 'phala cvms attestation <cvm-name>' or check the Phala Cloud dashboard."
        ),
        "phala_dashboard": "https://cloud.phala.network/dashboard",
        "trust_site": "https://trust.phala.com",
    })


def _compute_sha256_hex(data: bytes) -> str:
    """Compute SHA-256 hash of raw bytes, return hex string."""
    return hashlib.sha256(data).hexdigest()


@app.route("/process", methods=["POST"])
def process():
    transcript_raw = None
    transcript_bytes = None
    participant_id = None
    nullifier = None
    date_str = None
    client_hash = None

    if request.is_json:
        data = request.get_json(silent=True) or {}
        transcript_raw = data.get("transcript")
        participant_id = data.get("participant_id")
        nullifier = data.get("nullifier")
        date_str = data.get("date")
        client_hash = data.get("transcript_hash")
        if transcript_raw is not None:
            transcript_bytes = transcript_raw.encode("utf-8", errors="replace")
    elif "transcript" in request.files:
        f = request.files["transcript"]
        try:
            transcript_bytes = f.read()
            transcript_raw = transcript_bytes.decode("utf-8", errors="replace")
        except Exception as e:
            return jsonify({"error": f"Could not read transcript file: {e}"}), 400
        participant_id = request.form.get("participant_id")
        nullifier = request.form.get("nullifier")
        date_str = request.form.get("date")
        client_hash = request.form.get("transcript_hash")
    else:
        return (
            jsonify({"error": "Send JSON with 'transcript' or multipart form field 'transcript' (file)"}),
            400,
        )

    # U2SSO: when both participant_id and nullifier present, enforce one-time use (Sybil resistance)
    if participant_id and participant_id.strip() and nullifier and str(nullifier).strip():
        if is_nullifier_used(participant_id.strip(), str(nullifier).strip()):
            return jsonify({"error": "Duplicate submission — this nullifier was already used"}), 409

    if not (transcript_raw and transcript_raw.strip()):
        return jsonify({"error": "Transcript is empty"}), 400

    # Props integrity: verify transcript_hash when client sends it
    if client_hash and transcript_bytes is not None:
        server_hash = _compute_sha256_hex(transcript_bytes)
        if not (client_hash.lower() == server_hash.lower()):
            audit_hash_verification(hash_verified=False)
            return jsonify({"error": "Transcript integrity check failed (hash mismatch)"}), 400
        audit_hash_verification(hash_verified=True)
    else:
        # Client may not send hash (e.g. curl, older clients); allow but audit
        audit_hash_verification(hash_verified=None)

    # Process in-memory only; never log or persist raw transcript (PRIVACY_POLICY.md)
    audit_ingestion(participant_id=participant_id, has_transcript=bool(transcript_raw and transcript_raw.strip()))

    use_llm = bool(os.environ.get("OLLAMA_URL", "").strip())
    raw_result = extract_with_llm(transcript_raw) if use_llm else extract_from_transcript(transcript_raw)

    audit_aggregation(
        blocker_count=len(raw_result.get("blockers", [])),
        action_count=len(raw_result.get("action_items", [])),
        decision_count=len(raw_result.get("decisions", [])),
    )

    # Props policy filter: only metrics, themes, velocity leave TEE (no verbatim quotes)
    use_props = os.environ.get("PROPS_FILTER", "true").lower() == "true"
    result = apply_props_filter(raw_result) if use_props else raw_result

    audit_policy_output(
        themes_count=len(result.get("themes", [])),
        velocity_blockers=result.get("velocity", {}).get("blocker_count", 0),
    )
    # Participant aggregation: append Props metrics by participant_id + date (no raw transcript)
    if participant_id and participant_id.strip():
        v = result.get("velocity") or {}
        append_aggregation(
            participant_id.strip(),
            v.get("blocker_count", len(result.get("blockers", []))),
            v.get("action_item_count", len(result.get("action_items", []))),
            v.get("decision_count", len(result.get("decisions", []))),
            date_str or None,
        )
    if participant_id:
        result["participant_id"] = participant_id
    if date_str:
        result["date"] = date_str

    # U2SSO: mark nullifier used after successful processing (prevents replay)
    if participant_id and participant_id.strip() and nullifier and str(nullifier).strip():
        mark_nullifier_used(participant_id.strip(), str(nullifier).strip())

    return jsonify(result)


@app.route("/aggregates", methods=["GET"])
def aggregates():
    """Return time-series of blocker/action/decision counts for a participant (pseudonym-only)."""
    participant_id = request.args.get("participant_id", "").strip()
    if not participant_id:
        return jsonify({"error": "participant_id required"}), 400
    rows = get_aggregates(participant_id)
    return jsonify({"participant_id": participant_id, "data": rows})


if __name__ == "__main__":
    # Default 5001 to avoid conflict with macOS AirPlay Receiver on 5000
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG", "false").lower() == "true")
