/**
 * @param {string | null | undefined} dashboardRole
 */
export function getPostLoginPath(dashboardRole) {
  if (dashboardRole === 'hackathon-host') return '/host-console'
  if (dashboardRole === 'team-lead') return '/team'
  /** Team members land on Team first to enter a join code if they have no roster row yet. */
  if (dashboardRole === 'team-member') return '/team'
  return '/dashboard'
}

/**
 * @param {string | null | undefined} dashboardRole
 */
export function roleLabel(dashboardRole) {
  if (dashboardRole === 'hackathon-host') return 'Host'
  if (dashboardRole === 'team-lead') return 'Team Lead'
  if (dashboardRole === 'team-member') return 'Team Member'
  return 'User'
}
