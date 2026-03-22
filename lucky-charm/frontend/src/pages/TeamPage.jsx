import { useState, useCallback, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTeam } from '../contexts/TeamContext'
import { useAuth } from '../context/AuthContext'
import { useDashboardRole } from '../context/DashboardRoleContext'
import {
  readDemoJoinBypass,
  setDemoJoinBypass,
  DEMO_LEAD_PLACEHOLDER_ID,
} from '../utils/teamStorage'
import { clearAppCache } from '../utils/clearAppCache'
import './TeamPage.css'

export default function TeamPage() {
  const navigate = useNavigate()
  const { auth } = useAuth()
  const { role: dashboardRole } = useDashboardRole()
  const {
    currentTeam: team,
    currentUserRole,
    createTeam: createTeamForUser,
    joinTeam: joinTeamForUser,
    joinAsDemoMember: joinAsDemoMemberForUser,
    regenerateCode,
    leaveTeam: leaveTeamAction,
    removeMember: removeMemberAction,
    addMemberPlaceholder,
    refresh: refreshTeamContext,
    currentUserDisplayName,
    userId,
    setMyDisplayName,
    renameTeam,
  } = useTeam()

  const [createName, setCreateName] = useState('')
  const [createLeadDisplayName, setCreateLeadDisplayName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinDisplayName, setJoinDisplayName] = useState('')
  const [message, setMessage] = useState(null)
  const [copied, setCopied] = useState(false)
  const [demoJoinBypass, setDemoJoinBypassState] = useState(() => readDemoJoinBypass())
  const [editingOwnDisplayName, setEditingOwnDisplayName] = useState(false)
  const [ownDisplayNameDraft, setOwnDisplayNameDraft] = useState('')
  const [editingTeamName, setEditingTeamName] = useState(false)
  const [teamNameDraft, setTeamNameDraft] = useState('')
  const [addMemberName, setAddMemberName] = useState('')

  useEffect(() => {
    if (dashboardRole !== 'team-member' || team) return
    const n = (auth.displayName || '').trim()
    if (n) setJoinDisplayName((prev) => (prev.trim() ? prev : n))
  }, [dashboardRole, team, auth.displayName])

  const showError = (msg) => {
    setMessage({ type: 'error', text: msg })
    setTimeout(() => setMessage(null), 4000)
  }
  const showOk = (msg) => {
    setMessage({ type: 'ok', text: msg })
    setTimeout(() => setMessage(null), 3000)
  }

  const goUpload = useCallback(() => {
    navigate('/upload')
  }, [navigate])

  const handleResetDemo = useCallback(() => {
    if (
      !window.confirm(
        'Clear all app data and start fresh? This removes teams, TEE results, deliverables, and resets to a clean state. Close other tabs with this app first if you have any open.',
      )
    ) {
      return
    }
    clearAppCache()
    // Force full reload so all components read fresh from localStorage
    window.location.href = '/team'
  }, [])

  const handleCreateTeam = (e) => {
    e.preventDefault()
    const leadName = createLeadDisplayName.trim()
    if (!leadName) {
      showError('Enter your display name (how teammates will see you as Team Lead).')
      return
    }
    createTeamForUser(createName, leadName)
    setCreateName('')
    setCreateLeadDisplayName('')
    showOk('Team created. Opening Upload…')
    goUpload()
  }

  const handleJoinTeam = (e) => {
    e.preventDefault()
    const res = joinTeamForUser(joinCode, joinDisplayName, { demoBypass: demoJoinBypass })
    if (!res.ok) {
      showError(res.error || 'Could not join')
      return
    }
    setJoinCode('')
    setJoinDisplayName('')
    if (res.demoSynthetic) {
      showOk(
        res.alreadyMember
          ? 'Already on this team. Opening Upload…'
          : 'Joined a presentation-only team in this browser (demo). Opening Upload…',
      )
    } else {
      showOk(res.alreadyMember ? 'Already on this team. Opening Upload…' : 'Joined team. Opening Upload…')
    }
    goUpload()
  }

  const handleToggleDemoBypass = (on) => {
    setDemoJoinBypass(on)
    setDemoJoinBypassState(on)
  }

  const handleJoinAsDemoMember = () => {
    if (!joinDisplayName.trim()) {
      showError('Enter your display name in the field above first.')
      return
    }
    const res = joinAsDemoMemberForUser(joinDisplayName)
    if (!res.ok) {
      showError(res.error || 'Could not join as demo member')
      return
    }
    showOk('Demo member session ready (this browser only). Opening Upload…')
    goUpload()
  }

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = code
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRegenerate = () => {
    const res = regenerateCode()
    if (!res.ok) {
      showError(res.error || 'Could not generate code')
      return
    }
    showOk('New join code generated. The old code no longer works.')
  }

  const handleRemoveMember = (memberId) => {
    const res = removeMemberAction(memberId)
    if (!res.ok) {
      showError(res.error || 'Could not remove member')
      return
    }
    showOk('Member removed')
  }

  const handleAddPlaceholder = (e) => {
    e?.preventDefault?.()
    const name = (addMemberName || '').trim()
    if (!name) {
      showError('Enter a display name for the new member.')
      return
    }
    const res = addMemberPlaceholder(name)
    if (!res.ok) {
      showError(res.error || 'Could not add member')
      return
    }
    setAddMemberName('')
    showOk(`${name} added to the team.`)
  }

  const handleLeaveTeam = () => {
    const res = leaveTeamAction()
    if (!res.ok) {
      showError(res.error || 'Could not leave team')
      return
    }
    showOk('You left the team.')
    navigate('/team')
  }

  const startEditOwnName = () => {
    setOwnDisplayNameDraft((currentUserDisplayName || '').trim() || '')
    setEditingOwnDisplayName(true)
  }

  const cancelEditOwnName = () => {
    setEditingOwnDisplayName(false)
    setOwnDisplayNameDraft('')
  }

  const saveOwnDisplayName = () => {
    const res = setMyDisplayName(ownDisplayNameDraft)
    if (!res.ok) {
      showError(res.error || 'Could not update name')
      return
    }
    setEditingOwnDisplayName(false)
    showOk('Your display name was updated.')
  }

  const startEditTeamName = () => {
    if (!team) return
    setTeamNameDraft(team.teamName || '')
    setEditingTeamName(true)
  }

  const cancelEditTeamName = () => {
    setEditingTeamName(false)
    setTeamNameDraft('')
  }

  const saveTeamName = () => {
    const res = renameTeam(teamNameDraft)
    if (!res.ok) {
      showError(res.error || 'Could not rename team')
      return
    }
    setEditingTeamName(false)
    showOk('Team name updated.')
  }

  const handleRefreshRoster = useCallback(() => {
    refreshTeamContext()
    showOk('Roster reloaded from this browser’s storage.')
  }, [refreshTeamContext])

  const hostNoTeamView = (
    <div className="team-page team-page--wide">
      <h1 className="team-page-title">Host account</h1>
      <p className="team-page-lead">
        You&apos;re signed in as a <strong>hackathon host</strong>. Participant teams live under the host console for this
        browser.
      </p>
      <div className="team-page-actions team-page-actions--host-only">
        <Link to="/host-console" className="team-page-btn team-page-btn--primary">
          Open host console
        </Link>
      </div>
    </div>
  )

  const memberJoinOnlyView = (
    <div className="team-page team-page--wide team-page--member-join">
      <h1 className="team-page-title">Join your team</h1>
      <p className="team-page-lead">
        Enter the <strong>join code</strong> from your Team Lead. Everyone must use the <strong>same browser profile</strong>{' '}
        (same machine, not Incognito) so the team list in <code>localStorage</code> is shared. For isolated demos, use{' '}
        <strong>Demo mode</strong> or <strong>Join as demo member</strong> below.
      </p>
      <div className="team-page-demo-panel">
        <label className="team-page-demo-toggle">
          <input
            type="checkbox"
            checked={demoJoinBypass}
            onChange={(e) => handleToggleDemoBypass(e.target.checked)}
          />
          <span>Demo mode — accept any join code (no validation)</span>
        </label>
        {demoJoinBypass && (
          <p className="team-page-demo-warn" role="status">
            Demo mode — codes are not validated. A matching code in this browser still joins the real team first; otherwise a
            presentation-only team is created.
          </p>
        )}
      </div>
      {message && (
        <p className={`team-page-banner team-page-banner--${message.type}`} role="status">
          {message.text}
        </p>
      )}
      <section className="team-page-card team-page-card--full" aria-labelledby="team-member-join-heading">
        <h2 id="team-member-join-heading" className="team-page-card-title">
          Enter join code
        </h2>
        <p className="team-page-card-desc">
          You&apos;ll be added to that team&apos;s roster under your account. Your membership is saved in this browser for future
          sessions.
        </p>
        <form className="team-page-form" onSubmit={handleJoinTeam}>
          <label className="team-page-label" htmlFor="join-code">
            Join code
          </label>
          <input
            id="join-code"
            className="team-page-input team-page-input--mono"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            autoComplete="off"
            maxLength={24}
          />
          <label className="team-page-label" htmlFor="join-display">
            Your display name <span className="team-page-required">(required)</span>
          </label>
          <input
            id="join-display"
            className="team-page-input"
            value={joinDisplayName}
            onChange={(e) => setJoinDisplayName(e.target.value)}
            placeholder="How teammates see you (e.g. Sam)"
            autoComplete="name"
            required
          />
          <button type="submit" className="team-page-btn team-page-btn--primary">
            Join team
          </button>
        </form>
        <div className="team-page-demo-join-alt">
          <p className="team-page-demo-join-alt-label">Or skip the code entirely</p>
          <button type="button" className="team-page-btn team-page-btn--secondary" onClick={handleJoinAsDemoMember}>
            Join as demo member
          </button>
          <p className="team-page-muted team-page-demo-join-alt-hint">
            Uses your display name above. Creates a presentation-only team in this browser.
          </p>
        </div>
      </section>
      <p className="team-page-reset-wrap">
        <button type="button" className="team-page-btn team-page-btn--secondary team-page-btn--small" onClick={handleResetDemo}>
          Clear cache & start fresh
        </button>
      </p>
    </div>
  )

  const noTeamView = (
    <div className="team-page team-page--wide">
      <h1 className="team-page-title">Collaborative <span>Workspace</span></h1>
      <p className="team-page-lead">
        Teams live in <strong>this browser profile only</strong> (localStorage). A code copied from a normal window will{' '}
        <strong>not</strong> work in Incognito or another browser — they don&apos;t share storage. For that case, turn on{' '}
        <strong>Demo mode</strong> (then any code creates a local presentation team) or use <strong>Join as demo member</strong>.
      </p>
      <div className="team-page-demo-panel">
        <label className="team-page-demo-toggle">
          <input
            type="checkbox"
            checked={demoJoinBypass}
            onChange={(e) => handleToggleDemoBypass(e.target.checked)}
          />
          <span>Demo mode — accept any join code (no validation)</span>
        </label>
        {demoJoinBypass && (
          <p className="team-page-demo-warn" role="status">
            Demo mode — codes are not validated. A matching code in this browser still joins the real team first; otherwise a
            presentation-only team is created so you can show the member flow.
          </p>
        )}
      </div>
      {message && (
        <p className={`team-page-banner team-page-banner--${message.type}`} role="status">
          {message.text}
        </p>
      )}
      <div className="team-page-split">
        <section className="team-page-card" aria-labelledby="team-create-heading">
          <h2 id="team-create-heading" className="team-page-card-title">
            Create a new team
          </h2>
          <p className="team-page-card-desc">You&apos;ll become Team Lead and get a join code to share.</p>
          <form className="team-page-form" onSubmit={handleCreateTeam}>
            <label className="team-page-label" htmlFor="team-name">
              Team name
            </label>
            <input
              id="team-name"
              className="team-page-input"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Lucky Charm"
              autoComplete="off"
            />
            <label className="team-page-label" htmlFor="create-lead-display">
              Your display name <span className="team-page-required">(required)</span>
            </label>
            <input
              id="create-lead-display"
              className="team-page-input"
              value={createLeadDisplayName}
              onChange={(e) => setCreateLeadDisplayName(e.target.value)}
              placeholder="e.g. Sam or Jordan"
              autoComplete="name"
              required
            />
            <button type="submit" className="team-page-btn team-page-btn--primary">
              Create team
            </button>
          </form>
        </section>
        <section className="team-page-card" aria-labelledby="team-join-heading">
          <h2 id="team-join-heading" className="team-page-card-title">
            Join an existing team
          </h2>
            <p className="team-page-card-desc">
              Enter the code from your Team Lead (same browser), or turn on <strong>Demo mode</strong> and type any code for a
              local presentation team.
            </p>
          <form className="team-page-form" onSubmit={handleJoinTeam}>
            <label className="team-page-label" htmlFor="join-code">
              Join code
            </label>
            <input
              id="join-code"
              className="team-page-input team-page-input--mono"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              autoComplete="off"
              maxLength={24}
            />
            <label className="team-page-label" htmlFor="join-display">
              Your display name <span className="team-page-required">(required)</span>
            </label>
            <input
              id="join-display"
              className="team-page-input"
              value={joinDisplayName}
              onChange={(e) => setJoinDisplayName(e.target.value)}
              placeholder="How teammates see you (e.g. Sam)"
              autoComplete="name"
              required
            />
            <button type="submit" className="team-page-btn team-page-btn--primary">
              Join team
            </button>
          </form>
          <div className="team-page-demo-join-alt">
            <p className="team-page-demo-join-alt-label">Or skip the code entirely</p>
            <button type="button" className="team-page-btn team-page-btn--secondary" onClick={handleJoinAsDemoMember}>
              Join as demo member
            </button>
            <p className="team-page-muted team-page-demo-join-alt-hint">
              Uses your display name above. Creates a presentation-only team with a mock lead so you can open the Team Member
              dashboard in this browser.
            </p>
          </div>
        </section>
      </div>
      <p className="team-page-reset-wrap">
        <button type="button" className="team-page-btn team-page-btn--secondary team-page-btn--small" onClick={handleResetDemo}>
          Clear cache & start fresh
        </button>
      </p>
    </div>
  )

  if (!team) {
    if (dashboardRole === 'hackathon-host') return hostNoTeamView
    if (dashboardRole === 'team-member') return memberJoinOnlyView
    return noTeamView
  }

  const lead = currentUserRole === 'lead'
  const myRoleLabel = currentUserRole === 'lead' ? 'Team Lead' : 'Team Member'
  const youLabel = (currentUserDisplayName || '').trim() || 'You'

  return (
    <div className="team-page">
      <div className="team-page-title-block">
        {lead && editingTeamName ? (
          <div className="team-page-inline-edit team-page-inline-edit--title" role="group" aria-label="Edit team name">
            <input
              type="text"
              className="team-page-input team-page-input--inline-title"
              value={teamNameDraft}
              onChange={(e) => setTeamNameDraft(e.target.value)}
              placeholder="Team name"
              autoComplete="organization"
            />
            <div className="team-page-inline-edit-actions">
              <button type="button" className="team-page-btn team-page-btn--primary team-page-btn--compact" onClick={saveTeamName}>
                Save
              </button>
              <button type="button" className="team-page-btn team-page-btn--secondary team-page-btn--compact" onClick={cancelEditTeamName}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="team-page-title-row">
            <h1 className="team-page-title">{team.teamName}</h1>
            {lead && (
              <button type="button" className="team-page-btn team-page-btn--secondary team-page-btn--compact" onClick={startEditTeamName}>
                Edit team name
              </button>
            )}
          </div>
        )}
      </div>
      <p className="team-page-lead">
        You&apos;re <strong>{youLabel}</strong> · <strong>{myRoleLabel}</strong>
      </p>
      {message && (
        <p className={`team-page-banner team-page-banner--${message.type}`} role="status">
          {message.text}
        </p>
      )}

      {team.leadId === DEMO_LEAD_PLACEHOLDER_ID && (
        <p className="team-page-banner team-page-banner--ok" role="status">
          Presentation-only team — data exists only in this browser (not the same as another window&apos;s team).
        </p>
      )}

      <section className="team-page-section">
        <h2 className="team-page-section-title">Join code</h2>
        <p className="team-page-section-desc">Share this code with teammates. Anyone with the code can join.</p>
        <div className="team-code-row">
          <code className="team-code-value">{team.joinCode}</code>
          <button type="button" className="team-page-btn team-page-btn--secondary" onClick={() => handleCopyCode(team.joinCode)}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
          {lead && (
            <button type="button" className="team-page-btn team-page-btn--secondary" onClick={handleRegenerate}>
              Generate new code
            </button>
          )}
        </div>
        {!lead && (
          <p className="team-page-muted team-page-hint">
            Ask your Team Lead to generate a new code if this one should be rotated.
          </p>
        )}
      </section>

      <section className="team-page-section">
        <div className="team-page-section-head">
          <h2 className="team-page-section-title team-page-section-title--inline">Members</h2>
          <div className="team-page-section-head-actions">
            {lead && (
              <form className="team-page-add-member-form" onSubmit={handleAddPlaceholder}>
                <input
                  type="text"
                  className="team-page-input team-page-input--add-member"
                  value={addMemberName}
                  onChange={(e) => setAddMemberName(e.target.value)}
                  placeholder="Add member (display name)"
                  aria-label="New member display name"
                />
                <button type="submit" className="team-page-btn team-page-btn--secondary team-page-btn--compact">
                  Add member
                </button>
              </form>
            )}
            <button type="button" className="team-page-btn team-page-btn--secondary team-page-btn--compact" onClick={handleRefreshRoster}>
              Refresh roster
            </button>
          </div>
        </div>
        <p className="team-page-muted team-page-members-hint">
          Share the join code above for others to join, or add a placeholder member for demos. Members can be removed by the Team Lead.
        </p>
        <ul className="team-members-list">
          {(team.members ?? []).map((m) => {
            const isSelf = m.memberId === userId
            const showNameEditor = isSelf && editingOwnDisplayName
            return (
              <li key={m.memberId} className="team-members-item">
                {showNameEditor ? (
                  <div className="team-page-inline-edit team-page-inline-edit--member" role="group" aria-label="Edit your display name">
                    <input
                      type="text"
                      className="team-page-input team-page-input--inline-member"
                      value={ownDisplayNameDraft}
                      onChange={(e) => setOwnDisplayNameDraft(e.target.value)}
                      placeholder="Your display name"
                      autoComplete="name"
                    />
                    <div className="team-page-inline-edit-actions">
                      <button
                        type="button"
                        className="team-page-btn team-page-btn--primary team-page-btn--compact"
                        onClick={saveOwnDisplayName}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="team-page-btn team-page-btn--secondary team-page-btn--compact"
                        onClick={cancelEditOwnName}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="team-members-name">{m.displayName || m.memberId}</span>
                    {isSelf && (
                      <button
                        type="button"
                        className="team-page-btn team-page-btn--secondary team-page-btn--compact team-members-edit-name"
                        onClick={startEditOwnName}
                      >
                        Edit name
                      </button>
                    )}
                  </>
                )}
                <span className="team-members-role">
                  {m.role === 'team-lead' ? 'Team Lead' : 'Team Member'}
                </span>
                {lead && m.role !== 'team-lead' && (
                  <button
                    type="button"
                    className="team-page-btn team-page-btn--danger"
                    onClick={() => handleRemoveMember(m.memberId)}
                  >
                    Remove
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <div className="team-page-actions">
        {!lead && (
          <button type="button" className="team-page-btn team-page-btn--danger team-page-btn--outline" onClick={handleLeaveTeam}>
            Leave team
          </button>
        )}
        <button type="button" className="team-page-btn team-page-btn--primary" onClick={goUpload}>
          Open upload
        </button>
        <button type="button" className="team-page-btn team-page-btn--secondary" onClick={() => navigate('/dashboard')}>
          Open dashboard
        </button>
        <button type="button" className="team-page-btn team-page-btn--secondary team-page-btn--outline" onClick={handleResetDemo}>
          Clear cache & start fresh
        </button>
      </div>
    </div>
  )
}
