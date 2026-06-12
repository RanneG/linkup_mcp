import nest_asyncio
from typing import Any
from llama_index.llms.ollama import Ollama
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.core.settings import Settings
from llama_index.core.workflow import Event, Context, Workflow, StartEvent, StopEvent, step
from llama_index.core.schema import NodeWithScore
from llama_index.core import SimpleDirectoryReader, VectorStoreIndex
from llama_index.core.response_synthesizers import CompactAndRefine

import rag_heuristics

# Apply nest_asyncio to allow nested event loops
nest_asyncio.apply()

class RetrieverEvent(Event):
    """Result of running retrieval"""
    nodes: list[NodeWithScore]

class RAGWorkflow(Workflow):
    def __init__(self, model_name="llama3.2", embedding_model="BAAI/bge-small-en-v1.5"):
        super().__init__(timeout=60.0)
        # Initialize LLM and embedding model
        self.llm = Ollama(model=model_name)
        self.embed_model = HuggingFaceEmbedding(model_name=embedding_model)
        
        # Configure global settings
        Settings.llm = self.llm
        Settings.embed_model = self.embed_model
        
        self.index = None
        # Tunable per-instance; defaults live in rag_heuristics.
        self.weak_evidence_threshold = rag_heuristics.WEAK_EVIDENCE_THRESHOLD
        self.high_confidence_threshold = rag_heuristics.HIGH_CONFIDENCE_THRESHOLD
        self.medium_confidence_threshold = rag_heuristics.MEDIUM_CONFIDENCE_THRESHOLD
        self.keyword_coverage_threshold = rag_heuristics.KEYWORD_COVERAGE_THRESHOLD
        self._stopwords = rag_heuristics.STOPWORDS

    def _build_sources(self, nodes: list[NodeWithScore]) -> list[dict[str, Any]]:
        sources: list[dict[str, Any]] = []
        for idx, node in enumerate(nodes, start=1):
            metadata = node.node.metadata or {}
            sources.append(
                {
                    "rank": idx,
                    "source_id": metadata.get("file_name")
                    or metadata.get("filename")
                    or metadata.get("document_id")
                    or "unknown",
                    "score": node.score,
                    "snippet": rag_heuristics.make_snippet(node.node.get_content()),
                }
            )
        return sources

    def _is_weak_evidence(self, nodes: list[NodeWithScore]) -> bool:
        return rag_heuristics.is_weak_evidence(
            (n.score for n in nodes), threshold=self.weak_evidence_threshold
        )

    def _confidence_label(self, nodes: list[NodeWithScore]) -> str:
        return rag_heuristics.confidence_label(
            (n.score for n in nodes),
            high=self.high_confidence_threshold,
            medium=self.medium_confidence_threshold,
        )

    def _keyword_coverage(self, query: str, nodes: list[NodeWithScore]) -> float:
        return rag_heuristics.keyword_coverage(
            query,
            [node.node.get_content() for node in nodes],
            stopwords=self._stopwords,
        )

    @step
    async def ingest(self, ctx: Context, ev: StartEvent) -> StopEvent | None:
        """Entry point to ingest documents from a directory."""
        dirname = ev.get("dirname")
        if not dirname:
            return None

        documents = SimpleDirectoryReader(dirname).load_data()
        self.index = VectorStoreIndex.from_documents(documents=documents)
        return StopEvent(result=self.index)

    @step
    async def retrieve(self, ctx: Context, ev: StartEvent) -> RetrieverEvent | None:
        """Entry point for RAG retrieval."""
        query = ev.get("query")
        index = ev.get("index") or self.index

        if not query:
            return None

        if index is None:
            print("Index is empty, load some documents before querying!")
            return None

        retriever = index.as_retriever(similarity_top_k=2)
        nodes = await retriever.aretrieve(query)
        await ctx.set("query", query)
        return RetrieverEvent(nodes=nodes)

    @step
    async def synthesize(self, ctx: Context, ev: RetrieverEvent) -> StopEvent:
        """Generate a response with answer, sources, and confidence metadata."""
        query = await ctx.get("query", default="")
        if not ev.nodes:
            return StopEvent(
                result={
                    "answer": "I could not find enough relevant evidence in the PDF corpus to answer that confidently.",
                    "confidence": "low",
                    "fallback": True,
                    "sources": [],
                }
            )

        coverage = self._keyword_coverage(query, ev.nodes)
        if coverage < self.keyword_coverage_threshold:
            return StopEvent(
                result={
                    "answer": "I could not find relevant evidence in the current PDF corpus for that request.",
                    "confidence": "low",
                    "fallback": True,
                    "sources": self._build_sources(ev.nodes),
                }
            )

        if self._is_weak_evidence(ev.nodes):
            return StopEvent(
                result={
                    "answer": "I found only weak matches in the PDF corpus. Please refine your question or add more targeted documents.",
                    "confidence": "low",
                    "fallback": True,
                    "sources": self._build_sources(ev.nodes),
                }
            )

        summarizer = CompactAndRefine(streaming=True, verbose=True)
        response = await summarizer.asynthesize(query, nodes=ev.nodes)
        return StopEvent(
            result={
                "answer": str(response),
                "confidence": self._confidence_label(ev.nodes),
                "fallback": False,
                "sources": self._build_sources(ev.nodes),
            }
        )

    async def query(self, query_text: str):
        """Helper method to perform a complete RAG query."""
        if self.index is None:
            raise ValueError("No documents have been ingested. Call ingest_documents first.")
        
        result = await self.run(query=query_text, index=self.index)
        return result

    async def ingest_documents(self, directory: str):
        """Helper method to ingest documents."""
        result = await self.run(dirname=directory)
        self.index = result
        return result

# Example usage
async def main():
    # Initialize the workflow
    workflow = RAGWorkflow()
    
    # Ingest documents
    await workflow.ingest_documents("data")
    
    # Perform a query
    result = await workflow.query("How was DeepSeekR1 trained?")
    
    # Print the response payload
    print(result)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())













