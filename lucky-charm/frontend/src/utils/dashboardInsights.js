/**
 * Derive AI-style insights and chart data from dashboard data.
 * Used to generate summaries, themes, and visualizations.
 */

/** Extract category from title (e.g. "integration: Phala..." → "integration") */
function extractCategory(title) {
  if (!title || typeof title !== 'string') return 'other'
  const idx = title.indexOf(':')
  if (idx > 0) {
    const cat = title.slice(0, idx).trim().toLowerCase()
    return cat || 'other'
  }
  return 'other'
}

/** Parse "2 days", "1 day", "4 hours" into sortable age */
function parseSince(since) {
  if (!since || since === '—') return { days: 999, label: 'Unknown' }
  const s = String(since).toLowerCase()
  const dayMatch = s.match(/(\d+)\s*days?/)
  const hourMatch = s.match(/(\d+)\s*hours?/)
  if (dayMatch) return { days: parseInt(dayMatch[1], 10), label: since }
  if (s.includes('day') && !dayMatch) return { days: 1, label: since }
  if (hourMatch) return { days: 0, label: since }
  return { days: 999, label: since }
}

/** Bucket due date into timeframe — exported for filtering */
export function bucketDue(due) {
  if (!due) return 'Other'
  const d = String(due).toLowerCase()
  if (d.includes('today')) return 'Today'
  if (d.includes('tomorrow')) return 'Tomorrow'
  if (d.includes('this week') || d.includes('week')) return 'This week'
  if (d.includes('next week')) return 'Next week'
  if (d.includes('friday') || d.includes('monday') || d.includes('day')) return 'This week'
  return 'Later'
}

/**
 * Generate project story summary — where we are, where we're heading.
 * Aligns with Lucky Charm arc: no plan → concept → goals → planning → execution → finished.
 */
export function generateStorySummary({ blockers = [], actionItems = [], decisions = [], sessions = [] }) {
  const n = sessions?.length ?? 1
  const blockerCount = blockers.length
  const decisionCount = decisions.length
  const resolvedCount = blockers.filter((b) => /resolved/i.test(String(b.status ?? ''))).length

  let phase = ''
  let heading = ''

  if (n <= 2) {
    phase = 'Concept — defining the product and scope'
    heading = 'Lock goals and plan integration points'
  } else if (n <= 4) {
    phase = 'Planning — goals locked, integration points identified'
    heading = 'Execute and address blockers as they arise'
  } else if (blockerCount >= 4 && resolvedCount < 2) {
    phase = 'Execution — blockers in focus, team addressing them'
    heading = 'Resolve blockers and wrap decisions for delivery'
  } else if (decisionCount >= 4 && blockerCount <= 2) {
    phase = 'Delivery — decisions wrapped, momentum toward ship'
    heading = 'Demo prep and final follow-through'
  } else {
    phase = 'In progress — mixed planning and execution'
    heading = 'Track blockers, complete actions, lock remaining decisions'
  }

  return { phase, heading, meetingCount: n }
}

/** Generate AI-style executive summary */
export function generateSummary({ blockers = [], actionItems = [], decisions = [], sessions = [] }) {
  const meetingCount = sessions?.length ?? 1
  const blockerCount = blockers.length
  const actionCount = actionItems.length
  const decisionCount = decisions.length

  const categories = blockers.reduce((acc, b) => {
    const cat = extractCategory(b.title ?? b.description)
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})
  const topTheme = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'various'

  const urgentActions = actionItems.filter((a) =>
    /today|tomorrow/i.test(String(a.due ?? a.due_date ?? ''))
  ).length

  const parts = []
  parts.push(
    `Based on ${meetingCount} meeting${meetingCount !== 1 ? 's' : ''}, your team has **${blockerCount} active blocker${blockerCount !== 1 ? 's' : ''}**, **${actionCount} action item${actionCount !== 1 ? 's' : ''}**, and **${decisionCount} recorded decision${decisionCount !== 1 ? 's' : ''}**.`
  )
  if (blockerCount > 0) {
    parts.push(`Top concern: **${topTheme}** (${categories[topTheme]} ${topTheme}-related issues).`)
  }
  if (urgentActions > 0) {
    parts.push(`${urgentActions} item${urgentActions !== 1 ? 's' : ''} due today or tomorrow.`)
  }
  if (decisionCount > 0) {
    parts.push('The team is making progress on alignment and scope.')
  }

  return parts.join(' ')
}

