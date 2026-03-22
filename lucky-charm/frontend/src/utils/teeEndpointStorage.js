const KEY_TEE_ENDPOINT = 'lucky-charm-tee-url'

/**
 * Get user-overridden TEE endpoint from localStorage (for use when app is deployed without VITE_TEE_URL).
 * @returns {string | null} URL or null if not set
 */
export function getTEEEndpointOverride() {
  try {
    const v = localStorage.getItem(KEY_TEE_ENDPOINT)
    return v && v.trim() ? v.trim().replace(/\/$/, '') : null
  } catch {
    return null
  }
}

/**
 * Save user-entered TEE endpoint to localStorage.
 * @param {string} url
 */
export function setTEEEndpointOverride(url) {
  try {
    const trimmed = url && typeof url === 'string' ? url.trim().replace(/\/$/, '') : ''
    if (trimmed) {
      localStorage.setItem(KEY_TEE_ENDPOINT, trimmed)
    } else {
      localStorage.removeItem(KEY_TEE_ENDPOINT)
    }
  } catch {
    // ignore
  }
}
