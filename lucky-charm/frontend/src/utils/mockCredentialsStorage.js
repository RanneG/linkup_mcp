/**
 * Demo login users stored in localStorage (editable for hackathon demos).
 * Key: lucky-charm-mock-credentials
 */

export const MOCK_CREDENTIALS_KEY = 'lucky-charm-mock-credentials'

/** @typedef {{ email: string, password: string, role: 'team-lead' | 'team-member' | 'hackathon-host', teamId: string | null, name: string, teamName?: string }} MockCredentialUser */

/** Stable user ids for team storage (same browser = same roster row). */
export const MOCK_LOGIN_USER_IDS = {
  'lead@demo.com': 'u_mock_lead',
  'member@demo.com': 'u_mock_member',
  'host@demo.com': 'u_mock_host',
}

export const DEMO_TEAM_1_ID = 'demo-team-1'

/** Default roster seed — written to localStorage on first read if missing. */
export const DEFAULT_MOCK_CREDENTIAL_USERS = [
  {
    email: 'lead@demo.com',
    password: 'lead123',
    role: 'team-lead',
    teamId: DEMO_TEAM_1_ID,
    name: 'Alex Lead',
    teamName: 'Team 1',
  },
  {
    email: 'member@demo.com',
    password: 'member123',
    role: 'team-member',
    teamId: DEMO_TEAM_1_ID,
    name: 'Riley Member',
    teamName: 'Team 1',
  },
  {
    email: 'host@demo.com',
    password: 'host123',
    role: 'hackathon-host',
    teamId: null,
    name: 'Jordan Host',
    teamName: null,
  },
]

/**
 * @returns {MockCredentialUser[]}
 */
export function getMockCredentialUsers() {
  try {
    const raw = localStorage.getItem(MOCK_CREDENTIALS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeMockUser).filter(Boolean)
      }
    }
  } catch {
    // fall through to seed
  }
  try {
    localStorage.setItem(MOCK_CREDENTIALS_KEY, JSON.stringify(DEFAULT_MOCK_CREDENTIAL_USERS))
  } catch {
    // ignore
  }
  return DEFAULT_MOCK_CREDENTIAL_USERS.map((u) => ({ ...u }))
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {MockCredentialUser | null}
 */
export function findMockUserByCredentials(email, password) {
  const e = (email || '').trim().toLowerCase()
  const p = password || ''
  const users = getMockCredentialUsers()
  const row = users.find((u) => u.email.toLowerCase() === e && u.password === p)
  return row || null
}

/** @param {any} u */
function normalizeMockUser(u) {
  if (!u || typeof u.email !== 'string' || typeof u.password !== 'string') return null
  const role = u.role
  if (role !== 'team-lead' && role !== 'team-member' && role !== 'hackathon-host') return null
  return {
    email: u.email.trim().toLowerCase(),
    password: String(u.password),
    role,
    teamId: u.teamId == null || u.teamId === '' ? null : String(u.teamId),
    name: typeof u.name === 'string' && u.name.trim() ? u.name.trim() : 'Demo user',
    teamName: u.teamName != null ? String(u.teamName) : null,
  }
}

/**
 * @param {string} email
 */
export function getMockLoginUserId(email) {
  const e = (email || '').trim().toLowerCase()
  return MOCK_LOGIN_USER_IDS[e] || `u_mock_${simpleHash(e)}`
}

function simpleHash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h).toString(36).slice(0, 12)
}
