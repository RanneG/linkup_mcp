import asyncio
import json
from rag import RAGWorkflow


PROMPTS = [
    # Factual extraction
    "What is Retrieval-Augmented Generation and why is it useful?",
    "Summarize key security concerns discussed in the MCP landscape paper.",
    "What does NIST AI RMF emphasize for trustworthy AI systems?",
    # Synthesis
    "Compare dense retrieval and late interaction retrieval approaches from the included papers.",
    "Compare baseline RAG and graph-based RAG ideas from the corpus.",
    "How do the papers suggest improving grounded answers and reducing hallucinations?",
    # Failure-mode checks
    "What are the official Stitch production SLA guarantees?",
    "Give exact Apple App Store subscription pricing for Stitch.",
]


async def run() -> None:
    workflow = RAGWorkflow()
    await workflow.ingest_documents("data")

    fallback_count = 0
    sourced_count = 0
    low_conf_count = 0

    for idx, prompt in enumerate(PROMPTS, start=1):
        try:
            result = await workflow.query(prompt)
        except Exception as exc:
            result = {
                "answer": f"Query failed: {exc}",
                "confidence": "low",
                "fallback": True,
                "sources": [],
            }
        sources = result.get("sources", [])
        if result.get("fallback"):
            fallback_count += 1
        if sources:
            sourced_count += 1
        if result.get("confidence") == "low":
            low_conf_count += 1

        print(f"\n=== Prompt {idx} ===")
        print(prompt)
        print(json.dumps(result, indent=2))

    print("\n=== Summary ===")
    print(f"Total prompts: {len(PROMPTS)}")
    print(f"With sources: {sourced_count}")
    print(f"Fallback responses: {fallback_count}")
    print(f"Low confidence responses: {low_conf_count}")


if __name__ == "__main__":
    asyncio.run(run())
