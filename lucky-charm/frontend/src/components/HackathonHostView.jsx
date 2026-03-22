import {
  hackathonVelocityByTeam,
  hackathonAverageVelocity,
  hackathonCommonBlockerThemes,
  hackathonTeamsRankedByBlockers,
  hackathonDecisionTrends,
} from '../data/dashboardMock'
import { buildHostAggregatesFromTranscripts } from '../utils/hostConsoleAggregates'
import { anonymizeForHostDisplay } from '../utils/privacyDisplay'
import './HackathonHostView.css'

/**
 * Optional: fold TEE-derived copy into anonymized snippets only (no action items, no assignments).
 */
function anonymizedTeeSnippets(teeResult) {
  if (!teeResult) return []
  const out = []
  const blockers = Array.isArray(teeResult.blockers) ? teeResult.blockers : []
  const decisions = Array.isArray(teeResult.decisions) ? teeResult.decisions : []
  blockers.slice(0, 2).forEach((b, i) => {
    const t = b.title ?? b.description ?? ''
    if (t)
      out.push({
        id: `tee-b-${i}`,
        text: anonymizeForHostDisplay(t.slice(0, 120) + (t.length > 120 ? '…' : '')),
      })
  })
  decisions.slice(0, 2).forEach((d, i) => {
    const t = d.text ?? d.title ?? ''
    if (t)
      out.push({
        id: `tee-d-${i}`,
        text: anonymizeForHostDisplay(t.slice(0, 120) + (t.length > 120 ? '…' : '')),
      })
  })
  return out
}

function mergeDecisionTrendWithTee(baseTrend, teeDecisions) {
  if (!Array.isArray(teeDecisions) || teeDecisions.length === 0) return baseTrend
  return baseTrend.map((d, i) =>
    i === baseTrend.length - 1 ? { ...d, count: d.count + Math.min(teeDecisions.length, 2) } : d
  )
}

/**
 * @param {object} props
 * @param {object | null} [props.teeResult]
 * @param {boolean} [props.demoMode]
 * @param {Array} [props.transcripts]
 * @param {Record<string, string>} [props.teamNameById]
 */
