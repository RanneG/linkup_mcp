import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import HackathonHostView from '../components/HackathonHostView'
import { getTEEResult, formatTEETimestamp } from '../utils/teeResultStorage'
import { getTeams } from '../utils/teamStorage'
import {
  getTranscriptRecords,
  getHostConsoleDemoMode,
  setHostConsoleDemoMode,
} from '../utils/transcriptHistoryStorage'
import { roleLabel } from '../utils/postLoginRedirect'
import './HostConsolePage.css'

/**
 * Organizer / hackathon host entry — separate from the participant app.
 * Open: http://localhost:3000/host-console
 * Aggregates: demo charts + teams stored in this browser's localStorage + optional last TEE result (anonymized in view).
 */
export default function HostConsolePage() {
  const navigate = useNavigate()
  const { auth, logout } = useAuth()
  const [teeResult, setTeeResult] = useState(null)
  const [teams, setTeams] = useState([])
  const [transcripts, setTranscripts] = useState([])
  const [demoMode, setDemoMode] = useState(() => getHostConsoleDemoMode())

  useEffect(() => {
    setTeeResult(getTEEResult())
    setTeams(getTeams())
    setTranscripts(getTranscriptRecords())
  }, [])

  const teamNameById = useMemo(() => {
    const m = {}
    for (const t of teams) {
      if (t.teamId) m[t.teamId] = t.teamName || 'Team'
    }
    return m
  }, [teams])

  const refreshLocal = () => {
    setTeeResult(getTEEResult())
    setTeams(getTeams())
    setTranscripts(getTranscriptRecords())
  }

  const onDemoToggle = (checked) => {
    setHostConsoleDemoMode(checked)
    setDemoMode(checked)
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const sessionLabel = auth.displayName || auth.email || 'Host'

  return (
    <div className="host-console">
      <header className="host-console-header">
        <div className="host-console-brand">
          <h1 className="host-console-title">Lucky Charm — Host console</h1>
          <p className="host-console-sub">
            Aggregated view across teams on <strong>this browser</strong> (localStorage demo). Participant app:{' '}
            <Link to="/team" className="host-console-link">
              Open participant app
            </Link>
          </p>
          <div className="host-console-user-bar" role="status">
            <span className="host-console-user-text">
              {sessionLabel}
              <span className="host-console-user-role"> · {roleLabel(auth.dashboardRole)}</span>
            </span>
            <button type="button" className="host-console-logout" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
        <div className="host-console-header-actions">
          <label className="host-console-demo-toggle">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(e) => onDemoToggle(e.target.checked)}
            />
            <span>Show mock demo data</span>
          </label>
          <button type="button" className="host-console-refresh" onClick={refreshLocal}>
            Refresh data
          </button>
        </div>
      </header>

      <section className="host-console-section host-console-section--teams" aria-labelledby="host-teams-heading">
        <h2 id="host-teams-heading" className="host-console-h2">
          Teams in this browser
        </h2>
        <p className="host-console-desc">
          Roster summary from <code>lucky-charm-teams</code> — no edit controls here (use the participant app).
        </p>
        {teams.length === 0 ? (
          <p className="host-console-muted">No teams yet. Participants create/join from the main app.</p>
        ) : (
          <ul className="host-console-team-list">
            {teams.map((t) => (
              <li key={t.teamId} className="host-console-team-row">
                <span className="host-console-team-name">{t.teamName}</span>
                <span className="host-console-team-meta">
                  {t.members?.length ?? 0} member{(t.members?.length ?? 0) === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {teeResult && (
        <p className="host-console-tee-note" role="status">
          Latest TEE snapshot in this browser: <strong>{teeResult.filename}</strong>
          {teeResult.teamName && (
            <>
              {' '}
              (team: {teeResult.teamName})
            </>
          )}{' '}
          — {formatTEETimestamp(teeResult.timestamp)}.
          {demoMode
            ? ' Demo mode: charts use mock Alpha/Beta/Gamma-style data plus optional snippet blend.'
            : ' Charts use stored transcripts (lucky-charm-transcripts) when demo mode is off.'}
        </p>
      )}

      <div className="host-console-dashboard">
        <HackathonHostView
          teeResult={teeResult}
          demoMode={demoMode}
          transcripts={transcripts}
          teamNameById={teamNameById}
        />
      </div>
    </div>
  )
}
