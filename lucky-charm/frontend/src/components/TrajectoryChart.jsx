import { useId } from 'react'
import './TrajectoryChart.css'

/** Project trajectory / dopamine chart — upward cumulative line */
export default function TrajectoryChart({ data, height = 260, subtitle, variant = 'team' }) {
  if (!data || data.length === 0) return <p className="ai-chart-empty">No trajectory data yet</p>
  const values = data.map((d) => d.cumulativeWins)
  const maxVal = Math.max(...values, 1)
  const isCompact = height <= 80
  const padding = {
    top: isCompact ? 8 : 12,
    right: isCompact ? 8 : 12,
    bottom: isCompact ? 18 : 28,
    left: isCompact ? 24 : 32,
  }
  const w = 280
  const h = height
  const innerW = w - padding.left - padding.right
  const innerH = h - padding.top - padding.bottom
  const bottomY = padding.top + innerH
  const points = data.map((d, i) => {
    const x = padding.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2)
    const y = padding.top + innerH - (d.cumulativeWins / maxVal) * innerH
    return { x, y, ...d }
  })
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const last = points[points.length - 1]
  const areaD = last ? `${pathD} L ${last.x} ${bottomY} L ${padding.left} ${bottomY} Z` : ''
  const gradId = useId().replace(/:/g, '-')
  const isPersonal = variant === 'personal'
  const accentColor = isPersonal ? 'var(--success)' : 'var(--accent)'

  // When many points, show only a subset of labels to avoid crowding (max ~6)
  const maxLabels = 6
  const labelIndices = (() => {
    const n = points.length
    if (n <= maxLabels) return [...Array(n).keys()]
    const step = Math.max(1, Math.floor((n - 1) / (maxLabels - 1)))
    const out = [0]
    for (let i = step; i < n - 1; i += step) out.push(i)
    if (n > 1 && out[out.length - 1] !== n - 1) out.push(n - 1)
    return out
  })()

  return (
    <div className={`trajectory-chart ${isPersonal ? 'trajectory-chart--personal' : ''} ${isCompact ? 'trajectory-chart--compact' : ''}`}>
      <p className="trajectory-chart-subtitle">{subtitle ?? 'Decisions + action items — keep it rising'}</p>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="trajectory-svg">
        <defs>
          <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {areaD && <path d={areaD} fill={`url(#${gradId})`} />}
        <path d={pathD} fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="butt" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill={accentColor} stroke="var(--bg)" strokeWidth="2" />
            {labelIndices.includes(i) && (
              <text x={p.x} y={bottomY + (h - bottomY) / 2} textAnchor="middle" dominantBaseline="middle" className="trajectory-svg-label">
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
