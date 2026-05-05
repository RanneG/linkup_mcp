/**
 * Stable `/api/*` paths proxied from stitch-app Vite — useful for tests and clients.
 */

export const STITCH_BRIDGE_API_ROUTES = {
  health: "/api/health",
  ragStitch: "/api/rag/stitch",
  ragStitchHelp: "/api/rag/stitch-help",
  stitchUserGuide: "/api/stitch-user-guide",
  voiceTranscribe: "/api/voice/transcribe",
} as const;

export type StitchBridgeApiRoute =
  (typeof STITCH_BRIDGE_API_ROUTES)[keyof typeof STITCH_BRIDGE_API_ROUTES];
