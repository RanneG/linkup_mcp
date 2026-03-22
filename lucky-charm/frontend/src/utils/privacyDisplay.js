/**
 * Hackathon Host: replace identifiable name-like tokens with [Team Member]
 */
export function anonymizeForHostDisplay(text) {
  if (text == null || typeof text !== 'string') return text
  let out = text
  // Two-word capitalized names (simple heuristic)
  out = out.replace(/\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/g, '[Team Member]')
  // Known demo names from dashboardMock
  const demoNames = ['Alex Rivera', 'Jordan Kim', 'Sam Okonkwo', 'Morgan Lee']
  for (const n of demoNames) {
    const re = new RegExp(`\\b${n.replace(/\s+/g, '\\s+')}\\b`, 'g')
    out = out.replace(re, '[Team Member]')
  }
  return out
}

function namesRoughlyMatch(a, b) {
  const x = (a || '').trim().toLowerCase()
  const y = (b || '').trim().toLowerCase()
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}

/**
 * Whether this action item is assigned to the current user.
 * Pass `teamMembers` so assignee lines can match roster names (e.g. "Jordan" vs "Jordan Kim").
 */
export function isActionItemForViewer(item, viewerDisplayName, teamMembers = []) {
  if (/speaker \(self\)|\bself\b|\byou\b/i.test(item.assignee || '')) return true
  const assignee = (item.assignee || '').trim().toLowerCase()
  if (!assignee) return false

  const candidates = new Set()
  const v = (viewerDisplayName || '').trim().toLowerCase()
  if (v) candidates.add(v)
  for (const m of teamMembers || []) {
    const n = (m.displayName || '').trim().toLowerCase()
    if (n && v && namesRoughlyMatch(n, v)) candidates.add(n)
  }

  for (const c of candidates) {
    if (namesRoughlyMatch(assignee, c)) return true
  }
  return false
}

/** Team Member: action items assigned to this viewer sort first */
export function sortActionItemsYoursFirst(items, viewerDisplayName, teamMembers = []) {
  const score = (item) => (isActionItemForViewer(item, viewerDisplayName, teamMembers) ? 2 : 0)
  return [...items].sort((x, y) => score(y) - score(x))
}

export function isBlockerReportedByViewer(reportedBy, viewerDisplayName, teamMembers = []) {
  if (!reportedBy || !viewerDisplayName) return false
  const r = reportedBy.trim().toLowerCase()
  const v = viewerDisplayName.trim().toLowerCase()
  if (namesRoughlyMatch(r, v)) return true
  for (const m of teamMembers || []) {
    const n = (m.displayName || '').trim().toLowerCase()
    if (n && namesRoughlyMatch(r, n) && namesRoughlyMatch(n, v)) return true
  }
  return false
}
