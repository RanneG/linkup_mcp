const STORAGE_KEY = 'lucky-charm-dashboard-role'
const VALID = ['team-lead', 'team-member', 'hackathon-host']

/** Read persisted dashboard role (same key as DashboardRoleContext). */
export function getStoredDashboardRole() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (VALID.includes(v)) return v
  } catch {
    // ignore
  }
  return 'team-lead'
}

export function isHackathonHostRole() {
  return getStoredDashboardRole() === 'hackathon-host'
}
