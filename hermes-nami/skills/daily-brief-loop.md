# Skill — daily brief (first closed loop)

Read-only morning digest for Ranne on Telegram. Copy this block into a Hermes heartbeat / cron routine when wiring on Mac.

Design reference: [LOOP_ENGINEERING.md](../../docs/hermes/LOOP_ENGINEERING.md) · [REEL_BACKLOG.md](../../docs/hermes/REEL_BACKLOG.md) item 4.

---

## Loop: daily brief

**Starts when:** Hermes heartbeat (e.g. weekdays 07:30 Europe/London) **or** Ranne sends `/brief` on Telegram.

**Done looks like:**

- Exactly **3 bullets** (Build, Products, This week — one line each).
- **0** outbound actions besides one Telegram message to Ranne (no email, no browser clicks, no file writes except memory log).
- Each bullet grounded in **RAG** (`rag` on nami-corpus) and/or `~/.hermes/memories/` — not invented.

**The check:**

| Criterion | Pass |
|-----------|------|
| Bullet count | `== 3` |
| Each bullet ≤ 120 chars | yes |
| At least one RAG or memory citation per bullet | yes |
| No tool calls that send/post/delete | yes |

Run **[loop-checker.md](./loop-checker.md)** on the draft; send only on **PASS**.

**Turn cap:** **8** tool rounds (search + RAG + memory read). Stop and report partial if cap hit.

**Limits:** read-only; do not send email; do not delete; browser off for v1.

**Memory:** append one line to `~/.hermes/memories/LOOP_LOG.md`:

```text
YYYY-MM-DD daily-brief PASS|FAIL — <6-word summary>
```

**Checker:** `loop-checker` skill — separate pass before Telegram send.

---

## Execution steps

1. Read `MEMORY.md` / recent `LOOP_LOG.md` for context.
2. `rag` — "What is Ranne's current focus and open todos?" (nami-corpus).
3. Optional: `web_search` only if Ranne asked for live news in USER memory — default **skip**.
4. Draft 3 bullets using template below.
5. Run **loop-checker** pass on draft.
6. On PASS: send Telegram message. On FAIL: send short FAIL note to Ranne only.

## Telegram template (PASS)

```text
☀️ Daily brief

• Build: …
• Products: …
• This week: …

(read-only · corpus + memory)
```

## Wire on PC (current)

1. Pull repo; `.\scripts\install-nami-hermes.ps1` (syncs skills + LOOP_LOG.md).
2. `hermes config set TELEGRAM_HOME_CHANNEL <your_telegram_user_id>`
3. Test: Telegram **`/brief`** (or full prompt in [DAILY_BRIEF.md](../../docs/hermes/DAILY_BRIEF.md)).
4. Schedule: `.\scripts\Setup-NamiDailyBrief.ps1` (weekdays 07:30 Europe/London).

Gateway must be running (Scheduled Task or `Start-NamiGateway.ps1`). PC off at 07:30 = no cron — VPS later.

## Wire on Mac (legacy)

See `bash scripts/install-nami-stack-mac.sh` + [MAC_SETUP.md](../../docs/hermes/MAC_SETUP.md).

## Do not

- Turn this into an open-ended research loop.
- Add connectors (browser, email) until v1 brief ships clean for one week.
