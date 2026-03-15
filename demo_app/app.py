"""
Demo app: SSO signup/login + transcript ingestion for Privacy-Preserving Standup Bot.

Uses identity_core for verification and nullifier enforcement.
Processing boundary for transcript aggregation (TEE-ready, runs locally for now).
"""

import hashlib
import secrets
from datetime import datetime
from flask import Flask, request, render_template_string, redirect, url_for, session

from identity_core import (
    AuthVerifier,
    NullifierStore,
    RegistrationRequest,
    AuthRequest,
    AuthStatus,
)
from processing_boundary import ProcessingBoundary, TranscriptSubmission

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# Shared verifier and nullifier store
nullifier_store = NullifierStore()
verifier = AuthVerifier(nullifier_store=nullifier_store, mock=True)

# Processing boundary (TEE-ready; partner can swap in TEE impl later)
boundary = ProcessingBoundary()

SERVICE_NAME = "standup_bot"


def _service_name_hex() -> str:
    return hashlib.sha256(SERVICE_NAME.encode()).hexdigest()


SIGNUP_HTML = """
<!DOCTYPE html>
<html>
<head><title>Sign Up - Standup Bot</title>
<style>
body { font-family: Arial; max-width: 480px; margin: 40px auto; padding: 20px; }
input, textarea { width: 100%; padding: 12px; margin: 8px 0; box-sizing: border-box; }
button { background: #04AA6D; color: white; padding: 14px 24px; border: none; cursor: pointer; }
.code { background: #f5f5f5; padding: 12px; font-family: monospace; font-size: 12px; word-break: break-all; }
</style>
</head>
<body>
<h1>Sign Up</h1>
<p>Use <strong>clientapp</strong> to generate proof, spk, nullifier. For mock demo, paste placeholder values.</p>
<div class="code">Challenge: {{ challenge }}</div>
<div class="code">Service name: {{ service_name }}</div>
<form method="post" action="/signup">
  <input type="hidden" name="challenge" value="{{ challenge }}">
  <input type="hidden" name="sname" value="{{ service_name }}">
  <label>Username</label>
  <input type="text" name="name" required placeholder="e.g. alice">
  <label>Public key (spk, hex)</label>
  <input type="text" name="spk" required placeholder="hex string">
  <label>Ring size (N)</label>
  <input type="number" name="n" value="2" min="2" required>
  <label>Nullifier (hex)</label>
  <input type="text" name="nullifier" required placeholder="unique hex per identity">
  <label>Membership proof (hex)</label>
  <textarea name="proof" rows="3" required placeholder="proof from clientapp"></textarea>
  <button type="submit">Submit</button>
</form>
<p><a href="/">Back</a></p>
</body>
</html>
"""

LOGIN_HTML = """
<!DOCTYPE html>
<html>
<head><title>Log In - Standup Bot</title>
<style>
body { font-family: Arial; max-width: 480px; margin: 40px auto; padding: 20px; }
input, textarea { width: 100%; padding: 12px; margin: 8px 0; box-sizing: border-box; }
button { background: #04AA6D; color: white; padding: 14px 24px; border: none; cursor: pointer; }
.code { background: #f5f5f5; padding: 12px; font-family: monospace; font-size: 12px; word-break: break-all; }
</style>
</head>
<body>
<h1>Log In</h1>
<p>Use <strong>clientapp -command auth</strong> to generate signature. For mock demo, paste any hex.</p>
<div class="code">Challenge: {{ challenge }}</div>
<div class="code">Service name: {{ service_name }}</div>
<form method="post" action="/login">
  <input type="hidden" name="challenge" value="{{ challenge }}">
  <input type="hidden" name="sname" value="{{ service_name }}">
  <label>Username</label>
  <input type="text" name="name" required>
  <label>Public key (spk, hex)</label>
  <input type="text" name="spk" required>
  <label>Digital Signature (hex)</label>
  <textarea name="signature" rows="2" required></textarea>
  <button type="submit">Submit</button>
</form>
<p><a href="/">Back</a></p>
</body>
</html>
"""

HOME_HTML = """
<!DOCTYPE html>
<html>
<head><title>Standup Bot - SSO Demo</title>
<style>
body { font-family: Arial; max-width: 480px; margin: 40px auto; padding: 20px; }
a { display: inline-block; margin: 8px; padding: 8px 16px; background: #04AA6D; color: white; text-decoration: none; }
</style>
</head>
<body>
<h1>Privacy-Preserving Standup Bot</h1>
<p>ASC/U2SSO-aligned SSO demo. Sign up or log in with pseudonymous identity.</p>
<a href="/signup">Sign Up</a>
<a href="/login">Log In</a>
</body>
</html>
"""

DASHBOARD_HTML = """
<!DOCTYPE html>
<html>
<head><title>Dashboard - Standup Bot</title>
<style>
body { font-family: Arial; max-width: 560px; margin: 40px auto; padding: 20px; }
a, button { display: inline-block; margin: 8px; padding: 8px 16px; background: #04AA6D; color: white; text-decoration: none; border: none; cursor: pointer; }
.logout { background: #666; }
</style>
</head>
<body>
<h1>Dashboard</h1>
<p>Logged in. Submit standup transcripts or view team report.</p>
<a href="/submit">Submit Standup</a>
<a href="/report">Team Report</a>
<a href="/logout" class="logout">Log Out</a>
</body>
</html>
"""

