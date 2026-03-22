/**
 * U2SSO proof-of-concept JSON API (github.com/RanneG/sso-poc, proof-of-concept/server.go)
 * Dev: set VITE_SSO_BASE_URL=/sso-api and run vite proxy → http://localhost:8080
 */

const PROBE_MS = 4000

function timeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms)
  }
  const c = new AbortController()
  setTimeout(() => c.abort(), ms)
  return c.signal
}

export function getSsoBaseUrl() {
  const raw = (import.meta.env.VITE_SSO_BASE_URL || '').trim()
  return raw || ''
}

function joinUrl(base, path) {
  const b = base.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${b}${p}`
}

/**
 * GET /api/challenge/login → { challenge, sname }
 */
export async function fetchLoginChallenge(baseUrl) {
  const url = joinUrl(baseUrl, '/api/challenge/login')
  const res = await fetch(url, { method: 'GET', signal: timeoutSignal(PROBE_MS) })
  if (!res.ok) throw new Error(`SSO challenge failed (${res.status})`)
  const data = await res.json()
  if (!data?.challenge || !data?.sname) {
    throw new Error('Invalid challenge response from SSO server')
  }
  return data
}

/**
 * POST /api/login — body matches sso-poc; response may include Lucky Charm extensions.
 */
export async function postSsoLogin(baseUrl, body) {
  const url = joinUrl(baseUrl, '/api/login')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: timeoutSignal(PROBE_MS * 3),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `SSO login failed (${res.status})`)
  }
  if (!data.success) {
    throw new Error(data.message || 'Login rejected')
  }
  return data
}

export async function probeSsoReachable(baseUrl) {
  if (!baseUrl) return false
  try {
    await fetchLoginChallenge(baseUrl)
    return true
  } catch {
    return false
  }
}

/**
 * Fetch a one-time nullifier for transcript submission (U2SSO / ASC).
 * SSO generates nullifier; backend rejects duplicate (participant_id, nullifier).
 * @param {string} baseUrl - SSO base URL (e.g. /sso-api)
 * @param {string} participantId - Opaque participant ID from auth
 * @param {string} [sessionToken] - Optional session token for auth
 * @returns {Promise<{ nullifier: string }>}
 */
export async function fetchSubmissionNullifier(baseUrl, participantId, sessionToken = null) {
  const url = joinUrl(baseUrl, '/api/submission/nullifier')
  const headers = { 'Content-Type': 'application/json' }
  if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ participant_id: participantId }),
    signal: timeoutSignal(PROBE_MS),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Nullifier request failed (${res.status})`)
  }
  if (!data?.nullifier || typeof data.nullifier !== 'string') {
    throw new Error('Invalid nullifier response from SSO')
  }
  return { nullifier: data.nullifier }
}

/** Map server role strings → dashboard role ids */
export function normalizeDashboardRole(value) {
  if (value == null || value === '') return null
  const s = String(value).trim().toLowerCase().replace(/[\s_]+/g, '-')
  const aliases = {
    'team-lead': 'team-lead',
    teamlead: 'team-lead',
    lead: 'team-lead',
    manager: 'team-lead',
    'team-member': 'team-member',
    member: 'team-member',
    contributor: 'team-member',
    'hackathon-host': 'hackathon-host',
    host: 'hackathon-host',
    organizer: 'hackathon-host',
  }
  if (aliases[s]) return aliases[s]
  if (['team-lead', 'team-member', 'hackathon-host'].includes(s)) return s
  return null
}

/**
 * Extract Lucky Charm profile from login JSON (optional fields from extended sso-poc).
 */
export function parseLuckyCharmProfile(loginResponse) {
  const lc = loginResponse.lucky_charm || loginResponse.luckyCharm
  const roleRaw = lc?.role ?? loginResponse.role ?? loginResponse.user_role
  let team = lc?.team ?? loginResponse.team
  if (team && typeof team === 'object') {
    team = {
      teamId: team.team_id ?? team.teamId ?? team.id,
      teamName: team.team_name ?? team.teamName ?? team.name,
      joinCode: team.join_code ?? team.joinCode,
    }
  } else {
    team = null
  }
  const displayName =
    lc?.display_name ?? loginResponse.display_name ?? loginResponse.name ?? null
  const userId = lc?.user_id ?? loginResponse.user_id ?? loginResponse.sub ?? null
  const emailRaw = lc?.email ?? loginResponse.email ?? null

  return {
    dashboardRole: normalizeDashboardRole(roleRaw),
    displayName: displayName ? String(displayName).trim() : null,
    userId: userId ? String(userId).trim() : null,
    email: emailRaw ? String(emailRaw).trim() : null,
    team: team?.teamId || team?.teamName ? team : null,
  }
}
