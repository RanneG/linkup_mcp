/**
 * Build Host console charts from lucky-charm-transcripts records.
 */

const BLOCKER_BUCKETS = [
  { id: 'api', label: 'API / rate limits & integrations', keywords: ['api', 'rate', 'integration', 'endpoint', 'rest'] },
  { id: 'env', label: 'Environments & deploy pipeline', keywords: ['staging', 'ci', 'deploy', 'pipeline', 'env', 'nightly'] },
  { id: 'design', label: 'Design / UX handoff', keywords: ['design', 'token', 'mobile', 'ux', 'shell'] },
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * @param {Array<{ teamId: string, teamName?: string, timestamp: number, velocity: number, blockers?: any[], decisions?: any[] }>} transcripts
 * @param {Record<string, string>} [teamNameById] fresh names from lucky-charm-teams
 */
export function buildHostAggregatesFromTranscripts(transcripts, teamNameById = {}) {
  const list = Array.isArray(transcripts) ? transcripts : []
  if (list.length === 0) {
    return {
      hasData: false,
      averageVelocity: 0,
      averageVelocityPerTranscript: 0,
      velocityByTeam: [],
      blockerThemes: [],
      teamsRankedByBlockers: [],
      decisionTrends: [],
      totalTranscripts: 0,
      totalBlockers: 0,
      totalDecisions: 0,
    }
  }

  const byTeam = new Map()
  for (const t of list) {
    const id = t.teamId
    const name = (teamNameById[id] || t.teamName || 'Team').trim() || 'Team'
    if (!byTeam.has(id)) {
      byTeam.set(id, {
        teamId: id,
        teamName: name,
        velocitySum: 0,
        transcriptCount: 0,
        blockerCount: 0,
      })
    }
    const row = byTeam.get(id)
    row.velocitySum += typeof t.velocity === 'number' ? t.velocity : 0
    row.transcriptCount += 1
    row.blockerCount += Array.isArray(t.blockers) ? t.blockers.length : 0
    if (teamNameById[id]) row.teamName = teamNameById[id]
  }

  const velocitySumAll = list.reduce((s, t) => s + (typeof t.velocity === 'number' ? t.velocity : 0), 0)
  /** Mean of each team’s average velocity (fair when upload counts differ). */
  const teamRows = [...byTeam.values()]
  const teamAvgVelocities = teamRows.map((r) =>
    r.transcriptCount > 0 ? r.velocitySum / r.transcriptCount : 0
  )
  const averageVelocityAcrossTeams =
    teamAvgVelocities.length > 0
      ? teamAvgVelocities.reduce((a, b) => a + b, 0) / teamAvgVelocities.length
      : 0
  const averageVelocityPerTranscript = velocitySumAll / list.length

  const velocityByTeam = [...byTeam.values()]
    .map((r) => ({ team: r.teamName, teamId: r.teamId, points: Math.round(r.velocitySum * 10) / 10 }))
    .sort((a, b) => b.points - a.points)

  const allBlockers = list.flatMap((t) => (Array.isArray(t.blockers) ? t.blockers : []))
  const blockerThemes = buildBlockerThemes(allBlockers)

  const teamsRankedByBlockers = [...byTeam.values()]
    .map((r) => ({
      team: r.teamName,
      teamId: r.teamId,
      blockerCount: r.blockerCount,
    }))
    .sort((a, b) => b.blockerCount - a.blockerCount)

  const decisionTrends = buildDecisionTrends(list)

  const totalDecisions = list.reduce((s, t) => s + (Array.isArray(t.decisions) ? t.decisions.length : 0), 0)

  return {
    hasData: true,
    averageVelocity: Math.round(averageVelocityAcrossTeams * 10) / 10,
    averageVelocityPerTranscript: Math.round(averageVelocityPerTranscript * 10) / 10,
    velocityByTeam,
    blockerThemes,
    teamsRankedByBlockers,
    decisionTrends,
    totalTranscripts: list.length,
    totalBlockers: allBlockers.length,
    totalDecisions,
  }
}

function buildBlockerThemes(blockers) {
  const counts = new Map(BLOCKER_BUCKETS.map((b) => [b.id, 0]))
  for (const b of blockers) {
    const text = `${b.title ?? b.description ?? ''}`.toLowerCase()
    for (const buck of BLOCKER_BUCKETS) {
      if (buck.keywords.some((k) => text.includes(k))) {
        counts.set(buck.id, (counts.get(buck.id) || 0) + 1)
      }
    }
  }
  return BLOCKER_BUCKETS.map((b) => {
    const c = counts.get(b.id) || 0
    return {
      id: b.id,
      label: b.label,
      blurb: c > 0 ? `${c} signal${c === 1 ? '' : 's'} across uploaded transcripts` : null,
      count: c,
    }
  }).filter((x) => x.count > 0)
}

function buildDecisionTrends(transcripts) {
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const t of transcripts) {
    const ts = t.timestamp
    if (typeof ts !== 'number') continue
    const w = new Date(ts).getDay()
    counts[w] += Array.isArray(t.decisions) ? t.decisions.length : 0
  }
  const order = [1, 2, 3, 4, 5, 6, 0]
  return order.map((dayIdx) => ({
    day: DAY_LABELS[dayIdx],
    count: counts[dayIdx],
  }))
}
