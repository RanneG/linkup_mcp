# Lucky Charm — Demo Script

## Prerequisites

- Frontend: `cd frontend && npm run dev` (http://localhost:3000)
- Backend (optional for Live TEE): `cd backend && flask run -p 5001`

---

## Demo Flow (6–8 min)

### 1. Start Fresh (30 sec)

- Open http://localhost:3000
- Go to **Team** tab
- Click **Clear cache & start fresh** (if testing again)
- Confirm — app reloads with clean state

### 2. Sign In (1 min)

- **Option A — Connect wallet:** Click "Connect wallet" (MetaMask / Coinbase Wallet). No email or password.
- **Option B — Demo mode:** Click "Continue in demo mode"
- **Option C — Mock credentials:** Expand "Other sign-in options", use `lead@demo.com` / `lead123` (Team Lead)
- **Option D — Pseudonym mode:** Check "Use pseudonym", then log in with any demo account

Explain: *"Wallet-first: connect your wallet for privacy-preserving sign-in. Or use demo, mock, or pseudonym modes."*

### 3. Team (1 min)

- Create or join a team with a join code
- For solo demo: Create team "Lucky Charm" or "Presentation team"

### 4. Create Project (30 sec)

- Go to **Upload** tab
- You'll see **Create your project first**
- Click **Create Project**, name your deliverable (e.g. "MVP", "Sprint 1", "Init")
- Click **Create** — now you can upload

### 5. Upload Transcript — The Full Story (3 min)

- Stay on **Upload** tab
- Data source: **Mock** (or **Live TEE** if backend is running)
- **Quick start:** Click **Load sample transcript** to preload `lucky_charm_standup_01.tab`, then Upload to TEE
- **Full story:** Upload files from `mock_hackathon_data/` **in order** — each adds a meeting:

  | Order | File | What you'll see |
  |-------|------|-----------------|
  | 1 | `lucky_charm_standup_01.tab` | No plan — ideation, brainstorm |
  | 2 | `lucky_charm_standup_02.tab` | Concept — Lucky Charm, TEE, Props, LLM |
  | 3 | `lucky_charm_standup_03.tab` | Goals — capture blockers/actions/decisions |
  | 4 | `lucky_charm_standup_04.tab` | Planning — OpenAPI, attestation, staging |
  | 5 | `lucky_charm_standup_05.tab` | Execution — blockers spike |
  | 6 | `lucky_charm_standup_06.tab` | Finished — wrap-up, DevPost |

- Click **Upload to TEE** after each file
- Explain: *"Each upload adds to the same deliverable. The dashboard tells the story: from no plan to finished product."*

### 6. Dashboard (2 min)

- Go to **Dashboard**
- Dropdown shows **Deliverable 1 — [name] (current)**
- TEE indicator (top-right): **Demo mode** (mock) or **TEE connected/offline** (real)
- Sections: **Overview** | **Actions** | **Blockers** | **Takeaways**
- Show: Project story, velocity, blocker categories, decisions
- **TEE Status & Settings** — collapsed at bottom; expand for endpoint, attestation, data source toggle
- Explain: *"Output is Props-compliant: categories and counts only, no verbatim quotes."*

### 7. Deliverables & Phase Completion (1 min)

- **Previous deliverables** dropdown — switch between archived and current
- **Mark deliverable complete** — archive current work, start Phase 2
- **Archive** (per deliverable) — permanently remove for security
- **Copy for LLM** / **Download JSON** — project context for AI assistants

---

## Key Talking Points

| Point | Script |
|-------|--------|
| **Story arc** | "Mock data follows a real project: no plan → concept → goals → planning → execution → finished. Upload 01–06 to see it." |
| **Privacy** | "Raw transcripts never leave the TEE. Only metrics and themes do." |
| **Props** | "Our Props filter implements contextual-integrity ideas: no verbatim quotes, only structured categories and keyword-derived summaries. Strict allowlist (integration, environment, resource, task, other) reduces leakage." |
| **Deliverables** | "Create Project first, then upload. Mark complete to archive and start the next phase." |
| **TEE indicator** | "Top-right shows Demo mode or TEE status. Settings live below the dashboard." |
| **LLM context** | "Copy for LLM and Download JSON give AI assistants full project context." |
| **Research** | "We align with Props (2410.20522), ASC/unlinkable SSO (2025-618), and TEE threat-model work (2506.14964). See ARCHITECTURE.md Research Alignment." |

---

## Limitation Statements (for judges)

1. TEE security depends on Phala CVM isolation. arXiv 2506.14964 discusses threat-model vs deployment gaps.
2. Pseudonym mode is session-based; full U2SSO (ASC, 2025-618) would add Sybil resistance.
3. Transcript hash verification is implemented; see PRIVACY_POLICY.md.
