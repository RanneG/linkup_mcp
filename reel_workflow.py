"""Heuristics to turn reel transcripts into workflow cards (*.workflow.md)."""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

WORKFLOW_TYPES = ("tutorial", "opinion", "funnel", "inspiration")

TYPE_SIGNALS: dict[str, tuple[str, ...]] = {
    "tutorial": (
        "first go to",
        "then open",
        "next we need",
        "upload",
        "download",
        "paste",
        "set the frame rate",
        "step",
        "how to",
    ),
    "opinion": (
        "mistake",
        "wrong",
        "hot take",
        "better than",
        "don't need",
        "trust me",
        "overall",
        "nope",
        "leaned too heavily",
        "problems i see",
    ),
    "funnel": (
        "comment",
        "send you",
        "dm me",
        "link in bio",
        "full walkthrough",
        "i'll send",
    ),
    "inspiration": (
        "charge 5k",
        "developers easily charge",
        "just built",
        "buttery smooth",
    ),
}

# Whisper / homophone fixes (order matters for multi-word patterns).
TOOL_FIXES: tuple[tuple[re.Pattern[str], str], ...] = tuple(
    (re.compile(pat, re.I), repl)
    for pat, repl in (
        (r"\bcloud design\b", "Claude design"),
        (r"\bcloud code\b", "Claude Code"),
        (r"\bcloud of reference\b", "Claude a reference"),
        (r"\bcloud\b", "Claude"),
        (r"\bclotting chrome\b", "controlling Chrome"),
        (r"\bclot\b", "Claude"),
        (r"\beasy gift\b", "ezgif"),
        (r"\bgoogle flow\b", "Google Flow"),
        (r"\bwhisk\b", "Whisk"),
        (r"\brevan your cat\b", "RevenueCat"),
        (r"\brevan who cat\b", "RevenueCat"),
        (r"\bmetta ads\b", "Meta Ads"),
        (r"\bmetta\b", "Meta"),
        (r"\bagenda harness\b", "agent harness"),
        (r"\bhermes agent\b", "Hermes Agent"),
        (r"\bmetricool\b", "Metricool"),
        (r"\bcodex\b", "Codex"),
        (r"\bjarvis\b", "Jarvis"),
    )
)

KNOWN_TOOLS: tuple[str, ...] = (
    "Whisk",
    "Google Flow",
    "ezgif",
    "Claude",
    "Claude design",
    "Claude Code",
    "Codex",
    "Hermes Agent",
    "Hermes",
    "RevenueCat",
    "Metricool",
    "Meta Ads",
    "Cursor",
    "Chrome",
    "Ollama",
    "Telegram",
    "linkup MCP",
)

SURFACE_RULES: tuple[tuple[re.Pattern[str], str, str], ...] = (
    (re.compile(r"\bhermes\b", re.I), "Hermes", "Runtime agent host on Mac"),
    (re.compile(r"\bvoice\b", re.I), "Hermes", "Built-in Hermes voice (Mac)"),
    (re.compile(r"\bchrome\b|browser", re.I), "Hermes", "Browser control from Mac agent"),
    (re.compile(r"\bsub.?agent", re.I), "Hermes", "Hermes sub-agents + skills"),
    (re.compile(r"\bclaude design\b", re.I), "external", "Anthropic design tool"),
    (re.compile(r"\bclaude code\b|\bcodex\b", re.I), "Cursor", "IDE coding assistant"),
    (re.compile(r"\bwhisk\b|\bgoogle flow\b|\bezgif\b", re.I), "external", "Asset prep (not in repo)"),
    (re.compile(r"\bscroll\b|frame", re.I), "Cursor", "Ship demo HTML in linkup_mcp"),
    (re.compile(r"\brevenuecat\b", re.I), "skip", "Product analytics — app-specific"),
    (re.compile(r"\bmetricool\b", re.I), "skip", "Social scheduling — product-dependent"),
    (re.compile(r"\bmeta ads\b", re.I), "skip", "Paid ads — product-dependent"),
    (re.compile(r"\bcustomer support|faq", re.I), "skip", "SupplyMe later — not Nami v1"),
    (re.compile(r"\bdaily brief|routine", re.I), "Hermes", "Hermes cron / heartbeat"),
)


