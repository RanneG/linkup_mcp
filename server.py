import asyncio
import json
import os
from typing import Optional
from dotenv import load_dotenv
from linkup import LinkupClient
from llama_index.llms.ollama import Ollama
from agents import AgentOrchestrator, AgentType
from mcp.server.fastmcp import FastMCP

from rag_runtime import ensure_rag_ready
from rag_stitch_contract import _to_stitch_view

load_dotenv()

mcp = FastMCP('linkup-server')

# Initialize LinkupClient only if API key is available
linkup_api_key = os.getenv('LINKUP_API_KEY')
client = None
if linkup_api_key:
    client = LinkupClient()

# Initialize LLM for agents (reuse the same Ollama instance)
agent_llm = Ollama(model="llama3.2")

# We'll initialize the orchestrator after defining tools
agent_orchestrator: Optional[AgentOrchestrator] = None

@mcp.tool()
def web_search(query: str) -> str:
    """Search the web for the given query."""
    if client is None:
        return "Error: LINKUP_API_KEY not set. Please add it to your .env file to use web search."
    
    search_response = client.search(
        query=query,
        depth="standard",  # "standard" or "deep"
        output_type="sourcedAnswer",  # "searchResults" or "sourcedAnswer" or "structured"
        structured_output_schema=None,  # must be filled if output_type is "structured"
    )
    return search_response

@mcp.tool()
async def rag(query: str) -> str:
    """Use local PDF RAG and return answer with evidence sources."""
    wf = await ensure_rag_ready()
    response_payload = await wf.query(query)
    return json.dumps(response_payload)


@mcp.tool()
async def rag_stitch(query: str) -> str:
    """Use local PDF RAG and return a Stitch-friendly UI payload."""
    wf = await ensure_rag_ready()
    response_payload = await wf.query(query)
    return json.dumps(_to_stitch_view(response_payload))


@mcp.tool()
def whisper_stt_status() -> str:
    """
    Check whether local faster-whisper is available for MCP transcribe tools.
    Does not call Linkup. Install: pip install -e ".[stitch-whisper]"
    """
    import local_whisper_stt as lw

    ok = lw.whisper_import_ok()
    model = (os.getenv("STITCH_WHISPER_MODEL") or "tiny.en").strip() or "tiny.en"
    return json.dumps(
        {
            "faster_whisper_import_ok": ok,
            "configured_model": model,
            "hint": "Use transcribe_wav_file with a path to a .wav file (RIFF WAVE). First run downloads model weights.",
        }
    )


@mcp.tool()
def transcribe_wav_file(wav_path: str, language: str = "en") -> str:
    """
    Transcribe a local WAV file with faster-whisper (CPU/GPU on your machine). Not Linkup.

    Args:
        wav_path: Absolute or user-relative path to a RIFF WAVE file (e.g. 16-bit mono from a recorder).
        language: Whisper language code (default en).

    Returns:
        Plain transcribed text, or a short error line if faster-whisper is missing or the file is invalid.
    """
    import local_whisper_stt as lw

    if not lw.whisper_import_ok():
        return (
            "Error: faster-whisper is not installed in this Python environment. "
            'From the repo root run: pip install -e ".[stitch-whisper]" then restart the MCP server.'
        )
    try:
        text = lw.transcribe_wav_path(wav_path, language=language)
        return text if text else "(no speech detected)"
    except FileNotFoundError as e:
        return f"Error: {e}"
    except ValueError as e:
        return f"Error: {e}"
    except Exception as e:
        return f"Error: {type(e).__name__}: {e}"


@mcp.tool()
async def spawn_agent(
    task: str,
    agent_type: str = "general",
    context: str = ""
) -> str:
    """
    Spawn a specialized sub-agent to handle complex tasks autonomously.
    
    The sub-agent will work independently and return a comprehensive report.
    
    Args:
        task: The task description for the agent to complete
        agent_type: Type of agent to spawn:
            - "research": Web search + analysis (best for finding current information)
            - "document": RAG queries + analysis (best for querying your documents)
            - "analyst": Pure reasoning (best for analyzing provided context/code)
            - "general": All capabilities (flexible, uses tools as needed)
        context: Optional context, data, or code to provide to the agent
    
    Returns:
        A structured report from the sub-agent with findings and recommendations
    """
    global agent_orchestrator
    
    if agent_orchestrator is None:
        return "Error: Agent system not initialized. Please restart the server."
    
    result = await agent_orchestrator.spawn(
        agent_type=agent_type,
        task=task,
        context=context if context else None
    )
    
    # Format the response
    output_parts = [
        f"## Agent Report ({result.agent_type.upper()})",
        f"**Status**: {'✅ Success' if result.success else '❌ Failed'}",
    ]
    
    if result.tool_calls_made:
        output_parts.append(f"**Tools Used**: {len(result.tool_calls_made)}")
        for call in result.tool_calls_made:
            output_parts.append(f"  - {call}")
    
    output_parts.append("")
    output_parts.append("### Report")
    output_parts.append(result.report)
    
    return "\n".join(output_parts)


def _setup_agent_orchestrator():
    """Set up the agent orchestrator with available tools"""
    global agent_orchestrator
    
    # Create tool wrappers that the agents can call
    def web_search_tool(query: str) -> str:
        if client is None:
            return "Error: Web search not available (LINKUP_API_KEY not set)"
        search_response = client.search(
            query=query,
            depth="standard",
            output_type="sourcedAnswer",
        )
        return str(search_response)
    
    async def rag_tool(query: str) -> str:
        wf = await ensure_rag_ready()
        response_payload = await wf.query(query)
        return json.dumps(response_payload)
    
    tools = {
        "web_search": web_search_tool,
        "rag": rag_tool,
    }
    
    agent_orchestrator = AgentOrchestrator(llm=agent_llm, tools=tools)


if __name__ == "__main__":
    # Set up the agent orchestrator (RAG loads on first rag / document agent use)
    _setup_agent_orchestrator()

    # Run the MCP server (stdio must start quickly for OpenClaw / Cursor MCP)
    mcp.run(transport="stdio")


