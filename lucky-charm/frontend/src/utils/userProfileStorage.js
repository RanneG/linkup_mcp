/**
 * Current user profile (demo) — mirrors team membership for quick reads.
 * Teams remain source of truth in lucky-charm-teams; this stays in sync.
 */
const PROFILE_KEY = 'lucky-charm-user-profile'

export function readUserProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return { userId: null, teamId: null }
    const o = JSON.parse(raw)
    return {
      userId: o?.userId ?? null,
      teamId: o?.teamId ?? null,
    }
  } catch {
    return { userId: null, teamId: null }
  }
}

export function writeUserProfile(partial) {
  const next = { ...readUserProfile(), ...partial }
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}

/** Call after any team change for this user. */
export function syncUserTeamProfile(userId, team) {
  if (!userId) return
  writeUserProfile({
    userId,
    teamId: team?.teamId ?? null,
  })
}
