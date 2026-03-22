/**
 * Demo team + join code storage (localStorage).
 * Teams array: { teamId (id), teamName (name), joinCode, leadId, members: [{ memberId, role, displayName }] }
 */

import { readAuthState, writeAuthState, patchAuthSession } from './authStorage'
import { syncUserTeamProfile } from './userProfileStorage'
import { DEMO_TEAM_1_ID } from './mockCredentialsStorage'

/** Exported for `storage` listeners and debugging. */
export const TEAMS_STORAGE_KEY = 'lucky-charm-teams'
const TEAMS_KEY = TEAMS_STORAGE_KEY
const USER_KEY = 'lucky-charm-user-id'
const DEMO_JOIN_BYPASS_KEY = 'lucky-charm-demo-join-bypass'

/** Synthetic lead for presentation teams (no real browser session). */
export const DEMO_LEAD_PLACEHOLDER_ID = 'lc_demo_lead_present'

/** Stored on the placeholder lead row in localStorage — not a person’s name; UI shows roster lead separately. */
export const SYNTHETIC_LEAD_DISPLAY_NAME = 'Team lead (placeholder)'

export function readDemoJoinBypass() {
  try {
    return localStorage.getItem(DEMO_JOIN_BYPASS_KEY) === '1'
  } catch {
    return false
  }
}

export function setDemoJoinBypass(enabled) {
  try {
    if (enabled) localStorage.setItem(DEMO_JOIN_BYPASS_KEY, '1')
    else localStorage.removeItem(DEMO_JOIN_BYPASS_KEY)
  } catch {
    // ignore
  }
}

function buildSyntheticPresentationTeam(normalizedCode, userId, memberDisplayName, teams) {
  const teamId = randomId('t')
  let joinCode = normalizedCode
  if (teams.some((t) => t.joinCode === joinCode)) {
    joinCode = generateUniqueCode(teams)
  }
  const dn = (memberDisplayName || '').trim()
  return {
    teamId,
    teamName: `Presentation team (${normalizedCode})`,
    joinCode,
    leadId: DEMO_LEAD_PLACEHOLDER_ID,
    members: [
      {
        memberId: DEMO_LEAD_PLACEHOLDER_ID,
        role: 'team-lead',
        displayName: SYNTHETIC_LEAD_DISPLAY_NAME,
      },
      { memberId: userId, role: 'team-member', displayName: dn },
    ],
  }
}

function randomId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Update `lucky-charm-auth.teamId` from `lucky-charm-teams` for the current session user (same storage slot as session).
 */
export function syncAuthTeamIdWithRoster() {
  const auth = readAuthState()
  if (!auth.gateCompleted) return
  if (auth.dashboardRole === 'hackathon-host') {
    patchAuthSession({ teamId: null })
    return
  }
  const uid = getOrCreateUserId()
  if ((auth.mode === 'mock' || auth.mode === 'sso') && auth.userId && auth.userId !== uid) return
  const team = getUserTeam(uid)
  patchAuthSession({ teamId: team?.teamId ?? null })
}

export function getOrCreateUserId() {
  try {
    const auth = readAuthState()
    if (auth.mode === 'sso' && auth.userId) return auth.userId
    if (auth.mode === 'mock' && auth.userId) return auth.userId

    let id = localStorage.getItem(USER_KEY)
    if (!id) {
      id = randomId('u')
      localStorage.setItem(USER_KEY, id)
    }
    return id
  } catch {
    return `u_fallback_${Date.now()}`
  }
}

/**
 * Apply SSO-reported team membership (join code, or team id + lead/member role).
 * Hackathon hosts skip team sync.
 */
export function upsertTeamFromSso(userId, displayName, dashboardRole, teamPayload) {
  if (!teamPayload || dashboardRole === 'hackathon-host') return null
  const dn = (displayName || '').trim() || 'Member'
  const teams = getTeams()
  const join = (teamPayload.joinCode || '').trim().toUpperCase()
  const tid = (teamPayload.teamId || '').trim()

  if (join) {
    const res = joinTeam(join, userId, dn)
    if (!res.ok) return null
    if (dashboardRole === 'team-lead') {
      const all = getTeams()
      const t = all.find((x) => x.joinCode === join)
      if (t) {
        t.leadId = userId
        const m = t.members.find((x) => x.memberId === userId)
        if (m) m.role = 'team-lead'
        setTeams(all)
      }
    }
    return getUserTeam(userId)
  }

  if (!tid) return null

  let team = teams.find((t) => t.teamId === tid)
  const isLead = dashboardRole === 'team-lead'

  if (!team && isLead) {
    const fresh = {
      teamId: tid,
      teamName: (teamPayload.teamName || '').trim() || 'Team',
      joinCode: generateUniqueCode(teams),
      leadId: userId,
      members: [{ memberId: userId, role: 'team-lead', displayName: dn }],
    }
    teams.push(fresh)
    setTeams(teams)
    syncUserTeamProfile(userId, fresh)
    return fresh
  }

  if (!team) return null

  if (isLead) team.leadId = userId
  let m = team.members.find((x) => x.memberId === userId)
  if (m) {
    m.displayName = dn
    m.role = isLead ? 'team-lead' : 'team-member'
  } else {
    team.members.push({
      memberId: userId,
      role: isLead ? 'team-lead' : 'team-member',
      displayName: dn,
    })
  }
  setTeams(teams)
  syncUserTeamProfile(userId, team)
  return team
}

