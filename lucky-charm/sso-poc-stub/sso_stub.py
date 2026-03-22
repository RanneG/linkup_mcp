#!/usr/bin/env python3
"""
Minimal U2SSO / sso-poc stub for local development.
Provides: challenge, login, submission nullifier.
Run: python sso_stub.py  (listens on 8081)
Set VITE_SSO_BASE_URL=/sso-api so Vite proxy forwards /sso-api -> localhost:8081
"""

import hashlib
import os
import secrets
import time
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["*"])


@app.route("/api/challenge/login", methods=["GET"])
def challenge_login():
    """GET /api/challenge/login -> { challenge, sname }"""
    ch = secrets.token_hex(32)
    return jsonify({"challenge": ch, "sname": "lucky-charm-stub"})


@app.route("/api/login", methods=["POST"])
def login():
    """POST /api/login — accept any name/challenge/sname/spk/signature for stub."""
    data = request.get_json(silent=True) or {}
    return jsonify({
        "success": True,
        "session_token": secrets.token_hex(24),
        "user_id": f"sso_{data.get('name', 'user')[:16]}_{secrets.token_hex(8)}",
        "lucky_charm": {
            "role": "team-lead",
            "display_name": data.get("name", "SSO User"),
            "team": {"team_id": "stub-team-1", "team_name": "Stub Team"},
        },
    })


@app.route("/api/submission/nullifier", methods=["POST"])
def submission_nullifier():
    """
    POST /api/submission/nullifier — one-time nullifier for U2SSO Sybil resistance.
    Body: { participant_id } -> { nullifier }
    """
    data = request.get_json(silent=True) or {}
    pid = (data.get("participant_id") or "").strip()
    if not pid:
        return jsonify({"error": "participant_id required"}), 400
    # Stub: generate deterministic-but-unique nullifier (real sso-poc would use ZK proof)
    nonce = secrets.token_hex(16)
    h = hashlib.sha256(f"{pid}:{time.time_ns()}:{nonce}".encode()).hexdigest()
    return jsonify({"nullifier": h})


if __name__ == "__main__":
    port = int(os.environ.get("SSO_STUB_PORT", 8081))
    print(f"sso-poc stub listening on http://localhost:{port}")
    print("Set VITE_SSO_BASE_URL=/sso-api in frontend .env for Vite proxy")
    app.run(host="0.0.0.0", port=port, debug=False)
