import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react'
import { useAuth } from './AuthContext'

const STORAGE_KEY = 'lucky-charm-dashboard-role'
const VALID = ['team-lead', 'team-member', 'hackathon-host']

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (VALID.includes(v)) return v
  } catch {
    // ignore
  }
  return 'team-lead'
}

const DashboardRoleContext = createContext({
  role: 'team-lead',
  setRole: () => {},
  roleLocked: false,
})

export function DashboardRoleProvider({ children }) {
  const { auth } = useAuth()
  const [role, setRoleState] = useState(readStored)

  const roleLocked =
    auth.gateCompleted && (auth.mode === 'sso' || auth.mode === 'mock')

  useEffect(() => {
    if (roleLocked && auth.dashboardRole && VALID.includes(auth.dashboardRole)) {
      setRoleState(auth.dashboardRole)
      try {
        localStorage.setItem(STORAGE_KEY, auth.dashboardRole)
      } catch {
        // ignore
      }
    }
  }, [roleLocked, auth.dashboardRole])

  const setRole = useCallback(
    (next) => {
      if (roleLocked) return
      if (!VALID.includes(next)) return
      setRoleState(next)
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // ignore
      }
    },
    [roleLocked],
  )

  const value = useMemo(() => ({ role, setRole, roleLocked }), [role, setRole, roleLocked])

  return (
    <DashboardRoleContext.Provider value={value}>
      {children}
    </DashboardRoleContext.Provider>
  )
}

export function useDashboardRole() {
  const ctx = useContext(DashboardRoleContext)
  if (!ctx) {
    throw new Error('useDashboardRole must be used within DashboardRoleProvider')
  }
  return ctx
}