export function getTeams() {
  try {
    const raw = localStorage.getItem(TEAMS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function setTeams(teams) {
  try {
    localStorage.setItem(TEAMS_KEY, JSON.stringify(teams))
  } catch {
    // ignore
  }
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) {
    s += chars[Math.floor(Math.random() * chars.length)]
  }
  return s
}

function generateUniqueCode(existingTeams) {
  const codes = new Set(existingTeams.map((t) => t.joinCode))
  let code = generateCode()
  let guard = 0
  while (codes.has(code) && guard < 50) {
    code = generateCode()
    guard += 1
  }
  return code
}

export function getUserTeam(userId) {
  const teams = getTeams()
  return teams.find((t) => t.members?.some((m) => m.memberId === userId)) ?? null
}

/**
 * Clear all teams + demo user id (for testing "no team" flow).
 * SSO users: teams cleared; same auth user id kept; auth `team` in localStorage cleared if present.
 */
/**
 * Ensure mock-login Team 1 exists and the user is on the roster (lead, member, or first-time member with placeholder lead).
 * No-op for roles without a team (e.g. hackathon-host).
 * @param {string} userId
 * @param {string} displayName
 * @param {'team-lead' | 'team-member'} dashboardRole
 * @param {string} teamName e.g. "Team 1"
 */
export function syncMockLoginTeamMembership(userId, displayName, dashboardRole, teamName) {
  if (dashboardRole !== 'team-lead' && dashboardRole !== 'team-member') return null
  const dn = (displayName || '').trim() || 'Demo user'
  let teams = getTeams()
  let team = teams.find((t) => t.teamId === DEMO_TEAM_1_ID)
  const isLead = dashboardRole === 'team-lead'
  const tname = (teamName || '').trim() || 'Team 1'

  if (!team) {
    const joinCode = pickDemoTeamJoinCode(teams)
    if (isLead) {
      team = {
        teamId: DEMO_TEAM_1_ID,
        teamName: tname,
        joinCode,
        leadId: userId,
        members: [{ memberId: userId, role: 'team-lead', displayName: dn }],
      }
    } else {
      team = {
        teamId: DEMO_TEAM_1_ID,
        teamName: tname,
        joinCode,
        leadId: DEMO_LEAD_PLACEHOLDER_ID,
        members: [
          {
            memberId: DEMO_LEAD_PLACEHOLDER_ID,
            role: 'team-lead',
            displayName: SYNTHETIC_LEAD_DISPLAY_NAME,
          },
          { memberId: userId, role: 'team-member', displayName: dn },
        ],
      }
    }
    teams.push(team)
    setTeams(teams)
    syncUserTeamProfile(userId, team)
    return team
  }

  if (isLead) {
    team.leadId = userId
    team.teamName = tname || team.teamName
    team.members = team.members.filter((m) => m.memberId !== DEMO_LEAD_PLACEHOLDER_ID)
    const existing = team.members.find((m) => m.memberId === userId)
    if (existing) {
      existing.role = 'team-lead'
      existing.displayName = dn
    } else {
      team.members.push({ memberId: userId, role: 'team-lead', displayName: dn })
    }
  } else {
    const existing = team.members.find((m) => m.memberId === userId)
    if (existing) {
      existing.displayName = dn
      existing.role = 'team-member'
    } else {
      team.members.push({ memberId: userId, role: 'team-member', displayName: dn })
    }
  }
  setTeams(teams)
  syncUserTeamProfile(userId, getUserTeam(userId))
  return getUserTeam(userId)
}

function pickDemoTeamJoinCode(teams) {
  const preferred = 'TEAM01'
  if (!teams.some((t) => t.joinCode === preferred)) return preferred
  return generateUniqueCode(teams)
}

export function resetTeamDemoStorage() {
  try {
    const uid = getOrCreateUserId()
    setTeams([])
    syncUserTeamProfile(uid, null)
    try {
      localStorage.removeItem('lucky-charm-user-profile')
    } catch {
      // ignore
    }
    const auth = readAuthState()
    if (auth.mode === 'sso' || auth.mode === 'mock') {
      patchAuthSession({ team: null, teamId: null })
    } else {
      localStorage.removeItem(USER_KEY)
    }
    try {
      localStorage.removeItem(DEMO_JOIN_BYPASS_KEY)
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
}

export function createTeam(teamName, userId, leadDisplayName) {
  const leadName = (leadDisplayName || '').trim()
  const teams = getTeams()
  const teamId = randomId('t')
  const joinCode = generateUniqueCode(teams)
  const team = {
    teamId,
    teamName: (teamName || '').trim() || 'My team',
    joinCode,
    leadId: userId,
    members: [
      {
        memberId: userId,
        role: 'team-lead',
        displayName: leadName || 'Team Lead',
      },
    ],
  }
  teams.push(team)
  setTeams(teams)
  syncUserTeamProfile(userId, team)
  syncAuthTeamIdWithRoster()
  return team
}

/**
 * @param {{ demoBypass?: boolean }} [options] If `demoBypass` is set, it wins over localStorage (checkbox state).
 */
export function joinTeam(joinCode, userId, displayName, options = {}) {
  let teams = getTeams()
  const code = (joinCode || '').trim().toUpperCase()
  if (!code) return { ok: false, error: 'Enter a join code' }
  let team = teams.find((t) => t.joinCode === code)
  const bypass =
    typeof options.demoBypass === 'boolean' ? options.demoBypass : readDemoJoinBypass()
  if (!team) {
    if (bypass) {
      const dn = (displayName || '').trim()
      if (!dn) {
        return { ok: false, error: 'Enter your display name so teammates know who you are.' }
      }
      const synthetic = buildSyntheticPresentationTeam(code, userId, dn, teams)
      teams.push(synthetic)
      setTeams(teams)
      syncUserTeamProfile(userId, synthetic)
      syncAuthTeamIdWithRoster()
      return { ok: true, team: synthetic, demoSynthetic: true }
    }
    return {
      ok: false,
      error:
        'This join code is not in this browser’s storage. Normal and Incognito (or another device) each have separate data — turn on Demo mode above, or use “Join as demo member”.',
    }
  }
  const targetTeamId = team.teamId

  // Re-load from localStorage so concurrent joins in other tabs are merged (avoid last-write-wins dropping members).
  teams = getTeams()
  team = teams.find((t) => t.teamId === targetTeamId)
  if (!team) {
    return { ok: false, error: 'Team not found. Try Refresh or check your join code.' }
  }
  if (team.joinCode !== code && !bypass) {
    return { ok: false, error: 'This join code is no longer valid. Ask your lead for the current code.' }
  }

  if (team.members.some((m) => m.memberId === userId)) {
    syncUserTeamProfile(userId, team)
    syncAuthTeamIdWithRoster()
    return { ok: true, team, alreadyMember: true }
  }
  const memberName = (displayName || '').trim()
  if (!memberName) {
    return { ok: false, error: 'Enter your display name so teammates know who you are.' }
  }
  team.members.push({
    memberId: userId,
    role: 'team-member',
    displayName: memberName,
  })
  setTeams(teams)
  syncUserTeamProfile(userId, team)
  syncAuthTeamIdWithRoster()
  return { ok: true, team }
}

/**
 * One-click Team Member demo: local synthetic team (isolated localStorage OK for presentations).
 */
export function joinAsDemoMember(userId, displayName) {
  if (getUserTeam(userId)) {
    return { ok: false, error: 'You are already on a team. Leave or use Reset demo first.' }
  }
  const dn = (displayName || '').trim()
  if (!dn) {
    return { ok: false, error: 'Enter your display name in the field above.' }
  }
  const teams = getTeams()
  let joinCode = 'DEMO-MEMBER'
  if (teams.some((t) => t.joinCode === joinCode)) {
    joinCode = generateUniqueCode(teams)
  }
  const team = {
    teamId: randomId('t'),
    teamName: 'Presentation team (member view)',
    joinCode,
    leadId: DEMO_LEAD_PLACEHOLDER_ID,
    members: [
      {
        memberId: DEMO_LEAD_PLACEHOLDER_ID,
        role: 'team-lead',
        displayName: SYNTHETIC_LEAD_DISPLAY_NAME,
      },
      { memberId: userId, role: 'team-member', displayName: dn },
    ],
  }
  teams.push(team)
  setTeams(teams)
  syncUserTeamProfile(userId, team)
  syncAuthTeamIdWithRoster()
  return { ok: true, team, demoSynthetic: true }
}

/** Current user updates their roster display name (any role). */
export function updateMyDisplayName(userId, newDisplayName) {
  const name = (newDisplayName || '').trim()
  if (!name) return { ok: false, error: 'Display name cannot be empty' }
  const teams = getTeams()
  const team = teams.find((t) => t.members?.some((m) => m.memberId === userId))
  if (!team) return { ok: false, error: 'You are not on a team' }
  const member = team.members.find((m) => m.memberId === userId)
  if (!member) return { ok: false, error: 'Member not found' }
  member.displayName = name
  setTeams(teams)
  syncUserTeamProfile(userId, team)
  return { ok: true, team }
}

/** Team Lead renames the team. */
export function updateTeamName(teamId, actingUserId, newTeamName) {
  const teams = getTeams()
  const team = teams.find((t) => t.teamId === teamId)
  if (!team || team.leadId !== actingUserId) {
    return { ok: false, error: 'Only the team lead can rename the team' }
  }
  const next = (newTeamName || '').trim() || 'My team'
  team.teamName = next
  setTeams(teams)
  syncUserTeamProfile(actingUserId, team)
  return { ok: true, team }
}

export function regenerateJoinCode(teamId, actingUserId) {
  const teams = getTeams()
  const team = teams.find((t) => t.teamId === teamId)
  if (!team || team.leadId !== actingUserId) return { ok: false, error: 'Only the team lead can rotate the code' }
  team.joinCode = generateUniqueCode(teams)
  setTeams(teams)
  return { ok: true, team }
}

/**
 * Add a placeholder member (demo only) — synthetic member for presentation when no one else is in the same browser.
 * Only team lead can add. Member gets a synthetic ID.
 */
export function addMemberPlaceholder(teamId, displayName, actingUserId) {
  const teams = getTeams()
  const team = teams.find((t) => t.teamId === teamId)
  if (!team || team.leadId !== actingUserId) return { ok: false, error: 'Only the team lead can add members' }
  const dn = (displayName || '').trim() || 'Teammate'
  const memberId = `lc_placeholder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  if (team.members.some((m) => m.displayName === dn && m.memberId?.startsWith?.('lc_placeholder'))) {
    return { ok: false, error: 'A member with that name already exists' }
  }
  team.members.push({
    memberId,
    role: 'team-member',
    displayName: dn,
  })
  setTeams(teams)
  return { ok: true, team }
}

export function removeMember(teamId, memberIdToRemove, actingUserId) {
  let teams = getTeams()
  let team = teams.find((t) => t.teamId === teamId)
  if (!team || team.leadId !== actingUserId) return { ok: false, error: 'Only the team lead can remove members' }
  if (memberIdToRemove === actingUserId) return { ok: false, error: "You can't remove yourself as lead" }
  const tid = team.teamId
  teams = getTeams()
  team = teams.find((t) => t.teamId === tid)
  if (!team || team.leadId !== actingUserId) return { ok: false, error: 'Only the team lead can remove members' }
  const member = team.members.find((m) => m.memberId === memberIdToRemove)
  if (!member) return { ok: false, error: 'Member not found' }
  if (member.role === 'team-lead') return { ok: false, error: "Can't remove another lead" }
  team.members = team.members.filter((m) => m.memberId !== memberIdToRemove)
  setTeams(teams)
  syncUserTeamProfile(memberIdToRemove, null)
  return { ok: true, team }
}

/** Team members only — removes self from team. Team Lead cannot use this (must stay or manage roster). */
export function leaveTeam(userId) {
  const teams = getTeams()
  const team = teams.find((t) => t.members?.some((m) => m.memberId === userId))
  if (!team) return { ok: false, error: 'You are not on a team' }
  if (team.leadId === userId) {
    return {
      ok: false,
      error: 'Team Leads cannot leave with this action. Remove other members first or ask an organizer.',
    }
  }
  team.members = team.members.filter((m) => m.memberId !== userId)
  setTeams(teams)
  syncUserTeamProfile(userId, null)
  syncAuthTeamIdWithRoster()
  return { ok: true }
}

export function isTeamLead(team, userId) {
  return team?.leadId === userId
}

export function getMemberRole(team, userId) {
  const m = team?.members?.find((x) => x.memberId === userId)
  return m?.role ?? null
}

/** Simple deterministic mock anonymized metrics for Hackathon Host demo */
export function getAnonymizedTeamMetrics(team) {
  const seed = team.teamId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const n = team.members?.length ?? 0
  return {
    signalScore: ((seed % 40) + 60) / 100,
    openBlockerSignals: (seed % 4) + (n > 3 ? 1 : 0),
    decisionMomentum: ['Rising', 'Steady', 'Cooling'][seed % 3],
    note: 'Aggregated from team activity only — no individual content.',
  }
}
