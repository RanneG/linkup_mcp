/**
 * Build rich context for LLM consumption from dashboard data.
 * Transforms sparse Props output into fuller narrative/timeline an LLM can use.
 * Designed for: pasting into ChatGPT/Claude, API context, or downstream analysis.
 */

/**
 * Format a single session into narrative form.
 * @param {object} session - { id, filename, timestamp, blockerCount, actionItemCount, decisionCount }
 * @param {number} idx - 0-based session index
 */
function formatSessionNarrative(session, idx) {
  const meetingNum = idx + 1
  const parts = [`Meeting ${meetingNum}${session.filename ? ` (${session.filename})` : ''}`]
  const counts = []
  if (session.blockerCount > 0) counts.push(`${session.blockerCount} blocker(s)`)
  if (session.actionItemCount > 0) counts.push(`${session.actionItemCount} action(s)`)
  if (session.decisionCount > 0) counts.push(`${session.decisionCount} decision(s)`)
  if (counts.length) parts.push(counts.join(', '))
  return parts.join(': ')
}

/**
 * Build a full project context blob suitable for LLM consumption.
 * @param {object} teeResult - { sessions, blockers, action_items, decisions, teamName?, filename? }
 * @returns {string} Markdown-formatted context
 */
export function buildLLMContext(teeResult) {
  if (!teeResult) return ''

  const sessions = teeResult.sessions ?? []
  const blockers = teeResult.blockers ?? []
  const actions = teeResult.action_items ?? []
  const decisions = teeResult.decisions ?? []
  const teamName = teeResult.teamName ?? 'Team'

  const lines = [
    '# Project context (standup synthesis)',
    '',
    `**Team:** ${teamName}`,
    `**Meetings processed:** ${sessions.length || 1}`,
    '',
    '---',
    '',
    '## Timeline by meeting',
    '',
  ]

  if (sessions.length > 0) {
    sessions.forEach((s, i) => {
      const sessionBlockers = blockers.filter((b) => (b._sessionIdx ?? 0) === i)
      const sessionActions = actions.filter((a) => (a._sessionIdx ?? 0) === i)
      const sessionDecisions = decisions.filter((d) => (d._sessionIdx ?? 0) === i)

      lines.push(`### Meeting ${i + 1}${s.filename ? ` — ${s.filename}` : ''}`)
      lines.push('')
      lines.push(`Summary: ${formatSessionNarrative(s, i)}.`)

      if (sessionBlockers.length > 0) {
        lines.push('')
        lines.push('**Blockers raised:**')
        sessionBlockers.forEach((b) => {
          const title = b.title ?? b.description ?? b.summary ?? 'Blocker'
          const cat = b.category ? `[${b.category}] ` : ''
          const ctx = b.context ? ` — ${b.context}` : ''
          lines.push(`- ${cat}${title}${ctx}`)
        })
      }
      if (sessionActions.length > 0) {
        lines.push('')
        lines.push('**Action items:**')
        sessionActions.forEach((a) => {
          const text = a.text ?? a.title ?? a.summary ?? 'Action'
          const theme = a.theme ? `[${a.theme}] ` : ''
          const due = a.due ? ` (due: ${a.due})` : ''
          const ctx = a.context ? ` — ${a.context}` : ''
          lines.push(`- ${theme}${text}${due}${ctx}`)
        })
      }
      if (sessionDecisions.length > 0) {
        lines.push('')
        lines.push('**Decisions / agreements:**')
        sessionDecisions.forEach((d) => {
          const text = d.text ?? d.title ?? d.summary ?? 'Decision'
          const theme = d.theme ? `[${d.theme}] ` : ''
          const ctx = d.context ? ` — ${d.context}` : ''
          lines.push(`- ${theme}${text}${ctx}`)
        })
      }
      lines.push('')
    })
  } else {
    // No sessions — list everything cumulatively with fuller detail
    lines.push('### Cumulative view')
    lines.push('')
    if (blockers.length > 0) {
      lines.push('**Blockers:**')
      blockers.forEach((b) => {
        const title = b.title ?? b.description ?? (b.summary ? `${b.category || ''}: ${b.summary}`.trim() : 'Blocker')
        const since = b.since ? ` (since: ${b.since})` : ''
        const ctx = b.context ? ` — ${b.context}` : ''
        lines.push(`- ${title}${since}${ctx}`)
      })
      lines.push('')
    }
    if (actions.length > 0) {
      lines.push('**Action items:**')
      actions.forEach((a) => {
        const text = a.text ?? a.title ?? (a.summary ? `${a.theme || ''}: ${a.summary}`.trim() : 'Action')
        const due = a.due ? ` — due: ${a.due}` : ''
        const assignee = a.assignee ? ` (${a.assignee})` : ''
        const ctx = a.context ? ` — ${a.context}` : ''
        lines.push(`- ${text}${due}${assignee}${ctx}`)
      })
      lines.push('')
    }
    if (decisions.length > 0) {
      lines.push('**Decisions / takeaways:**')
      decisions.forEach((d) => {
        const text = d.text ?? d.title ?? (d.summary ? `${d.theme || ''}: ${d.summary}`.trim() : 'Decision')
        const ctx = d.context ? ` — ${d.context}` : ''
        lines.push(`- ${text}${ctx}`)
      })
      lines.push('')
    }
  }

  lines.push('---')
  lines.push('')
  lines.push('*Context generated from standup synthesis. Use for planning, retrospectives, or briefing an AI assistant.*')

  return lines.join('\n')
}

