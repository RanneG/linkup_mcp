/**
 * POST /api/voice/transcribe — raw WAV body; JSON responses vary by engine.
 */

export interface VoiceTranscribeSuccess {
  text: string;
  engine: string;
  /** e.g. Google path when audio was unintelligible. */
  note?: string;
}

export interface VoiceTranscribeErrorBody {
  error: string;
  voice_stt?: unknown;
}
