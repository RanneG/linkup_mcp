// Mock data for Results Dashboard (demo only) — supports Team Lead / Team Member / Hackathon Host privacy rules

export const DEMO_TEAM_NAME = 'Lucky Charm'

/** Replaced at runtime with the real team lead’s displayName from the roster (localStorage). */
export const MOCK_ROSTER_LEAD_TOKEN = '__ROSTER_TEAM_LEAD__'

export function resolveMockLeadName(leadDisplayName) {
  const s = (leadDisplayName || '').trim()
  return s || 'Team lead'
}

/** Swap token fields on a mock row for the roster lead name (or “Team lead” if missing). */
export function applyMockLeadToken(row, fieldNames, leadDisplayNameRaw) {
  const ln = resolveMockLeadName(leadDisplayNameRaw)
  const next = { ...row }
  for (const f of fieldNames) {
    if (next[f] === MOCK_ROSTER_LEAD_TOKEN) next[f] = ln
  }
  return next
}

export function mapMockRowsWithLead(rows, fieldNames, leadDisplayNameRaw) {
  return rows.map((r) => applyMockLeadToken(r, fieldNames, leadDisplayNameRaw))
}

export const teamLeadSummary = {
  teamVelocity: '14 pts',
  activeBlockers: 6,
  decisionsMade: 15,
}

/** Team Lead: full team picture — Lucky Charm story arc (execution-phase blockers + earlier context) */
export const teamLeadNamedBlockers = [
  { id: 'b1', team: DEMO_TEAM_NAME, title: 'integration: Phala attestation — enclave verification failing', context: 'Blocking staging deployment and integration tests', since: '2 days', reportedBy: 'Jordan Kim' },
  { id: 'b2', team: DEMO_TEAM_NAME, title: 'environment: Staging env flaky for nightly deploys', context: 'Nightly runs failing intermittently', since: '1 day', reportedBy: MOCK_ROSTER_LEAD_TOKEN },
  { id: 'b3', team: DEMO_TEAM_NAME, title: 'resource: Design tokens missing for mobile shell', since: '3 days', reportedBy: 'Sam Okonkwo' },
  { id: 'b4', team: DEMO_TEAM_NAME, title: 'integration: Plaid webhook sandbox credentials expiring', since: '1 day', reportedBy: 'Jordan Kim' },
  { id: 'b5', team: DEMO_TEAM_NAME, title: 'integration: TEE sandbox rate limits blocking integration tests', since: '2 days', reportedBy: 'Morgan Lee' },
  { id: 'b6', team: DEMO_TEAM_NAME, title: 'task: Documentation onboarding gap', since: '—', reportedBy: 'Morgan Lee' },
]

export const teamLeadActionItemsAll = [
  { id: 'a1', text: 'Finish OpenAPI spec for /transcript endpoint', context: 'Unblocks frontend upload integration', due: 'Tomorrow', assignee: MOCK_ROSTER_LEAD_TOKEN },
  { id: 'a2', text: 'Review PR #142 — Props filter keyword extraction', context: 'Props compliance depends on filter logic', due: 'Today', assignee: 'Jordan Kim' },
  { id: 'a3', text: 'Update TEE runbook for Phala deployment', due: 'This week', assignee: 'Sam Okonkwo' },
  { id: 'a4', text: 'Prep demo script for sponsor review', due: 'Friday', assignee: 'Morgan Lee' },
  { id: 'a5', text: 'API auth handoff — transcript upload flow', due: 'Tomorrow', assignee: MOCK_ROSTER_LEAD_TOKEN },
  { id: 'a6', text: 'Docs for onboarding — privacy policy + attestation', due: 'Friday', assignee: 'Sam Okonkwo' },
  { id: 'a7', text: 'DevPost submit', context: 'Final wrap-up', due: 'Today', assignee: MOCK_ROSTER_LEAD_TOKEN },
]

export const teamLeadDecisionsNamed = [
  { id: 'd1', text: 'REST for transcript upload; WebSocket only for live updates', context: 'Simplifies client integration and reduces latency', date: 'Mar 14', decidedBy: MOCK_ROSTER_LEAD_TOKEN },
  { id: 'd2', text: 'Blur speaker names in preview by default — privacy first', context: 'Aligns with Props policy and user expectations', date: 'Mar 13', decidedBy: 'Jordan Kim' },
  { id: 'd3', text: 'Ship MVP with mock + Live TEE toggle', date: 'Mar 12', decidedBy: 'Sam Okonkwo' },
  { id: 'd4', text: 'Scope demo to one bank — keep it simple', date: 'Mar 15', decidedBy: 'Morgan Lee' },
  { id: 'd5', text: 'Lucky Charm: capture blockers, actions, LLM-ready context', context: 'Concept lock', date: 'Mar 10', decidedBy: 'Morgan Lee' },
]

