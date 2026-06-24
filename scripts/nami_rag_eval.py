#!/usr/bin/env python3
"""Smoke-test RAG answers against known facts in the nami corpus."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Golden questions — substring(s) expected in answer or sources.
EVAL_CASES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("What port does the Stitch bridge use by default?", ("8765",)),
    ("Where does runtime Nami Hermes run?", ("Mac",)),
    ("What is the Windows PC role vs Mac for Nami?", ("Cursor",)),
    ("How do I start the Nami Telegram gateway after reboot?", ("start-nami-gateway", "gateway start")),
    ("What Ollama model is recommended for Nami on Mac?", ("qwen",)),
)


async def run_eval(*, rebuild: bool) -> int:
    if rebuild:
        from nami_corpus.sync import sync_corpus

        sync_corpus()

    # Force fresh index after corpus sync (in-process eval only).
    import rag_runtime

    rag_runtime._rag_workflow = None

    from rag_runtime import ensure_rag_ready

    wf = await ensure_rag_ready()
    passed = 0
    failed = 0

    for question, needles in EVAL_CASES:
        payload = await wf.query(question)
        answer = (payload.get("answer") or "").lower()
        sources = json.dumps(payload.get("sources") or []).lower()
        blob = answer + " " + sources
        ok = any(n.lower() in blob for n in needles)
        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1
        conf = payload.get("confidence", "?")
        fb = payload.get("fallback", False)
        print(f"{status} [{conf} fallback={fb}] {question}")
        if not ok:
            print(f"       expected one of: {needles}")
            print(f"       answer: {(payload.get('answer') or '')[:120]}...")

    print(f"\n{passed}/{passed + failed} passed")
    return 0 if failed == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate nami RAG corpus")
    parser.add_argument("--rebuild", action="store_true", help="Sync corpus before eval")
    args = parser.parse_args()
    return asyncio.run(run_eval(rebuild=args.rebuild))


if __name__ == "__main__":
    sys.exit(main())
