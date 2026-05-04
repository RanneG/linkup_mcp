# Stitch UI (moved)

The **Stitch desktop application** source code lives in **[RanneG/stitch-app](https://github.com/RanneG/stitch-app)**.

This repo (**linkup_mcp**) keeps only the **HTTP bridge** (`stitch_rag_bridge.py`), **MCP** (`server.py`), **Google OAuth / subscriptions** (`stitch_auth/`), **face verification** (`face_verification/`), and the **in-app help** markdown (`docs/stitch_user_guide.md`).

- **Run the UI:** clone [stitch-app](https://github.com/RanneG/stitch-app), then see [docs/RUNNING.md](https://github.com/RanneG/stitch-app/blob/main/docs/RUNNING.md) and [docs/BACKEND.md](https://github.com/RanneG/stitch-app/blob/main/docs/BACKEND.md).
- **Run the API:** from linkup_mcp root, `python stitch_rag_bridge.py` (default `http://127.0.0.1:8765`).
- **One-click from linkup_mcp:** `Stitch.bat` / `Stitch-Desktop.bat` resolve **`../stitch-app`** or **`STITCH_APP_ROOT`** (see **`scripts/StitchPaths.ps1`**).

Split checklist: **[docs/stitch/MIGRATION.md](../../docs/stitch/MIGRATION.md)**.
