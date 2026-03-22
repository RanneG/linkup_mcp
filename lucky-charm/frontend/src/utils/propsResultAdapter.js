/**
 * Adapt Props-compliant TEE response to dashboard display format.
 * Props output (per-item): { blockers: [{category, summary}], action_items: [{theme, summary, due}], decisions: [{theme, summary}] }
 * Or (aggregated): { blockers: [{category, count}], ... }
 * Dashboard expects: { blockers: [{id, title, ...}], action_items: [{id, text, ...}], decisions: [{id, text, ...}] }
 */

function isPropsFormat(body) {
  return (
    body &&
    (Array.isArray(body.themes) || body.velocity) &&
    Array.isArray(body.blockers) &&
    (body.blockers.length === 0 ||
      body.blockers[0]?.category != null ||
      body.blockers[0]?.summary != null)
  )
}

function toDisplayBlocker(b, i) {
  const summary = b.summary ?? (b.count != null ? `${b.category} (${b.count})` : '—')
  const title = summary !== '—' && b.category ? `${b.category}: ${summary}` : summary
  return {
    id: b.id ?? `b-${i}`,
    team: b.team ?? 'Team',
    title: title.length > 100 ? title.slice(0, 100) + '…' : title,
    context: b.context ?? null,
    status: b.status ?? 'In progress',
    reportedBy: b.reported_by ?? b.reportedBy ?? 'Team (from transcript)',
    since: b.since ?? '—',
  }
}

function toDisplayAction(a, i) {
  const summary = a.summary ?? (a.count != null ? `${a.theme} (${a.count})` : '—')
  const text = summary !== '—' && a.theme ? `${a.theme}: ${summary}` : summary
  const dueDist = a.due_distribution || {}
  const dueSummary =
    Object.keys(dueDist).length > 0
      ? Object.entries(dueDist)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')
      : a.due ?? '—'
  return {
    id: a.id ?? `a-${i}`,
    text: text.length > 120 ? text.slice(0, 120) + '…' : text,
    context: a.context ?? null,
    due: dueSummary,
    assignee: a.assignee ?? 'Team (from transcript)',
  }
}

function toDisplayDecision(d, i) {
  const summary = d.summary ?? (d.count != null ? `${d.theme} (${d.count})` : '—')
  const text = summary !== '—' && d.theme ? `${d.theme}: ${summary}` : summary
  return {
    id: d.id ?? `d-${i}`,
    text: text.length > 120 ? text.slice(0, 120) + '…' : text,
    context: d.context ?? null,
    date: d.date ?? '—',
    decidedBy: d.decided_by ?? d.decidedBy ?? 'Team (from transcript)',
  }
}

/**
 * @param {object} body - TEE response (Props or legacy)
 * @returns {object} - Normalized for dashboard: { blockers, action_items, decisions, velocity?, themes? }
 */
export function adaptTEEResponse(body) {
  if (!body) return { blockers: [], action_items: [], decisions: [] }
  if (!isPropsFormat(body)) return body

  const blockers = (body.blockers || []).map(toDisplayBlocker)
  const action_items = (body.action_items || []).map(toDisplayAction)
  const decisions = (body.decisions || []).map(toDisplayDecision)

  return {
    ...body,
    blockers,
    action_items,
    decisions,
    velocity: body.velocity,
    themes: body.themes,
  }
}