/** Extract keywords for relationship matching */
function extractKeywords(str) {
  if (!str || typeof str !== 'string') return []
  return str.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? []
}

/** Simulated rationale for blockers based on category and title */
function simulateBlockerRationale(b) {
  const title = (b.title ?? b.description ?? b.summary ?? '').toLowerCase()
  const cat = (b.category ?? 'other').toLowerCase()
  const since = b.since ?? ''
  if (/attestation|enclave|phala|tee|verification/i.test(title)) {
    return 'Integration/security verification blocking deployment pipeline. Resolving will unblock staging and production readiness.'
  }
  if (/staging|env|deployment|nightly/i.test(title)) {
    return 'Environment instability affects CI/CD and team velocity. Recommend prioritizing before next release.'
  }
  if (/design|token|mobile|shell/i.test(title)) {
    return 'Frontend/design dependency. May block UI work until design tokens are available.'
  }
  if (/credential|plaid|webhook|sandbox/i.test(title)) {
    return 'External service or sandbox limitation. May require credential rotation or vendor follow-up.'
  }
  if (/rate limit|documentation/i.test(title)) {
    return cat === 'integration' ? 'Integration throttling or docs gap blocking onboarding.' : 'Documentation or process gap.'
  }
  if (since && /days?|week/i.test(String(since))) {
    return `Active for ${since} — consider escalation or additional resourcing.`
  }
  return 'Requires attention. Check with team for current status and dependencies.'
}

/** Simulated rationale for actions */
function simulateActionRationale(a, blockers) {
  const text = (a.text ?? a.title ?? a.summary ?? '').toLowerCase()
  const keywords = extractKeywords(text)
  const related = blockers.filter((b) => {
    const bStr = (b.title ?? b.description ?? b.summary ?? '').toLowerCase()
    return keywords.some((kw) => bStr.includes(kw))
  })
  if (related.length > 0) {
    const ids = related.map((r) => r.id).slice(0, 2)
    return `Addresses blocker(s) ${ids.join(', ')}. Completing this will reduce friction and unblock dependent work.`
  }
  if (/openapi|spec|endpoint|api/i.test(text)) {
    return 'Unblocks frontend and integration work. API contract clarity reduces rework.'
  }
  if (/review|pr/i.test(text)) {
    return 'Review bottleneck. Timely feedback accelerates delivery.'
  }
  if (/runbook|docs|documentation/i.test(text)) {
    return 'Reduces bus factor and onboarding time. Critical for operational continuity.'
  }
  return 'Contributes to project momentum. Track for completion.'
}

/** Simulated rationale for decisions */
function simulateDecisionRationale(d) {
  const text = (d.text ?? d.title ?? d.summary ?? '').toLowerCase()
  if (/rest|websocket|api|upload/i.test(text)) {
    return 'Architecture choice affecting client implementation and latency. Reduces ambiguity for integration work.'
  }
  if (/blur|privacy|speaker|preview/i.test(text)) {
    return 'Privacy-first UX. Aligns with Props policy and user expectations.'
  }
  if (/mvp|mock|tee|toggle/i.test(text)) {
    return 'Scope and delivery strategy. Enables demo path while preserving production option.'
  }
  if (/scope|bank|demo|simple/i.test(text)) {
    return 'Scoping decision. Keeps demo focused and achievable.'
  }
  return 'Records team alignment. Reference for future scope and prioritization.'
}

