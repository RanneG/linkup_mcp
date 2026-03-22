import { useDataSource } from '../context/DataSourceContext'
import { useTEEStatus } from '../context/TEEStatusContext'
import './TEEStatusIndicator.css'

const STATUS_LABELS = {
  checking: 'Checking TEE connection…',
  connected: 'TEE connected',
  offline: 'TEE offline',
}

export default function TEEStatusIndicator() {
  const { dataSource } = useDataSource()
  const { status } = useTEEStatus()

  if (dataSource === 'mock') {
    return (
      <div className="tee-status tee-status--demo" title="Using demo/mock data" role="status">
        <span className="tee-status-dot" aria-hidden />
        <span className="tee-status-label">Demo mode</span>
      </div>
    )
  }

  return (
    <div
      className={`tee-status tee-status--${status}`}
      title={STATUS_LABELS[status]}
      role="status"
      aria-live="polite"
    >
      <span className="tee-status-dot" aria-hidden />
      <span className="tee-status-label">{STATUS_LABELS[status]}</span>
    </div>
  )
}
