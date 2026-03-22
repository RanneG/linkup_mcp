#!/usr/bin/env python3
"""
Generate mock Lucky Charm project meeting .tab datasets for TEE ingestion.
Tells one cohesive story: no plan → concept → goals → planning → execution → finished product.
Format: Tab-separated, columns Index, Time, Speaker, Speech Segment, Open code(s), Axial code(s).
"""

import os
import random
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "mock_hackathon_data"
HEADER = "Index\tTime\tSpeaker\tSpeech Segment\tOpen code(s)\tAxial code(s)"


def ts(sec: int) -> str:
    """Convert seconds to HH:MM:SS quoted."""
    h, sec = divmod(sec, 3600)
    m, s = divmod(sec, 60)
    return f'"{h:02d}:{m:02d}:{s:02d}"'


def row(idx: int, t_sec: int, speaker: str, speech: str, open_c: str = "", axial_c: str = "") -> str:
    speech_esc = speech.replace('"', '""') if '"' in speech else speech
    return f"{idx}\t{ts(t_sec)}\t\"{speaker}\"\t\"{speech_esc}\"\t\"{open_c}\"\t\"{axial_c}\""


def generate_tab(name: str, segments: list[tuple[str, str, str, str]]) -> str:
    """Build full .tab content from list of (speaker, speech, open_code, axial_code) tuples."""
    lines = [HEADER]
    t = 60  # start at 1 min
    for i, (spk, speech, oc, ax) in enumerate(segments, start=1):
        t += random.randint(8, 35)
        lines.append(row(i, t, spk, speech, oc, ax))
    return "\n".join(lines)


# Lucky Charm project: one cohesive story across 6 meetings
# Meeting 1: No plan — ideation, what to build
# Meeting 2: Concept — Lucky Charm idea takes shape
# Meeting 3: Goals — capture blockers, actions, LLM-ready context
# Meeting 4: Planning — integration points, docs, staging
# Meeting 5: Execution — blockers emerge (attestation, OpenAPI, staging)
# Meeting 6: Decisions & wrap-up — ship decisions, final actions