export const teamLeadMemberContributions = [
  { id: 'c1', memberName: MOCK_ROSTER_LEAD_TOKEN, summary: 'Led concept → goals → OpenAPI; Phala attestation spike' },
  { id: 'c2', memberName: 'Jordan Kim', summary: 'Props filter, privacy UX, blocker categories' },
  { id: 'c3', memberName: 'Sam Okonkwo', summary: 'Transcript pipeline, extract rules, TEE runbook' },
  { id: 'c4', memberName: 'Morgan Lee', summary: 'Demo script, design tokens, sponsor review' },
]

/** Cross-org — peer hackathon teams (Lucky Charm context) */
export const crossTeamBlockers = [
  { id: '1', team: 'Alpha', title: 'Phala enclave attestation verification', since: '2 days', reportedBy: '—' },
  { id: '2', team: 'Beta', title: 'Waiting on design tokens for mobile', since: '1 day', reportedBy: '—' },
  { id: '3', team: 'Gamma', title: 'Staging env down for TEE deployment', since: '4 hours', reportedBy: '—' },
  { id: '4', team: 'Alpha', title: 'Transcript format parsing — tab vs JSON', since: '1 day', reportedBy: '—' },
  { id: '5', team: 'Delta', title: 'Props filter documentation gap', since: '3 days', reportedBy: '—' },
]

/** Velocity reflects Lucky Charm story arc: no plan → concept → goals → planning → execution → finished */
export const velocityOverTime = [
  { week: 'W1', value: 4 },
  { week: 'W2', value: 7 },
  { week: 'W3', value: 10 },
  { week: 'W4', value: 12 },
  { week: 'W5', value: 14 },
  { week: 'W6', value: 14 },
]

/** Mock velocity API response — mirrors GET /velocity?team_id= shape for future integration */
export const mockVelocityData = {
  currentSprint: {
    sprint: 'W6',
    points: 14,
    goal: 14,
    completed: 4, // points done "this week" in current sprint (in-progress)
    label: 'Sprint 6 — Mar 18–22',
  },
  trend: velocityOverTime.map((d) => ({ sprint: d.week, points: d.value })),
  avgVelocity: 10,
  source: 'demo',
}

/**
 * Contextual velocity mock based on actual teeResult (meetings processed).
 * Uses actions + decisions from transcript as output proxy; scales trend to session count.
 */
export function getVelocityDataForDemo(teeResult) {
  const sessionCount = teeResult?.sessions?.length ?? 0
  const actionCount = (teeResult?.action_items ?? []).length
  const decisionCount = (teeResult?.decisions ?? []).length
  const outputThisMeeting = actionCount + decisionCount

  if (sessionCount === 0 || (!teeResult && outputThisMeeting === 0)) {
    return mockVelocityData
  }

  const base = Math.max(outputThisMeeting, 2)
  const sprintTotal = Math.min(14, Math.max(base + 6, 10))
  const completed = Math.min(outputThisMeeting, sprintTotal)

  const trend =
    sessionCount === 1
      ? [
          { sprint: 'W4', points: Math.max(4, base - 4) },
          { sprint: 'W5', points: Math.max(6, base - 2) },
          { sprint: 'W6', points: sprintTotal },
        ]
      : sessionCount <= 3
        ? [
            { sprint: 'W4', points: base },
            { sprint: 'W5', points: base + 2 },
            { sprint: 'W6', points: sprintTotal },
          ]
        : velocityOverTime.map((d) => ({ sprint: d.week, points: d.value }))

  return {
    currentSprint: {
      sprint: 'W6',
      points: sprintTotal,
      goal: sprintTotal,
      completed,
      label: `Sprint 6 — ${sessionCount} meeting${sessionCount !== 1 ? 's' : ''} processed`,
    },
    trend,
    avgVelocity: Math.round(trend.reduce((s, d) => s + d.points, 0) / trend.length),
    source: 'demo',
    sessionCount,
    outputProxy: outputThisMeeting,
  }
}

export const teamsThatNeedHelp = [
  { team: 'Alpha', blockerCount: 2 },
  { team: 'Delta', blockerCount: 1 },
  { team: 'Beta', blockerCount: 1 },
  { team: 'Gamma', blockerCount: 1 },
]

// ——— Hackathon Host: aggregates only (no action items; names anonymized in UI) ———

export const hackathonVelocityByTeam = [
  { team: 'Alpha', points: 14 },
  { team: 'Beta', points: 11 },
  { team: 'Gamma', points: 9 },
  { team: 'Delta', points: 7 },
  { team: 'Epsilon', points: 6 },
]

/** Average story points across teams (demo) */
export const hackathonAverageVelocity =
  hackathonVelocityByTeam.reduce((s, t) => s + t.points, 0) / hackathonVelocityByTeam.length