@dataclass(frozen=True)
class WorkflowCard:
    slug: str
    source_url: str
    transcript_path: str
    workflow_type: str
    steps: list[str]
    tools: list[str]
    surfaces: list[tuple[str, str, str]]  # item, surface, note
    mvp_slice: str
    not_doing: list[str]


def slug_from_url(url: str) -> str:
    m = re.search(r"/(?:reels?|p)/([^/?#]+)", url, re.I)
    if m:
        return m.group(1)
    return re.sub(r"[^a-zA-Z0-9_-]+", "-", url)[:48].strip("-") or "reel"


def clean_transcript(text: str) -> str:
    out = text.strip()
    for pattern, repl in TOOL_FIXES:
        out = pattern.sub(repl, out)
    return re.sub(r"\s+", " ", out)


def classify_type(text: str) -> str:
    lowered = text.lower()
    scores = {t: 0 for t in WORKFLOW_TYPES}
    for wf_type, signals in TYPE_SIGNALS.items():
        for signal in signals:
            if signal in lowered:
                scores[wf_type] += 1
    best = max(scores, key=lambda k: scores[k])
    if scores[best] == 0:
        return "inspiration"
    # Tie-break: tutorial > opinion > funnel > inspiration
    tied = [t for t, s in scores.items() if s == scores[best]]
    for preferred in ("tutorial", "opinion", "funnel", "inspiration"):
        if preferred in tied:
            return preferred
    return best


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def extract_steps(text: str) -> list[str]:
    cleaned = clean_transcript(text)
    sentences = _split_sentences(cleaned)
    steps: list[str] = []
    for sent in sentences:
        s = sent.strip()
        if len(s) < 12:
            continue
        # Skip pure commentary openers for opinion reels
        if re.match(r"^(hey |overall |yep |nope )", s, re.I):
            continue
        if re.search(r"\b(i think|hot take|trust me|biggest mistake)\b", s, re.I):
            continue
        steps.append(s.rstrip("."))
    if not steps:
        steps = [cleaned[:280] + ("..." if len(cleaned) > 280 else "")]
    return steps[:12]


def extract_tools(text: str) -> list[str]:
    cleaned = clean_transcript(text)
    found: list[str] = []
    lowered = cleaned.lower()
    for tool in KNOWN_TOOLS:
        if tool.lower() in lowered and tool not in found:
            found.append(tool)
    return found


def map_surfaces(text: str) -> list[tuple[str, str, str]]:
    cleaned = clean_transcript(text)
    rows: list[tuple[str, str, str]] = []
    seen: set[str] = set()
    for pattern, surface, note in SURFACE_RULES:
        m = pattern.search(cleaned)
        if m and m.group(0).lower() not in seen:
            seen.add(m.group(0).lower())
            rows.append((m.group(0), surface, note))
    if not rows:
        rows.append(("transcript themes", "external", "No Hermes/Cursor action identified"))
    return rows


def default_mvp(workflow_type: str, text: str) -> str:
    lowered = text.lower()
    if "scroll" in lowered or "frame" in lowered:
        return (
            "Ship `demos/scroll-frames/` with 24 placeholder frames and scroll-synced "
            "playback (~1–2h). Swap zip export from ezgif when you have a real Flow clip."
        )
    if "hermes" in lowered or "jarvis" in lowered:
        return (
            "Mac: enable Hermes voice + document `/browser` Chrome connect in "
            "`docs/hermes/REEL_BACKLOG.md` priority 1–3 (~1–2h each)."
        )
    if workflow_type == "tutorial":
        return "Extract one numbered procedure from the reel and automate the first manual step in-repo."
    if workflow_type == "opinion":
        return "Turn disagreements into a 3-item backlog doc (done: REEL_BACKLOG.md) — no code yet."
    return "Capture transcript + workflow card only; defer implementation until scoped."