LUCKY_CHARM_MEETINGS = [
    {
        "name": "lucky_charm_standup_01.tab",
        "phase": "no_plan",
        "segments": [
            ("Speaker 1", "Quick sync. What are we even building?", "Clarification of team task", "Team process"),
            ("Speaker 2", "Hackathon starts soon. We need an idea.", "Time commitment", "Team process"),
            ("Speaker 3", "I saw the banking API track. Prizes are solid.", "Prizes", "Hackathon features"),
            ("Speaker 1", "Before we lock in, let's brainstorm.", "Topic generation", "Design process"),
            ("Speaker 4", "What about something for meetings? Standups are messy.", "Explanation of an idea", "Project"),
            ("Speaker 2", "Like a bot that runs standup?", "Asking for idea clarification", "Project"),
            ("Speaker 4", "Or captures what people say and turns it into updates.", "Expanding on idea", "Project"),
            ("Speaker 3", "Blockers, action items — that kind of thing?", "Clarification of idea", "Project"),
            ("Speaker 1", "Yeah. Would need to process transcript or audio.", "Feasibility of idea", "Project"),
            ("Speaker 4", "Transcript is easier. Tab or JSON.", "Scoping", "Design process"),
            ("Speaker 2", "Is that feasible in a weekend?", "Feasibility of idea", "Project"),
            ("Speaker 3", "If we keep it simple. Parse, extract, show a dashboard.", "Scoping", "Design process"),
            ("Speaker 1", "Let's write it down and think more.", "Convergence onto topic", "Design process"),
        ],
    },
    {
        "name": "lucky_charm_standup_02.tab",
        "phase": "concept",
        "segments": [
            ("Speaker 1", "Okay, so we're doing the standup tool.", "Goal validation", "Team process"),
            ("Speaker 4", "Lucky Charm. That's the name I'm pitching.", "Chosen idea", "Project"),
            ("Speaker 2", "Cute. What does it do?", "Asking for idea clarification", "Project"),
            ("Speaker 4", "Capture standup updates from meetings. Blockers, actions, decisions.", "Explanation of an idea", "Project"),
            ("Speaker 3", "So you upload a transcript, it extracts structure?", "Clarification of idea", "Project"),
            ("Speaker 4", "Exactly. No verbatim quotes — Props compliant. Categories and themes only.", "Explanation of an idea", "Project"),
            ("Speaker 1", "Privacy-first. Raw text stays in a TEE.", "Scoping", "Design process"),
            ("Speaker 2", "TEE? Like trusted execution?", "Asking for idea clarification", "Project"),
            ("Speaker 1", "Yeah. Phala has enclave support. We'd run extraction there.", "Explanation of an idea", "Project"),
            ("Speaker 3", "Output goes to a dashboard. Team lead view, member view.", "Expanding on idea", "Project"),
            ("Speaker 4", "And we could export context for an LLM. Summary, rationale.", "Expanding on idea", "Project"),
            ("Speaker 2", "I'm in. Who's doing what?", "Task allocation", "Team process"),
            ("Speaker 1", "I'll own backend and TEE integration.", "Role allocation", "Team process"),
        ],
    },
    {
        "name": "lucky_charm_standup_03.tab",
        "phase": "goals",
        "segments": [
            ("Speaker 1", "Let's lock in the goals.", "Facilitation", "Team process"),
            ("Speaker 3", "Goal one: capture blockers with categories.", "Scoping team goal", "Team goal"),
            ("Speaker 4", "Goal two: action items with due dates and assignees.", "Scoping team goal", "Team goal"),
            ("Speaker 2", "Goal three: key decisions and agreements.", "Scoping team goal", "Team goal"),
            ("Speaker 1", "And output that's LLM-ready?", "Asking for idea clarification", "Project"),
            ("Speaker 4", "Yeah. Narrative summary, rationale, timeline. For ChatGPT or Claude.", "Explanation of an idea", "Project"),
            ("Speaker 3", "So someone can paste context and get a standup recap.", "Validation of idea", "Project"),
            ("Speaker 2", "Copy for LLM, Download JSON. Those features.", "Scoping team goal", "Team goal"),
            ("Speaker 1", "One bank for demo, keep it simple.", "Scoping", "Design process"),
            ("Speaker 4", "Agreed. Top 12 is the target.", "Team goal to win", "Team goal"),
            ("Speaker 3", "Let's document this. Add to the README.", "Task allocation", "Team process"),
            ("Speaker 2", "I'll draft the goals doc.", "Commitment", "Team process"),
        ],
    },
    {
        "name": "lucky_charm_standup_04.tab",
        "phase": "planning",
        "segments": [
            ("Speaker 1", "Integration planning. What do we need?", "Facilitation", "Team process"),
            ("Speaker 3", "OpenAPI for the transcript endpoint.", "Task allocation", "Team process"),
            ("Speaker 2", "Attestation flow — Phala CVM verification.", "Task allocation", "Team process"),
            ("Speaker 4", "Staging env for nightly deploys.", "Task allocation", "Team process"),
            ("Speaker 1", "Docs: onboarding, privacy policy, attestation UX.", "Task allocation", "Team process"),
            ("Speaker 3", "Review process — hash verification, Props filter PR.", "Review request", "Team process"),
            ("Speaker 4", "Props filter: keyword extraction, no verbatim.", "Clarification of idea", "Project"),
            ("Speaker 2", "So we need a runbook for TEE deployment.", "Commitment", "Team process"),
            ("Speaker 1", "Add it. Who's on OpenAPI?", "Task allocation", "Team process"),
            ("Speaker 3", "I'll do it. Finish by tomorrow.", "Commitment", "Team process"),
            ("Speaker 4", "Demo script for sponsor review — Friday.", "Commitment", "Team process"),
            ("Speaker 2", "API auth handoff after OpenAPI is done.", "Coordination", "Team process"),
        ],
    },
    {
        "name": "lucky_charm_standup_05.tab",
        "phase": "execution",
        "segments": [
            ("Speaker 1", "Standup. What's blocking us?", "Facilitation", "Team process"),
            ("Speaker 2", "Phala attestation — enclave verification failing.", "Blocker", "Integration"),
            ("Speaker 1", "How long?", "", ""),
            ("Speaker 2", "Two days. Rate limits on the sandbox too.", "Duration", ""),
            ("Speaker 3", "Staging env is flaky. Nightly deploys keep failing.", "Blocker", "Environment"),
            ("Speaker 4", "Design tokens still missing for the mobile shell. Three days.", "Blocker", "Resource"),
            ("Speaker 1", "Plaid webhook sandbox credentials are expiring.", "Blocker", "Integration"),
            ("Speaker 3", "I can take attestation. Got the docs open.", "Task allocation", "Team process"),
            ("Speaker 1", "OpenAPI spec — still in progress?", "", ""),
            ("Speaker 2", "Yeah. A few more hours. Unblocks frontend upload.", "Status update", ""),
            ("Speaker 4", "Props filter PR 142 needs review. Keyword extraction.", "Review request", "Team process"),
            ("Speaker 1", "I'll take it. TEE runbook?", "", ""),
            ("Speaker 2", "This week. I'll write it up.", "Commitment", "Team process"),
            ("Speaker 3", "Documentation gap for onboarding. We should fix that.", "Blocker", "Task"),
            ("Speaker 1", "Add to backlog. Focus on attestation and staging first.", "Prioritization", "Team process"),
        ],
    },
    {
        "name": "lucky_charm_standup_06.tab",
        "phase": "finished",
        "segments": [
            ("Speaker 1", "Final sync before demo.", "Facilitation", "Team process"),
            ("Speaker 2", "We decided: REST for transcript upload, WebSocket only for live later.", "Decision recap", "Scope"),
            ("Speaker 3", "Blur speaker names in preview by default. Privacy first.", "Decision recap", "Agreement"),
            ("Speaker 4", "Ship MVP with mock plus Live TEE toggle.", "Decision recap", "Scope"),
            ("Speaker 1", "One bank for demo. Keeps it simple.", "Decision recap", "Scope"),
            ("Speaker 2", "OpenAPI spec is done. Frontend can integrate.", "Status update", ""),
            ("Speaker 3", "Attestation still optional for MVP. Demo path works.", "Clarification of idea", "Project"),
            ("Speaker 4", "Prep demo script for sponsor review by Friday.", "Commitment", "Team process"),
            ("Speaker 1", "Docs and README — finish by Friday?", "", ""),
            ("Speaker 2", "I'm on it. Privacy policy and attestation UX.", "Commitment", "Team process"),
            ("Speaker 1", "DevPost submit. We're ready.", "Next steps", "Next steps"),
            ("Speaker 3", "Got it. Standup done.", "", ""),
        ],
    },
]

