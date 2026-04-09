import asyncio
import os
from typing import Optional
from dotenv import load_dotenv
from linkup import LinkupClient
from llama_index.llms.ollama import Ollama
from rag import RAGWorkflow
from agents import AgentOrchestrator, AgentType
from mcp.server.fastmcp import FastMCP

load_dotenv()

mcp = FastMCP('linkup-server')

# Initialize LinkupClient only if API key is available
linkup_api_key = os.getenv('LINKUP_API_KEY')
client = None
if linkup_api_key:
    client = LinkupClient()

# RAG is heavy (HF embed download + ingest). Lazy-init so MCP stdio handshake is not blocked.
rag_workflow: Optional[RAGWorkflow] = None
_rag_ready_lock = asyncio.Lock()

# Initialize LLM for agents (reuse the same Ollama instance)
agent_llm = Ollama(model="llama3.2")

# We'll initialize the orchestrator after defining tools
agent_orchestrator: Optional[AgentOrchestrator] = None


async def _ensure_rag_ready() -> RAGWorkflow:
    """Build embedding index on first use so bundled MCP clients do not time out at startup."""
    global rag_workflow
    if rag_workflow is not None:
        return rag_workflow
    async with _rag_ready_lock:
        if rag_workflow is None:
            rag_workflow = RAGWorkflow()
            await rag_workflow.ingest_documents("data")
        return rag_workflow

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
    """Use a simple RAG workflow to answer queries using documents from data directory about Deep Seek"""
    wf = await _ensure_rag_ready()
    response = await wf.query(query)
    return str(response)


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
        wf = await _ensure_rag_ready()
        response = await wf.query(query)
        return str(response)
    
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


