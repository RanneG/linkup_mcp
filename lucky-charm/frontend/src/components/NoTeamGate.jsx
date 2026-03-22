import { Link, useLocation } from 'react-router-dom'
import './NoTeamGate.css'

/**
 * Shown on /upload or /dashboard when the current user has no team (localStorage).
 */
export default function NoTeamGate() {
  const { pathname } = useLocation()
  const isUpload = pathname.startsWith('/upload')

  return (
    <div className="no-team-gate">
      <h2 className="no-team-gate-title">Create or join a team first</h2>
      <p className="no-team-gate-text">
        {isUpload
          ? 'You need to be on a team before uploading transcripts to the TEE.'
          : 'You need to be on a team before opening the results dashboard.'}
      </p>
      <p className="no-team-gate-hint">Use the Team tab to create a new team or enter a join code.</p>
      <Link to="/team" className="no-team-gate-link">
        Go to Team
      </Link>
    </div>
  )
}
