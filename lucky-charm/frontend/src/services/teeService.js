/**
 * TEE Service Layer — all communication with the Trusted Execution Environment.
 * Endpoint: localStorage override > VITE_TEE_URL > default /api/tee.
 */

import { getTEEEndpointOverride } from '../utils/teeEndpointStorage'
import { computeTranscriptHash } from '../utils/transcriptHash'

const ENV_ENDPOINT =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_TEE_URL
    ? import.meta.env.VITE_TEE_URL
    : '/api/tee'

const PROCESS_PATH = '/process'
const HEALTH_PATH = '/health'
const ATTESTATION_PATH = '/attestation'
const MAX_RETRIES = 3
/** Exponential backoff: 1s, 2s between attempts */
const RETRY_DELAYS_MS = [1000, 2000]
const CHECK_TIMEOUT_MS = 5000

/**
 * Get the TEE base endpoint (localStorage override > env > default).
 */
export function getTEEEndpoint() {
  const override = getTEEEndpointOverride()
  const base = override || ENV_ENDPOINT
  return base.replace(/\/$/, '')
}

function getProcessURL() {
  return `${getTEEEndpoint()}${PROCESS_PATH}`
}

function getHealthURL() {
  const base = getTEEEndpoint()
  if (base.includes('/process')) return base.replace(/\/process$/, HEALTH_PATH)
  return `${base}${HEALTH_PATH}`
}

/**
 * Check if the TEE is reachable.
 * Tries GET /health first; if that fails, tries GET upload URL (405 = reachable).
 * @returns {Promise<{ reachable: boolean, message?: string }>}
 */
export async function checkTEEReachable() {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)

  const tryFetch = (url) =>
    fetch(url, { method: 'GET', signal: controller.signal, mode: 'cors' })

  try {
    let lastError = null
    let res = await tryFetch(getHealthURL()).catch((e) => {
      lastError = e
      return null
    })
    if (!res) res = await tryFetch(getProcessURL()).catch((e) => {
      if (!lastError) lastError = e
      return null
    })
    clearTimeout(timeoutId)
    // Consider reachable only if we get a success status AND the response looks like a TEE (not SPA fallback HTML)
    if (res && (res.ok || res.status === 404 || res.status === 405)) {
      const contentType = res.headers.get('content-type') || ''
      const isHtml = contentType.includes('text/html')
      if (!isHtml) return { reachable: true }
      // 200 with HTML is likely Vite/dev server SPA fallback, not a real TEE
      return {
        reachable: false,
        message: 'Endpoint returned HTML (no TEE at this URL?)',
      }
    }
    if (res) {
      const text = await res.text().catch(() => '')
      return {
        reachable: false,
        message: text || `TEE returned ${res.status}`,
      }
    }
    const msg = lastError?.message || 'No response from TEE'
    return { reachable: false, message: msg }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      return { reachable: false, message: 'TEE did not respond in time' }
    }
    return {
      reachable: false,
      message: err?.message || 'Cannot reach TEE',
    }
  }
}

/** Alias for checkTEEReachable (for compatibility). */
export const checkTEEHealth = checkTEEReachable

/**
 * Fetch attestation report from the TEE for client verification.
 * @returns {Promise<{ status?: string, tee_type?: string, message?: string, phala_dashboard?: string, trust_site?: string }>}
 */
export async function fetchAttestation() {
  const base = getTEEEndpoint()
  const url = base.includes('/attestation')
    ? base
    : `${base.replace(/\/$/, '')}${ATTESTATION_PATH}`
  const res = await fetch(url, { method: 'GET', mode: 'cors' })
  if (!res.ok) throw new Error(`Attestation endpoint returned ${res.status}`)
  return res.json()
}

/**
 * Process (upload) a transcript file to the TEE with retries and progress.
 * @param {File} file - The transcript file
 * @param {function(number): void} onProgress - Progress callback 0–100
 * @param {{ participantId?: string, nullifier?: string }} [options] - Optional: participant_id, nullifier (U2SSO)
 * @returns {Promise<{ blockers?: array, action_items?: array, decisions?: array }>} TEE response body when successful
 * @throws Error with user-friendly message on failure
 */
export async function processTranscript(file, onProgress, options = {}) {
  const url = getProcessURL()
  let lastError = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const body = await uploadOnce(url, file, onProgress, {
        participantId: options.participantId,
        nullifier: options.nullifier,
      })
      return body ?? {}
    } catch (err) {
      lastError = err
      if (attempt < MAX_RETRIES) {
        const delayMs = RETRY_DELAYS_MS[attempt - 1] ?? 2000
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }
  }

  throw lastError || new Error('Upload failed')
}

async function uploadOnce(url, file, onProgress, options = {}) {
  const transcriptHash = await computeTranscriptHash(file)

  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('transcript', file)
    formData.append('transcript_hash', transcriptHash)
    if (options.participantId && typeof options.participantId === 'string') {
      formData.append('participant_id', options.participantId)
      const today = new Date().toISOString().slice(0, 10)
      formData.append('date', today)
    }
    if (options.nullifier && typeof options.nullifier === 'string') {
      formData.append('nullifier', options.nullifier)
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let body = {}
        try {
          if (xhr.responseText && xhr.responseText.trim()) {
            body = JSON.parse(xhr.responseText)
          }
        } catch {
          // ignore parse error, return {}
        }
        resolve(body || {})
        return
      }
      let message = `TEE returned error: ${xhr.status}`
      try {
        const body = JSON.parse(xhr.responseText)
        if (body?.message) message = body.message
        else if (body?.error) message = body.error
        else if (typeof xhr.responseText === 'string' && xhr.responseText.trim())
          message = xhr.responseText.trim()
      } catch {
        if (xhr.responseText?.trim()) message = xhr.responseText.trim()
      }
      reject(new Error(message))
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Network error — TEE may be unreachable'))
    })

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was cancelled'))
    })

    xhr.send(formData)
  })
}

/**
 * Fetch participant aggregates (time-series of blocker/action/decision counts).
 * @param {string} participantId - Opaque participant ID from auth
 * @returns {Promise<{ participant_id: string, data: Array<{ date, blocker_count, action_count, decision_count }> }>}
 */
export async function fetchAggregates(participantId) {
  if (!participantId || typeof participantId !== 'string') return { participant_id: '', data: [] }
  const base = getTEEEndpoint()
  const url = `${base.replace(/\/$/, '')}/aggregates?participant_id=${encodeURIComponent(participantId)}`
  const res = await fetch(url, { method: 'GET', mode: 'cors' })
  if (!res.ok) throw new Error(`Aggregates endpoint returned ${res.status}`)
  return res.json()
}

/**
 * User-friendly message for TEE unreachable (for UI).
 */
export const TEE_UNREACHABLE_MESSAGE =
  'TEE is unreachable. Check your connection or use Mock Data to continue.'
