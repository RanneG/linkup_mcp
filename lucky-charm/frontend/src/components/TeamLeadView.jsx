import { useMemo, useState, useEffect } from 'react'
import {
  teamLeadSummary,
  DEMO_TEAM_NAME,
  mapMockRowsWithLead,
  teamLeadNamedBlockers,
  teamLeadActionItemsAll,
  teamLeadDecisionsNamed,
  teamLeadMemberContributions,
  crossTeamBlockers,
  velocityOverTime,
  getVelocityDataForDemo,
  teamsThatNeedHelp,
} from '../data/dashboardMock'
import {
  generateSummary,
  generateStorySummary,
  generateInsights,
  getBlockerByCategory,
  getActionsByDueDate,
  getBlockerStatusBreakdown,
  getTrajectoryData,
  bucketDue,
  generateActionsInterpretation,
  generateBlockersInterpretation,
  generateDecisionsInterpretation,
} from '../utils/dashboardInsights'
import { DASHBOARD_TAB_CHANGE } from './SecurityConcierge'
import TeamLeadTeeSettings from './TeamLeadTeeSettings'
import TrajectoryChart from './TrajectoryChart'
import './TeamLeadView.css'

function normalizeBlockersLead(teeBlockers, teamLabel) {
  if (!Array.isArray(teeBlockers) || teeBlockers.length === 0) return []
  return teeBlockers.map((b, i) => ({
    id: b.id ?? `b-${i}`,
    team: b.team ?? teamLabel,
    title: b.title ?? b.description ?? 'Blocker',
    since: b.since ?? b.created_at ?? '—',
    reportedBy: b.reported_by ?? b.reportedBy ?? 'Team member',
    status: b.status ?? 'In progress',
    context: b.context ?? null,
  }))
}

function normalizeActionsLead(teeActions) {
  if (!Array.isArray(teeActions) || teeActions.length === 0) return []
  return teeActions.map((a, i) => ({
    id: a.id ?? `a-${i}`,
    text: a.text ?? a.title ?? a.description ?? 'Action item',
    due: a.due ?? a.due_date ?? '—',
    assignee: a.assignee ?? 'Unassigned',
    context: a.context ?? null,
  }))
}

function normalizeDecisionsLead(teeDecisions) {
  if (!Array.isArray(teeDecisions) || teeDecisions.length === 0) return []
  return teeDecisions.map((d, i) => ({
    id: d.id ?? `d-${i}`,
    text: d.text ?? d.title ?? d.description ?? 'Decision',
    date: d.date ?? d.created_at ?? '—',
    decidedBy: d.decided_by ?? d.decidedBy ?? 'Team',
    context: d.context ?? null,
  }))
}

function deriveTeamsThatNeedHelp(blockers) {
  const byTeam = {}
  for (const b of blockers) {
    const t = b.team || 'Other'
    byTeam[t] = (byTeam[t] || 0) + 1
  }
  return Object.entries(byTeam)
    .map(([team, blockerCount]) => ({ team, blockerCount }))
    .sort((a, b) => b.blockerCount - a.blockerCount)
}

/** Simple bar for horizontal bar chart — labels clickable when onLabelClick provided */
function BarChart({ data, maxVal, color = 'var(--accent)', height = 12, onLabelClick }) {
  const m = maxVal || Math.max(...data.map((d) => d.count), 1)
  const label = (item) => item.name ?? item.label ?? ''
  return (
    <div className="ai-chart-bars">
      {data.map((item, i) => (
        <div key={label(item) || i} className="ai-chart-row">
          {onLabelClick ? (
            <button
              type="button"
              className="ai-chart-label ai-chart-label--clickable"
              onClick={() => onLabelClick(label(item))}
            >
              {label(item)}
            </button>
          ) : (
            <span className="ai-chart-label">{label(item)}</span>
          )}
          <div className="ai-chart-bar-wrap">
            <div
              className="ai-chart-bar"
              style={{
                width: `${(item.count / m) * 100}%`,
                background: item.color ?? color,
                height: `${height}px`,
              }}
            />
          </div>
          <span className="ai-chart-value">{item.count}</span>
        </div>
      ))}
    </div>
  )
}

