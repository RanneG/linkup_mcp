# Workflow: Ry3YyG22EUc

- **Type:** tutorial
- **Source:** https://www.youtube.com/watch?v=Ry3YyG22EUc
- **Transcript:** [Ry3YyG22EUc.md](Ry3YyG22EUc.md)

## Steps

1. There's a new idea that the top AI users and programmers in the world are all talking about
2. Loop engineering, or sometimes it's simpler for it to as loops
3. In particular, Boris Churney, who created Claude Code and Peter Steinberg who created Open Claw, have both been talking about the saying that this is now how they program
4. They don't just prompt a chatbot and they definitely don't write code by hand, but instead they create these loops where the AI prompts itself
5. You're saying that this is the future, but at the same time it's pretty confusing
6. So in this video we're going to break down exactly what loops are, how to use them, what they're good for, what they're not as good for, and a bunch of real world use cases along with a demo so you can see exactly how to start using this yourself
7. So at a high level here's what a loop looks like
8. Nice and mentioned that loops are usually talked about with regards to coding, but they can also be used for a ton of other things like content creation or research or teaching yourself a new skill
9. And we'll cover all of those too
10. But that being said, they do still all go through these coding tools like Claude Code or Codex, but you don't have to be technical to do this
11. So if a terminal window scares you, don't worry, it's totally cool
12. So to show you this visually, this is what the old way looked like

## Tools mentioned

- Claude
- Claude Code
- Codex

## Surface map

| Item | Surface | Notes |
|------|---------|-------|
| orchestrator + sub-agents | Hermes | Main Nami + scout/builder workers |
| closed loop / checker | Hermes | Daily brief + `loop-checker` skill |
| memory (next_steps file) | Hermes | `~/.hermes/memories/` + loop log |
| weekly automation | Hermes | Heartbeat after gateway launchd |
| Claude Code /goal + Routines | external | Reference only — not Nami v1 host |
| Codex | external | Same pattern, different product |

## MVP slice

Mac: implement **one closed loop** — read-only daily brief with explicit done check and turn cap ([LOOP_ENGINEERING.md](../../docs/hermes/LOOP_ENGINEERING.md)); defer multi-agent pickleball-style fleet until that ships.

## Not doing

- Full Jarvis clone in Cursor — runtime stays on Hermes (Mac).
- RevenueCat / Metricool / Meta Ads MCP unless a shipped app needs them.
- 24/7 customer-support agent — deferred (SupplyMe lane).
- Scroll-frame demo — not relevant to this reel.
