# sso-poc Stub

Minimal U2SSO / sso-poc stub for Lucky Charm local development. Implements the SSO API expected by the frontend (challenge, login, submission nullifier) without Ganache or smart contracts.

## Quick Start

```bash
cd sso-poc-stub
pip install -r requirements.txt
python sso_stub.py
```

Listens on **http://localhost:8081** by default.

## Frontend Configuration

In `lucky-charm/frontend/.env`:

```
VITE_SSO_BASE_URL=/sso-api
```

Vite proxy (see `vite.config.js`) forwards `/sso-api` → `http://localhost:8081`, so the frontend talks to the stub via relative URLs.

## API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/challenge/login` | GET | Returns `{ challenge, sname }` for login flow |
| `/api/login` | POST | Accepts `{ name, challenge, sname, spk, signature }` → `{ success, session_token, ... }` |
| `/api/submission/nullifier` | POST | Body `{ participant_id }` → `{ nullifier }` for U2SSO Sybil resistance |

## Production

For production, replace this stub with a real sso-poc deployment (e.g. [RanneG/sso-poc](https://github.com/RanneG/sso-poc) or ASC-compliant implementation) that uses IdR, child credentials, and cryptographic nullifiers. See ARCHITECTURE.md U2SSO section.
