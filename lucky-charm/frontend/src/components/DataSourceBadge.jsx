import { useDataSource } from '../context/DataSourceContext'
import './DataSourceBadge.css'

export default function DataSourceBadge() {
  const { dataSource } = useDataSource()
  const isReal = dataSource === 'real'

  return (
    <div
      className={`data-source-badge data-source-badge--${dataSource}`}
      role="status"
      aria-label={`Using: ${isReal ? 'Real TEE' : 'Mock Data'}`}
    >
      Using: {isReal ? 'Real TEE' : 'Mock Data'}
    </div>
  )
}
