import asyncio
import json

from server import rag_stitch


def _print_view(payload: dict) -> None:
    print("\n=== Stitch Demo View ===")
    print(f"state: {payload.get('state')}")
    print(f"confidence: {payload.get('confidence')}")
    print(f"answer: {payload.get('answer')}\n")

    if payload.get("show_sources"):
        print("source_cards:")
        for card in payload.get("source_cards", []):
            score = card.get("score")
            score_str = f"{score:.3f}" if isinstance(score, (int, float)) else "n/a"
            print(
                f"- #{card.get('rank')} {card.get('source_id')} "
                f"(score={score_str})"
            )
            print(f"  {card.get('snippet')}\n")
    else:
        print("source_cards: none (hidden in fallback; set STITCH_RAG_DEBUG=1 for debug_retrieval_cards)\n")

    debug_cards = payload.get("debug_retrieval_cards")
    if debug_cards:
        print("debug_retrieval_cards:")
        for card in debug_cards:
            score = card.get("score")
            score_str = f"{score:.3f}" if isinstance(score, (int, float)) else "n/a"
            print(f"- #{card.get('rank')} {card.get('source_id')} (score={score_str})")
            print(f"  {card.get('snippet')}\n")


async def _run_once(query: str) -> None:
    raw = await rag_stitch(query)
    payload = json.loads(raw)
    _print_view(payload)


def main() -> None:
    print("Stitch RAG demo CLI")
    print("Type a question (or 'exit' to quit).")
    while True:
        query = input("\nquery> ").strip()
        if not query:
            continue
        if query.lower() in {"exit", "quit"}:
            break
        asyncio.run(_run_once(query))


if __name__ == "__main__":
    main()
