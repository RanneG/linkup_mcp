#!/usr/bin/env python3
"""Thin wrapper — prefer: python -m nami_corpus.sync"""

from nami_corpus.sync import main

if __name__ == "__main__":
    raise SystemExit(main())
