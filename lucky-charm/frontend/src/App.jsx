import { useEffect } from 'react'
import {
  Routes,
  Route,
  Link,
  NavLink,
  Outlet,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useTeam } from './contexts/TeamContext'
import UploadPage from './pages/UploadPage'
import Dashboard from './pages/Dashboard'
import TeamPage from './pages/TeamPage'
import TEEPage from './pages/TEEPage'
import LoginPage from './pages/LoginPage'
import HostConsolePage from './pages/HostConsolePage'
import TEEStatusIndicator from './components/TEEStatusIndicator'
import CreditSaver from './components/CreditSaver'
import NoTeamGate from './components/NoTeamGate'
import { ErrorBoundary } from './components/ErrorBoundary'
import SecurityConcierge from './components/SecurityConcierge'
import { getOrCreateUserId, getUserTeam } from './utils/teamStorage'
import { syncUserTeamProfile } from './utils/userProfileStorage'
import { getPostLoginPath, roleLabel } from './utils/postLoginRedirect'
import './App.css'

const PAGE_SUBTITLES = {
  upload: 'Upload your meeting transcript to the TEE',
  dashboard: 'Results dashboard',
  team: 'Team workspace',
}

function userHasTeamInStorage() {
  try {
    return !!getUserTeam(getOrCreateUserId())
  } catch {
    return false
  }
}

/** `/` → host console, or `/team` / `/upload` for participants. */
function ParticipantIndexRedirect() {
  const { auth } = useAuth()
  if (auth.dashboardRole === 'hackathon-host') {
    return <Navigate to="/host-console" replace />
  }
  return <Navigate to={userHasTeamInStorage() ? '/upload' : '/team'} replace />
}

/**
 * Prefer localStorage for the gate (source of truth) and sync context if it was stale.
 * Without a team: show a message on Upload/Dashboard (tabs stay usable).
 */
function TeamRequiredRoute({ children }) {
  const { currentTeam, refresh } = useTeam()
  const uid = getOrCreateUserId()
  const teamInStorage = getUserTeam(uid)
  const storageTeamId = teamInStorage?.teamId ?? null
  const contextTeamId = currentTeam?.teamId ?? null

  useEffect(() => {
    if (storageTeamId && !contextTeamId) {
      refresh()
    }
  }, [storageTeamId, contextTeamId, refresh])

  if (!teamInStorage) {
    return <NoTeamGate />
  }
  return children
}

function ParticipantCatchAll() {
  const { auth } = useAuth()
  if (auth.dashboardRole === 'hackathon-host') {
    return <Navigate to="/host-console" replace />
  }
  return <Navigate to={userHasTeamInStorage() ? '/upload' : '/team'} replace />
}

function navLinkClass({ isActive }) {
  return `app-nav-link${isActive ? ' app-nav-link--active' : ''}`
}

function RequireAuth({ children }) {
  const { auth } = useAuth()
  const location = useLocation()
  if (!auth.gateCompleted) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}

function RequireHost({ children }) {
  const { auth } = useAuth()
  if (auth.dashboardRole !== 'hackathon-host') {
    return <Navigate to={getPostLoginPath(auth.dashboardRole)} replace />
  }
  return children
}

/** Participant shell: Team | Upload | Dashboard — routes `/team`, `/upload`, `/dashboard`. */
function ParticipantLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { auth, logout } = useAuth()

  const pageKey =
    pathname === '/dashboard' || pathname.startsWith('/dashboard/')
      ? 'dashboard'
      : pathname === '/upload' || pathname.startsWith('/upload/')
        ? 'upload'
        : pathname === '/tee' || pathname.startsWith('/tee/')
          ? 'tee'
          : 'team'

  useEffect(() => {
    try {
      const uid = getOrCreateUserId()
      syncUserTeamProfile(uid, getUserTeam(uid))
    } catch {
      // ignore
    }
  }, [pathname])

  const displayName = auth.displayName || auth.email || 'Signed in'
  const isHost = auth.dashboardRole === 'hackathon-host'

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`app app--stitch ${pageKey === 'dashboard' ? 'app--dashboard' : ''}`}>
      <header className="app-header app-header--stitch">
        <div className="app-header-left">
          <h1 className="app-title app-title--stitch">Lucky Charm</h1>
          {isHost && (
            <Link to="/host-console" className="app-host-link" style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>
              Host console
            </Link>
          )}
        </div>
        <nav className="app-nav app-nav--stitch" aria-label="Main" data-tour="nav">
          <NavLink to="/team" className={navLinkClass} end data-tour="team-create">
            Team
          </NavLink>
          <span className="app-nav-sep" aria-hidden>|</span>
          <NavLink to="/upload" className={navLinkClass} end data-tour="upload-area">
            Upload
          </NavLink>
          <span className="app-nav-sep" aria-hidden>|</span>
          <NavLink to="/dashboard" className={navLinkClass} end data-tour="dashboard">
            Dashboard
          </NavLink>
          <span className="app-nav-sep" aria-hidden>|</span>
          <NavLink to="/tee" className={navLinkClass} end>
            TEE
          </NavLink>
        </nav>
        {auth.gateCompleted && (
          <div className="app-auth-row app-auth-row--stitch">
            <span className="app-auth-user app-auth-user--compact" title={auth.email || auth.displayName || ''}>
              {displayName}
              <span className="app-auth-role"> · {roleLabel(auth.dashboardRole)}</span>
            </span>
            <div className="app-avatar" title={auth.email || auth.displayName || ''}>
              {(displayName || 'U').charAt(0).toUpperCase()}
            </div>
            <button type="button" className="app-auth-logout" onClick={handleLogout}>
              Log out
            </button>
          </div>
        )}
      </header>

      <main
        className={`app-main ${pageKey === 'dashboard' ? 'app-main--dashboard' : ''} ${pageKey === 'team' ? 'app-main--team' : ''}`}
      >
        <Outlet />
      </main>
      <TEEStatusIndicator />
      <CreditSaver />
    </div>
  )
}

function ParticipantApp() {
  return (
    <Routes>
      <Route element={<ParticipantLayout />}>
        <Route path="/" element={<ParticipantIndexRedirect />} />
        <Route path="/team" element={<ErrorBoundary><TeamPage /></ErrorBoundary>} />
        <Route
          path="/upload"
          element={
            <TeamRequiredRoute>
              <UploadPage />
            </TeamRequiredRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <TeamRequiredRoute>
              <ErrorBoundary>
                <Dashboard />
              </ErrorBoundary>
            </TeamRequiredRoute>
          }
        />
        <Route path="/tee" element={<ErrorBoundary><TEEPage /></ErrorBoundary>} />
        <Route path="*" element={<ParticipantCatchAll />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const { ready } = useAuth()

  if (!ready) {
    return (
      <div className="app app--boot">
        <p className="app-boot-msg">Loading…</p>
      </div>
    )
  }

  return (
    <>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/host-console"
        element={
          <RequireAuth>
            <RequireHost>
              <HostConsolePage />
            </RequireHost>
          </RequireAuth>
        }
      />
      <Route path="/host" element={<Navigate to="/host-console" replace />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <ParticipantApp />
          </RequireAuth>
        }
      />
    </Routes>
    <SecurityConcierge />
    </>
  )
}
