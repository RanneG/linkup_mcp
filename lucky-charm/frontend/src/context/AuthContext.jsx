import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  readAuthState,
  writeAuthState,
  clearAuthStorageKeys,
} from '../utils/authStorage'
import {
  getSsoBaseUrl,
  probeSsoReachable,
  postSsoLogin,
  parseLuckyCharmProfile,
} from '../services/ssoService'
import {
  upsertTeamFromSso,
  syncMockLoginTeamMembership,
  syncAuthTeamIdWithRoster,
} from '../utils/teamStorage'
import {
  findMockUserByCredentials,
  getMockLoginUserId,
} from '../utils/mockCredentialsStorage'
import { generatePseudonymId } from '../utils/pseudonymUtils'
import {
  getProvider,
  connectWallet as doConnectWallet,
  deriveParticipantIdFromAddress,
  truncateAddress,
} from '../services/walletAuthService'

const AuthContext = createContext(null)

const VALID_ROLES = ['team-lead', 'team-member', 'hackathon-host']

function deriveUserIdFromSpk(spkHex, profileUserId) {
  if (profileUserId) return profileUserId
  const h = (spkHex || '').replace(/^0x/i, '').toLowerCase()
  if (h.length < 16) return `sso_${randomFallback()}`
  return `sso_spk_${h.slice(0, 40)}`
}

function randomFallback() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [ssoReachable, setSsoReachable] = useState(null)
  const [auth, setAuth] = useState(() => readAuthState())

  const baseUrl = useMemo(() => getSsoBaseUrl(), [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!baseUrl) {
        if (!cancelled) {
          setSsoReachable(false)
          setReady(true)
        }
        return
      }
      const ok = await probeSsoReachable(baseUrl)
      if (!cancelled) {
        setSsoReachable(ok)
        setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [baseUrl])

  const persist = useCallback((patch, persistOptions) => {
    const next = writeAuthState(patch, persistOptions)
    setAuth(next)
    return next
  }, [])

  /**
   * @param {string} email
   * @param {string} password
   * @param {boolean} rememberMe
   * @param {boolean} [usePseudonym] - use opaque participant ID instead of identity
   */
  const loginWithMockCredentials = useCallback((email, password, rememberMe, usePseudonym = false) => {
    const row = findMockUserByCredentials(email, password)
    if (!row) {
      throw new Error('Invalid email or password')
    }
    const userId = usePseudonym ? generatePseudonymId() : getMockLoginUserId(row.email)
    const participantId = usePseudonym ? userId : null
    /** Only the Team Lead is seeded into demo Team 1; members join via join code (same browser). */
    if (row.role === 'team-lead') {
      syncMockLoginTeamMembership(userId, usePseudonym ? 'Pseudonym' : row.name, row.role, row.teamName || 'Team 1')
    }
    const next = persist(
      {
        gateCompleted: true,
        mode: 'mock',
        email: usePseudonym ? null : row.email,
        displayName: usePseudonym ? 'Pseudonym' : row.name,
        userId,
        participantId,
        dashboardRole: row.role,
        teamId: row.role === 'team-lead' ? row.teamId : null,
        sessionToken: null,
        spkHex: null,
        team: null,
      },
      { persistSessionOnly: !rememberMe },
    )
    syncAuthTeamIdWithRoster()
    return next
  }, [persist])

  /** Wallet connect — MetaMask/Coinbase/Rabby etc. One-click, no email. */
  const completeWalletLogin = useCallback(
    async (rememberMe = true) => {
      const address = await doConnectWallet()
      const participantId = await deriveParticipantIdFromAddress(address)
      if (!participantId) throw new Error('Could not derive participant ID')
      const displayName = truncateAddress(address)
      const next = persist(
        {
          gateCompleted: true,
          mode: 'wallet',
          email: null,
          teamId: null,
          displayName: `Wallet ${displayName}`,
          dashboardRole: 'team-lead',
          userId: participantId,
          participantId,
          sessionToken: null,
          spkHex: null,
          team: null,
        },
        { persistSessionOnly: !rememberMe },
      )
      syncAuthTeamIdWithRoster()
      return next
    },
    [persist],
  )

  /** Presentation bypass — no password; role selector stays available unless SSO/mock locks it. */
  const completeDemoGate = useCallback(
    (rememberMe = true, usePseudonym = false) => {
      const participantId = usePseudonym ? generatePseudonymId() : null
      const next = persist(
        {
          gateCompleted: true,
          mode: 'demo',
          email: null,
          teamId: null,
          displayName: usePseudonym ? 'Pseudonym' : 'Demo user',
          dashboardRole: 'team-lead',
          userId: usePseudonym ? participantId : null,
          participantId,
          sessionToken: null,
          spkHex: null,
          team: null,
        },
        { persistSessionOnly: !rememberMe },
      )
      return next
    },
    [persist],
  )

  const completeSsoLogin = useCallback(
    async (form) => {
      const { name, challenge, sname, spk, signature } = form
      if (!baseUrl) throw new Error('SSO base URL not configured')
      const data = await postSsoLogin(baseUrl, {
        name,
        challenge,
        sname,
        spk,
        signature,
      })
      const profile = parseLuckyCharmProfile(data)
      const dashboardRole =
        profile.dashboardRole && VALID_ROLES.includes(profile.dashboardRole)
          ? profile.dashboardRole
          : 'team-member'
      const userId = deriveUserIdFromSpk(spk, profile.userId)
      const displayName = profile.displayName || name || 'User'
      /** SSO userId is already opaque (spk-derived); use as participantId for aggregation */
      const participantId = userId

      upsertTeamFromSso(userId, displayName, dashboardRole, profile.team)

      const next = persist(
        {
          gateCompleted: true,
          mode: 'sso',
          sessionToken: data.session_token || null,
          displayName,
          userId,
          participantId,
          dashboardRole,
          team: profile.team,
          spkHex: spk,
          email: profile.email ?? null,
          teamId: profile.team?.teamId ?? null,
        },
        { persistSessionOnly: false },
      )
      syncAuthTeamIdWithRoster()
      return next
    },
    [baseUrl, persist],
  )

  const logout = useCallback(() => {
    clearAuthStorageKeys()
    setAuth(readAuthState())
  }, [])

  const value = useMemo(
    () => ({
      ready,
      ssoReachable,
      ssoBaseUrl: baseUrl,
      auth,
      isLoggedIn: !!auth.gateCompleted,
      loginWithMockCredentials,
      completeWalletLogin,
      completeDemoGate,
      completeSsoLogin,
      logout,
      isDemoMode: auth.mode === 'demo' && auth.gateCompleted,
      isSsoMode: auth.mode === 'sso' && auth.gateCompleted,
      isWalletMode: auth.mode === 'wallet' && auth.gateCompleted,
      isMockMode: auth.mode === 'mock' && auth.gateCompleted,
      /** @deprecated use !isLoggedIn at /login */
      needsLoginGate: ready && !auth.gateCompleted,
      ssoDashboardRole: auth.mode === 'sso' ? auth.dashboardRole : null,
    }),
    [
      ready,
      ssoReachable,
      baseUrl,
      auth,
      loginWithMockCredentials,
      completeWalletLogin,
      completeDemoGate,
      completeSsoLogin,
      logout,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
