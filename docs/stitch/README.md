# Stitch (HTTP bridge + handoff)

The **Stitch desktop app** lives in **[RanneG/stitch-app](https://github.com/RanneG/stitch-app)**. This folder holds **linkup_mcp** documentation for the Flask bridge, OAuth, and the product/repo split.

| Doc | Purpose |
|-----|---------|
| [MIGRATION.md](MIGRATION.md) | Checklist: what stays in linkup_mcp vs stitch-app, dependency profiles, phases. |
| [STATUS.md](STATUS.md) | Roadmap, voice intents, Google sign-in env notes. |

Python entrypoints remain at the repo root (`stitch_rag_bridge.py`, `stitch_gui.py`, …) so `pip install -e .` and Cursor MCP keep working without a package-layout migration.
