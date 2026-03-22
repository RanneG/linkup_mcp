import './ViewToggle.css'

const ROLES = [
  { id: 'team-lead', label: 'Team Lead' },
  { id: 'team-member', label: 'Team Member' },
  { id: 'hackathon-host', label: 'Hackathon Host' },
]

export default function ViewToggle({ role, onChange, roleLocked = false }) {
  return (
    <div className="view-toggle" role="tablist" aria-label="View as role">
      <span className="view-toggle-label">
        View as:
        {roleLocked && (
          <span className="view-toggle-badge view-toggle-badge--sso" title="Role comes from SSO sign-in">
            SSO
          </span>
        )}
      </span>
      <div className="view-toggle-buttons">
        {ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={role === r.id}
            disabled={roleLocked && role !== r.id}
            className={`view-toggle-btn ${role === r.id ? 'view-toggle-btn--active' : ''} ${roleLocked && role !== r.id ? 'view-toggle-btn--disabled' : ''}`}
            onClick={() => onChange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  )
}
