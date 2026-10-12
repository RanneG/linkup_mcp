# stitch-api-types

TypeScript **declaration-only** package for the **Stitch HTTP bridge** (`stitch_rag_bridge.py` in [linkup_mcp](https://github.com/RanneG/linkup_mcp)): `/api/health`, RAG view JSON, user guide payload, voice transcription responses, and related request shapes.

## Install

From **stitch-app** (or any consumer) while developing locally:

```bash
npm install file:../linkup_mcp/packages/stitch-api-types
# or, if repos are siblings:
npm install file:../../cursor_linkup_mcp/packages/stitch-api-types
```

After a **npm** publish (optional), use the semver version instead.

## Use

```ts
import type {
  BridgeHealthPayload,
  RagStitchPostBody,
  RagStitchView,
  VoiceTranscribeSuccess,
} from "stitch-api-types";
import { STITCH_BRIDGE_API_ROUTES } from "stitch-api-types";

const body: RagStitchPostBody = { query: "What changed in Q3?" };
const res = await fetch(STITCH_BRIDGE_API_ROUTES.ragStitch, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const data = (await res.json()) as RagStitchView;
```

Voice STT fallback uses the same route constants. The bridge expects raw WAV bytes, not JSON:

```ts
const healthRes = await fetch(STITCH_BRIDGE_API_ROUTES.health);
const health = (await healthRes.json()) as BridgeHealthPayload;

if (health.voice_stt.ok) {
  const wavBytes = await recordedWavBlob.arrayBuffer();
  const voiceRes = await fetch(STITCH_BRIDGE_API_ROUTES.voiceTranscribe, {
    method: "POST",
    headers: { "Content-Type": "audio/wav" },
    body: wavBytes,
  });
  const transcript = (await voiceRes.json()) as VoiceTranscribeSuccess;
  console.log(transcript.text, transcript.engine);
}
```

Bridge constraints from `bridge/voice_routes.py`: upload a short RIFF/WAVE body, keep it under 2 MiB, and use `GET /api/health` (`voice_stt`) to detect whether Google or Whisper STT is available before enabling the UI.

`npm install` runs **`prepare` → `build`** so `dist/*.d.ts` exists without committing build output.

## Source of truth

Types follow **`rag_stitch_contract._to_stitch_view`**, **`stitch_rag_bridge`** routes, and the current **stitch-app** panels (`LinkupRagPanel`, `StitchHelpView`). When the bridge contract changes, bump this package and update consumers.
