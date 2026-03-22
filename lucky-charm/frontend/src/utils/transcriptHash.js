/**
 * Compute SHA-256 hash of transcript for input integrity (Props).
 * Client and backend both hash the same bytes; backend verifies match.
 */

/**
 * Compute SHA-256 hash of ArrayBuffer, return hex string.
 * @param {ArrayBuffer} buffer - Raw bytes (file content)
 * @returns {Promise<string>} - Hex-encoded hash
 */
export async function sha256Hex(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Compute transcript_hash from a File for upload integrity verification.
 * @param {File} file - The transcript file
 * @returns {Promise<string>} - Hex-encoded SHA-256 hash
 */
export async function computeTranscriptHash(file) {
  const buffer = await file.arrayBuffer()
  return sha256Hex(buffer)
}
