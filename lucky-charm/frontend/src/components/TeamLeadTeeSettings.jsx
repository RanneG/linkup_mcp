import { useState, useCallback, useEffect } from 'react'
import { useDataSource } from '../context/DataSourceContext'
import { useTEEStatus } from '../context/TEEStatusContext'
import DataSourceToggle from './DataSourceToggle'
import { getTEEEndpoint, checkTEEHealth, fetchAttestation } from '../services/teeService'
import { getTEEEndpointOverride, setTEEEndpointOverride } from '../utils/teeEndpointStorage'
import { getIdleTimeoutMinutes, setIdleTimeoutMinutes } from '../utils/creditSaverStorage'
import './TeamLeadTeeSettings.css'

const TIMEOUT_OPTIONS = [15, 30, 60]

/** Phala trust / attestation (opens in new tab) */
export const PHALA_ATTESTATION_URL = 'https://trust.phala.com'

export default function TeamLeadTeeSettings() {
  const { dataSource } = useDataSource()
  const { status: teeStatus, checkNow } = useTEEStatus()
  const [open, setOpen] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [idleTimeoutMin, setIdleTimeoutMin] = useState(30)
  const [teeEndpointInput, setTeeEndpointInput] = useState(() => getTEEEndpoint())
  const [attestationReport, setAttestationReport] = useState(null)
  const [attestationLoading, setAttestationLoading] = useState(false)

  useEffect(() => {
    setIdleTimeoutMin(getIdleTimeoutMinutes())
  }, [])

  const handleSaveTEEEndpoint = useCallback(() => {
    const trimmed = teeEndpointInput.trim().replace(/\/$/, '')
    if (trimmed) {
      setTEEEndpointOverride(trimmed)
      setTeeEndpointInput(trimmed)
      checkNow()
    } else {
      setTEEEndpointOverride('')
      setTeeEndpointInput(getTEEEndpoint())
      checkNow()
    }
  }, [teeEndpointInput, checkNow])

  const handleTestConnection = useCallback(async () => {
    setTestResult('checking')
    const result = await checkTEEHealth()
    setTestResult(result)
  }, [])

  const handleFetchAttestation = useCallback(async () => {
    if (dataSource === 'mock') return
    setAttestationLoading(true)
    setAttestationReport(null)
    try {
      const report = await fetchAttestation()
      setAttestationReport(report)
    } catch (e) {
      setAttestationReport({ error: e?.message ?? 'Failed to fetch attestation' })
    } finally {
      setAttestationLoading(false)
    }
  }, [dataSource])

  const statusDot = dataSource === 'mock' ? null : teeStatus

  return (
    <div className="tl-tee-panel">
      <button
        type="button"
        className="tl-tee-summary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="tl-tee-settings-body"
        id="tl-tee-settings-heading"
      >
        <span className="tl-tee-summary-text">TEE Status &amp; Settings</span>
        <span className="tl-tee-chevron" aria-hidden>
          {open ? '▼' : '▶'}
        </span>
      </button>

      {open && (
        <div
          id="tl-tee-settings-body"
          className="tl-tee-body"
          role="region"
          aria-labelledby="tl-tee-settings-heading"
        >
          <p className="tl-tee-endpoint-display">
            <span className="tl-tee-endpoint-label">Current endpoint</span>
            <code className="tl-tee-endpoint-value">{getTEEEndpoint()}</code>
          </p>

          <section className="dev-section">
            <h3 className="dev-section-title">Data source</h3>
            <p className="dev-section-desc">Preference is saved in localStorage.</p>
            <DataSourceToggle realLabel="Live TEE" />
          </section>

          <section className="dev-section dev-section--endpoint">
            <h3 className="dev-section-title">TEE endpoint</h3>
            <div className="dev-endpoint-row">
              <input
                type="text"
                inputMode="url"
                autoComplete="off"
                className="dev-endpoint-input"
                value={teeEndpointInput}
                onChange={(e) => setTeeEndpointInput(e.target.value)}
                onBlur={handleSaveTEEEndpoint}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSaveTEEEndpoint())}
                placeholder="https://your-tee.phala.network or /api/tee"
                aria-label="TEE endpoint URL"
              />
              <button type="button" className="dev-save-endpoint-btn" onClick={handleSaveTEEEndpoint}>
                Save
              </button>
            </div>
            <p className="dev-section-desc">
              {getTEEEndpointOverride()
                ? 'Saved in browser storage. Clear the field and blur to use build default.'
                : 'From VITE_TEE_URL or default /api/tee. Enter a URL to override (e.g. your Phala CVM URL).'}
            </p>
          </section>

          <section className="dev-section">
            <h3 className="dev-section-title">Connection status</h3>
            {dataSource === 'mock' ? (
              <p className="dev-section-desc">Using mock data — TEE status not checked.</p>
            ) : (
              <>
                <div className="dev-status-row">
                  <span className={`dev-status-dot dev-status-dot--${statusDot}`} aria-hidden />
                  <span className="dev-status-label">
                    {statusDot === 'checking' && 'Checking…'}
                    {statusDot === 'connected' && 'Connected'}
                    {statusDot === 'offline' && 'Offline'}
                  </span>
                </div>
                <button
                  type="button"
                  className="dev-test-btn"
                  onClick={handleTestConnection}
                  disabled={testResult === 'checking'}
                >
                  {testResult === 'checking' ? 'Checking…' : 'Test connection'}
                </button>
                {testResult && testResult !== 'checking' && (
                  <p className={`dev-test-result dev-test-result--${testResult.reachable ? 'ok' : 'fail'}`}>
                    {testResult.reachable ? '✓ Health check passed' : `✗ ${testResult.message ?? 'Unreachable'}`}
                  </p>
                )}
              </>
            )}
          </section>

          <section className="dev-section">
            <h3 className="dev-section-title">TEE Credit Saver</h3>
            <p className="dev-section-desc">
              When using Live TEE, you&apos;ll get a reminder to stop your GPU instance after this much idle time (no
              uploads).
            </p>
            <div className="dev-timeout-options">
              {TIMEOUT_OPTIONS.map((min) => (
                <label key={min} className="dev-timeout-label">
                  <input
                    type="radio"
                    name="idle-timeout-tl"
                    value={min}
                    checked={idleTimeoutMin === min}
                    onChange={() => {
                      setIdleTimeoutMinutes(min)
                      setIdleTimeoutMin(min)
                    }}
                    className="dev-timeout-radio"
                  />
                  <span className="dev-timeout-text">{min} minutes</span>
                </label>
              ))}
            </div>
          </section>

          <section className="dev-section">
            <h3 className="dev-section-title">Attestation</h3>
            <p className="dev-section-desc">
              Fetch attestation from the TEE to verify its identity. The report proves the CVM is running in a trusted
              enclave (Phala), with code and environment unmodified. Hosts can confirm this before allowing uploads.
            </p>
            <div className="dev-attestation-actions">
              <button
                type="button"
                className="tl-tee-attest-btn"
                onClick={handleFetchAttestation}
                disabled={dataSource === 'mock' || attestationLoading}
                title="Verify the TEE runs in a Phala CVM enclave — attestation proves the code and environment haven't been tampered with"
              >
                {attestationLoading ? (
                  <span className="tl-tee-attest-loading">
                    <span className="tl-tee-attest-spinner" aria-hidden />
                    Fetching…
                  </span>
                ) : (
                  'Fetch attestation report'
                )}
              </button>
              <a
                href={PHALA_ATTESTATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="tl-tee-attest-btn tl-tee-attest-btn--link"
              >
                Phala Trust
              </a>
            </div>
            {attestationReport && (
              <div className={`dev-attestation-result ${attestationReport.error ? 'dev-attestation-result--error' : ''}`}>
                {attestationReport.error ? (
                  <p>{attestationReport.error}</p>
                ) : (
                  <>
                    <p className="dev-attestation-message">{attestationReport.message}</p>
                    {attestationReport.phala_dashboard && (
                      <a href={attestationReport.phala_dashboard} target="_blank" rel="noopener noreferrer">
                        Phala Cloud Dashboard
                      </a>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
