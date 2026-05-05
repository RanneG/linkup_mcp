/**
 * GET /api/stitch-user-guide
 */

export interface StitchUserGuideResponse {
  markdown: string;
  /** Present on 404 when the guide file is missing on the server. */
  error?: string;
}
