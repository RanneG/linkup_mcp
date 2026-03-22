# Raw Transcript Handling — Privacy Policy

## TEE-Only Processing

**Raw transcripts never leave the TEE.** Only Props-compliant aggregates (metrics, themes, velocity) are returned to clients.

### Transcript Hash (Props Integrity)

The client computes a SHA-256 hash of the transcript before upload and sends it as `transcript_hash`. The TEE computes the hash of the received bytes and verifies they match. A mismatch returns 400 and is audited. This provides assurance that the transcript was not modified in transit. If the client does not send a hash (e.g. API clients), processing proceeds but the audit records `hash_verified: null`.

### Enforcement

1. **No server-side persistence of raw input:** The backend does not log, store, or persist raw transcript text. It is processed in-memory and discarded after extraction.
2. **TEE boundary:** When deployed to Phala Cloud CPU TEE, all processing runs inside the Confidential VM. The host and cloud provider cannot access transcript contents.
3. **Props filter:** The output layer (`props_filter.py`) ensures only structured, non-verbatim data leaves the process: category names, counts, themes, velocity metrics.
4. **Transport:** Raw transcript is sent over HTTPS to the TEE endpoint. For additional assurance, consider client-side envelope encryption (key exchange with TEE) in a future iteration.

### Threat Model

We protect against: organizers, other teams, and the host seeing raw transcripts or linking contributions to real identities.

We do not protect against: compromised TEE (side-channels, physical attacks), malicious participants submitting fake data, or compromise of the aggregation logic.

### Configuration

- `PROPS_FILTER=true` (default): Enables Props policy filter. Only aggregates leave the TEE.
- `PROPS_FILTER=false`: Disables filter for local development only. **Do not use in production.**
