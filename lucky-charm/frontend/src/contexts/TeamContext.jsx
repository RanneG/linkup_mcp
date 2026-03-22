import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { flushSync } from 'react-dom'
import {
  getOrCreateUserId,
  getTeams,
  getUserTeam,
  createTeam as createTeamStorage,
  joinTeam as joinTeamStorage,
  joinAsDemoMember as joinAsDemoMemberStorage,
  regenerateJoinCode,
  leaveTeam as leaveTeamStorage,
  removeMember as removeMemberStorage,
  addMemberPlaceholder as addMemberPlaceholderStorage,
  updateMyDisplayName as updateMyDisplayNameStorage,
  updateTeamName as updateTeamNameStorage,
  TEAMS_STORAGE_KEY,
} from '../utils/teamStorage'

const TeamContext = createContext(null)

/**
 * @typedef {'lead' | 'member' | null} TeamMemberKind
 */

export function TeamProvider({ children }) {
  const [version, setVersion] = useState(0)
  /** Re-read localStorage into context immediately (avoids race with navigate after create/join). */
  const refresh = useCallback(() => {
    flushSync(() => setVersion((v) => v + 1))
  }, [])

  /** Other tabs/windows in this profile update `lucky-charm-teams` — keep roster in sync for Team Lead. */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.storageArea !== localStorage) return
      if (e.key === TEAMS_STORAGE_KEY || e.key === null) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const userId = getOrCreateUserId()

  const currentTeam = useMemo(() => getUserTeam(userId), [userId, version])

  const allTeams = useMemo(() => getTeams(), [version])

  const currentUserRole = useMemo(() => {
    if (!currentTeam) return null
    if (currentTeam.leadId === userId) return 'lead'
    const m = currentTeam.members?.find((x) => x.memberId === userId)
    if (m?.role === 'team-lead') return 'lead'
    if (m?.role === 'team-member') return 'member'
    return null
  }, [currentTeam, userId])

  const teamMembers = currentTeam?.members ?? []

  const joinCode = currentTeam?.joinCode ?? null

  const currentUserDisplayName = useMemo(() => {
    const m = teamMembers.find((x) => x.memberId === userId)
    return m?.displayName?.trim() || 'You'
  }, [teamMembers, userId])

  const createTeam = useCallback(
    (teamName, leadDisplayName) => {
      const team = createTeamStorage(teamName, userId, leadDisplayName)
      refresh()
      return team
    },
    [userId, refresh],
  )

  const joinTeam = useCallback(
    (code, displayName, options) => {
      const res = joinTeamStorage(code, userId, displayName, options)
      if (res.ok) refresh()
      return res
    },
    [userId, refresh],
  )

  const joinAsDemoMember = useCallback(
    (displayName) => {
      const res = joinAsDemoMemberStorage(userId, displayName)
      if (res.ok) refresh()
      return res
    },
    [userId, refresh],
  )

  const regenerateCode = useCallback(() => {
    if (!currentTeam) return { ok: false, error: 'No team' }
    const res = regenerateJoinCode(currentTeam.teamId, userId)
    if (res.ok) refresh()
    return res
  }, [currentTeam, userId, refresh])

  const leaveTeam = useCallback(() => {
    const res = leaveTeamStorage(userId)
    if (res.ok) refresh()
    return res
  }, [userId, refresh])

  const removeMember = useCallback(
    (memberId) => {
      if (!currentTeam) return { ok: false, error: 'No team' }
      const res = removeMemberStorage(currentTeam.teamId, memberId, userId)
      if (res.ok) refresh()
      return res
    },
    [currentTeam, userId, refresh],
  )

  const addMemberPlaceholder = useCallback(
    (displayName) => {
      if (!currentTeam) return { ok: false, error: 'No team' }
      const res = addMemberPlaceholderStorage(currentTeam.teamId, displayName, userId)
      if (res.ok) refresh()
      return res
    },
    [currentTeam, userId, refresh],
  )

  const setMyDisplayName = useCallback(
    (newDisplayName) => {
      const res = updateMyDisplayNameStorage(userId, newDisplayName)
      if (res.ok) refresh()
      return res
    },
    [userId, refresh],
  )

  const renameTeam = useCallback(
    (newTeamName) => {
      if (!currentTeam) return { ok: false, error: 'No team' }
      const res = updateTeamNameStorage(currentTeam.teamId, userId, newTeamName)
      if (res.ok) refresh()
      return res
    },
    [currentTeam, userId, refresh],
  )

  const value = useMemo(
    () => ({
      userId,
      currentTeam,
      currentUserRole,
      teamMembers,
      joinCode,
      currentUserDisplayName,
      allTeams,
      refresh,
      createTeam,
      joinTeam,
      joinAsDemoMember,
      regenerateCode,
      leaveTeam,
      removeMember,
      addMemberPlaceholder,
      setMyDisplayName,
      renameTeam,
    }),
    [
      userId,
      currentTeam,
      currentUserRole,
      teamMembers,
      joinCode,
      currentUserDisplayName,
      allTeams,
      refresh,
      createTeam,
      joinTeam,
      joinAsDemoMember,
      regenerateCode,
      leaveTeam,
      removeMember,
      addMemberPlaceholder,
      setMyDisplayName,
      renameTeam,
    ],
  )

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>
}

export function useTeam() {
  const ctx = useContext(TeamContext)
  if (!ctx) {
    throw new Error('useTeam must be used within TeamProvider')
  }
  return ctx
}
