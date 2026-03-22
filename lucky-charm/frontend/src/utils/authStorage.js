/**
 * Auth session: mock login, SSO, or demo presentation bypass.
 * Persisted in localStorage (remember me) or sessionStorage (per tab).
 */

const KEY = 'lucky-charm-auth'
const VERSION = 2

const defaultState = () => ({
  v: VERSION,
  gateCompleted: false,
  /** 'demo' | 'sso' | 'mock' | 'wallet' */
  mode: 'demo',
  sessionToken: null,
  displayName: null,
  userId: null,
  dashboardRole: null,
  team: null,
  spkHex: null,
  email: null,
  /** Mock / session team id (e.g. demo-team-1); host uses null */
  teamId: null,
  /** Opaque participant ID for pseudonym-only aggregation (no real identity) */
  participantId: null,
})

function readRaw() {
  try {
    const tab = sessionStorage.getItem(KEY)
    if (tab) return { raw: tab, persistSessionOnly: true }
    const loc = localStorage.getItem(KEY)
    if (loc) return { raw: loc, persistSessionOnly: false }
  } catch {
    // ignore
  }
  return { raw: null, persistSessionOnly: false }
}

function parseState(raw) {
  try {
    const o = JSON.parse(raw)
    if (!o || typeof o !== 'object') return null
    if (o.v !== VERSION) return null
    return { ...defaultState(), ...o, v: VERSION }
  } catch {
    return null
  }
}

export function readAuthState() {
  const { raw } = readRaw()
  if (!raw) return defaultState()
  const parsed = parseState(raw)
  if (parsed) return parsed
  return defaultState()
}

/**
 * @param {object} partial
 * @param {{ persistSessionOnly?: boolean }} [options] If true, only sessionStorage; else localStorage (remember me).
 */
export function writeAuthState(partial, options = {}) {
  const persistSessionOnly = options.persistSessionOnly === true
  const prev = readAuthState()
  const next = { ...prev, ...partial, v: VERSION }
  const json = JSON.stringify(next)
  try {
    if (persistSessionOnly) {
      sessionStorage.setItem(KEY, json)
      localStorage.removeItem(KEY)
    } else {
      localStorage.setItem(KEY, json)
      sessionStorage.removeItem(KEY)
    }
  } catch {
    // ignore
  }
  return next
}

/**
 * Merge into the current session using the same storage (tab vs local) as the existing blob.
 */
export function patchAuthSession(partial) {
  const { raw, persistSessionOnly } = readRaw()
  const useSession = Boolean(raw) && persistSessionOnly === true
  return writeAuthState(partial, { persistSessionOnly: useSession })
}

export function clearAuthStorageKeys() {
  try {
    sessionStorage.removeItem(KEY)
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

/**
 * Clear SSO fields but keep gate (legacy). Prefer {@link clearAuthStorageKeys} for logout.
 */
export function clearSsoSession() {
  clearAuthStorageKeys()
  return defaultState()
}