/** Build narrative summary from data */
function buildNarrative(teeResult, blockers, actions, decisions) {
  const team = teeResult.teamName ?? 'Team'
  const n = teeResult.sessions?.length ?? 1
  const themes = [...new Set([...(blockers.map((b) => b.category)), ...(actions.map((a) => a.theme)), ...(decisions.map((d) => d.theme))])].filter(Boolean)

  let narrative = `${team} has processed ${n} meeting(s). `
  if (blockers.length > 0) {
    const top = blockers.reduce((acc, b) => {
      acc[b.category ?? 'other'] = (acc[b.category ?? 'other'] ?? 0) + 1
      return acc
    }, {})
    const topCat = Object.entries(top).sort((a, b) => b[1] - a[1])[0]
    narrative += `${blockers.length} blocker(s) — primary theme: ${topCat?.[0] ?? 'various'} (${topCat?.[1] ?? 0}). `
  }
  narrative += `${actions.length} action(s) and ${decisions.length} decision(s) recorded. `
  if (themes.length > 0) {
    narrative += `Themes: ${themes.slice(0, 5).join(', ')}. `
  }
  narrative += 'Use this context for standup summaries, risk assessment, or briefing an LLM on project state.'
  return narrative
}

/**
 * Build JSON context for LLM consumption — upload-ready, demo-enriched.
 * Simulates LLM-added value: rationale, relationships, narrative.
 */
export function buildLLMContextJSON(teeResult) {
  if (!teeResult) return {}

  const sessions = teeResult.sessions ?? []
  const blockers = teeResult.blockers ?? []
  const actions = teeResult.action_items ?? []
  const decisions = teeResult.decisions ?? []

  const mapBlocker = (b) => {
    const base = {
      id: b.id,
      title: b.title ?? b.description ?? b.summary,
      category: b.category,
      status: b.status,
      since: b.since,
      reportedBy: b.reported_by ?? b.reportedBy,
      context: b.context,
    }
    base.rationale = simulateBlockerRationale(b)
    return base
  }

  const mapAction = (a) => {
    const base = {
      id: a.id,
      text: a.text ?? a.title ?? a.summary,
      theme: a.theme,
      due: a.due,
      assignee: a.assignee,
      context: a.context,
    }
    base.rationale = simulateActionRationale(a, blockers)
    const relatedBlockers = blockers.filter((b) => {
      const kw = extractKeywords(a.text ?? a.title ?? a.summary ?? '')
      const bStr = (b.title ?? b.description ?? b.summary ?? '').toLowerCase()
      return kw.some((w) => bStr.includes(w))
    })
    if (relatedBlockers.length > 0) {
      base.relatedBlockers = relatedBlockers.map((r) => r.id)
    }
    return base
  }

  const mapDecision = (d) => {
    const base = {
      id: d.id,
      text: d.text ?? d.title ?? d.summary,
      theme: d.theme,
      date: d.date,
      decidedBy: d.decided_by ?? d.decidedBy,
      context: d.context,
    }
    base.rationale = simulateDecisionRationale(d)
    return base
  }

  const timeline = sessions.length > 0
    ? sessions.map((s, i) => ({
        meeting: i + 1,
        filename: s.filename,
        timestamp: s.timestamp,
        blockerCount: s.blockerCount,
        actionItemCount: s.actionItemCount,
        decisionCount: s.decisionCount,
        blockers: blockers.filter((b) => (b._sessionIdx ?? 0) === i).map(mapBlocker),
        actions: actions.filter((a) => (a._sessionIdx ?? 0) === i).map(mapAction),
        decisions: decisions.filter((d) => (d._sessionIdx ?? 0) === i).map(mapDecision),
      }))
    : null

  const narrative = buildNarrative(teeResult, blockers, actions, decisions)

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    team: teeResult.teamName ?? 'Team',
    meetingCount: sessions.length || 1,
    narrative,
    summary: {
      totalBlockers: blockers.length,
      totalActions: actions.length,
      totalDecisions: decisions.length,
    },
    _usage: 'Upload this JSON to an LLM for: standup summaries, risk reports, sprint planning, or project briefings. Use "narrative" for quick context; "rationale" and "relatedBlockers" for deeper analysis.',
    ...(timeline && { timeline }),
    blockers: blockers.map(mapBlocker),
    actions: actions.map(mapAction),
    decisions: decisions.map(mapDecision),
  }
}
