# Cursor Linkup MCP Server

Custom MCP (Model Context Protocol) server for Cursor IDE with:
- 🌐 **Web Search** - Deep web searches using [Linkup API](https://www.linkup.so/)
- 📚 **RAG (Retrieval Augmented Generation)** - Query documents using LlamaIndex with Ollama

## ✨ Key Features

- ✅ **Local AI** - Uses Ollama (llama3.2) for complete privacy
- ✅ **Zero API Costs** - RAG tool is completely free (uses local models)
- ✅ **Source Citations** - Know where answers come from
- ✅ **Multiple Document Types** - Supports PDF, DOCX, MD, TXT, and more
- ✅ **Cursor Integration** - Works seamlessly in Cursor IDE

## 📋 Prerequisites

- **Python 3.12+**
- **[uv](https://github.com/astral-sh/uv)** package manager
- **[Ollama](https://ollama.ai/)** installed locally with llama3.2 model
- **Linkup API key** (optional, only for web search)

## 🚀 Quick Start

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/RanneG/linkup_mcp.git
cd linkup_mcp
uv sync
```

### 2. Install Ollama & Model

```bash
# Download from https://ollama.ai/download
# Then pull the model:
ollama pull llama3.2
```

### 3. Configure Environment (Optional)

Create a `.env` file for web search (RAG works without API keys):

```bash
LINKUP_API_KEY=your_linkup_api_key  # Optional, for web_search tool
```

### 4. Configure Cursor

Add to `~/.cursor/mcp.json` (or `C:\Users\<username>\.cursor\mcp.json` on Windows):

```json
{
  "mcpServers": {
    "linkup-server": {
      "command": "C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe",
      "args": [
        "-m", "uv", "run",
        "--directory", "C:\\path\\to\\linkup_mcp",
        "python", "server.py"
      ]
    }
  }
}
```

**Replace** `YOUR_USERNAME` and path with your actual values.

### 5. Restart Cursor & Use!

In Cursor's chat:
- **"Use the rag tool to tell me about [topic]"**
- **"Use the rag_stitch tool to get a UI-ready answer payload"**
- **"Search the web for [query]"** (requires Linkup API key)

## 📚 Using the RAG Tool

Add documents to the `data/` folder:

```
data/
├── document1.pdf
├── notes.md
└── research/
    └── paper.pdf
```

Supported: PDF, DOCX, TXT, MD, HTML, and more.

### Stitch-style response shape

The `rag` tool now returns a JSON string with:
- `answer`: final synthesized answer text
- `confidence`: `low`, `medium`, or `high`
- `fallback`: `true` when evidence is weak/insufficient
- `sources`: ranked source snippets (`source_id`, `score`, `snippet`)

The `rag_stitch` tool returns a UI-oriented JSON string:
- `state`: `answered` or `fallback`
- `answer`
- `confidence` (`low`, `medium`, or `high`)
- `source_cards` (empty when `state` is `fallback` so the UI stays clean)
- `show_sources` (`false` on fallback)
- `debug_retrieval_cards` (only when `STITCH_RAG_DEBUG=1` and fallback — raw top chunks for debugging)

### Stitch HTTP bridge (for the Stitch desktop app)

Run a small Flask server that exposes the same payload as `rag_stitch`, plus optional **local face verification** (`/api/face/*`, DeepFace + OpenCV liveness — see `face_verification/`):

```bash
.\.venv\Scripts\python.exe stitch_rag_bridge.py
```

Then point Stitch’s Vite dev proxy at `http://127.0.0.1:8765` (see [integrations/stitch/README.md](integrations/stitch/README.md); proxy `/api` for both RAG and face routes).

### Stitch single-window GUI (API + built UI in one process)

If you want **one native window** without separate “bridge terminal” + “Vite/Tauri terminal”, use **pywebview** + Flask serving the **production Vite build** from the same port (`8765`):

1. **Build** the Stitch desktop bundle: `npm run build` in `temp_repo/stitch/apps/desktop` (after `npm run sync:stitch` if you edit files under `integrations/stitch/`).
2. **Install** `pywebview`: `uv sync --extra stitch-gui` or `pip install "pywebview>=5,<6"` into `.venv`.
3. **Run** by double-clicking **`Stitch.bat`** at the repo root (no terminal needed). It creates `.venv` if missing, installs Python deps + **pywebview**, syncs `integrations/stitch`, runs **`npm install`** + **`npm run build`**, then opens the window. Same script as **`Stitch-Bundled-Gui.bat`**. Optional: `npm run gui:stitch` or `.\scripts\Start-StitchBundledGui.ps1 -SkipBuild` after a successful build.

Implementation: [stitch_gui.py](stitch_gui.py) starts Flask from [stitch_rag_bridge.py](stitch_rag_bridge.py) with `STITCH_DESKTOP_DIST` pointing at `dist/` so `/` and `/assets/*` serve the SPA while `/api/*` stays the bridge. A **single `.exe`** later is possible with PyInstaller around `stitch_gui.py` (not automated here yet).

### Stitch as a native desktop app (no long manual command chain)

Stitch’s `apps/desktop` package uses **Tauri** for a real windowed app (`npm run dev` there = `tauri dev`). In this repo:

| Goal | What to do |
|------|----------------|
| **One double-click** (bridge + sync + Tauri) | Run **`Stitch-Desktop.bat`** at the repository root. |
| Same from a terminal | `npm run launch:stitch` |
| Bridge already running | `npm run launch:stitch:ui-only` or `.\scripts\Start-StitchDesktop.ps1 -SkipBridge` |
| Tauri only (you start the bridge yourself) | `npm run dev:desktop` |
| Browser tab only (no Tauri) | `npm run dev:browser` (unchanged) |
| Packaged `.exe` / installer | `npm run build:stitch-app` (after [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) and a `temp_repo/stitch` clone) |

You still need a **`temp_repo/stitch`** clone and **Node** on `PATH`. The first Tauri dev run may compile Rust dependencies (one-time wait).

### Quick regression run

To run the v1 prompt suite against your local PDF corpus:

```bash
python rag_regression.py
```

This prints each response payload and a small summary (sourced count, fallback count, low-confidence count).

### Stitch JSON contract tests

```bash
python -m unittest tests.test_rag_stitch_contract -v
```

Validates `_to_stitch_view` shapes (`answered` vs `fallback`, `show_sources`, optional `debug_retrieval_cards`).

If MCP-security prompts fall back, add the MCP landscape paper to `data/`:
- [Model Context Protocol (MCP): Landscape, Security Threats, and Future Research Directions](https://arxiv.org/pdf/2503.23278.pdf)

### Stitch CLI demo

To preview Stitch-oriented output states in a local terminal:

```bash
python stitch_demo_cli.py
```

This renders:
- `state` (`answered` or `fallback`)
- `confidence`
- `answer`
- source cards when `show_sources` is true; optional `debug_retrieval_cards` when `STITCH_RAG_DEBUG=1`

## 🛠️ Project Structure

```
linkup_mcp/
├── server.py          # Main MCP server
├── rag.py             # RAG workflow
├── stitch_rag_bridge.py  # Local HTTP bridge for Stitch UI dev (RAG + /api/face)
├── face_verification/    # Local 1:1 face match + liveness (used by bridge)
├── integrations/stitch/  # Tracked Stitch UI patch + instructions
├── data/              # Your documents
├── pyproject.toml     # Dependencies
├── .cursorrules       # AI context for Cursor
└── .env               # Environment variables (create this)
```

## 🔧 How It Works

```
Cursor IDE → MCP Server (server.py)
                 ↓
    ┌────────────┴────────────┐
    │  RAG Tool   │  Web Search│
    │  (rag.py)   │  (Linkup)  │
    └──────┬──────┴────────────┘
           ↓
    Ollama (llama3.2) - runs locally
```

## 💰 Cost

| Tool | Cost |
|------|------|
| RAG | **$0** (local Ollama) |
| Web Search | ~$10-50/month (Linkup API) |
| Ollama | **$0** (runs locally) |

## 🐛 Troubleshooting

**MCP server not loading?**
1. Check Ollama is running: `ollama list`
2. Verify path in `mcp.json`
3. Check Cursor logs: `%APPDATA%\Cursor\logs\`

**Ollama connection refused?**
```bash
ollama serve
```

## 🔐 Privacy

- ✅ **RAG Tool**: 100% local, documents never leave your machine
- ✅ **Ollama**: Runs locally, no cloud API calls
- ⚠️ **Web Search**: Queries sent to Linkup servers

## 📖 Related Projects

| Repository | Purpose |
|------------|---------|
| [chatbot-rag-core](https://github.com/RanneG/chatbot-rag-core) | Reusable Python RAG library |
| [chatbot-api-server](https://github.com/RanneG/chatbot-api-server) | Production Docker API server |

## 🎓 Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [Linkup API](https://www.linkup.so/)
- [LlamaIndex](https://docs.llamaindex.ai/)
- [Ollama](https://ollama.ai/)

## 📝 License

MIT License - See [LICENSE](LICENSE)

## 🙏 Credits

- Original: [patchy631/ai-engineering-hub](https://github.com/patchy631/ai-engineering-hub)
- [Linkup](https://www.linkup.so/) for web search
- [LlamaIndex](https://www.llamaindex.ai/) for RAG
- [Ollama](https://ollama.ai/) for local AI

---

**Made with ❤️ for Cursor IDE users**
