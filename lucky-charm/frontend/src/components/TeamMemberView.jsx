import { useMemo, useState } from 'react'
import {
  DEMO_TEAM_NAME,
  resolveMockLeadName,
  mapMockRowsWithLead,
  teamMemberAllBlockers,
  teamMemberActionItemsPooled,
  teamMemberDecisions,
} from '../data/dashboardMock'
import { isBlockerReportedByViewer, isActionItemForViewer } from '../utils/privacyDisplay'
import { getActionsByDueDate, getTrajectoryData, getPersonalTrajectoryData, generateStorySummary, bucketDue, generateActionsInterpretation, generateBlockersInterpretation, generateDecisionsInterpretation } from '../utils/dashboardInsights'
import TrajectoryChart from './TrajectoryChart'
import './TeamMemberView.css'

function normalizeActionItems(teeActionItems) {
  if (!Array.isArray(teeActionItems) || teeActionItems.length === 0) return []
  return teeActionItems.map((a, i) => ({
    id: a.id ?? `a-${i}`,
    text: a.text ?? a.title ?? a.description ?? 'Action item',
    due: a.due ?? a.due_date ?? '—',
    assignee: a.assignee ?? 'Team',
    context: a.context ?? null,
  }))
}

function normalizeTeamBlockers(teeBlockers) {
  if (!Array.isArray(teeBlockers) || teeBlockers.length === 0) return []
  return teeBlockers.map((b, i) => ({
    id: b.id ?? `br-${i}`,
    title: b.title ?? b.description ?? 'Blocker',
    status: b.status ?? 'In progress',
    reportedBy: b.reported_by ?? b.reportedBy ?? 'Teammate',
    context: b.context ?? null,
  }))
}

function normalizeDecisions(teeDecisions) {
  if (!Array.isArray(teeDecisions) || teeDecisions.length === 0) return []
  return teeDecisions.map((d, i) => ({
    id: d.id ?? `d-${i}`,
    text: d.text ?? d.title ?? d.description ?? 'Decision',
    date: d.date ?? d.created_at ?? '—',
    decidedBy: d.decided_by ?? d.decidedBy ?? 'Team',
    context: d.context ?? null,
  }))
}

function formatSummary(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  )
}

