const DEMO_MODE_KEY = 'lucky-charm-host-console-demo'
const TRANSCRIPTS_KEY = 'lucky-charm-transcripts'

/**
 * Transcript history / audit log storage.
 * Currently a no-op; implement for production audit trail.
 * @param {object} record - { teamId, teamName, timestamp, blockers, decisions, actionItems, filename }
 */
export function appendTranscriptRecord(record) {
  try {
    const records = getTranscriptRecords()
    records.push({ ...record, id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` })
    localStorage.setItem(TRANSCRIPTS_KEY, JSON.stringify(records))
  } catch {
    // ignore
  }
}

/** Returns transcript records for host console (teamId, teamName, timestamp, filename, etc.). */
export function getTranscriptRecords() {
  try {
    const raw = localStorage.getItem(TRANSCRIPTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Host console demo mode: show mock charts (Alpha/Beta/Gamma) vs stored transcripts. */
export function getHostConsoleDemoMode() {
  try {
    return localStorage.getItem(DEMO_MODE_KEY) === '1'
  } catch {
    return false
  }
}

/** @param {boolean} on */
export function setHostConsoleDemoMode(on) {
  try {
    localStorage.setItem(DEMO_MODE_KEY, on ? '1' : '0')
  } catch {
    // ignore
  }
}
