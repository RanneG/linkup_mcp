#!/usr/bin/env python3
"""
Minimal local server that mimics sso-poc JSON endpoints (no Ganache / contract / clientapp).

Use this when you only need Lucky Charm to probe SSO and complete the login UI flow.

  cd "LUCKY CHARM" && python3 scripts/sso_mock_server.py

Default port 8081 matches frontend Vite proxy (VITE_SSO_PROXY_TARGET).
"""
from __future__ import annotations

import json
import os
import secrets
from http.server import BaseHTTPRequestHandler, HTTPServer

# Same example sname as sso-poc docs (SHA256("abc_service") hex)
DEFAULT_SNAME = (
    "6d7e78af064c86eb9b9cb1c3611c9ab60a2f9317e3891891ef31770939f78ef8"
)


def _json_body(handler: BaseHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length", "0"))
    raw = handler.rfile.read(length) if length else b"{}"
    try:
        return json.loads(raw.decode())
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[sso-mock] {args[0] if args else fmt}")

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/api/challenge/login":
            body = json.dumps(
                {
                    "challenge": secrets.token_hex(32),
                    "sname": os.environ.get("SSO_MOCK_SNAME", DEFAULT_SNAME),
                }
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        msg = b'{"error":"use GET /api/challenge/login or POST /api/login"}'
        self.send_response(404)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(msg)))
        self.end_headers()
        self.wfile.write(msg)

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        if path != "/api/login":
            self.send_error(404)
            return
        payload = _json_body(self)
        name = (payload.get("name") or "User").strip()
        body = json.dumps(
            {
                "success": True,
                "message": "Login successful (mock SSO — not real U2SSO crypto)",
                "session_token": secrets.token_hex(32),
                "role": os.environ.get("SSO_MOCK_ROLE", "team-member"),
                "display_name": name,
                "user_id": f"mock_{secrets.token_hex(8)}",
            }
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    port = int(os.environ.get("PORT", "8081"))
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"U2SSO mock → http://{host}:{port}")
    print("  GET  /api/challenge/login")
    print("  POST /api/login")
    HTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
