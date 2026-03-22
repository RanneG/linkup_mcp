const KEY_LAST_TEE_UPLOAD = 'lucky-charm-last-tee-upload'
const KEY_IDLE_TIMEOUT = 'lucky-charm-tee-reminder-timeout'
const DEFAULT_TIMEOUT_MIN = 30

export function getLastTEEUploadAt() {
  try {
    const v = localStorage.getItem(KEY_LAST_TEE_UPLOAD)
    return v ? parseInt(v, 10) : null
  } catch {
    return null
  }
}

export function setLastTEEUploadAt() {
  try {
    localStorage.setItem(KEY_LAST_TEE_UPLOAD, String(Date.now()))
  } catch {
    // ignore
  }
}

export function getIdleTimeoutMinutes() {
  try {
    const v = localStorage.getItem(KEY_IDLE_TIMEOUT)
    const n = parseInt(v, 10)
    return [15, 30, 60].includes(n) ? n : DEFAULT_TIMEOUT_MIN
  } catch {
    return DEFAULT_TIMEOUT_MIN
  }
}

export function setIdleTimeoutMinutes(minutes) {
  try {
    if ([15, 30, 60].includes(minutes)) {
      localStorage.setItem(KEY_IDLE_TIMEOUT, String(minutes))
    }
  } catch {
    // ignore
  }
}

export const PHALA_DASHBOARD_URL = 'https://cloud.phala.network'