SUBMIT_HTML = """
<!DOCTYPE html>
<html>
<head><title>Submit Standup - Standup Bot</title>
<style>
body { font-family: Arial; max-width: 560px; margin: 40px auto; padding: 20px; }
textarea { width: 100%; height: 200px; padding: 12px; box-sizing: border-box; }
button { background: #04AA6D; color: white; padding: 14px 24px; border: none; cursor: pointer; }
</style>
</head>
<body>
<h1>Submit Standup</h1>
<p>Paste your standup or meeting notes. Raw text is processed and never stored.</p>
<form method="post" action="/submit">
  <textarea name="transcript" required placeholder="e.g. Yesterday: Completed API integration. Today: Working on tests. Blocked: waiting on design review."></textarea>
  <button type="submit">Submit</button>
</form>
<p><a href="/dashboard">Back to Dashboard</a></p>
</body>
</html>
"""

REPORT_HTML = """
<!DOCTYPE html>
<html>
<head><title>Team Report - Standup Bot</title>
<style>
body { font-family: Arial; max-width: 560px; margin: 40px auto; padding: 20px; }
ul { margin: 8px 0; }
.section { margin: 20px 0; }
</style>
</head>
<body>
<h1>Team Report (Role-Level)</h1>
<p>Aggregated metrics only. No participant names or raw transcripts.</p>
<div class="section">
  <h3>Summary</h3>
  <p>Total standups: {{ total }} | Unique participants: {{ unique }}</p>
</div>
<div class="section">
  <h3>Blockers</h3>
  {% if blockers %}
  <ul>{% for b in blockers %}<li>{{ b }}</li>{% endfor %}</ul>
  {% else %}
  <p>None reported.</p>
  {% endif %}
</div>
<div class="section">
  <h3>Completed</h3>
  {% if completed %}
  <ul>{% for c in completed %}<li>{{ c }}</li>{% endfor %}</ul>
  {% else %}
  <p>None reported.</p>
  {% endif %}
</div>
<div class="section">
  <h3>Themes</h3>
  {% if themes %}
  <p>{{ themes | join(", ") }}</p>
  {% else %}
  <p>None extracted.</p>
  {% endif %}
</div>
<p><a href="/dashboard">Back to Dashboard</a></p>
</body>
</html>
"""


def _require_login():
    if "participant_id" not in session:
        return None
    return session["participant_id"]


@app.route("/")
def index():
    if _require_login():
        return redirect(url_for("dashboard"))
    return render_template_string(HOME_HTML)


@app.route("/dashboard")
def dashboard():
    if not _require_login():
        return redirect(url_for("index"))
    return render_template_string(DASHBOARD_HTML)


@app.route("/signup")
def signup_form():
    challenge = secrets.token_hex(32)
    service_name = _service_name_hex()
    return render_template_string(SIGNUP_HTML, challenge=challenge, service_name=service_name)


@app.route("/signup", methods=["POST"])
def signup():
    req = RegistrationRequest(
        username=request.form.get("name", ""),
        spk_hex=request.form.get("spk", ""),
        nullifier_hex=request.form.get("nullifier", ""),
        proof_hex=request.form.get("proof", ""),
        ring_size_n=int(request.form.get("n", 2)),
        challenge_hex=request.form.get("challenge", ""),
        service_name_hex=request.form.get("sname", ""),
    )
    resp = verifier.verify_registration(req)
    if resp.status == AuthStatus.SUCCESS:
        return f"<h1>Registration successful</h1><p>Welcome, {req.username}. <a href='/login'>Log in</a> to submit standups.</p><p><a href='/'>Home</a></p>"
    return f"<h1>Registration failed</h1><p>{resp.message}</p><p><a href='/signup'>Try again</a></p>"


@app.route("/login")
def login_form():
    challenge = secrets.token_hex(32)
    service_name = _service_name_hex()
    return render_template_string(LOGIN_HTML, challenge=challenge, service_name=service_name)


@app.route("/login", methods=["POST"])
def login():
    req = AuthRequest(
        username=request.form.get("name", ""),
        spk_hex=request.form.get("spk", ""),
        signature_hex=request.form.get("signature", ""),
        challenge_hex=request.form.get("challenge", ""),
        service_name_hex=request.form.get("sname", ""),
    )
    resp = verifier.verify_auth(req)
    if resp.status == AuthStatus.SUCCESS:
        session["username"] = req.username
        session["participant_id"] = req.spk_hex  # Pseudonym for aggregation
        session["token"] = resp.session_token
        return redirect(url_for("dashboard"))
    return f"<h1>Login failed</h1><p>{resp.message}</p><p><a href='/login'>Try again</a></p>"


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


@app.route("/submit", methods=["GET"])
def submit_form():
    if not _require_login():
        return redirect(url_for("index"))
    return render_template_string(SUBMIT_HTML)


@app.route("/submit", methods=["POST"])
def submit():
    pid = _require_login()
    if not pid:
        return redirect(url_for("index"))
    transcript = request.form.get("transcript", "").strip()
    if not transcript:
        return "<h1>Error</h1><p>Transcript cannot be empty.</p><p><a href='/submit'>Try again</a></p>"
    submission = TranscriptSubmission(
        participant_id=pid,
        transcript=transcript,
        submitted_at=datetime.utcnow(),
    )
    boundary.process(submission)
    return "<h1>Submitted</h1><p>Your standup was processed. Raw text was not stored.</p><p><a href='/dashboard'>Dashboard</a> | <a href='/report'>Team Report</a></p>"


@app.route("/report")
def report():
    if not _require_login():
        return redirect(url_for("index"))
    r = boundary.get_report()
    return render_template_string(
        REPORT_HTML,
        total=r.total_standups,
        unique=r.unique_participants,
        blockers=r.all_blockers,
        completed=r.all_completed,
        themes=r.themes,
    )


def run(port: int = 5000):
    app.run(host="0.0.0.0", port=port, debug=True)


if __name__ == "__main__":
    run()
