/**
 * GET /api/health and GET /health (same payload).
 */

export interface VoiceSttEngines {
  google: boolean;
  whisper: boolean;
}

export type VoiceSttStatus =
  | {
      ok: true;
      engine: string;
      engines: VoiceSttEngines;
    }
  | {
      ok: false;
      engine: null;
      engines: VoiceSttEngines;
      reason?: string;
    };

export interface StitchSpaHealth {
  serving: boolean;
}

export interface BridgeHealthPayload {
  ok: true;
  service: "stitch-rag-bridge";
  google_oauth: boolean;
  voice_stt: VoiceSttStatus;
  stitch_spa: StitchSpaHealth;
}