/** Donut chart - status breakdown */
function DonutChart({ data, size = 80 }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) return <div className="ai-donut-empty">No data</div>

  let acc = 0
  const segments = data.map((d) => {
    const pct = (d.count / total) * 100
    const start = acc
    acc += pct
    return { ...d, pct, start }
  })

  const stroke = 12
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r

  return (
    <svg className="ai-donut" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => (
        <circle
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth={stroke}
          strokeDasharray={`${(seg.pct / 100) * circ} ${circ}`}
          strokeDashoffset={-(seg.start / 100) * circ}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ))}
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle" className="ai-donut-center">
        {total}
      </text>
    </svg>
  )
}

/** Format summary with bold markers */
function formatSummary(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  )
}

export default function TeamLeadView({ teeResult, teamName, teamMembers = [], aggregates = null }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedDueFilter, setSelectedDueFilter] = useState(null)
  const [selectedSessionIdx, setSelectedSessionIdx] = useState(null)

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(DASHBOARD_TAB_CHANGE, { detail: { tab: activeTab } }))
  }, [activeTab])

  const displayTeamName = (teamName || '').trim() || DEMO_TEAM_NAME
  const useTee = Boolean(teeResult)

  const rosterLeadRaw = useMemo(() => {
    const lead = teamMembers.find((m) => m.role === 'team-lead')
    return lead?.displayName ?? ''
  }, [teamMembers])

  const filteredBySession = useMemo(() => {
    if (!useTee || selectedSessionIdx == null) return null
    const match = (item) => (item._sessionIdx ?? 0) === selectedSessionIdx
    return {
      blockers: (teeResult.blockers ?? []).filter(match),
      action_items: (teeResult.action_items ?? []).filter(match),
      decisions: (teeResult.decisions ?? []).filter(match),
    }
  }, [useTee, teeResult?.blockers, teeResult?.action_items, teeResult?.decisions, selectedSessionIdx])

  const teeBlockers = useTee
    ? (filteredBySession?.blockers ?? teeResult.blockers ?? [])
    : null
  const teeActions = useTee
    ? (filteredBySession?.action_items ?? teeResult.action_items ?? [])
    : null
  const teeDecisions = useTee
    ? (filteredBySession?.decisions ?? teeResult.decisions ?? [])
    : null

  const blockersTeam = useTee
    ? normalizeBlockersLead(teeBlockers, displayTeamName)
    : mapMockRowsWithLead(
        teamLeadNamedBlockers.map((b) => ({ ...b, team: displayTeamName })),
        ['reportedBy'],
        rosterLeadRaw,
      )
  const actionItems = useTee
    ? normalizeActionsLead(teeActions)
    : mapMockRowsWithLead(teamLeadActionItemsAll, ['assignee'], rosterLeadRaw)
  const decisions = useTee
    ? normalizeDecisionsLead(teeDecisions)
    : mapMockRowsWithLead(teamLeadDecisionsNamed, ['decidedBy'], rosterLeadRaw)

  const orgBlockers = useTee ? normalizeBlockersLead(teeBlockers, displayTeamName) : crossTeamBlockers
  const teamsHelp = useTee && orgBlockers.length > 0 ? deriveTeamsThatNeedHelp(orgBlockers) : teamsThatNeedHelp
  const activeBlockers = blockersTeam.length

  const memberContributions = useMemo(() => {
    if (Array.isArray(teamMembers) && teamMembers.length > 0) {
      return teamMembers.map((m) => ({
        id: m.memberId,
        memberName: m.displayName?.trim() || m.memberId,
        summary:
          m.role === 'team-lead'
            ? 'Team Lead — coordination, join codes, and TEE settings'
            : 'Team Member — delivery on squad action items',
      }))
    }
    return mapMockRowsWithLead(teamLeadMemberContributions, ['memberName'], rosterLeadRaw)
  }, [teamMembers, rosterLeadRaw])

  const summary = useMemo(
    () =>
      generateSummary({
        blockers: blockersTeam,
        actionItems,
        decisions,
        sessions: teeResult?.sessions,
      }),
    [blockersTeam, actionItems, decisions, teeResult?.sessions],
  )

  const storySummary = useMemo(
    () =>
      generateStorySummary({
        blockers: blockersTeam,
        actionItems,
        decisions,
        sessions: teeResult?.sessions,
      }),
    [blockersTeam, actionItems, decisions, teeResult?.sessions],
  )

  const insights = useMemo(
    () => generateInsights({ blockers: blockersTeam, actionItems, decisions }),
    [blockersTeam, actionItems, decisions],
  )

  const blockerCategories = useMemo(() => getBlockerByCategory(blockersTeam), [blockersTeam])
  const actionsByDue = useMemo(() => getActionsByDueDate(actionItems), [actionItems])
  const blockerStatus = useMemo(() => getBlockerStatusBreakdown(blockersTeam), [blockersTeam])
  const trajectoryData = useMemo(
    () =>
      getTrajectoryData(
        teeResult?.sessions,
        { decisions: decisions.length, actions: actionItems.length },
        velocityOverTime,
      ),
    [teeResult?.sessions, decisions.length, actionItems.length],
  )

  const filteredActionItems = useMemo(() => {
    if (!selectedDueFilter) return actionItems
    return actionItems.filter((a) => bucketDue(a.due) === selectedDueFilter)
  }, [actionItems, selectedDueFilter])

  const actionsInterp = useMemo(() => generateActionsInterpretation(actionItems), [actionItems])
  const blockersInterp = useMemo(() => generateBlockersInterpretation(blockersTeam), [blockersTeam])
  const decisionsInterp = useMemo(() => generateDecisionsInterpretation(decisions), [decisions])

  const handleDueLabelClick = (label) => {
    setSelectedDueFilter(label)
    setActiveTab('actions')
  }

  const leadTabs = [
    { id: 'overview', label: 'Overview', count: null },
    { id: 'metrics', label: 'Metrics', count: null },
    { id: 'actions', label: 'Actions', count: actionItems.length },
    { id: 'blockers', label: 'Blockers', count: blockersTeam.length },
    { id: 'decisions', label: 'Takeaways', count: decisions.length },
  ]

  return (
    <div className="team-lead-view ai-dashboard team-lead-fit">
      <div className="dashboard-with-sidebar">
      <aside className="dashboard-sidebar" aria-label="Sections">
        <h3 className="dashboard-sidebar-title">Sections</h3>
        <nav className="dashboard-sidebar-nav" role="navigation">
          {leadTabs.map((t) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
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
          <div>
            <h2 className="team-lead-team-name">{displayTeamName}</h2>
            <p className="team-lead-team-sub">Team Lead — synthesized view from standup data</p>
          </div>
        </header>

        {/* Active filter tags — removable */}
        {activeTab === 'actions' && selectedDueFilter && (
          <div className="dashboard-filter-tags">
            <span className="dashboard-filter-tag">
              {selectedDueFilter}
              <button type="button" className="dashboard-filter-tag-remove" onClick={() => setSelectedDueFilter(null)} aria-label={`Remove ${selectedDueFilter} filter`}>×</button>
            </span>
          </div>
        )}

        {/* Project story + AI Summary + Insights — overview only */}
        {activeTab === 'overview' && (
          <div className="team-lead-top-row">
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
            <section className="ai-summary-card ai-summary-card--compact">
              <div className="ai-summary-icon" aria-hidden>◉</div>
              <div className="ai-summary-content">
                <h3 className="ai-summary-title">Summary</h3>
                <p className="ai-summary-text">{formatSummary(summary)}</p>
              </div>
            </section>
            {insights.length > 0 && (
              <section className="ai-insights-card ai-insights-card--compact">
                <h3 className="ai-insights-title">Key insights</h3>
                <ul className="ai-insights-list">
                  {insights.map((ins, i) => (
                    <li key={i} className={`ai-insight ai-insight--${ins.type}`}>
                      {ins.text}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {/* Sessions timeline — overview only */}
        {activeTab === 'overview' && useTee && teeResult.sessions?.length > 1 && (
          <section className="ai-section ai-sessions-section">
            <h3 className="ai-section-title">Meetings processed</h3>
            {selectedSessionIdx != null && teeResult.sessions[selectedSessionIdx] && (
              <p className="ai-sessions-focus">
                Viewing meeting {selectedSessionIdx + 1}: {(teeResult.sessions[selectedSessionIdx].filename ?? 'transcript').replace(/\.tab$/i, '')}
                {' — '}
                <button type="button" className="ai-sessions-clear" onClick={() => setSelectedSessionIdx(null)}>
                  show all
                </button>
              </p>
            )}
            <div className="ai-sessions-pills" role="tablist" aria-label="Select meeting">
              {teeResult.sessions.map((s, i) => {
                const sessionCount = teeResult.sessions.length
                const label = sessionCount > 8 ? `M${i + 1}` : `${i + 1}. ${(s.filename ?? '').replace(/\.tab$/i, '')}`
                return (
                  <button
                    key={s.id ?? i}
                    type="button"
                    className={`ai-session-pill ${selectedSessionIdx === i ? 'ai-session-pill--active' : ''}`}
                    onClick={() => setSelectedSessionIdx(selectedSessionIdx === i ? null : i)}
                    role="tab"
                    aria-selected={selectedSessionIdx === i}
                    title={s.filename ? `Meeting ${i + 1}: ${s.filename}` : undefined}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </section>
        )}

      {/* Tab panels */}
      <div className="dashboard-tab-panels dashboard-tab-panels--lead">
        {activeTab === 'overview' && (
        <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className="dashboard-tab-panel">
      {/* Charts — trajectory + bar/donut/velocity adjacent */}
      <div className="ai-charts-grid">
        <section className="ai-section ai-trajectory-card ai-chart-card">
          <h3 className="ai-section-title">Project trajectory</h3>
          <p className="ai-trajectory-desc">Cumulative decisions and action items over time — track your momentum</p>
          <TrajectoryChart data={trajectoryData} height={260} />
        </section>
        <section className="ai-section ai-chart-card">
          <h3 className="ai-section-title">Blockers by theme</h3>
          {blockerCategories.length > 0 ? (
            <BarChart data={blockerCategories} maxVal={Math.max(...blockerCategories.map((d) => d.count), 1)} />
          ) : (
            <p className="ai-chart-empty">No blockers</p>
          )}
        </section>

        <section className="ai-section ai-chart-card">
          <h3 className="ai-section-title">Actions by due date — click to filter</h3>
          {actionsByDue.length > 0 ? (
            <BarChart
              data={actionsByDue.map((d) => ({ ...d, name: d.label }))}
              maxVal={Math.max(...actionsByDue.map((d) => d.count), 1)}
              color="rgba(52, 211, 153, 0.8)"
              onLabelClick={handleDueLabelClick}
            />
          ) : (
            <p className="ai-chart-empty">No action items</p>
          )}
        </section>

        <section className="ai-section ai-chart-card ai-chart-card--donut">
          <h3 className="ai-section-title">Blocker status</h3>
          {blockerStatus.length > 0 ? (
            <div className="ai-donut-wrap">
              <DonutChart data={blockerStatus} size={120} />
              <div className="ai-donut-legend">
                {blockerStatus.map((s, i) => (
                  <span key={i} className="ai-donut-legend-item">
                    <span className="ai-donut-dot" style={{ background: s.color }} />
                    {s.label}: {s.count}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="ai-chart-empty">No blockers</p>
          )}
        </section>

        {aggregates?.data?.length > 0 && (
          <section className="ai-section ai-chart-card ai-aggregates-card">
            <h3 className="ai-section-title">Participant trend (you)</h3>
            <p className="ai-aggregates-desc">Blockers, actions, and decisions over time — from your submissions</p>
            <div className="ai-aggregates-chart">
              {aggregates.data.map((row) => {
                const total = row.blocker_count + row.action_count + row.decision_count || 1
                const pctB = (row.blocker_count / total) * 100
                const pctA = (row.action_count / total) * 100
                const pctD = (row.decision_count / total) * 100
                const shortDate = row.date.slice(5)
                return (
                  <div key={row.date} className="ai-aggregates-row">
                    <span className="ai-aggregates-date" title={row.date}>{shortDate}</span>
                    <div className="ai-aggregates-bar-wrap" title={`${row.blocker_count} blockers, ${row.action_count} actions, ${row.decision_count} decisions`}>
                      <div className="ai-aggregates-segment ai-aggregates-segment--blockers" style={{ width: `${pctB}%` }} />
                      <div className="ai-aggregates-segment ai-aggregates-segment--actions" style={{ width: `${pctA}%` }} />
                      <div className="ai-aggregates-segment ai-aggregates-segment--decisions" style={{ width: `${pctD}%` }} />
                    </div>
                    <span className="ai-aggregates-legend">
                      {row.blocker_count}B {row.action_count}A {row.decision_count}D
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>

      {/* Teams needing help — cross-team blockers; click badge to view Blockers tab */}
      {teamsHelp.length > 0 && (
        <section className="ai-section ai-teams-need-help">
          <h3 className="ai-section-title">Teams that need help</h3>
          <p className="ai-teams-need-help-desc">Teams with blockers — click to view in Blockers tab</p>
          <div className="ai-teams-badges">
            {teamsHelp.map((t) => (
              <button key={t.team} type="button" className="ai-team-badge ai-team-badge--clickable" title={`View ${t.team} blockers`} onClick={() => setActiveTab('blockers')}>
                {t.team} · {t.blockerCount} blocker{t.blockerCount !== 1 ? 's' : ''}
              </button>
            ))}
          </div>
        </section>
      )}
        </div>
        )}

        {activeTab === 'metrics' && (() => {
          const velocityData = getVelocityDataForDemo(teeResult)
          const velocityMax = Math.max(...velocityData.trend.map((d) => d.points), 1)
          const meetingCount = velocityData.sessionCount ?? teeResult?.sessions?.length ?? 0
          const descText = meetingCount > 0
            ? `${meetingCount} meeting${meetingCount !== 1 ? 's' : ''} processed — output proxy from actions + decisions (real velocity from Jira in production)`
            : 'Story points by sprint — demo data (would come from Jira/manual input in production)'
          return (
        <div id="panel-metrics" role="tabpanel" aria-labelledby="tab-metrics" className="dashboard-tab-panel">
          <section className="ai-section ai-metrics-section">
            <div className="ai-metrics-velocity-card">
              <div className="ai-metrics-velocity-row">
                <div className="ai-metrics-velocity-kpi">
                  <span className="ai-metrics-velocity-value">{velocityData.currentSprint.points} pts</span>
                  <span className="ai-metrics-velocity-label">Current sprint</span>
                </div>
                <div className="ai-metrics-velocity-this-week">
                  <span className="ai-metrics-velocity-label">This week</span>
                  <div className="ai-metrics-velocity-progress-wrap">
                    <div
                      className="ai-metrics-velocity-progress"
                      style={{ width: `${((velocityData.currentSprint.completed / velocityData.currentSprint.goal) || 0) * 100}%` }}
                    />
                    <span className="ai-metrics-velocity-progress-value">{velocityData.currentSprint.completed}</span>
                  </div>
                </div>
              </div>
              <div className="ai-metrics-velocity-chart-wrap">
                <h3 className="ai-section-title">Velocity trend</h3>
                <p className="ai-metrics-velocity-desc">{descText}</p>
                <div className="velocity-chart">
                  {velocityData.trend.map((d) => (
                    <div key={d.sprint} className="velocity-bar-wrap">
                      <div
                        className="velocity-bar"
                        style={{ height: `${(d.points / velocityMax) * 100}%` }}
                        title={`${d.sprint}: ${d.points} pts`}
                      />
                      <span className="velocity-label">{d.sprint}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
          )
        })()}

        {activeTab === 'actions' && (
        <div id="panel-actions" role="tabpanel" aria-labelledby="tab-actions" className="dashboard-tab-panel">
      <section className="ai-interpreted-section">
        <div className="ai-interpreted-summary ai-interpreted-summary--actions">
          <span className="ai-interpreted-badge">AI summary</span>
          <p className="ai-interpreted-text">{formatSummary(actionsInterp.summary)}</p>
        </div>
        {actionsByDue.length > 0 && (
          <div className="ai-detail-filter-pills">
            <button type="button" className={`ai-detail-filter-pill ${!selectedDueFilter ? 'ai-detail-filter-pill--active' : ''}`} onClick={() => setSelectedDueFilter(null)}>
              All ({actionItems.length})
            </button>
            {actionsByDue.map((d) => (
              <button
                key={d.label}
                type="button"
                className={`ai-detail-filter-pill ${selectedDueFilter === d.label ? 'ai-detail-filter-pill--active' : ''}`}
                onClick={() => setSelectedDueFilter(d.label)}
              >
                {d.label} ({d.count})
              </button>
            ))}
          </div>
        )}
        <ul className="tl-actions-list tl-actions-list--interpreted">
          {(selectedDueFilter ? actionsInterp.items.filter((a) => bucketDue(a.due) === selectedDueFilter) : actionsInterp.items).map((item) => (
            <li key={item.id} className="tl-actions-item tl-actions-item--interpreted">
              <div className="tl-actions-main">
                <span className="tl-actions-text">{item.text}</span>
                <div className="tl-actions-meta">
                  <span className="tl-actions-assignee">
                    <span className="tl-blockers-label">Assigned to</span> {item.assignee}
                  </span>
                  <span className="tl-actions-due">{item.due}</span>
                </div>
              </div>
              <p className="tl-actions-interpretation">{item.interpretation}</p>
            </li>
          ))}
        </ul>
      </section>
      {filteredActionItems.length === 0 && actionItems.length > 0 && selectedDueFilter && (
        <p className="dashboard-empty-filter">
          No action items due <strong>{selectedDueFilter}</strong>. Try another filter.
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
        <ul className="tl-blockers-list tl-blockers-list--interpreted">
          {blockersInterp.items.map((b) => (
            <li key={b.id} className="tl-blockers-row tl-blockers-row--interpreted">
              <span className="tl-blockers-team">{b.team}</span>
              <span className="tl-blockers-title">{b.title}</span>
              <p className="tl-blockers-interpretation">{b.interpretation}</p>
              <span className="tl-blockers-meta">
                <span className="tl-blockers-label">Reported by</span> {b.reportedBy} · {b.since}
              </span>
            </li>
          ))}
        </ul>
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
        <ul className="tl-decisions-list tl-decisions-list--takeaways">
          {decisionsInterp.items.map((d) => (
            <li key={d.id} className="tl-decisions-item tl-decisions-item--takeaway">
              <span className="tl-decisions-text">{d.text}</span>
              <div className="tl-decisions-meta">
                <span>
                  <span className="tl-blockers-label">Agreed by</span> {d.decidedBy}
                </span>
                <span className="tl-decisions-date">{d.date}</span>
              </div>
            </li>
          ))}
        </ul>
        {decisions.length === 0 && (
          <p className="team-member-empty">No takeaways yet. Agreements on scope, approach, and priorities will appear here after standup.</p>
        )}
      </section>
      <section className="ai-section">
        <h3 className="ai-section-title">Who drove what</h3>
        <ul className="tl-contrib-list">
          {memberContributions.map((c) => (
            <li key={c.id} className="tl-contrib-item">
              <span className="tl-contrib-name">{c.memberName}</span>
              <span className="tl-contrib-summary">{c.summary}</span>
            </li>
          ))}
        </ul>
      </section>
        </div>
        )}
      </div>
      </main>
      </div>
      <TeamLeadTeeSettings />
    </div>
  )
}
