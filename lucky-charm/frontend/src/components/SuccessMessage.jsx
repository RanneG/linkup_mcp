import { Link } from 'react-router-dom'
import './SuccessMessage.css'

const PREVIEW_LIMIT = 3

export default function SuccessMessage({ onUploadAnother, variant = 'mock', result }) {
  const isRealTEE = variant === 'real'
  const hasResult = result && (
    (result.blockers?.length > 0) ||
    (result.action_items?.length > 0) ||
    (result.decisions?.length > 0)
  )

  return (
    <div className="success-message">
      <div className="success-message-icon" aria-hidden>
        ✓
      </div>
      <h2 className="success-message-title">
        {isRealTEE
          ? 'Transcript processed in secure TEE'
          : 'Transcript uploaded'}
      </h2>
      <p className="success-message-desc">
        This meeting has been added to your dashboard. Upload another to evolve the view, or go to Dashboard.
      </p>

      {hasResult && (
        <div className="success-message-aggregation" role="region" aria-label="Extraction summary">
          <div className="success-message-aggregation-card">
            <span className="success-message-aggregation-count">
              {result.blockers?.length ?? 0}
            </span>
            <span className="success-message-aggregation-label">Blockers</span>
            {(result.blockers ?? []).slice(0, PREVIEW_LIMIT).map((b, i) => (
              <p key={b.id ?? i} className="success-message-aggregation-preview">
                {b.title ?? '—'}
              </p>
            ))}
          </div>
          <div className="success-message-aggregation-card">
            <span className="success-message-aggregation-count">
              {result.action_items?.length ?? 0}
            </span>
            <span className="success-message-aggregation-label">Action items</span>
            {(result.action_items ?? []).slice(0, PREVIEW_LIMIT).map((a, i) => (
              <p key={a.id ?? i} className="success-message-aggregation-preview">
                {a.text ?? '—'}
              </p>
            ))}
          </div>
          <div className="success-message-aggregation-card">
            <span className="success-message-aggregation-count">
              {result.decisions?.length ?? 0}
            </span>
            <span className="success-message-aggregation-label">Decisions</span>
            {(result.decisions ?? []).slice(0, PREVIEW_LIMIT).map((d, i) => (
              <p key={d.id ?? i} className="success-message-aggregation-preview">
                {d.text ?? '—'}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="success-message-actions">
        <Link to="/dashboard" className="success-message-btn success-message-btn--primary">
          View Dashboard
        </Link>
        <button type="button" className="success-message-btn" onClick={onUploadAnother}>
          Upload another
        </button>
      </div>
    </div>
  )
}
