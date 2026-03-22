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
git clone https://github.com/RanneG/cursor_linkup_mcp.git
cd cursor_linkup_mcp
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
        "--directory", "C:\\path\\to\\cursor_linkup_mcp",
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

## 🛠️ Project Structure

```
cursor_linkup_mcp/
├── server.py          # Main MCP server
├── rag.py             # RAG workflow
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