def default_not_doing(text: str) -> list[str]:
    lowered = text.lower()
    cuts = [
        "Full Jarvis clone in Cursor — runtime stays on Hermes (Mac).",
        "RevenueCat / Metricool / Meta Ads MCP unless a shipped app needs them.",
        "24/7 customer-support agent — deferred (SupplyMe lane).",
    ]
    if "scroll" not in lowered and "frame" not in lowered:
        cuts.append("Scroll-frame demo — not relevant to this reel.")
    if "claude" not in lowered and "design" not in lowered:
        cuts.append("Claude design skill — only if you adopt Anthropic design tooling.")
    return cuts[:5]


def build_workflow_card(
    *,
    slug: str,
    source_url: str,
    transcript_text: str,
    transcript_rel_path: str,
) -> WorkflowCard:
    cleaned = clean_transcript(transcript_text)
    wf_type = classify_type(cleaned)
    return WorkflowCard(
        slug=slug,
        source_url=source_url,
        transcript_path=transcript_rel_path,
        workflow_type=wf_type,
        steps=extract_steps(transcript_text),
        tools=extract_tools(transcript_text),
        surfaces=map_surfaces(transcript_text),
        mvp_slice=default_mvp(wf_type, cleaned),
        not_doing=default_not_doing(cleaned),
    )


def parse_transcript_markdown(md_text: str) -> tuple[str, str]:
    """Return (source_url, transcript_body) from a *.md transcript file."""
    source = ""
    m = re.search(r"\*\*Source:\*\*\s*(.+)", md_text)
    if m:
        source = m.group(1).strip()
    body_match = re.search(r"## Transcript\s*\n+([\s\S]+?)(?:\n## |\Z)", md_text)
    body = body_match.group(1).strip() if body_match else md_text
    return source, body


def render_workflow_markdown(card: WorkflowCard) -> str:
    lines = [
        f"# Workflow: {card.slug}",
        "",
        f"- **Type:** {card.workflow_type}",
        f"- **Source:** {card.source_url}",
        f"- **Transcript:** [{Path(card.transcript_path).name}]({Path(card.transcript_path).name})",
        "",
        "## Steps",
        "",
    ]
    for i, step in enumerate(card.steps, 1):
        lines.append(f"{i}. {step}")
    lines.extend(["", "## Tools mentioned", ""])
    if card.tools:
        lines.extend(f"- {t}" for t in card.tools)
    else:
        lines.append("- (none detected)")
    lines.extend(["", "## Surface map", "", "| Item | Surface | Notes |", "|------|---------|-------|"])
    for item, surface, note in card.surfaces:
        lines.append(f"| {item} | {surface} | {note} |")
    lines.extend(
        [
            "",
            "## MVP slice",
            "",
            card.mvp_slice,
            "",
            "## Not doing",
            "",
        ]
    )
    for cut in card.not_doing:
        lines.append(f"- {cut}")
    lines.append("")
    return "\n".join(lines)


def write_workflow_card(
    *,
    inbox_dir: Path,
    slug: str,
    source_url: str,
    transcript_text: str,
    transcript_filename: str | None = None,
) -> Path:
    transcript_filename = transcript_filename or f"{slug}.md"
    transcript_rel = f"data/inbox/{transcript_filename}"
    card = build_workflow_card(
        slug=slug,
        source_url=source_url,
        transcript_text=transcript_text,
        transcript_rel_path=transcript_rel,
    )
    out = inbox_dir / f"{slug}.workflow.md"
    out.write_text(render_workflow_markdown(card), encoding="utf-8")
    return out


def workflow_from_transcript_file(md_path: Path, *, inbox_dir: Path | None = None) -> Path:
    inbox = inbox_dir or md_path.parent
    md_text = md_path.read_text(encoding="utf-8")
    source_url, body = parse_transcript_markdown(md_text)
    slug = md_path.stem
    return write_workflow_card(
        inbox_dir=inbox,
        slug=slug,
        source_url=source_url,
        transcript_text=body,
        transcript_filename=md_path.name,
    )
