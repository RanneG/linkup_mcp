/**
 * Clear all Lucky Charm app cache for a fresh demo run.
 * Removes teams, user id, TEE results, phases, data source, and auth state.
 */

import { clearTEEResult } from './teeResultStorage'
import { clearPhases } from './phaseStorage'
import { resetTeamDemoStorage } from './teamStorage'

export function clearAppCache() {
  try {
    clearTEEResult()
    clearPhases()
    resetTeamDemoStorage()

    // Remove all known keys
    const knownKeys = [
      'lucky-charm-tee-result',
      'lucky-charm-phases',
      'lucky-charm-current-phase',
      'lucky-charm-current-deliverable-label',
      'lucky-charm-data-source',
      'lucky-charm-teams',
      'lucky-charm-user-id',
      'lucky-charm-demo-join-bypass',
      'lucky-charm-user-profile',
    ]
    for (const key of knownKeys) {
      try {
        localStorage.removeItem(key)
      } catch {
        // ignore
      }
    }

    // Remove any other lucky-charm-* keys we might have missed
    try {
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('lucky-charm-')) {
          keysToRemove.push(key)
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key)
      }
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
}
