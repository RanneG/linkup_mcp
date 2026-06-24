# Workflow: DZ5H6F1Rz1S

- **Type:** opinion
- **Source:** https://www.instagram.com/reel/DZ5H6F1Rz1S/
- **Transcript:** [DZ5H6F1Rz1S.md](DZ5H6F1Rz1S.md)

## Steps

1. So how's the app doing?
2. For that dashboard, give a Claude a reference image of what you want and it'll pretty much one shot it
3. So I did use Claude, but I used Claude design to build this out and then I exported that to Claude Code to actually build it for me
4. Voice mode to talk instead of type
5. So Jarvis actually isn't running on Claude
6. It's running on a agent harness called Hermes Agent and in Hermes Agent, there's a built in voice feature where you can talk to your agents and I'm using that
7. controlling Chrome to give it access to your browser
8. So if you're running your Hermes agents on a Mac mini like I am, then they can have full control over the computer that they're running on and so they can pull up any tabs or windows that they need to
9. Over the last 17, 18, have 2,450-round new downloads generated 4,280-round doesn't even need
10. RevenueCat MCP to track your app revenue
11. Yep, he got this one right
12. I am using RevenueCat to track my app stats

## Tools mentioned

- Claude
- Claude design
- Claude Code
- Codex
- Hermes Agent
- Hermes
- RevenueCat
- Metricool
- Meta Ads
- Chrome

## Surface map

| Item | Surface | Notes |
|------|---------|-------|
| Hermes | Hermes | Runtime agent host on Mac |
| Voice | Hermes | Built-in Hermes voice (Mac) |
| Chrome | Hermes | Browser control from Mac agent |
| sub agent | Hermes | Hermes sub-agents + skills |
| Claude design | external | Anthropic design tool |
| Claude Code | Cursor | IDE coding assistant |
| RevenueCat | skip | Product analytics — app-specific |
| Metricool | skip | Social scheduling — product-dependent |
| Meta Ads | skip | Paid ads — product-dependent |
| FAQ | skip | SupplyMe later — not Nami v1 |
| daily brief | Hermes | Hermes cron / heartbeat |

## MVP slice

Mac: enable Hermes voice + document `/browser` Chrome connect in `docs/hermes/REEL_BACKLOG.md` priority 1–3 (~1–2h each).

## Not doing

- Full Jarvis clone in Cursor — runtime stays on Hermes (Mac).
- RevenueCat / Metricool / Meta Ads MCP unless a shipped app needs them.
- 24/7 customer-support agent — deferred (SupplyMe lane).
- Scroll-frame demo — not relevant to this reel.
