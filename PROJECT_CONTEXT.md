# Project Context

## Project Name
Privacy-Preserving Meeting/Standup Bot for Distributed Labs

## Primary Goal
Enable teams to share progress and blockers through aggregated insights without exposing raw transcript data or named identities.

## Core Idea
- Meeting/standup text is submitted to a trusted processing boundary (TEE-oriented architecture).
- Participants authenticate with ASC/U2SSO-style pseudonymous identities.
- Outputs are role-level metrics and themes, not person-level data.

## Why This Matters
- Addresses private coordination pain in remote/distributed teams.
- Combines privacy, identity, and useful operational analytics.
- Demonstrates a practical path from research cryptography to application workflow.

## Current Repository Role
`cursor_linkup_mcp` is currently used for:
- Research artifacts (`data/` PDFs)
- AI-assisted exploration/prototyping
- Security/privacy design docs

## Essential References in `data/`
- `AnonymousSelfCredentials.pdf`
- `2025-618.pdf`
- `props_presentation_hackathon.pdf`
- `2410.20522v1.pdf`

## Current Status Snapshot
- U2SSO PoC explored and executed in separate local workspace.
- ASC/U2SSO concepts mapped to hackathon architecture.
- Security/privacy scope and risks documented in `SECURITY_PRIVACY_CONSIDERATIONS.md`.

## Explicit Scope (Hackathon)
- Build a strong end-to-end prototype narrative, not a production-ready system.
- Prioritize one reliable demo path over broad but fragile functionality.
- Make assumptions and limitations explicit in documentation and presentation.
