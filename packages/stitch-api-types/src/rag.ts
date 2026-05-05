/**
 * JSON shape returned by POST /api/rag/stitch and POST /api/rag/stitch-help
 * (after `_to_stitch_view` in linkup_mcp `rag_stitch_contract.py`).
 */

export type RagStitchState = "answered" | "fallback";

/** One evidence card in `source_cards` / `debug_retrieval_cards`. */
export interface RagStitchSourceCard {
  rank?: number;
  source_id?: string;
  score?: number | null;
  snippet?: string;
}

export interface RagStitchView {
  state: RagStitchState;
  answer: string;
  /** Often `low` | `medium` | `high`; bridge may send other strings. */
  confidence: string;
  source_cards: RagStitchSourceCard[];
  show_sources: boolean;
  /** Present when `STITCH_RAG_DEBUG` is set and state is `fallback`. */
  debug_retrieval_cards?: RagStitchSourceCard[];
}

/** Request body for POST /api/rag/stitch and POST /api/rag/stitch-help. */
export interface RagStitchPostBody {
  query: string;
}