/** Thematic clusters — Lucky Charm hackathon teams */
export const hackathonCommonBlockerThemes = [
  { id: 't1', label: 'TEE / Phala attestation & enclave', teamCount: 3, blurb: '3 teams blocked on enclave verification or attestation' },
  { id: 't2', label: 'Transcript pipeline & Props filter', teamCount: 2, blurb: '2 teams stuck on format parsing or privacy filter' },
  { id: 't3', label: 'Design / staging & deploy', teamCount: 2, blurb: '2 teams waiting on tokens or staging stability' },
]

export const hackathonTeamsRankedByBlockers = [
  { team: 'Alpha', blockerCount: 4 },
  { team: 'Delta', blockerCount: 3 },
  { team: 'Beta', blockerCount: 2 },
  { team: 'Gamma', blockerCount: 2 },
  { team: 'Epsilon', blockerCount: 1 },
]

export const hackathonAnonymizedBlockers = [
  { id: 'hb1', team: 'Alpha', summary: 'Phala enclave — attestation verification', since: '2 days' },
  { id: 'hb2', team: 'Beta', summary: 'Props filter — keyword extraction delay', since: '1 day' },
  { id: 'hb3', team: 'Gamma', summary: 'TEE staging — deployment pipeline', since: '4 hours' },
  { id: 'hb4', team: 'Delta', summary: 'Transcript format — tab vs JSON', since: '3 days' },
  { id: 'hb5', team: 'Epsilon', summary: 'Privacy policy docs — onboarding gap', since: '6 hours' },
]

export const hackathonDecisionTrends = [
  { day: 'Mon', count: 3 },
  { day: 'Tue', count: 5 },
  { day: 'Wed', count: 4 },
  { day: 'Thu', count: 7 },
  { day: 'Fri', count: 6 },
  { day: 'Sat', count: 8 },
]

export const hackathonTeamsNeedingHelp = [
  { team: 'Delta', reason: 'Transcript format + Props filter gaps', blockerCount: 3 },
  { team: 'Alpha', reason: 'Multiple TEE attestation blockers', blockerCount: 4 },
  { team: 'Epsilon', reason: 'Privacy policy documentation', blockerCount: 1 },
]

// ——— Team Member: same team, names visible; “yours” determined by assignee/reporter match ———

export const teamMemberAllBlockers = [
  { id: 'mb1', title: 'integration: Phala attestation — enclave verification failing', status: 'In progress', reportedBy: 'Jordan Kim' },
  { id: 'mb2', title: 'environment: Staging env flaky for nightly deploys', status: 'In progress', reportedBy: MOCK_ROSTER_LEAD_TOKEN },
  { id: 'mb3', title: 'integration: TEE sandbox rate limits', status: 'Resolved', reportedBy: 'Sam Okonkwo' },
]

export const teamMemberActionItemsPooled = [
  { id: 'a1', text: 'Finish OpenAPI spec for /transcript endpoint', due: 'Tomorrow', assignee: MOCK_ROSTER_LEAD_TOKEN },
  { id: 'a2', text: 'Review PR #142 — Props filter', due: 'Today', assignee: 'Jordan Kim' },
  { id: 'a3', text: 'Update TEE runbook for Phala deployment', due: 'This week', assignee: 'Sam Okonkwo' },
  { id: 'a4', text: 'Prep demo script for sponsor review', due: 'Friday', assignee: 'Morgan Lee' },
  { id: 'a5', text: 'API auth handoff for transcript upload', due: 'Tomorrow', assignee: MOCK_ROSTER_LEAD_TOKEN },
  { id: 'a6', text: 'DevPost submit', due: 'Today', assignee: MOCK_ROSTER_LEAD_TOKEN },
]

export const teamMemberDecisions = [
  { id: 'd1', text: 'REST for transcript upload; WebSocket for live updates', date: 'Mar 14', decidedBy: MOCK_ROSTER_LEAD_TOKEN },
  { id: 'd2', text: 'Blur speaker names in preview — privacy first', date: 'Mar 13', decidedBy: 'Jordan Kim' },
  { id: 'd3', text: 'Ship MVP with mock + Live TEE toggle', date: 'Mar 12', decidedBy: 'Sam Okonkwo' },
  { id: 'd4', text: 'Scope demo to one bank', date: 'Mar 15', decidedBy: 'Morgan Lee' },
  { id: 'd5', text: 'Lucky Charm: capture blockers, actions, LLM context', date: 'Mar 10', decidedBy: 'Morgan Lee' },
]

/** Legacy exports used elsewhere */
export const myActionItems = teamMemberActionItemsPooled
export const myReportedBlockers = [
  { id: 'b1', title: 'integration: Phala attestation verification', status: 'In progress' },
  { id: 'b2', title: 'integration: TEE sandbox rate limits', status: 'Resolved' },
]
export const myTeamDecisions = teamMemberDecisions
