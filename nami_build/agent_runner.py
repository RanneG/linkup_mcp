"""Run a build task via Cursor SDK when configured."""

from __future__ import annotations

import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env", override=True)


@dataclass
class AgentRunResult:
    ok: bool
    summary: str
    detail: str = ""


def build_prompt(task: str, *, turn_cap: int) -> str:
    return f"""Mobile build request from Nami (async — Ranne reviews in Cursor).

Task:
{task}

Constraints:
- Read AGENTS.md and CLAUDE.md first.
- Minimal focused diff; match repo style.
- Run pytest before finishing; fix failures within this session.
- Do NOT git commit unless explicitly asked.
- Turn cap: {turn_cap} tool rounds — stop with summary if not done.

When finished, summarize: files changed, test result, suggested branch name.
"""


def run_pytest(cwd: Path, timeout: int = 300) -> tuple[bool, str]:
    targets = os.getenv("NAMI_BUILD_PYTEST", "tests/test_nami_build.py").strip()
    python = os.getenv("NAMI_BUILD_PYTHON", sys.executable)
    proc = subprocess.run(
        [python, "-m", "pytest", "-q", "--tb=no", *targets.split()],
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    out = (proc.stdout or "") + (proc.stderr or "")
    return proc.returncode == 0, out.strip()[-4000:]


def git_branch_name(job_id: str) -> str:
    return f"nami/build-{job_id[:8]}"


def ensure_branch(cwd: Path, branch: str) -> tuple[bool, str]:
    try:
        subprocess.run(["git", "rev-parse", "--git-dir"], cwd=cwd, check=True, capture_output=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False, "Not a git repository"

    status = subprocess.run(["git", "status", "--porcelain"], cwd=cwd, capture_output=True, text=True)
    current_proc = subprocess.run(["git", "branch", "--show-current"], cwd=cwd, capture_output=True, text=True)
    current = (current_proc.stdout or "").strip() or "HEAD"

    if status.stdout.strip():
        return True, f"Working tree dirty — staying on `{current}` (review diff in Cursor)"

    create = subprocess.run(
        ["git", "checkout", "-b", branch],
        cwd=cwd,
        capture_output=True,
        text=True,
    )
    if create.returncode != 0:
        checkout = subprocess.run(
            ["git", "checkout", branch],
            cwd=cwd,
            capture_output=True,
            text=True,
        )
        if checkout.returncode != 0:
            return True, f"Using current branch `{current}` (could not create `{branch}`)"

    return True, f"On branch `{branch}`"


def git_summary(cwd: Path) -> str:
    diff = subprocess.run(
        ["git", "diff", "--stat"],
        cwd=cwd,
        capture_output=True,
        text=True,
    )
    status = subprocess.run(["git", "status", "-sb"], cwd=cwd, capture_output=True, text=True)
    parts = [(status.stdout or "").strip(), (diff.stdout or "").strip()]
    return "\n".join(p for p in parts if p)


def _resolve_agent_cmd() -> str:
    override = os.getenv("NAMI_BUILD_AGENT_CMD", "").strip()
    if override:
        return override
    if os.name == "nt":
        localappdata = os.environ.get("LOCALAPPDATA", "")
        if localappdata:
            for name in ("agent.cmd", "agent.ps1"):
                candidate = Path(localappdata) / "cursor-agent" / name
                if candidate.is_file():
                    return str(candidate)
    return "agent"


def run_agent_cli(task: str, cwd: Path, *, turn_cap: int) -> AgentRunResult:
    """Cursor Agent CLI (recommended on Windows — Python cursor_sdk bridge fails there)."""
    api_key = os.getenv("CURSOR_API_KEY", "").strip()
    if not api_key:
        return AgentRunResult(
            ok=False,
            summary="CURSOR_API_KEY not set on PC worker",
            detail="Add CURSOR_API_KEY to .env — see docs/hermes/MOBILE_BUILD.md",
        )

    agent_cmd = _resolve_agent_cmd()
    prompt = build_prompt(task, turn_cap=turn_cap)
    env = os.environ.copy()
    env["CURSOR_API_KEY"] = api_key

    try:
        proc = subprocess.run(
            [agent_cmd, "--trust", prompt],
            cwd=cwd,
            env=env,
            capture_output=True,
            text=True,
            timeout=int(os.getenv("NAMI_BUILD_AGENT_TIMEOUT", "3600")),
        )
    except FileNotFoundError:
        return AgentRunResult(
            ok=False,
            summary="Cursor agent CLI not found",
            detail="Install: irm 'https://cursor.com/install?win32=true' | iex",
        )
    except subprocess.TimeoutExpired:
        return AgentRunResult(ok=False, summary="Cursor agent CLI timed out", detail="")

    combined = ((proc.stdout or "") + "\n" + (proc.stderr or "")).strip()
    ok = proc.returncode == 0
    return AgentRunResult(
        ok=ok,
        summary=combined[-2000:] if combined else f"agent exit code {proc.returncode}",
        detail=combined[:2000] if len(combined) > 2000 else "",
    )


def run_cursor_sdk_agent(task: str, cwd: Path, *, turn_cap: int) -> AgentRunResult:
    api_key = os.getenv("CURSOR_API_KEY", "").strip()
    if not api_key:
        return AgentRunResult(
            ok=False,
            summary="CURSOR_API_KEY not set on PC worker",
            detail="Add CURSOR_API_KEY to .env — see docs/hermes/MOBILE_BUILD.md",
        )

    try:
        from cursor_sdk import Agent, AgentOptions, LocalAgentOptions
    except ImportError:
        return AgentRunResult(
            ok=False,
            summary="cursor-sdk not installed",
            detail="pip install cursor-sdk  (see docs/hermes/MOBILE_BUILD.md)",
        )

    prompt = build_prompt(task, turn_cap=turn_cap)
    model = os.getenv("NAMI_BUILD_MODEL", "composer-2.5")

    try:
        result = Agent.prompt(
            prompt,
            AgentOptions(
                api_key=api_key,
                model=model,
                local=LocalAgentOptions(cwd=str(cwd.resolve())),
            ),
        )
    except OSError as exc:
        if "10038" in str(exc) and os.name == "nt":
            return run_agent_cli(task, cwd, turn_cap=turn_cap)
        return AgentRunResult(ok=False, summary="Cursor SDK error", detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        return AgentRunResult(ok=False, summary="Cursor agent error", detail=str(exc))

    status = getattr(result, "status", "unknown")
    text = getattr(result, "result", "") or ""
    ok = str(status).lower() in {"success", "completed", "done"}
    return AgentRunResult(
        ok=ok,
        summary=text[:2000] if text else f"Agent finished with status: {status}",
        detail=text[2000:4000] if len(text) > 2000 else "",
    )


def run_cursor_agent(task: str, cwd: Path, *, turn_cap: int) -> AgentRunResult:
    runner = os.getenv("NAMI_BUILD_RUNNER", "auto").strip().lower()
    if runner == "sdk":
        return run_cursor_sdk_agent(task, cwd, turn_cap=turn_cap)
    if runner == "cli" or (runner == "auto" and os.name == "nt"):
        return run_agent_cli(task, cwd, turn_cap=turn_cap)
    return run_cursor_sdk_agent(task, cwd, turn_cap=turn_cap)
