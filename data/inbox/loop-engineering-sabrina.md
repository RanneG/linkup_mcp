# Loop engineering — Sabrina Ramonov article summary

- **Source:** https://www.sabrina.dev/p/loop-engineering-claude-code-goal-routines
- **Fetched:** 2026-06-23
- **Related video:** https://www.youtube.com/watch?v=Ry3YyG22EUc (`data/inbox/Ry3YyG22EUc.md`)

## TL;DR

**Loop engineering** = designing a system that prompts your AI on a **schedule** and against a **goal**, instead of you typing each prompt. Your job shifts from doing every step to designing the machine: do work → check → repeat until done.

Named by **Addy Osmani** (June 2026). Popularized in part by **Peter Steinberger** (“don’t prompt agents — design loops that prompt them”).

## Six loop parts (Claude Code framing)

| Part | Role |
|------|------|
| **Automations** | Timer/trigger — loop starts without you |
| **Worktrees** | Separate work areas so parallel agents don’t collide |
| **Skills** | Saved instructions for *your* way of doing a task |
| **Connectors** | Gmail, Slack, etc. |
| **Sub-agents** | Doer vs checker — don’t grade your own homework |
| **Memory** | Notes outside the chat (what’s done, what’s next) |

Every loop has a **DOER** and a **CHECKER**. If you can’t define “done” and how to verify it, you have a wish, not a loop. Always **cap turns** so the loop can’t run forever.

## Claude Code primitives

1. **`/goal`** (desktop app, v2.1.139+) — give a finish line; a fast checker asks “met?” after each round; stops on yes or turn cap.
2. **Routines** (`claude.ai/code/routines`) — scheduled cloud jobs: instructions + connectors + trigger. Paid plan.

Formula: **timer + goal you can check = autonomous agent**.

## Safety defaults

- Start **read-only** (summarize before edit/send).
- Plain limits: “do not reply”, “do not delete”.
- Watch first runs before trusting send/change actions.

## Cheatsheet pattern

1. **Starts when:** time of day / event
2. **Done looks like:** verifiable end state
3. **The check:** how the AI proves it’s done
4. **Turn cap:** max iterations