/** Get blocker distribution by category for chart */
export function getBlockerByCategory(blockers) {
  const map = {}
  for (const b of blockers) {
    const cat = extractCategory(b.title ?? b.description)
    map[cat] = (map[cat] || 0) + 1
  }
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

/** Get action items by due date for chart */
export function getActionsByDueDate(actionItems) {
  const map = {}
  for (const a of actionItems) {
    const bucket = bucketDue(a.due ?? a.due_date ?? '')
    map[bucket] = (map[bucket] || 0) + 1
  }
  const order = ['Today', 'Tomorrow', 'This week', 'Next week', 'Later', 'Other']
  return order
    .filter((o) => map[o] > 0)
    .map((o) => ({ label: o, count: map[o] }))
}

/** Get blocker status breakdown */
export function getBlockerStatusBreakdown(blockers) {
  const resolved = blockers.filter((b) => /resolved/i.test(String(b.status ?? ''))).length
  const active = blockers.length - resolved
  return [
    { label: 'Active', count: active, color: '#f59e0b' },
    { label: 'Resolved', count: resolved, color: 'var(--success)' },
  ].filter((x) => x.count > 0)
}

/**
 * Personal trajectory — cumulative "your" action items + blockers per session.
 * Used for personal dopamine chart. Requires items with _sessionIdx and viewer matching.
 */
export function getPersonalTrajectoryData(
  sessions = [],
  actionItems = [],
  blockers = [],
  isYoursAction,
  isYoursBlocker,
) {
  if (!isYoursAction || !isYoursBlocker) return []
  if (Array.isArray(sessions) && sessions.length > 0) {
    return sessions.map((s, i) => {
      const myActions = actionItems.filter((a) => (a._sessionIdx ?? 0) <= i && isYoursAction(a)).length
      const myBlockers = blockers.filter((b) => (b._sessionIdx ?? 0) <= i && isYoursBlocker(b)).length
      const cum = myActions + myBlockers
      return {
        meeting: i + 1,
        label: `M${i + 1}`,
        cumulativeWins: cum,
      }
    })
  }
  // Fallback: synthetic 3-point trajectory for demo (no sessions)
  const myActions = actionItems.filter((a) => isYoursAction(a)).length
  const myBlockers = blockers.filter((b) => isYoursBlocker(b)).length
  const total = myActions + myBlockers
  if (total === 0) return []
  if (total === 1) return [{ meeting: 1, label: 'Now', cumulativeWins: 1 }]
  const pts = [
    { meeting: 1, label: 'M1', cumulativeWins: Math.max(1, Math.floor(total * 0.25)) },
    { meeting: 2, label: 'M2', cumulativeWins: Math.max(2, Math.floor(total * 0.6)) },
    { meeting: 3, label: 'M3', cumulativeWins: total },
  ]
  return pts
}

/** Trajectory data for project momentum / dopamine chart — cumulative wins over meetings */
export function getTrajectoryData(sessions = [], fallback = { decisions: 0, actions: 0 }, velocityWeeks = []) {
  if (Array.isArray(sessions) && sessions.length > 0) {
    let cumDec = 0
    let cumAct = 0
    return sessions.map((s, i) => {
      cumDec += s.decisionCount ?? 0
      cumAct += s.actionItemCount ?? 0
      return {
        meeting: i + 1,
        label: `M${i + 1}`,
        cumulativeDecisions: cumDec,
        cumulativeActions: cumAct,
        cumulativeWins: cumDec + cumAct,
      }
    })
  }
  if (velocityWeeks.length > 0) {
    return velocityWeeks.map((d, i) => ({
      meeting: i + 1,
      label: d.week ?? `W${i + 1}`,
      cumulativeDecisions: 0,
      cumulativeActions: 0,
      cumulativeWins: d.value ?? 0,
    }))
  }
  return [{
    meeting: 1,
    label: 'Now',
    cumulativeDecisions: fallback.decisions ?? 0,
    cumulativeActions: fallback.actions ?? 0,
    cumulativeWins: (fallback.decisions ?? 0) + (fallback.actions ?? 0),
  }]
}

/** Generate key insights (bullet points) */
export function generateInsights({ blockers, actionItems, decisions }) {
  const insights = []
  const categories = getBlockerByCategory(blockers)
  const byDue = getActionsByDueDate(actionItems)
  const status = getBlockerStatusBreakdown(blockers)

  if (categories.length > 0 && categories[0].count >= 2) {
    insights.push({
      type: 'theme',
      text: `${categories[0].name} is the most common blocker theme (${categories[0].count} items).`,
    })
  }

  const oldest = blockers
    .map((b) => ({ ...b, ...parseSince(b.since ?? b.created_at) }))
    .filter((b) => b.days < 999)
    .sort((a, b) => b.days - a.days)[0]
  if (oldest && oldest.days >= 2) {
    insights.push({
      type: 'attention',
      text: `Longest-running blocker: "${(oldest.title ?? '').slice(0, 50)}..." (${oldest.label}).`,
    })
  }

  const todayCount = byDue.find((d) => d.label === 'Today')?.count ?? 0
  if (todayCount > 0) {
    insights.push({
      type: 'urgent',
      text: `${todayCount} action item${todayCount !== 1 ? 's' : ''} due today.`,
    })
  }

  const resolvedCount = status.find((s) => s.label === 'Resolved')?.count ?? 0
  if (resolvedCount > 0 && blockers.length > 0) {
    insights.push({
      type: 'progress',
      text: `${resolvedCount} of ${blockers.length} blockers resolved.`,
    })
  }

  if (decisions.length >= 3) {
    insights.push({
      type: 'momentum',
      text: `Strong decision velocity: ${decisions.length} decisions recorded.`,
    })
  }

  return insights
}

/** AI-style interpretation of action items — narrative summary + per-item context */
export function generateActionsInterpretation(actionItems) {
  const byDue = getActionsByDueDate(actionItems)
  const urgentCount = (byDue.find((d) => d.label === 'Today')?.count ?? 0) +
    (byDue.find((d) => d.label === 'Tomorrow')?.count ?? 0)
  const themes = actionItems.reduce((acc, a) => {
    const t = extractCategory(a.text ?? a.title ?? '')
    if (t !== 'other') acc[t] = (acc[t] || 0) + 1
    return acc
  }, {})
  const topTheme = Object.entries(themes).sort((a, b) => b[1] - a[1])[0]?.[0]

  let summary = ''
  if (actionItems.length === 0) {
    summary = 'No action items on the board. The team may be between sprints or awaiting inputs.'
  } else {
    const parts = []
    parts.push(`**${actionItems.length} action item${actionItems.length !== 1 ? 's' : ''}** across the team.`)
    if (urgentCount > 0) {
      parts.push(`**${urgentCount}** due today or tomorrow — prioritize these for immediate momentum.`)
    }
    if (topTheme && themes[topTheme] >= 2) {
      parts.push(`Theme: **${topTheme}** (${themes[topTheme]} items) suggests coordinated effort in this area.`)
    }
    parts.push('Each item below includes context to help you understand impact and dependencies.')
    summary = parts.join(' ')
  }

  const withContext = actionItems.map((a) => {
    const cat = extractCategory(a.text ?? a.title ?? '')
    const due = bucketDue(a.due)
    const raw = (a.text ?? a.title ?? '').trim()
    const backendCtx = (a.context || '').trim()
    let interpretation = ''
    if (backendCtx) {
      interpretation = backendCtx + ' '
    }
    if (cat !== 'other') {
      interpretation += `Interpreted as ${cat}-focused work. `
    } else {
      interpretation += 'Action item. '
    }
    interpretation += `Due ${due}`
    if (due === 'Today' || due === 'Tomorrow') {
      interpretation += ' — high priority for immediate follow-through. '
    } else {
      interpretation += '. '
    }
    if (raw && !backendCtx) {
      interpretation += raw.length > 160 ? `${raw.slice(0, 160)}…` : raw
    } else if (raw) {
      interpretation += raw.length > 100 ? `${raw.slice(0, 100)}…` : raw
    }
    return { ...a, interpretation }
  })

  return { summary, items: withContext }
}

/** AI-style interpretation of blockers — narrative summary + per-item context */
export function generateBlockersInterpretation(blockers) {
  const categories = getBlockerByCategory(blockers)
  const status = getBlockerStatusBreakdown(blockers)
  const resolvedCount = status.find((s) => s.label === 'Resolved')?.count ?? 0

  let summary = ''
  if (blockers.length === 0) {
    summary = 'No active blockers reported. The team appears unblocked — consider checking in with members for any unspoken friction.'
  } else {
    const parts = []
    parts.push(`**${blockers.length} blocker${blockers.length !== 1 ? 's' : ''}** reported.`)
    if (categories.length > 0) {
      parts.push(`Primary theme: **${categories[0].name}** (${categories[0].count} ${categories[0].count === 1 ? 'item' : 'items'}).`)
    }
    if (resolvedCount > 0) {
      parts.push(`${resolvedCount} resolved — progress is being made.`)
    }
    parts.push('Each blocker is interpreted with severity and recommended attention.')
    summary = parts.join(' ')
  }

  const withContext = blockers.map((b) => {
    const cat = extractCategory(b.title ?? b.description)
    const since = parseSince(b.since ?? b.created_at)
    const isResolved = /resolved/i.test(String(b.status ?? ''))
    const raw = (b.title ?? b.description ?? '').trim()
    const backendCtx = (b.context || '').trim()
    let interpretation = ''
    if (backendCtx) {
      interpretation = backendCtx + ' '
    }
    if (isResolved) {
      interpretation += 'This blocker has been resolved. '
    } else if (since.days >= 3) {
      interpretation += `Active for ${since.days}+ days — recommended for escalation or additional support. `
    } else {
      interpretation += 'Currently active — under discussion. '
    }
    if (cat !== 'other') {
      interpretation += `${cat.charAt(0).toUpperCase() + cat.slice(1)}-related. `
    }
    if (raw) {
      interpretation += raw.length > 180 ? `${raw.slice(0, 180)}…` : raw
    }
    return { ...b, interpretation }
  })

  return { summary, items: withContext }
}

/**
 * Takeaways — key agreements and alignment from standup.
 * Reframed from "decisions" to "what we agreed on" for clearer purpose.
 */
export function generateDecisionsInterpretation(decisions) {
  let summary = ''
  if (decisions.length === 0) {
    summary = 'No takeaways recorded yet. As standups progress, this tab captures **scope changes**, **approach choices**, and **alignment** the team agreed on.'
  } else {
    summary = `**${decisions.length} takeaway${decisions.length !== 1 ? 's' : ''}** — what the team agreed on: scope, architecture, priorities. Use this to stay aligned without re-reading the transcript.`
  }

  const withContext = decisions.map((d) => {
    const text = (d.text ?? d.title ?? d.description ?? '').trim()
    const cat = extractCategory(text)
    const backendCtx = (d.context || '').trim()
    let interpretation = ''
    if (backendCtx) {
      interpretation = backendCtx + ' '
    }
    if (cat !== 'other') {
      interpretation += `${cat.charAt(0).toUpperCase() + cat.slice(1)} · `
    }
    interpretation += (text || 'No details').slice(0, 120) + (text.length > 120 ? '…' : '')
    return { ...d, interpretation }
  })

  return { summary, items: withContext }
}
