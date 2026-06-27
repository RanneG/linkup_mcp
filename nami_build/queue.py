"""File-backed build job queue; jobs live as JSON under data/build-queue/."""

from __future__ import annotations

import json
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
QUEUE_ROOT = ROOT / "data" / "build-queue"


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class BuildJob:
    id: str
    task: str
    source: str = "telegram"
    repo: str = "linkup_mcp"
    status: JobStatus = JobStatus.PENDING
    turn_cap: int = 8
    created_at: str = field(default_factory=lambda: _now())
    updated_at: str = field(default_factory=lambda: _now())
    result_summary: str = ""
    branch: str = ""
    error: str = ""
    test_output: str = ""

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["status"] = self.status.value
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> BuildJob:
        status = data.get("status", JobStatus.PENDING.value)
        if isinstance(status, JobStatus):
            status_val = status
        else:
            status_val = JobStatus(str(status))
        return cls(
            id=str(data["id"]),
            task=str(data["task"]),
            source=str(data.get("source", "telegram")),
            repo=str(data.get("repo", "linkup_mcp")),
            status=status_val,
            turn_cap=int(data.get("turn_cap", 8)),
            created_at=str(data.get("created_at", _now())),
            updated_at=str(data.get("updated_at", _now())),
            result_summary=str(data.get("result_summary", "")),
            branch=str(data.get("branch", "")),
            error=str(data.get("error", "")),
            test_output=str(data.get("test_output", "")),
        )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _dir_for(status: JobStatus) -> Path:
    return QUEUE_ROOT / status.value


class BuildQueue:
    def __init__(self, root: Path | None = None) -> None:
        self.root = root or QUEUE_ROOT
        for status in JobStatus:
            (self.root / status.value).mkdir(parents=True, exist_ok=True)

    def _path(self, job_id: str, status: JobStatus) -> Path:
        return self.root / status.value / f"{job_id}.json"

    def _find_path(self, job_id: str) -> Path | None:
        for status in JobStatus:
            path = self._path(job_id, status)
            if path.is_file():
                return path
        return None

    def enqueue(
        self,
        task: str,
        *,
        source: str = "telegram",
        repo: str = "linkup_mcp",
        turn_cap: int = 8,
    ) -> BuildJob:
        job = BuildJob(
            id=uuid.uuid4().hex[:12],
            task=task.strip(),
            source=source,
            repo=repo,
            turn_cap=max(1, min(turn_cap, 20)),
        )
        self._write(job, JobStatus.PENDING)
        return job

    def get(self, job_id: str) -> BuildJob | None:
        path = self._find_path(job_id)
        if not path:
            return None
        return BuildJob.from_dict(json.loads(path.read_text(encoding="utf-8")))

    def list_recent(self, limit: int = 10) -> list[BuildJob]:
        jobs: list[BuildJob] = []
        for status in JobStatus:
            for path in sorted(
                (self.root / status.value).glob("*.json"),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            ):
                jobs.append(BuildJob.from_dict(json.loads(path.read_text(encoding="utf-8"))))
        jobs.sort(key=lambda j: j.updated_at, reverse=True)
        return jobs[:limit]

    def update(self, job: BuildJob) -> None:
        job.updated_at = _now()
        existing = self._find_path(job.id)
        if not existing:
            raise FileNotFoundError(f"Job not found: {job.id}")
        current_status = JobStatus(existing.parent.name)
        if current_status != job.status:
            existing.unlink(missing_ok=True)
            self._write(job, job.status)
        else:
            self._write(job, job.status)

    def move(self, job: BuildJob, new_status: JobStatus) -> BuildJob:
        old = self._find_path(job.id)
        if old:
            old.unlink(missing_ok=True)
        job.status = new_status
        job.updated_at = _now()
        self._write(job, new_status)
        return job

    def _write(self, job: BuildJob, status: JobStatus) -> None:
        path = self._path(job.id, status)
        path.write_text(json.dumps(job.to_dict(), indent=2), encoding="utf-8")

    def pending_jobs(self) -> list[BuildJob]:
        pending_dir = self.root / JobStatus.PENDING.value
        jobs = [
            BuildJob.from_dict(json.loads(p.read_text(encoding="utf-8")))
            for p in sorted(pending_dir.glob("*.json"), key=lambda x: x.stat().st_mtime)
        ]
        return jobs
