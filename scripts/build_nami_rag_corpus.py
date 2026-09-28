#!/usr/bin/env python3
"""Thin wrapper — prefer: python -m nami_corpus"""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from nami_corpus.sync import main

if __name__ == "__main__":
    raise SystemExit(main())
