"""Flask routes: Google OAuth (PKCE), sessions, Gmail subscription discovery."""

from __future__ import annotations

import json
import logging
import secrets
import time
from typing import Any

from flask import Flask, jsonify, request

from stitch_auth import google_client
from stitch_auth.store import (
    decrypt_refresh,
    google_account_by_email,
    google_account_by_id,
    google_account_upsert,
    oauth_pending_pop,
    oauth_pending_save,
    session_accounts_detail,
    session_create,
    session_delete,
    session_load,
    session_update,
    subscription_delete,
    subscriptions_list,
    subscriptions_upsert_many,
)

logger = logging.getLogger(__name__)


def _session_from_request() -> str | None:
    auth = (request.headers.get("Authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        return auth[7:].strip() or None
    return (request.args.get("session") or "").strip() or None


def _html_callback_page(target_origin: str, payload: dict[str, Any]) -> str:
    """Popup callback: postMessage to opener then close."""
    origin_js = json.dumps(target_origin)
    payload_js = json.dumps(payload)
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Stitch sign-in</title></head>
<body>
<script>
(function() {{
  var origin = {origin_js};
  var payload = {payload_js};
  try {{
    if (window.opener && !window.opener.closed) {{
      window.opener.postMessage({{ type: "stitch-google-oauth", payload: payload }}, origin);
    }}
  }} catch (e) {{}}
  window.close();
}})();
</script>
<p style="font-family:system-ui">You can close this window.</p>
</body></html>"""


def register_stitch_auth_routes(app: Flask) -> None:
    def _owner_email_for_session() -> tuple[str | None, tuple[dict[str, Any], int] | None]:
        sid = _session_from_request()
        if not sid:
            return None, ({"ok": False, "error": "not_authenticated"}, 401)
        sess = session_load(sid)
        if not sess:
            return None, ({"ok": False, "error": "invalid_session"}, 401)
        active = (sess.get("active_email") or "").strip()
        ids = [int(x) for x in sess.get("account_ids") or []]
        if not active and ids:
            row = google_account_by_id(ids[0])
            active = str(row["email"]) if row else ""
        if not active:
            return None, ({"ok": False, "error": "no_accounts"}, 400)
        return active, None

    @app.route("/api/auth/google", methods=["OPTIONS"])
    @app.route("/api/auth/google/url", methods=["OPTIONS"])
    def auth_google_options():
        return "", 204

    def _auth_google_start_impl():
        if not google_client.oauth_configured():
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": "Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
                    }
                ),
                503,
            )
        body = request.get_json(silent=True) or {}
        client_origin = (body.get("client_origin") or request.headers.get("Origin") or "http://localhost:1420").strip()
        if not client_origin.startswith("http"):
            client_origin = "http://localhost:1420"
        linking = _session_from_request()
        state = secrets.token_urlsafe(32)
        verifier, challenge = google_client.pkce_pair()
        oauth_pending_save(state, verifier, client_origin, linking)
        try:
            url = google_client.build_authorize_url(state, challenge)
        except Exception as e:  # noqa: BLE001
            logger.exception("build auth url")
            return jsonify({"ok": False, "error": str(e)}), 500
        return jsonify({"ok": True, "auth_url": url, "state": state})

    @app.route("/api/auth/google", methods=["POST"])
    def auth_google_start():
        # Backwards-compatible alias.
        return _auth_google_start_impl()

    @app.route("/api/auth/google/url", methods=["POST"])
    def auth_google_url():
        # Canonical endpoint used by the basic sign-in flow.
        return _auth_google_start_impl()

    @app.route("/api/auth/google/callback", methods=["GET"])
    def auth_google_callback():
        err = request.args.get("error")
        state = request.args.get("state") or ""
        code = request.args.get("code") or ""
        pending = oauth_pending_pop(state) if state else None
        origin = (pending or {}).get("client_origin") or "http://localhost:1420"
        if err:
            payload = {"ok": False, "error": err, "error_description": request.args.get("error_description") or ""}
            return _html_callback_page(origin, payload), 200, {"Content-Type": "text/html; charset=utf-8"}
        if not pending or not code:
            payload = {"ok": False, "error": "missing_code_or_state"}
            return _html_callback_page(origin, payload), 200, {"Content-Type": "text/html; charset=utf-8"}
        try:
            token = google_client.exchange_code(code, pending["code_verifier"])
        except Exception as e:  # noqa: BLE001
            logger.exception("exchange")
            payload = {"ok": False, "error": "token_exchange_failed", "detail": str(e)}
            return _html_callback_page(origin, payload), 200, {"Content-Type": "text/html; charset=utf-8"}
        access = token.get("access_token") or ""
        refresh = token.get("refresh_token") or ""
        if not access or not refresh:
            payload = {"ok": False, "error": "no_refresh_token", "detail": "Try again and ensure consent is granted."}
            return _html_callback_page(origin, payload), 200, {"Content-Type": "text/html; charset=utf-8"}
        try:
            info = google_client.userinfo_from_token_response(token)
        except Exception as e:  # noqa: BLE001
            payload = {"ok": False, "error": "userinfo_failed", "detail": str(e)}
            return _html_callback_page(origin, payload), 200, {"Content-Type": "text/html; charset=utf-8"}
        email = (info.get("email") or "").strip()
        if not email:
            payload = {"ok": False, "error": "no_email", "detail": str(info)}
            return _html_callback_page(origin, payload), 200, {"Content-Type": "text/html; charset=utf-8"}
        sub = info.get("sub")
        picture = info.get("picture")
        aid = google_account_upsert(email, sub, refresh, picture)
        linking_sid = pending.get("linking_session_id") or None
        if linking_sid:
            sess = session_load(linking_sid)
            if sess:
                ids = list(sess.get("account_ids") or [])
                if aid not in ids:
                    ids.append(aid)
                session_update(linking_sid, ids, email)
                sid = linking_sid
            else:
                sid = session_create([aid], email)
        else:
            sid = session_create([aid], email)
        payload = {"ok": True, "session_id": sid, "email": email, "pictureUrl": picture}
        return _html_callback_page(origin, payload), 200, {"Content-Type": "text/html; charset=utf-8"}

    @app.route("/api/auth/status", methods=["GET", "OPTIONS"])
    def auth_status():
        if request.method == "OPTIONS":
            return "", 204
        sid = _session_from_request()
        if not sid:
            return jsonify({"authenticated": False, "emails": [], "activeEmail": None, "accounts": []})
        sess = session_load(sid)
        if not sess:
            return jsonify({"authenticated": False, "emails": [], "activeEmail": None, "accounts": [], "invalidSession": True})
        accounts = session_accounts_detail(sid)
        emails = [a["email"] for a in accounts]
        return jsonify(
            {
                "authenticated": True,
                "sessionId": sid,
                "emails": emails,
                "activeEmail": sess.get("active_email"),
                "accounts": accounts,
            }
        )

    @app.route("/api/auth/logout", methods=["POST", "OPTIONS"])
    def auth_logout():
        if request.method == "OPTIONS":
            return "", 204
        sid = _session_from_request()
        if sid:
            session_delete(sid)
        return jsonify({"ok": True})

    @app.route("/api/auth/active-email", methods=["POST", "OPTIONS"])
    def auth_active_email():
        if request.method == "OPTIONS":
            return "", 204
        sid = _session_from_request()
        if not sid:
            return jsonify({"ok": False, "error": "not_authenticated"}), 401
        body = request.get_json(silent=True) or {}
        em = (body.get("email") or "").strip()
        sess = session_load(sid)
        if not sess:
            return jsonify({"ok": False, "error": "invalid_session"}), 401
        ids = [int(x) for x in sess.get("account_ids") or []]
        acc = google_account_by_email(em)
        if not acc or int(acc["id"]) not in ids:
            return jsonify({"ok": False, "error": "email_not_linked"}), 400
        session_update(sid, ids, em)
        return jsonify({"ok": True, "activeEmail": em})

    def _access_for_account(account_id: int) -> str:
        row = google_account_by_id(account_id)
        if not row:
            raise ValueError("unknown_account")
        rt = decrypt_refresh(row)
        tok = google_client.refresh_access(rt)
        return str(tok["access_token"])

    @app.route("/api/subscriptions/from-gmail", methods=["GET", "OPTIONS"])
    def subscriptions_from_gmail():
        if request.method == "OPTIONS":
            return "", 204
        sid = _session_from_request()
        if not sid:
            return jsonify({"ok": False, "error": "not_authenticated"}), 401
        sess = session_load(sid)
        if not sess:
            return jsonify({"ok": False, "error": "invalid_session"}), 401
        account_id = request.args.get("account_id")
        ids = [int(x) for x in sess.get("account_ids") or []]
        if account_id:
            aid = int(account_id)
            if aid not in ids:
                return jsonify({"ok": False, "error": "account_not_in_session"}), 403
        else:
            active = sess.get("active_email")
            acc = google_account_by_email(active) if active else None
            aid = int(acc["id"]) if acc else (ids[0] if ids else None)
            if aid is None:
                return jsonify({"ok": False, "error": "no_accounts"}), 400
        row = google_account_by_id(int(aid))
        email = row["email"]
        try:
            access = _access_for_account(int(aid))
        except Exception as e:  # noqa: BLE001
            msg = str(e)
            if "invalid_grant" in msg.lower() or "401" in msg:
                return jsonify({"ok": False, "error": "token_expired", "detail": "Re-authenticate with Google."}), 401
            logger.exception("refresh")
            return jsonify({"ok": False, "error": "token_refresh_failed", "detail": msg}), 500
        try:
            candidates = google_client.discover_subscriptions(access, email)
        except RuntimeError as e:
            return jsonify({"ok": False, "error": "gmail_error", "detail": str(e)}), 502
        except Exception as e:  # noqa: BLE001
            logger.exception("gmail discover")
            return jsonify({"ok": False, "error": "gmail_failed", "detail": str(e)}), 500
        return jsonify(
            {
                "ok": True,
                "accountEmail": email,
                "accountId": int(aid),
                "count": len(candidates),
                "candidates": candidates,
            }
        )

    @app.route("/api/subscriptions/import", methods=["POST", "OPTIONS"])
    def subscriptions_import():
        if request.method == "OPTIONS":
            return "", 204
        owner_email, err = _owner_email_for_session()
        if err:
            payload, status = err
            return jsonify(payload), status
        body = request.get_json(silent=True) or {}
        selections = body.get("selections") or body.get("items") or []
        if not isinstance(selections, list):
            return jsonify({"ok": False, "error": "selections_must_be_list"}), 400
        imported_input: list[dict[str, Any]] = []
        for item in selections:
            if not isinstance(item, dict):
                continue
            name = (item.get("serviceName") or item.get("name") or "").strip()
            if not name:
                continue
            amt = item.get("amountUsd")
            try:
                amount = float(amt) if amt is not None else 0.0
            except (TypeError, ValueError):
                amount = 0.0
            due = (item.get("renewalDateIso") or item.get("dueDateIso") or "").strip()
            if not due:
                due = time.strftime("%Y-%m-%d")
            cat = (item.get("category") or "software").strip()
            if cat not in ("streaming", "music", "fitness", "shopping", "software"):
                cat = "software"
            imported_input.append(
                {
                    "id": f"sub-import-{secrets.token_hex(6)}",
                    "name": name,
                    "category": cat,
                    "amountUsd": round(amount, 2),
                    "dueDateIso": due,
                    "status": "pending",
                    "sourceEmail": item.get("sourceEmail"),
                }
            )
        imported = subscriptions_upsert_many(owner_email or "", imported_input)
        all_subscriptions = subscriptions_list(owner_email or "")
        return jsonify(
            {
                "ok": True,
                "ownerEmail": owner_email,
                "imported": imported,
                "count": len(imported),
                "subscriptions": all_subscriptions,
            }
        )

    @app.route("/api/subscriptions/list", methods=["GET", "OPTIONS"])
    def subscriptions_list_route():
        if request.method == "OPTIONS":
            return "", 204
        owner_email, err = _owner_email_for_session()
        if err:
            payload, status = err
            return jsonify(payload), status
        rows = subscriptions_list(owner_email or "")
        return jsonify({"ok": True, "ownerEmail": owner_email, "count": len(rows), "subscriptions": rows})

    @app.route("/api/subscriptions/upsert", methods=["POST", "OPTIONS"])
    def subscriptions_upsert_route():
        if request.method == "OPTIONS":
            return "", 204
        owner_email, err = _owner_email_for_session()
        if err:
            payload, status = err
            return jsonify(payload), status
        body = request.get_json(silent=True) or {}
        items = body.get("subscriptions") or body.get("items") or []
        if not isinstance(items, list):
            return jsonify({"ok": False, "error": "subscriptions_must_be_list"}), 400
        normalized: list[dict[str, Any]] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            name = (item.get("name") or "").strip()
            if not name:
                continue
            normalized.append(
                {
                    "id": item.get("id"),
                    "name": name,
                    "category": (item.get("category") or "software"),
                    "amountUsd": item.get("amountUsd"),
                    "dueDateIso": item.get("dueDateIso"),
                    "status": (item.get("status") or "pending"),
                    "sourceEmail": item.get("sourceEmail"),
                }
            )
        upserted = subscriptions_upsert_many(owner_email or "", normalized)
        rows = subscriptions_list(owner_email or "")
        return jsonify({"ok": True, "ownerEmail": owner_email, "upserted": upserted, "count": len(upserted), "subscriptions": rows})

    @app.route("/api/subscriptions/delete", methods=["POST", "OPTIONS"])
    def subscriptions_delete_route():
        if request.method == "OPTIONS":
            return "", 204
        owner_email, err = _owner_email_for_session()
        if err:
            payload, status = err
            return jsonify(payload), status
        body = request.get_json(silent=True) or {}
        sub_id = (body.get("id") or "").strip()
        if not sub_id:
            return jsonify({"ok": False, "error": "missing_id"}), 400
        removed = subscription_delete(owner_email or "", sub_id)
        rows = subscriptions_list(owner_email or "")
        return jsonify({"ok": True, "ownerEmail": owner_email, "removed": removed, "subscriptions": rows, "count": len(rows)})
