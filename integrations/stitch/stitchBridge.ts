/**
 * Base URL for stitch_rag_bridge (8765). Same-origin /api when VITE_STITCH_RAG_USE_PROXY=1.
 */
export function stitchRagApiOrigin(): string {
  if (import.meta.env.VITE_STITCH_RAG_USE_PROXY === "1") return "";
  const custom = (import.meta.env.VITE_STITCH_RAG_BRIDGE_ORIGIN as string | undefined)?.trim();
  if (custom) return custom.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://127.0.0.1:8765";
  if (typeof window !== "undefined") {
    const { hostname, port } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      if (port === "1420" || port === "5173") return "http://127.0.0.1:8765";
    }
  }
  return "";
}

export function stitchRagApiUrl(path: string): string {
  const base = stitchRagApiOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export const STITCH_FETCH_TIMEOUT_MS = 12000;

export const STITCH_GOOGLE_SESSION_KEY = "stitch.googleSessionId";
export const STITCH_GOOGLE_SKIP_KEY = "stitch.skipGoogleAuth";
/** Demo magic-link gate: allows shell without Google session (hackathon UX). */
export const STITCH_DEMO_MAGIC_AUTH_KEY = "stitch.demoMagicAuth";
/** Account email for face / panels (same key as AppShell). */
export const STITCH_USER_EMAIL_KEY = "stitch.userEmail";

export function readSessionId(): string {
  try {
    return (localStorage.getItem(STITCH_GOOGLE_SESSION_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function writeSessionId(id: string | null): void {
  try {
    if (id) localStorage.setItem(STITCH_GOOGLE_SESSION_KEY, id);
    else localStorage.removeItem(STITCH_GOOGLE_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function readGoogleSkipped(): boolean {
  try {
    return localStorage.getItem(STITCH_GOOGLE_SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeGoogleSkipped(skipped: boolean): void {
  try {
    if (skipped) localStorage.setItem(STITCH_GOOGLE_SKIP_KEY, "1");
    else localStorage.removeItem(STITCH_GOOGLE_SKIP_KEY);
  } catch {
    /* ignore */
  }
}

export function readDemoMagicAuth(): boolean {
  try {
    return localStorage.getItem(STITCH_DEMO_MAGIC_AUTH_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeDemoMagicAuth(on: boolean): void {
  try {
    if (on) localStorage.setItem(STITCH_DEMO_MAGIC_AUTH_KEY, "1");
    else localStorage.removeItem(STITCH_DEMO_MAGIC_AUTH_KEY);
  } catch {
    /* ignore */
  }
}

export function readUserEmail(): string {
  try {
    return (localStorage.getItem(STITCH_USER_EMAIL_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function writeUserEmail(email: string): void {
  try {
    const t = email.trim();
    if (t) localStorage.setItem(STITCH_USER_EMAIL_KEY, t);
    else localStorage.removeItem(STITCH_USER_EMAIL_KEY);
  } catch {
    /* ignore */
  }
}

export async function readJsonFromResponse(res: Response): Promise<{ data: unknown; parseError: string | null }> {
  const text = await res.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<!") || trimmed.toLowerCase().startsWith("<!doctype")) {
    return { data: null, parseError: "Server returned HTML instead of JSON — is the bridge running on 8765?" };
  }
  if (!trimmed) return { data: {}, parseError: null };
  try {
    return { data: JSON.parse(text) as unknown, parseError: null };
  } catch {
    return { data: null, parseError: "Invalid JSON from server" };
  }
}

export function authHeaders(sessionId: string | null): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (sessionId) h.Authorization = `Bearer ${sessionId}`;
  return h;
}

/**
 * Fail fast for local bridge calls so the demo does not hang forever.
 */
export async function stitchFetch(path: string, init?: RequestInit, timeoutMs: number = STITCH_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    return await fetch(stitchRagApiUrl(path), { ...(init || {}), signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}
