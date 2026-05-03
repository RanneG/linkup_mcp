/**
 * Pure voice intent matching for Stitch (Web Speech transcripts).
 * Kept in one module so it can move into a shared desktop library later.
 */

export type StitchVoiceCommand =
  | { type: "open_rag" }
  | { type: "open_settings" }
  | { type: "open_account" }
  | { type: "open_history" }
  | { type: "open_upcoming" }
  | { type: "scan_gmail" }
  | { type: "rag_query"; query: string };

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Map a speech transcript to a command. Does not handle "approve" — the UI
 * should treat approval only when a payment is pending.
 */
export function matchStitchVoiceCommand(raw: string): StitchVoiceCommand | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const t = norm(trimmed);

  const ragAsk =
    /^(?:ask|query)\s+(?:my\s+)?(?:the\s+)?(?:pdf|pdfs|document|documents|docs|corpus)\s+(?:about\s+)?(.{2,800})/i.exec(trimmed);
  if (ragAsk?.[1]) {
    const q = ragAsk[1].trim();
    if (q.length >= 2) return { type: "rag_query", query: q };
  }

  const ragSearch =
    /^search\s+(?:my\s+)?(?:pdf|pdfs|document|documents|docs)\s+(?:for\s+)?(.{2,800})/i.exec(trimmed);
  if (ragSearch?.[1]) {
    const q = ragSearch[1].trim();
    if (q.length >= 2) return { type: "rag_query", query: q };
  }

  if (
    /\b(scan\s+gmail|run\s+discovery|find\s+subscriptions|discover\s+subscriptions|scan\s+(?:my\s+)?(?:email|inbox))\b/i.test(
      t,
    )
  ) {
    return { type: "scan_gmail" };
  }

  if (
    /\b(open\s+(?:document\s+)?brain|open\s+rag|show\s+document\s+brain|document\s+brain|local\s+(?:document\s+)?brain)\b/i.test(t)
  ) {
    return { type: "open_rag" };
  }

  if (/\b(go\s+to\s+account|open\s+account|account\s+settings|link\s+google|google\s+sign[\s-]?in)\b/i.test(t)) {
    return { type: "open_account" };
  }

  if (/\b(payment\s+history|open\s+history|go\s+to\s+history)\b/i.test(t) || /^history$/i.test(trimmed)) {
    return { type: "open_history" };
  }

  if (
    /\b(go\s+home|open\s+upcoming|open\s+dashboard|upcoming\s+renewals)\b/i.test(t) ||
    /^(upcoming|dashboard|home)$/i.test(trimmed)
  ) {
    return { type: "open_upcoming" };
  }

  if (/\b(open\s+settings|go\s+to\s+settings)\b/i.test(t) || /^settings$/i.test(trimmed)) {
    return { type: "open_settings" };
  }

  return null;
}
