import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useDataSource } from '../context/DataSourceContext'
import { useTeam } from '../contexts/TeamContext'
import { useAuth } from '../context/AuthContext'
import { fetchAggregates } from '../services/teeService'
import { getOrCreateUserId, getUserTeam } from '../utils/teamStorage'
import { getTEEResult, formatTEETimestamp, clearTEEResult } from '../utils/teeResultStorage'
import { markDeliverableComplete, getCurrentPhaseNumber, getArchivedPhases, getCurrentDeliverableLabel as getStoredDeliverableLabel, removeArchivedDeliverable, createFirstDeliverable } from '../utils/phaseStorage'
import { buildLLMContext, buildLLMContextJSON } from '../utils/llmContextUtils'
import {
  DEMO_TEAM_NAME,
  mapMockRowsWithLead,
  teamLeadNamedBlockers,
  teamLeadActionItemsAll,
  teamLeadDecisionsNamed,
} from '../data/dashboardMock'
import TeamLeadView from '../components/TeamLeadView'
import TeamMemberView from '../components/TeamMemberView'
import './Dashboard.css'

export default function Dashboard() {
  const navigate = useNavigate()
  const { currentTeam, currentUserRole, currentUserDisplayName, teamMembers, refresh } = useTeam()
  const { dataSource } = useDataSource()
  const { auth } = useAuth()
  const [aggregates, setAggregates] = useState(null)
  const [teeResult, setTEEResultState] = useState(null)
  const [phaseNum, setPhaseNum] = useState(() => getCurrentPhaseNumber())
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completeLabel, setCompleteLabel] = useState('')
  const [viewingArchived, setViewingArchived] = useState(null)
  const [showArchivedDropdown, setShowArchivedDropdown] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 16 })
  const [archivedToRemove, setArchivedToRemove] = useState(null)
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [createProjectLabel, setCreateProjectLabel] = useState('')
  const previousBtnRef = useRef(null)

  const archivedPhases = getArchivedPhases()
  const storedLabel = getStoredDeliverableLabel()
  const isFreshTeam = phaseNum === 1 && archivedPhases.length === 0 && !storedLabel
  const hasDeliverables = archivedPhases.length > 0 || phaseNum > 1 || (phaseNum === 1 && storedLabel)

  const getCurrentDeliverableLabel = () => {
    if (viewingArchived) {
      const ap = viewingArchived
      return `Deliverable ${ap.phase}${(ap.label && ap.label !== `Phase ${ap.phase}` && ap.label !== `Deliverable ${ap.phase}`) ? ` — ${ap.label}` : ''}`
    }
    const label = storedLabel && storedLabel !== `Deliverable ${phaseNum}` ? ` — ${storedLabel}` : ''
    return `Deliverable ${phaseNum}${label} (current)`
  }

  const openArchivedDropdown = useCallback(() => {
    const rect = previousBtnRef.current?.getBoundingClientRect()
    if (rect) {
      setDropdownPosition({
        top: rect.bottom + 4,
        right: Math.max(8, window.innerWidth - rect.right),
      })
    }
    setShowArchivedDropdown((v) => !v)
  }, [])
  const uid = getOrCreateUserId()
  const teamInStorage = getUserTeam(uid)
  const storageTeamId = teamInStorage?.teamId ?? null
  const contextTeamId = currentTeam?.teamId ?? null

  const refreshTeeAndPhase = useCallback(() => {
    setTEEResultState(getTEEResult())
    setPhaseNum(getCurrentPhaseNumber())
  }, [])

  useEffect(() => {
    refreshTeeAndPhase()
    const handleStorage = (e) => {
      if (e?.key === 'lucky-charm-tee-result' && e?.newValue) refreshTeeAndPhase()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [refreshTeeAndPhase])

  const participantId = auth?.participantId || auth?.userId
  useEffect(() => {
    if (currentUserRole !== 'lead' || !participantId) {
      setAggregates(null)
      return
    }
    let cancelled = false
    fetchAggregates(participantId)
      .then((res) => {
        if (!cancelled && res?.data?.length > 0) setAggregates(res)
        else if (!cancelled) setAggregates(null)
      })
      .catch(() => {
        if (!cancelled) setAggregates(null)
      })
    return () => { cancelled = true }
  }, [currentUserRole, participantId])

  const handleClearDashboard = useCallback(() => {
    clearTEEResult()
    setTEEResultState(null)
  }, [])

  const handleRemoveArchived = useCallback((ap) => {
    removeArchivedDeliverable(ap.phase, ap.completedAt)
    if (viewingArchived?.phase === ap.phase && viewingArchived?.completedAt === ap.completedAt) {
      setViewingArchived(null)
    }
    setArchivedToRemove(null)
  }, [viewingArchived])

  const handleMarkComplete = useCallback(() => {
    const result = getTEEResult()
    const { phase } = markDeliverableComplete(result, completeLabel.trim() || undefined)
    clearTEEResult()
    setTEEResultState(null)
    setPhaseNum(phase)
    setShowCompleteModal(false)
    setCompleteLabel('')
  }, [completeLabel])

  const handleCreateProject = useCallback(() => {
    if (createFirstDeliverable(createProjectLabel.trim() || undefined)) {
      setPhaseNum(getCurrentPhaseNumber())
      setShowCreateProjectModal(false)
      setCreateProjectLabel('')
    }
  }, [createProjectLabel])

  const handleCopyForLLM = useCallback(() => {
    const ctx = buildLLMContext(teeResult)
    if (!ctx) return
    navigator.clipboard.writeText(ctx).then(
      () => { /* success */ },
      () => { /* fallback: could show error */ },
    )
  }, [teeResult])

  const handleDownloadJSON = useCallback(() => {
    const data = buildLLMContextJSON(teeResult)
    if (!teeResult || !data || Object.keys(data).length === 0) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `project-context-${teeResult?.teamName?.replace(/\s+/g, '-') ?? 'standup'}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [teeResult])

  useEffect(() => {
    if (storageTeamId && !contextTeamId) {
      refresh()
    }
  }, [storageTeamId, contextTeamId, refresh])

  const displayResult = viewingArchived?.data ?? teeResult
  const hasTEEResult = displayResult != null
  const showEmptyState = !teeResult && !viewingArchived
  const showRoleContent = hasTEEResult || viewingArchived != null

  const rosterLeadRaw = teamMembers.find((m) => m.role === 'team-lead')?.displayName ?? ''
  const displayTeamName = (currentTeam?.teamName || '').trim() || DEMO_TEAM_NAME
  const mockTeeResultForLLM =
    !displayResult && dataSource === 'mock'
      ? {
          teamName: displayTeamName,
          sessions: [],
          blockers: mapMockRowsWithLead(
            teamLeadNamedBlockers.map((b) => ({ ...b, team: displayTeamName })),
            ['reportedBy'],
            rosterLeadRaw,
          ).map((b) => ({ ...b, reported_by: b.reportedBy })),
          action_items: mapMockRowsWithLead(teamLeadActionItemsAll, ['assignee'], rosterLeadRaw),
          decisions: mapMockRowsWithLead(teamLeadDecisionsNamed, ['decidedBy'], rosterLeadRaw).map(
            (d) => ({ ...d, decided_by: d.decidedBy }),
          ),
        }
      : null
  const dataForCopyDownload = displayResult ?? mockTeeResultForLLM

  const renderRoleView = () => {
    const tee = hasTEEResult ? displayResult : null

    if (currentUserRole === 'lead') {
      return (
        <TeamLeadView
          teeResult={tee}
          teamName={currentTeam?.teamName}
          teamMembers={teamMembers}
          aggregates={aggregates}
        />
      )
    }
    if (currentUserRole === 'member') {
      return (
        <TeamMemberView
          teeResult={tee}
          teamName={currentTeam?.teamName}
          viewerDisplayName={currentUserDisplayName}
          teamMembers={teamMembers}
        />
      )
    }

    return (
      <div className="dashboard-no-team-msg">
        <p>We couldn&apos;t determine your role on this team. Check the <strong>Team</strong> tab.</p>
      </div>
    )
  }

  if (!currentTeam) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header">
          <h1 className="dashboard-page-title">Results dashboard</h1>
        </div>
        <div className="dashboard-no-team-msg">
          <p>Loading team…</p>
        </div>
      </div>
    )
  }

  const formatArchivedDate = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1 className="dashboard-page-title">Results dashboard</h1>
        <div className="dashboard-header-actions">
          {isFreshTeam && (
            <button
              type="button"
              className="dashboard-create-project-btn"
              onClick={() => setShowCreateProjectModal(true)}
            >
              Create Project
            </button>
          )}
          {hasDeliverables && (
            <div className="dashboard-archived-dropdown">
              <button
                ref={previousBtnRef}
                type="button"
                className="dashboard-previous-btn"
                onClick={openArchivedDropdown}
                aria-expanded={showArchivedDropdown}
                aria-haspopup="listbox"
              >
                {getCurrentDeliverableLabel()}
                <span className="dashboard-dropdown-chevron" aria-hidden>▼</span>
              </button>
              {showArchivedDropdown &&
                createPortal(
                  <>
                    <div
                      className="dashboard-archived-backdrop"
                      aria-hidden="true"
                      onClick={() => setShowArchivedDropdown(false)}
                    />
                    <ul
                      className="dashboard-archived-list dashboard-archived-list--portal"
                      role="listbox"
                      aria-label="Select deliverable"
                      style={{
                        position: 'fixed',
                        top: dropdownPosition.top,
                        right: dropdownPosition.right,
                        left: 'auto',
                      }}
                    >
                      <li role="option" className="dashboard-archived-row dashboard-archived-row--current">
                        <button
                          type="button"
                          className={`dashboard-archived-item ${!viewingArchived ? 'dashboard-archived-item--active' : ''}`}
                          onClick={() => {
                            setViewingArchived(null)
                            setShowArchivedDropdown(false)
                          }}
                        >
                          <span className="dashboard-archived-label">
                            Deliverable {phaseNum}{storedLabel && storedLabel !== `Deliverable ${phaseNum}` ? ` — ${storedLabel}` : ''} (current)
                          </span>
                          <span className="dashboard-archived-meta">In progress</span>
                        </button>
                      </li>
                      {archivedPhases.map((ap, i) => (
                        <li key={ap.completedAt ?? i} role="option" className="dashboard-archived-row">
                          <button
                            type="button"
                            className={`dashboard-archived-item ${viewingArchived?.phase === ap.phase && viewingArchived?.completedAt === ap.completedAt ? 'dashboard-archived-item--active' : ''}`}
                            onClick={() => {
                              setViewingArchived(ap)
                              setShowArchivedDropdown(false)
                            }}
                          >
                            <span className="dashboard-archived-label">
                              Deliverable {ap.phase}{(ap.label && ap.label !== `Phase ${ap.phase}` && ap.label !== `Deliverable ${ap.phase}`) ? ` — ${ap.label}` : ''}
                            </span>
                            <span className="dashboard-archived-meta">
                              {ap.sessionCount ?? 0} meeting{(ap.sessionCount ?? 0) !== 1 ? 's' : ''}
                              {' · '}
                              {formatArchivedDate(ap.completedAt)}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="dashboard-archived-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              setArchivedToRemove(ap)
                            }}
                            title="Permanently remove this deliverable (for security)"
                          >
                            Archive
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>,
                  document.body,
                )}
            </div>
          )}
          {phaseNum > 1 && !viewingArchived && (
            <span className="dashboard-phase-badge" title="Current phase">
              Phase {phaseNum}
            </span>
          )}
        </div>
      </div>

      {viewingArchived && (
        <div className="dashboard-archived-banner" role="status">
          Viewing: <strong>Deliverable {viewingArchived.phase}{(viewingArchived.label && viewingArchived.label !== `Phase ${viewingArchived.phase}` && viewingArchived.label !== `Deliverable ${viewingArchived.phase}`) ? ` — ${viewingArchived.label}` : ''}</strong>
          {' — '}
          {viewingArchived.sessionCount ?? 0} meeting{(viewingArchived.sessionCount ?? 0) !== 1 ? 's' : ''}
          {' · '}
          Completed {formatArchivedDate(viewingArchived.completedAt)}
          {' '}
          <button
            type="button"
            className="dashboard-archived-copy-btn"
            onClick={() => {
              const ctx = buildLLMContext(viewingArchived.data)
              if (ctx) navigator.clipboard.writeText(ctx)
            }}
          >
            Copy for LLM
          </button>
          <button
            type="button"
            className="dashboard-archived-download-btn"
            onClick={() => {
              const data = buildLLMContextJSON(viewingArchived.data)
              if (!viewingArchived.data || !data || Object.keys(data).length === 0) return
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `project-context-${(viewingArchived.data?.teamName ?? 'standup').replace(/\s+/g, '-')}-phase-${viewingArchived.phase}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            Download JSON
          </button>
          <button
            type="button"
            className="dashboard-archived-delete-btn"
            onClick={() => setArchivedToRemove(viewingArchived)}
            title="Permanently remove this deliverable (for security)"
          >
            Archive deliverable
          </button>
        </div>
      )}

      {archivedToRemove && (
        <div
          className="dashboard-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-modal-title"
          onClick={() => setArchivedToRemove(null)}
        >
          <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="archive-modal-title" className="dashboard-modal-title">Archive deliverable?</h2>
            <p className="dashboard-modal-desc">
              Permanently remove Deliverable {archivedToRemove.phase} from storage? This cannot be undone. Use this for security when you no longer need the data.
            </p>
            <div className="dashboard-modal-actions">
              <button type="button" className="dashboard-btn dashboard-btn--primary" onClick={() => handleRemoveArchived(archivedToRemove)}>
                Yes, archive
              </button>
              <button type="button" className="dashboard-btn dashboard-btn--secondary" onClick={() => setArchivedToRemove(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showEmptyState && (
        <div className="dashboard-empty-tee">
          <p className="dashboard-empty-tee-text">No meetings processed yet</p>
          <p className="dashboard-empty-tee-desc">
            Upload meeting transcripts to see takeaways, action items, blockers, and more.
          </p>
          <button
            type="button"
            className="dashboard-empty-tee-btn"
            onClick={() => navigate('/upload')}
          >
            Go to Upload
          </button>
        </div>
      )}

      {hasTEEResult && !viewingArchived && (
        <div className="dashboard-tee-banner" role="status">
          <span>
            <strong>{teeResult.sessions?.length ?? 1} meeting{(teeResult.sessions?.length ?? 1) !== 1 ? 's' : ''} processed</strong>
            {teeResult.teamName && (
              <>
                {' '}
                · Team: <strong>{teeResult.teamName}</strong>
              </>
            )}
            {' – '}
            Latest: {teeResult.filename} ({formatTEETimestamp(teeResult.timestamp)})
          </span>
          <div className="dashboard-banner-actions">
            <button
              type="button"
              className="dashboard-copy-llm-btn"
              onClick={handleCopyForLLM}
              title="Copy markdown context for ChatGPT, Claude, or other LLMs"
            >
              Copy for LLM
            </button>
            <button
              type="button"
              className="dashboard-download-json-btn"
              onClick={handleDownloadJSON}
              title="Download contextual data as JSON file for upload to LLMs or other tools"
            >
              Download JSON
            </button>
            <button
              type="button"
              className="dashboard-clear-btn"
              onClick={handleClearDashboard}
              title="Clear all and start fresh"
            >
              Clear all
            </button>
            <button
              type="button"
              className="dashboard-complete-btn"
              onClick={() => setShowCompleteModal(true)}
              title="Mark deliverable complete and start a new phase"
            >
              Mark deliverable complete
            </button>
          </div>
        </div>
      )}

      {dataForCopyDownload && !hasTEEResult && !viewingArchived && !showEmptyState && (
        <div className="dashboard-tee-banner dashboard-tee-banner--mock" role="status">
          <span>Demo data · Team: <strong>{dataForCopyDownload.teamName}</strong></span>
          <div className="dashboard-banner-actions">
            <button
              type="button"
              className="dashboard-clear-btn"
              onClick={handleClearDashboard}
              title="Clear all and start fresh"
            >
              Clear all
            </button>
            <button
              type="button"
              className="dashboard-copy-llm-btn"
              onClick={() => {
                const ctx = buildLLMContext(dataForCopyDownload)
                if (ctx) navigator.clipboard.writeText(ctx)
              }}
              title="Copy markdown context for ChatGPT, Claude, or other LLMs"
            >
              Copy for LLM
            </button>
            <button
              type="button"
              className="dashboard-download-json-btn"
              onClick={() => {
                const data = buildLLMContextJSON(dataForCopyDownload)
                if (!dataForCopyDownload || !data || Object.keys(data).length === 0) return
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `project-context-${(dataForCopyDownload.teamName ?? 'standup').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`
                a.click()
                URL.revokeObjectURL(url)
              }}
              title="Download contextual data as JSON file for upload to LLMs or other tools"
            >
              Download JSON
            </button>
          </div>
        </div>
      )}

      {showCreateProjectModal && (
        <div
          className="dashboard-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-project-modal-title"
          onClick={() => setShowCreateProjectModal(false)}
        >
          <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="create-project-modal-title" className="dashboard-modal-title">Create Project</h2>
            <p className="dashboard-modal-desc">
              Name your first deliverable to get started.
            </p>
            <label className="dashboard-modal-label" htmlFor="create-project-label">
              Deliverable name
            </label>
            <input
              id="create-project-label"
              className="dashboard-modal-input"
              type="text"
              value={createProjectLabel}
              onChange={(e) => setCreateProjectLabel(e.target.value)}
              placeholder="e.g. MVP, Sprint 1"
            />
            <div className="dashboard-modal-actions">
              <button type="button" className="dashboard-btn dashboard-btn--primary" onClick={handleCreateProject}>
                Create
              </button>
              <button type="button" className="dashboard-btn dashboard-btn--secondary" onClick={() => { setShowCreateProjectModal(false); setCreateProjectLabel('') }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompleteModal && (
        <div
          className="dashboard-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="complete-modal-title"
          onClick={() => setShowCompleteModal(false)}
        >
          <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="complete-modal-title" className="dashboard-modal-title">Mark deliverable complete</h2>
            <p className="dashboard-modal-desc">
              Archive the current work and start Phase {phaseNum + 1}. The current dashboard data will be saved as a completed phase.
            </p>
            <label className="dashboard-modal-label" htmlFor="complete-phase-label">
              Phase label (optional)
            </label>
            <input
              id="complete-phase-label"
              className="dashboard-modal-input"
              type="text"
              value={completeLabel}
              onChange={(e) => setCompleteLabel(e.target.value)}
              placeholder="e.g. MVP, Sprint 1"
            />
            <div className="dashboard-modal-actions">
              <button type="button" className="dashboard-btn dashboard-btn--primary" onClick={handleMarkComplete}>
                Complete & start new phase
              </button>
              <button type="button" className="dashboard-btn dashboard-btn--secondary" onClick={() => { setShowCompleteModal(false); setCompleteLabel('') }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoleContent && (
        <div className="dashboard-content">
          {renderRoleView()}
        </div>
      )}
    </div>
  )
}
