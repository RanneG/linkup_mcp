# Lucky Charm

Privacy-preserving standup and meeting transcript tool. Meeting data is processed inside a Trusted Execution Environment (TEE); only structured metrics and themes leave — no verbatim quotes.

## Features

- **Wallet-first auth** — Connect MetaMask or Coinbase Wallet. We only use a hash of your address; we never see your keys.
- **TEE processing** — Transcripts stay inside Phala CVM. Only Props-filtered output (blockers, actions, decisions) leaves.
- **Dashboard** — Project story, velocity chart, blockers by theme, actions by due date, takeaways. Meeting pills to filter by session.
- **Copy for LLM / Download JSON** — Export Props-filtered context for AI tools without exposing raw data.

## Quick Start

```bash
# Frontend
cd lucky-charm/frontend && npm install && npm run dev
# Open http://localhost:3000

# Backend (optional, for Live TEE)
cd lucky-charm/backend && flask run -p 5001
```

Demo mode works without a backend. Use the sample dropdown to load meetings and upload to the TEE.

## Research

| Area | Paper |
|------|-------|
| **Props** | [2410.20522](https://arxiv.org/abs/2410.20522) — contextual integrity, no verbatim output |
| **ASC/U2SSO** | [2025-618](https://eprint.iacr.org/2025/618) — unlinkable SSO, pseudonyms |
| **TEE** | [2506.14964](https://arxiv.org/abs/2506.14964) — threat model |

## Docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — data flow, components, threat model
- [DEMO_SCRIPT.md](DEMO_SCRIPT.md) — human demo walkthrough
- [DEMO_PROMPT_FOR_AI.md](DEMO_PROMPT_FOR_AI.md) — AI assistant demo guide
