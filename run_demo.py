#!/usr/bin/env python3
"""
Run the SSO demo app for the Privacy-Preserving Standup Bot.

Usage:
  python run_demo.py
  # or: uv run python run_demo.py

Opens http://localhost:5000
"""

from demo_app.app import run

if __name__ == "__main__":
    run(port=5000)
