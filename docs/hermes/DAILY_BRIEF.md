# Daily brief — first closed loop (PC)

Three Telegram bullets every morning (or on demand): **Build · Products · This week**. Read-only, RAG + memory grounded.

Skills: `hermes-nami/skills/daily-brief-loop.md` + `loop-checker.md`.

---

## Prerequisites

- [x] Hermes on PC + gateway running (`hermes gateway status`)
- [x] linkup MCP (`hermes mcp test linkup`)
- [x] Telegram pairing approved (you did: user `8098932781`)

---

## Step 1 — Sync skills + memory (2 min)

```powershell
cd C:\Users\ranne\Cursor\cursor_linkup_mcp
git pull
.\scripts\install-nami-hermes.ps1
hermes gateway restart
```

Optional — seed focus lines (edit in Notepad):

```powershell
notepad $env:LOCALAPPDATA\hermes\memories\MEMORY.md
```

Add 2–3 lines under **Active repos** or a new **This week** section with what you're actually working on. The brief is only as good as this file + RAG corpus.

---

## Step 2 — Set Telegram home channel (1 min)

Cron delivery needs where to DM you. Your user ID from pairing: **8098932781**.

```powershell
hermes config set TELEGRAM_HOME_CHANNEL 8098932781
```

Verify:

```powershell
hermes config | Select-String -Pattern TELEGRAM_HOME
```

---

## Step 3 — Test `/brief` manually (5 min)

On **Telegram**, message your Nami bot:

```text
/brief
```

If `/brief` is not recognized as a command, send this instead:

```text
Run daily-brief-loop skill exactly. Use loop-checker before sending. Read-only. Turn cap 8.
```

**Pass looks like:**

```text
☀️ Daily brief

• Build: …
• Products: …
• This week: …

(read-only · corpus + memory)
```

**If it fails:** reply with the error text. Common fixes: gateway not running, RAG empty (`python -m nami_corpus.sync`), model rate limit.

---

## Step 4 — Schedule weekday 07:30 (optional)

Only after Step 3 passes once.

```powershell
cd C:\Users\ranne\Cursor\cursor_linkup_mcp
.\scripts\Setup-NamiDailyBrief.ps1
```

Or ask Nami in Telegram:

```text
/cron add "every weekday at 07:30" "Run daily-brief-loop and loop-checker skills. Read-only daily brief to Telegram. Turn cap 8." --skill daily-brief-loop --skill loop-checker --name nami-daily-brief --deliver telegram
```

List / test:

```powershell
hermes cron list
hermes cron run nami-daily-brief
```

**Requires:** PC on + gateway running at 07:30 (Scheduled Task). No VPS yet.

---

## Step 5 — Checker habit (weekly)

After the brief ships 3 days in a row:

1. Open `%LOCALAPPDATA%\hermes\memories\LOOP_LOG.md` — should have `PASS` lines.
2. If bullets feel generic, add one concrete line to `MEMORY.md` each evening.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No reply to `/brief` | `hermes gateway status`; restart gateway |
| Invented todos | Strengthen `MEMORY.md`; brief must cite RAG/memory |
| Cron silent | `TELEGRAM_HOME_CHANNEL` unset; PC asleep at 07:30 |
| Too long bullets | Re-run — skill caps at 120 chars per bullet |

---

## Related

- [LOOP_ENGINEERING.md](./LOOP_ENGINEERING.md)
- [PC_SETUP.md](./PC_SETUP.md)
