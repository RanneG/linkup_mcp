"""Process one pending queued build job (subprocess entry — avoids Flask thread + SDK on Windows)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env", override=True)

from nami_build.queue import BuildJob, JobStatus
from nami_build.worker import run_once


def main() -> int:
    job = run_once()
    if job is None:
        return 0
    print(json.dumps(job.to_dict()))
    if job.status == JobStatus.COMPLETED:
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
