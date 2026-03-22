/**
 * Pseudonym mode: opaque participant IDs for privacy-preserving aggregation.
 * Submissions are tied to pseudonym, not real identity.
 */

/**
 * Generate an opaque participant ID (pseudonym).
 * Used when "Use pseudonym" is selected — aggregation uses this instead of email/name.
 */
export function generatePseudonymId() {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return 'p_' + Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
