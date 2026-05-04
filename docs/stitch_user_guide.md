# Stitch user guide

Stitch is a local-first subscription companion: **Upcoming** renewals, **History** of approvals, and **Settings** for Google, Gmail discovery, voice, face MFA, alerts, and appearance.

## Views

- **Upcoming** — Dashboard of subscriptions with status `pending` or `paid`. Pending items can be approved (button or voice), may require face MFA if enabled, and can be imported from Gmail.
- **History** — Payments you already approved; amounts and timestamps for your records.
- **Settings** — Account (Google sign-in), billing (local document brain / RAG), voice activation and STT backend, alerts, face enrollment, appearance / theme.

## Pending vs paid

- **Pending** — Renewal is expected; Stitch can ping you when it is due soon and ask for approval.
- **Paid** — You marked the charge as handled for this cycle; it moves out of the pending approval flow.

## Check due payments now (sidebar)

The sidebar action **Check due payments now** runs the **same scan** as the automatic background job:

- It looks for the first **pending** subscription whose due date is **within the next 24 hours**.
- If one is found, Stitch opens the **payment ping** popup so you can approve, snooze, or use voice where supported.
- If none match, the **status line** (under the main header) says there are no charges due in the next 24 hours.

The automatic timer runs about **every 5 minutes**. When it finds a due-soon pending item, it can also request **desktop notifications** if your browser or OS allows them (you may need to grant permission once).

## Gmail discovery

With Google connected, you can **scan Gmail** for subscription-like messages. Results are suggestions; review amounts and dates before saving. Discovery uses the bridge on port **8765** by default.

## Voice

Turn **Voice activation** on in Settings → Voice. Example intents (exact wording can vary; see in-app voice hints):

- **Approve** — When a payment ping or approval card is active, saying **approve** can confirm it (face MFA still applies if enabled).
- **Open settings**, **open account**, **open voice**, **open alerts**, **open face**, **open billing**, **open history**, **open upcoming** — Navigate the app.
- **Scan Gmail** / **find subscriptions** — Triggers Gmail discovery from the Upcoming flow.
- **Document brain / RAG** — Phrases like **open document brain** or **ask my documents about …** use the local PDF RAG panel (Settings → Billing). The bridge and Ollama must be running for answers.
- **Help** — Say **open help**, **user guide**, or **help** to open **Help & support** (this guide + Ask Stitch).

## Face MFA

Optional **Face verification** adds a camera step before approving a payment. Enroll under Settings → Face. Purchase approvals use **purpose=purchase** verification when face MFA is on.

## Local document brain (RAG)

**Settings → Billing → Local document brain** sends questions to `POST /api/rag/stitch` on the Linkup MCP bridge. That answers from your **PDF corpus** in the `data/` folder on the machine running the bridge—not from this user guide.

## Ask Stitch (support)

**Help** → **Ask Stitch** sends questions to `POST /api/rag/stitch-help`. Answers are grounded in **this guide** only. If something is not documented here, the assistant should say so instead of inventing features.

## Google sign-in

Connect Google under **Settings → Account** to sync persisted subscriptions and Gmail discovery. OAuth is configured via environment variables on the bridge (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, redirect URI on **8765**). See `ENV_TEMPLATE.md` in the linkup_mcp repo.

## Troubleshooting

- **Bridge errors / failed to fetch** — Start `stitch_rag_bridge.py` (or your bundled GUI) so `http://127.0.0.1:8765` responds; the desktop dev server proxies `/api` to it.
- **RAG or Ask Stitch not answering** — Ensure **Ollama** is running and the model in use (default **llama3.2**) is pulled locally.
- **Notifications** — Allow site notifications in the browser or OS if you want due-soon alerts from the timer.
