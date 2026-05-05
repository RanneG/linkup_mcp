# stitch-api-types

TypeScript **declaration-only** package for the **Stitch HTTP bridge** (`stitch_rag_bridge.py` in [linkup_mcp](https://github.com/RanneG/linkup_mcp)): `/api/health`, RAG view JSON, user guide payload, and related request shapes.

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
import type { RagStitchView, RagStitchPostBody, BridgeHealthPayload } from "stitch-api-types";
import { STITCH_BRIDGE_API_ROUTES } from "stitch-api-types";

const body: RagStitchPostBody = { query: "What changed in Q3?" };
const res = await fetch(STITCH_BRIDGE_API_ROUTES.ragStitch, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const data = (await res.json()) as RagStitchView;
```

`npm install` runs **`prepare` → `build`** so `dist/*.d.ts` exists without committing build output.

## Source of truth

Types follow **`rag_stitch_contract._to_stitch_view`**, **`stitch_rag_bridge`** routes, and the current **stitch-app** panels (`LinkupRagPanel`, `StitchHelpView`). When the bridge contract changes, bump this package and update consumers.