export default function TeamMemberView({
  teeResult,
  teamName,
  viewerDisplayName = 'You',
  teamMembers = [],
}) {
  const displayTeamName = (teamName || '').trim() || DEMO_TEAM_NAME

  const rosterLeadRaw = useMemo(() => {
    const lead = teamMembers.find((m) => m.role === 'team-lead')
    return lead?.displayName ?? ''
  }, [teamMembers])

  const rosterLeadLabel = useMemo(() => resolveMockLeadName(rosterLeadRaw), [rosterLeadRaw])

  const rawActions = useMemo(() => {
    if (teeResult) return normalizeActionItems(teeResult.action_items)
    const patched = mapMockRowsWithLead(teamMemberActionItemsPooled, ['assignee'], rosterLeadRaw)
    return normalizeActionItems(patched)
  }, [teeResult, rosterLeadRaw])

  const myActionItems = useMemo(
    () =>
      rawActions.filter((item) => isActionItemForViewer(item, viewerDisplayName, teamMembers)),
    [rawActions, viewerDisplayName, teamMembers],
  )

  const blockersTeam = useMemo(() => {
    if (teeResult) return normalizeTeamBlockers(teeResult.blockers)
    const patched = mapMockRowsWithLead(teamMemberAllBlockers, ['reportedBy'], rosterLeadRaw)
    return normalizeTeamBlockers(patched)
  }, [teeResult, rosterLeadRaw])

  const myBlockers = useMemo(
    () =>
      blockersTeam.filter((b) =>
        isBlockerReportedByViewer(b.reportedBy, viewerDisplayName, teamMembers),
      ),
    [blockersTeam, viewerDisplayName, teamMembers],
  )

  const decisions = useMemo(() => {
    if (teeResult) return normalizeDecisions(teeResult.decisions)
    const patched = mapMockRowsWithLead(teamMemberDecisions, ['decidedBy'], rosterLeadRaw)
    return normalizeDecisions(patched)
  }, [teeResult, rosterLeadRaw])

  const storySummary = useMemo(
    () =>
      generateStorySummary({
        blockers: blockersTeam,
        actionItems: rawActions,
        decisions,
        sessions: teeResult?.sessions,
      }),
    [blockersTeam, rawActions, decisions, teeResult?.sessions],
  )

  const memberSummary = useMemo(() => {
    const parts = []
    if (myActionItems.length > 0) {
      parts.push(`You have **${myActionItems.length} action item${myActionItems.length !== 1 ? 's' : ''}** assigned to you.`)
    } else {
      parts.push('No action items are currently assigned to you.')
    }
    if (myBlockers.length > 0) {
      parts.push(`You've reported **${myBlockers.length} blocker${myBlockers.length !== 1 ? 's' : ''}**.`)
    }
    parts.push(`The team has made **${decisions.length} decision${decisions.length !== 1 ? 's' : ''}** in recent standups.`)
    return parts.join(' ')
  }, [myActionItems.length, myBlockers.length, decisions.length])

  const myActionsByDue = useMemo(() => getActionsByDueDate(myActionItems), [myActionItems])

  const trajectoryData = useMemo(
    () =>
      getTrajectoryData(
        teeResult?.sessions,
        { decisions: decisions.length, actions: rawActions.length },
        [],
      ),
    [teeResult?.sessions, decisions.length, rawActions.length],
  )

  const rawBlockersForTrajectory = useMemo(() => {
    if (teeResult) return teeResult.blockers ?? []
    const patched = mapMockRowsWithLead(teamMemberAllBlockers, ['reportedBy'], rosterLeadRaw)
    return patched.map((b, i) => ({ ...b, reported_by: b.reportedBy ?? b.reported_by }))
  }, [teeResult, rosterLeadRaw])

  const rawActionsForTrajectory = useMemo(() => {
    if (teeResult) return teeResult.action_items ?? []
    const patched = mapMockRowsWithLead(teamMemberActionItemsPooled, ['assignee'], rosterLeadRaw)
    return patched
  }, [teeResult, rosterLeadRaw])

  const personalTrajectoryData = useMemo(
    () =>
      getPersonalTrajectoryData(
        teeResult?.sessions ?? [],
        rawActionsForTrajectory,
        rawBlockersForTrajectory,
        (a) => isActionItemForViewer(a, viewerDisplayName, teamMembers),
        (b) => isBlockerReportedByViewer(b.reported_by ?? b.reportedBy, viewerDisplayName, teamMembers),
      ),
    [
      teeResult?.sessions,
      rawActionsForTrajectory,
      rawBlockersForTrajectory,
      viewerDisplayName,
      teamMembers,
    ],
  )

  const [activeTab, setActiveTab] = useState('overview')
  const [selectedDue, setSelectedDue] = useState(null)
  const actionsInterp = useMemo(() => generateActionsInterpretation(myActionItems), [myActionItems])
  const blockersInterp = useMemo(() => generateBlockersInterpretation(myBlockers), [myBlockers])
  const decisionsInterp = useMemo(() => generateDecisionsInterpretation(decisions), [decisions])
  const filteredActions = useMemo(() => {
    if (!selectedDue) return myActionItems
    return myActionItems.filter((a) => bucketDue(a.due) === selectedDue)
  }, [myActionItems, selectedDue])

  const filteredActionsInterp = useMemo(() => {
    if (!selectedDue) return actionsInterp.items
    return actionsInterp.items.filter((a) => bucketDue(a.due) === selectedDue)
  }, [actionsInterp.items, selectedDue])

  const tabs = [
    { id: 'overview', label: 'Overview', count: null },
    { id: 'actions', label: 'Actions', count: myActionItems.length },
    { id: 'blockers', label: 'Blockers', count: myBlockers.length },
    { id: 'decisions', label: 'Takeaways', count: decisions.length },
  ]

  return (
    <div className="team-member-view ai-dashboard team-member-grid dashboard-with-sidebar">
      <aside className="dashboard-sidebar" aria-label="Sections">
        <h3 className="dashboard-sidebar-title">Sections</h3>
        <nav className="dashboard-sidebar-nav" role="navigation">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`dashboard-sidebar-item ${activeTab === t.id ? 'dashboard-sidebar-item--active' : ''}`}
              onClick={() => setActiveTab(t.id)}
              aria-current={activeTab === t.id ? 'true' : undefined}
            >
              <span className="dashboard-sidebar-label">{t.label}</span>
              {t.count != null && <span className="dashboard-sidebar-badge">{t.count}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-main-header">
          <h2 className="team-member-team-name">{displayTeamName}</h2>
          <p className="team-member-team-sub">
            <strong>{viewerDisplayName}</strong> · Lead: {rosterLeadLabel}
          </p>
        </header>

        {/* Active filter tags — removable */}
        {activeTab === 'actions' && selectedDue && (
          <div className="dashboard-filter-tags">
            <span className="dashboard-filter-tag">
              {selectedDue}
              <button type="button" className="dashboard-filter-tag-remove" onClick={() => setSelectedDue(null)} aria-label={`Remove ${selectedDue} filter`}>×</button>
            </span>
          </div>
        )}

      {/* Tab panels */}
      <div className="dashboard-tab-panels">
        {activeTab === 'overview' && (
        <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className="dashboard-tab-panel">
      <div className="team-member-overview-top">
        <section className="ai-story-card ai-summary-card--compact">
          <div className="ai-summary-icon" aria-hidden>📋</div>
          <div className="ai-summary-content">
            <h3 className="ai-summary-title">Project story</h3>
            <p className="ai-story-phase">{storySummary.phase}</p>
            <p className="ai-story-heading">
              <strong>Heading:</strong> {storySummary.heading}
            </p>
            <p className="ai-story-meta">
              {storySummary.meetingCount} meeting{storySummary.meetingCount !== 1 ? 's' : ''} processed
            </p>
          </div>
        </section>
        <section className="ai-summary-card ai-summary-card--member ai-summary-compact">
          <div className="ai-summary-icon" aria-hidden>◉</div>
          <div className="ai-summary-content">
            <h3 className="ai-summary-title">Your summary</h3>
            <p className="ai-summary-text">{formatSummary(memberSummary)}</p>
          </div>
        </section>
      </div>

      {/* Trajectory charts — side by side */}
      <div className="team-member-charts-row">
        {personalTrajectoryData.length > 0 && (
          <section className="ai-section ai-trajectory-card ai-chart-compact">
            <h3 className="ai-section-title">Your momentum</h3>
            <TrajectoryChart
              data={personalTrajectoryData}
              height={260}
              subtitle="Your action items + blockers — keep it rising"
              variant="personal"
            />
          </section>
        )}
        {trajectoryData.length > 0 && (
          <section className="ai-section ai-trajectory-card ai-chart-compact">
            <h3 className="ai-section-title">Project trajectory</h3>
            <TrajectoryChart data={trajectoryData} height={260} />
          </section>
        )}
      </div>

      {/* Actions panel — with Today/Tomorrow/This week sub-tabs */}
      </div>
        )}

        {activeTab === 'actions' && (
        <div id="panel-actions" role="tabpanel" aria-labelledby="tab-actions" className="dashboard-tab-panel dashboard-tab-panel--actions">
      <section className="ai-interpreted-section">
        <div className="ai-interpreted-summary ai-interpreted-summary--actions">
          <span className="ai-interpreted-badge">AI summary</span>
          <p className="ai-interpreted-text">{formatSummary(actionsInterp.summary)}</p>
        </div>
        {myActionsByDue.length > 0 && (
          <div className="ai-member-due-pills" role="tablist" aria-label="Filter by due date">
            <button
              type="button"
              className={`ai-member-due-pill ${!selectedDue ? 'ai-member-due-pill--active' : ''}`}
              onClick={() => setSelectedDue(null)}
              role="tab"
              aria-selected={!selectedDue}
            >
              All ({myActionItems.length})
            </button>
            {myActionsByDue.map((d) => (
              <button
                key={d.label}
                type="button"
                className={`ai-member-due-pill ${selectedDue === d.label ? 'ai-member-due-pill--active' : ''}`}
                onClick={() => setSelectedDue(d.label)}
                role="tab"
                aria-selected={selectedDue === d.label}
              >
                {d.label} ({d.count})
              </button>
            ))}
          </div>
        )}
        {myActionItems.length === 0 ? (
          <p className="team-member-empty">No action items assigned to you.</p>
        ) : (
          <ul className="action-items-list action-items-list--expanded">
            {filteredActionsInterp.map((item) => (
              <li key={item.id} className="action-item action-item--yours action-item--interpreted">
                <div className="action-item-main-row">
                  <span className="action-item-text">{item.text}</span>
                  <div className="action-item-right">
                    <span className="action-item-assignee">{item.assignee}</span>
                    <button
                      type="button"
                      className="action-item-due-pill"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedDue(bucketDue(item.due))
                      }}
                      title={`Filter to ${bucketDue(item.due)}`}
                    >
                      {item.due}
                    </button>
                  </div>
                </div>
                <p className="action-item-interpretation">{item.interpretation}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {filteredActionsInterp.length === 0 && myActionItems.length > 0 && selectedDue && (
        <p className="dashboard-empty-filter">
          No action items due <strong>{selectedDue}</strong>. Try another filter.
        </p>
      )}
        </div>
        )}

        {activeTab === 'blockers' && (
        <div id="panel-blockers" role="tabpanel" aria-labelledby="tab-blockers" className="dashboard-tab-panel">
      <section className="ai-interpreted-section">
        <div className="ai-interpreted-summary ai-interpreted-summary--blockers">
          <span className="ai-interpreted-badge">AI summary</span>
          <p className="ai-interpreted-text">{formatSummary(blockersInterp.summary)}</p>
        </div>
        {myBlockers.length === 0 ? (
          <p className="team-member-empty">No blockers attributed to you.</p>
        ) : (
          <ul className="blockers-reported-list blockers-reported-list--expanded">
            {blockersInterp.items.map((b) => (
              <li key={b.id} className="blockers-reported-item blockers-reported-item--yours blockers-reported-item--interpreted">
                <div className="blockers-reported-body">
                  <span className="blockers-reported-title">{b.title}</span>
                  <span className="blockers-reported-by">Reported by <strong>{b.reportedBy}</strong></span>
                </div>
                <p className="blockers-reported-interpretation">{b.interpretation}</p>
                <span
                  className={`blockers-reported-status blockers-reported-status--${
                    b.status === 'Resolved' ? 'resolved' : 'active'
                  }`}
                >
                  {b.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
        </div>
        )}

        {activeTab === 'decisions' && (
        <div id="panel-decisions" role="tabpanel" aria-labelledby="tab-decisions" className="dashboard-tab-panel">
      <section className="ai-interpreted-section ai-takeaways-section">
        <div className="ai-interpreted-summary ai-interpreted-summary--decisions">
          <span className="ai-interpreted-badge">AI summary</span>
          <p className="ai-interpreted-text">{formatSummary(decisionsInterp.summary)}</p>
        </div>
        <h4 className="ai-takeaways-subtitle">Key agreements</h4>
        {decisions.length === 0 ? (
          <p className="team-member-empty">No takeaways yet. Agreements on scope, approach, and priorities will appear here after standup.</p>
        ) : (
          <ul className="decisions-list decisions-list--takeaways">
            {decisionsInterp.items.map((d) => (
              <li key={d.id} className="decisions-list-item decisions-list-item--takeaway">
                <span className="decisions-text">{d.text}</span>
                <div className="decisions-meta">
                  <span className="decisions-by">Agreed by {d.decidedBy}</span>
                  <span className="decisions-date">{d.date}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
        </div>
        )}
      </div>
      </main>
    </div>
  )
}
