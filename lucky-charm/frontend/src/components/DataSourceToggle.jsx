import { useDataSource } from '../context/DataSourceContext'
import './DataSourceToggle.css'

const TOOLTIP = 'Use mock data to save GPU credits while developing'

export default function DataSourceToggle({ realLabel = 'Real TEE' }) {
  const { dataSource, setDataSource } = useDataSource()

  return (
    <div
      className="data-source-toggle"
      title={TOOLTIP}
      aria-label="Data source"
    >
      <span className="data-source-toggle-label">Data source:</span>
      <div className="data-source-toggle-buttons">
        <button
          type="button"
          className={`data-source-toggle-btn ${dataSource === 'real' ? 'data-source-toggle-btn--active' : ''}`}
          onClick={() => setDataSource('real')}
          title={TOOLTIP}
        >
          {realLabel}
        </button>
        <button
          type="button"
          className={`data-source-toggle-btn ${dataSource === 'mock' ? 'data-source-toggle-btn--active' : ''}`}
          onClick={() => setDataSource('mock')}
          title={TOOLTIP}
        >
          Mock Data
        </button>
      </div>
    </div>
  )
}
