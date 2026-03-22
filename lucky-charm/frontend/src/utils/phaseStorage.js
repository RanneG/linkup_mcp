/**
 * Phase / completion point storage.
 * Archives completed deliverables so teams can mark phases complete and start fresh.
 */

const PHASES_KEY = 'lucky-charm-phases'
const CURRENT_PHASE_KEY = 'lucky-charm-current-phase'
const CURRENT_LABEL_KEY = 'lucky-charm-current-deliverable-label'

function getPhases() {
  try {
    const raw = localStorage.getItem(PHASES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function setPhases(phases) {
  try {
    localStorage.setItem(PHASES_KEY, JSON.stringify(phases))
  } catch {
    // ignore
  }
}

export function getCurrentPhaseNumber() {
  try {
    const raw = localStorage.getItem(CURRENT_PHASE_KEY)
    if (raw == null) return 1
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n >= 1 ? n : 1
  } catch {
    return 1
  }
}

export function getArchivedPhases() {
  return getPhases()
}

export function getCurrentDeliverableLabel() {
  try {
    const raw = localStorage.getItem(CURRENT_LABEL_KEY)
    return (raw && raw.trim()) || ''
  } catch {
    return ''
  }
}

function setCurrentDeliverableLabel(label) {
  try {
    if (label) {
      localStorage.setItem(CURRENT_LABEL_KEY, String(label).trim())
    } else {
      localStorage.removeItem(CURRENT_LABEL_KEY)
    }
  } catch {
    // ignore
  }
}

/**
 * Name the first deliverable for a fresh team (phase 1, no archived yet).
 * Stores the label only — you stay on Deliverable 1. No archiving.
 * @param {string} label - Name for the deliverable (e.g. "MVP", "Sprint 1")
 */
export function createFirstDeliverable(label = '') {
  const phases = getPhases()
  if (phases.length > 0) return false
  const phaseNum = getCurrentPhaseNumber()
  if (phaseNum !== 1) return false

  setCurrentDeliverableLabel(label || 'Deliverable 1')
  return true
}

/**
 * Mark the current deliverable complete, archive it, and start a new phase.
 * @param {object} teeResult - Current dashboard data to archive
 * @param {string} label - Optional label (e.g. "MVP", "Sprint 1")
 * @returns {{ phase: number, archived: object }}
 */
export function markDeliverableComplete(teeResult, label = '') {
  const phases = getPhases()
  const phaseNum = getCurrentPhaseNumber()
  const resolvedLabel = (label && label.trim()) || getCurrentDeliverableLabel() || `Deliverable ${phaseNum}`
  const archived = {
    phase: phaseNum,
    label: resolvedLabel.trim(),
    completedAt: Date.now(),
    sessionCount: teeResult?.sessions?.length ?? 0,
    data: teeResult ? { ...teeResult } : null,
  }
  phases.push(archived)
  setPhases(phases)
  setCurrentDeliverableLabel('')
  try {
    localStorage.setItem(CURRENT_PHASE_KEY, String(phaseNum + 1))
  } catch {
    // ignore
  }
  return { phase: phaseNum + 1, archived }
}

export function clearPhases() {
  try {
    localStorage.removeItem(PHASES_KEY)
    localStorage.removeItem(CURRENT_PHASE_KEY)
    localStorage.removeItem(CURRENT_LABEL_KEY)
  } catch {
    // ignore
  }
}

/**
 * Permanently remove an archived deliverable (for security / data cleanup).
 * @param {number} phase - Phase number of the deliverable
 * @param {number} completedAt - completedAt timestamp (unique identifier)
 */
export function removeArchivedDeliverable(phase, completedAt) {
  const phases = getPhases().filter(
    (p) => !(p.phase === phase && p.completedAt === completedAt),
  )
  setPhases(phases)
}
