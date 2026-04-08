# Environment Variables Template

Create a `.env` file in the project root with the following variables:

```bash
# Linkup API Key — get your key from https://www.linkup.so/
LINKUP_API_KEY=your_linkup_api_key_here

# OpenAI API Key — only if you wire features that need it
OPENAI_API_KEY=your_openai_api_key_here
```

## Getting API Keys

### Linkup API Key

1. Visit https://www.linkup.so/
2. Sign up and open the dashboard
3. Create or copy your API key

### OpenAI API Key

1. Visit https://platform.openai.com/
2. Open **API keys** and create a key

Never commit `.env`; it is listed in `.gitignore`.

For Ollama: install from https://ollama.ai/download, then `ollama pull llama3.2` (see **README.md**).