# Filler for realistic length (meetings have more back-and-forth)
FILLER = [
    ("Speaker 1", "Yeah.", "", ""),
    ("Speaker 2", "OK.", "", ""),
    ("Speaker 3", "Sounds good.", "", ""),
    ("Speaker 4", "Got it.", "", ""),
    ("Speaker 1", "What do you think?", "Checking in with others", "Team dynamics"),
    ("Speaker 2", "I'm in.", "", ""),
    ("Speaker 3", "Let me check.", "", ""),
    ("Speaker 4", "We could also try that.", "", ""),
]


def add_filler(segments: list, target_min: int = 35) -> list:
    """Add filler so each file has enough rows for a realistic dataset."""
    while len(segments) < target_min:
        segments.append(random.choice(FILLER))
    return segments


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for m in LUCKY_CHARM_MEETINGS:
        segs = add_filler(m["segments"].copy(), target_min=40)
        content = generate_tab(m["name"], segs)
        out_path = OUTPUT_DIR / m["name"]
        out_path.write_text(content, encoding="utf-8")
        print(f"Wrote {out_path} ({len(segs)} segments, phase: {m['phase']})")
    # Also generate 07-21 as repeats for backwards compat (cycle through phases)
    phases = [m["phase"] for m in LUCKY_CHARM_MEETINGS]
    for i in range(7, 22):
        name = f"lucky_charm_standup_{i:02d}.tab"
        phase_idx = (i - 1) % len(LUCKY_CHARM_MEETINGS)
        m = LUCKY_CHARM_MEETINGS[phase_idx]
        segs = add_filler(m["segments"].copy(), target_min=40)
        content = generate_tab(name, segs)
        out_path = OUTPUT_DIR / name
        out_path.write_text(content, encoding="utf-8")
        print(f"Wrote {out_path} (cycle: {m['phase']})")
    print(f"\nDone. 21 mock files in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