export default function HackathonHostView({ teeResult, demoMode = false, transcripts = [], teamNameById = {} }) {
  const agg = buildHostAggregatesFromTranscripts(transcripts, teamNameById)
  const teeSnips = anonymizedTeeSnippets(teeResult)

  const useDemo = demoMode

  const averageVelocity = useDemo ? hackathonAverageVelocity : agg.averageVelocity
  const velocityByTeam = useDemo ? hackathonVelocityByTeam : agg.velocityByTeam
  const blockerThemes = useDemo ? hackathonCommonBlockerThemes : agg.blockerThemes
  const teamsRankedByBlockers = useDemo ? hackathonTeamsRankedByBlockers : agg.teamsRankedByBlockers

  const decisionTrends = useDemo
    ? teeResult
      ? mergeDecisionTrendWithTee([...hackathonDecisionTrends], teeResult.decisions)
      : hackathonDecisionTrends
    : agg.decisionTrends

  const maxTrend = Math.max(...decisionTrends.map((d) => d.count), 1)
  const maxVelocityPts =
    velocityByTeam.length > 0 ? Math.max(...velocityByTeam.map((x) => x.points), 1) : 1

  const avgDesc = useDemo
    ? 'Mean story points across registered teams (mock demo)'
    : 'Mean of each team’s average velocity from transcripts in this browser (TEE uploads)'

  const velocityDesc = useDemo
    ? 'Comparative throughput (no individual breakdown)'
    : 'Sum of velocity scores per team from uploaded transcripts'

  const blockersDesc = useDemo
    ? 'Themes affecting multiple teams (e.g. "3 teams blocked by API issues")'
    : 'Keyword themes aggregated from real blocker text in uploaded transcripts'

  const rankDesc = useDemo
    ? 'Ranked by open blocker signals (mock)'
    : 'Total blocker items recorded per team across uploads'

  const trendDesc = useDemo
    ? 'Aggregate decision volume — no attribution (mock + optional TEE bump)'
    : 'Decision counts by weekday from transcript timestamps — no attribution'

  if (!useDemo && !agg.hasData) {
    return (
      <div className="hackathon-host-view">
        <p className="hackathon-host-privacy">
          <strong>Hackathon Host:</strong> aggregates across all teams. Individual names appear as{' '}
          <strong>[Team Member]</strong>. No action items and no per-person assignments.
        </p>
        <section className="dashboard-section host-console-real-empty" aria-live="polite">
          <h2 className="dashboard-section-title">No transcript data yet</h2>
          <p className="dashboard-section-desc">
            Process a transcript from the participant app (with a team selected) so results are saved under{' '}
            <code>lucky-charm-transcripts</code> in this browser. Then refresh the Host console.
          </p>
          <p className="dashboard-section-desc">
            For development, turn on <strong>Show mock demo data</strong> above to preview charts.
          </p>
        </section>
        {teeSnips.length > 0 && (
          <section className="dashboard-section">
            <h2 className="dashboard-section-title">Anonymized session snippets</h2>
            <p className="dashboard-section-desc">From the latest processed transcript — names redacted</p>
            <ul className="host-snips-list">
              {teeSnips.map((s) => (
                <li key={s.id} className="host-snips-item">
                  {s.text}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="hackathon-host-view">
      <p className="hackathon-host-privacy">
        <strong>Hackathon Host:</strong> aggregates across all teams. Individual names appear as{' '}
        <strong>[Team Member]</strong>. No action items and no per-person assignments.
      </p>

      {!useDemo && agg.hasData && (
        <p className="host-console-data-source" role="status">
          Showing <strong>{agg.totalTranscripts}</strong> uploaded transcript{agg.totalTranscripts === 1 ? '' : 's'} ·{' '}
          {agg.totalBlockers} blocker item{agg.totalBlockers === 1 ? '' : 's'} · {agg.totalDecisions} decision
          {agg.totalDecisions === 1 ? '' : 's'} recorded
          {typeof agg.averageVelocityPerTranscript === 'number' && (
            <>
              {' '}
              · avg per upload: <strong>{agg.averageVelocityPerTranscript}</strong> pts
            </>
          )}
        </p>
      )}

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Average velocity</h2>
        <p className="dashboard-section-desc">{avgDesc}</p>
        <p className="host-metric-big">{averageVelocity.toFixed(1)} pts / team</p>
      </section>

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Velocity by team</h2>
        <p className="dashboard-section-desc">{velocityDesc}</p>
        <div className="host-velocity-by-team">
          {velocityByTeam.map((t) => {
            const key = t.teamId ?? t.team
            const label = t.team
            return (
              <div key={key} className="host-velocity-row">
                <span className="host-velocity-team">{label}</span>
                <div className="host-velocity-bar-track">
                  <div
                    className="host-velocity-bar-fill"
                    style={{ width: `${(t.points / maxVelocityPts) * 100}%` }}
                    title={`${label}: ${t.points} pts`}
                  />
                </div>
                <span className="host-velocity-pts">{t.points} pts</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Most common blockers</h2>
        <p className="dashboard-section-desc">{blockersDesc}</p>
        {blockerThemes.length === 0 ? (
          <p className="dashboard-section-desc host-console-muted-themes">
            No keyword themes matched yet. Blocker text may use different wording — try another upload or use demo mode.
          </p>
        ) : (
          <ul className="host-themes-list">
            {blockerThemes.map((t) => (
              <li key={t.id} className="host-themes-item">
                <span className="host-themes-label">{t.label}</span>
                <span className="host-themes-blurb">{useDemo ? t.blurb : t.blurb || `${t.count} signal(s)`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Teams with highest blocker count</h2>
        <p className="dashboard-section-desc">{rankDesc}</p>
        <ol className="host-rank-list">
          {teamsRankedByBlockers.map((row, idx) => (
            <li key={row.teamId ?? row.team} className="host-rank-item">
              <span className="host-rank-pos">{idx + 1}.</span>
              <span className="host-rank-team">{row.team}</span>
              <span className="host-rank-count">{row.blockerCount} open signals</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Decision trends (event)</h2>
        <p className="dashboard-section-desc">{trendDesc}</p>
        <div className="host-trend-chart">
          {decisionTrends.map((d) => (
            <div key={d.day} className="host-trend-col">
              <div
                className="host-trend-bar"
                style={{ height: `${(d.count / maxTrend) * 100}%` }}
                title={`${d.day}: ${d.count}`}
              />
              <span className="host-trend-label">{d.day}</span>
              <span className="host-trend-count">{d.count}</span>
            </div>
          ))}
        </div>
      </section>

      {teeSnips.length > 0 && (
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">Anonymized session snippets</h2>
          <p className="dashboard-section-desc">From the latest processed transcript — names redacted</p>
          <ul className="host-snips-list">
            {teeSnips.map((s) => (
              <li key={s.id} className="host-snips-item">
                {s.text}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
