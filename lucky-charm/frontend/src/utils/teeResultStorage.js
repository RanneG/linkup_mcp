/**
 * Cumulative TEE result storage: each upload adds to the dashboard.
 * Sessions are appended; getTEEResult returns the merged view from all meetings.
 */

import { appendTranscriptRecord } from './transcriptHistoryStorage'

const STORAGE_KEY = 'lucky-charm-tee-result'

/**
 * Merge a new session into existing data. Each item gets a session-scoped id to avoid collisions.
 */
function mergeSession(existing, session) {
  let sessions = Array.isArray(existing?.sessions) ? existing.sessions : []
  if (sessions.length === 0 && existing?.blockers) {
    sessions = [{
      id: 'session-legacy',
      filename: existing.filename ?? 'transcript',
      timestamp: existing.timestamp ?? Date.now(),
      blockerCount: (existing.blockers ?? []).length,
      actionItemCount: (existing.action_items ?? []).length,
      decisionCount: (existing.decisions ?? []).length,
    }]
  }
  const idx = sessions.length
  const teamId = session.teamId ?? existing?.teamId ?? null
  const teamName = session.teamName ?? existing?.teamName ?? null

  const blockers = (existing?.blockers ?? []).concat(
    (session.blockers ?? []).map((b, i) => ({
      ...b,
      id: b.id ?? `s${idx}-b-${i}`,
      _sessionIdx: idx,
    }))
  )
  const action_items = (existing?.action_items ?? []).concat(
    (session.action_items ?? []).map((a, i) => ({
      ...a,
      id: a.id ?? `s${idx}-a-${i}`,
      _sessionIdx: idx,
    }))
  )
  const decisions = (existing?.decisions ?? []).concat(
    (session.decisions ?? []).map((d, i) => ({
      ...d,
      id: d.id ?? `s${idx}-d-${i}`,
      _sessionIdx: idx,
    }))
  )

  const newSession = {
    id: `session-${Date.now()}`,
    filename: session.filename ?? 'transcript',
    timestamp: session.timestamp ?? Date.now(),
    blockerCount: (session.blockers ?? []).length,
    actionItemCount: (session.action_items ?? []).length,
    decisionCount: (session.decisions ?? []).length,
  }

  return {
    sessions: [...sessions, newSession],
    filename: newSession.filename,
    timestamp: newSession.timestamp,
    teamId,
    teamName,
    blockers,
    action_items,
    decisions,
  }
}

export function getTEEResult() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.sessions) return parsed
    return parsed
  } catch {
    return null
  }
}

/**
 * Appends a new upload to the dashboard. Each call adds a session; the dashboard shows the cumulative result.
 * @param {object} payload - { filename, blockers?, action_items?, decisions?, teamId?, teamName? }
 */
export function setTEEResult(payload) {
  const session = {
    filename: payload.filename ?? 'transcript',
    timestamp: Date.now(),
    blockers: Array.isArray(payload.blockers) ? payload.blockers : [],
    action_items: Array.isArray(payload.action_items) ? payload.action_items : [],
    decisions: Array.isArray(payload.decisions) ? payload.decisions : [],
    teamId: payload.teamId ?? null,
    teamName: payload.teamName ?? null,
  }

  const existing = getTEEResult()
  const merged = mergeSession(existing, session)

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // ignore
  }

  if (session.teamId) {
    appendTranscriptRecord({
      teamId: session.teamId,
      teamName: session.teamName,
      timestamp: session.timestamp,
      blockers: session.blockers,
      decisions: session.decisions,
      actionItems: session.action_items,
      filename: session.filename,
    })
  }
}

/**
 * Clears all sessions and resets the dashboard.
 */
export function clearTEEResult() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function formatTEETimestamp(ms) {
  if (typeof ms !== 'number') return ''
  const d = new Date(ms)
  return d.toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}
