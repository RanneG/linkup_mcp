import { Link } from 'react-router-dom'
import './TEEPage.css'

export default function TEEPage() {
  return (
    <div className="tee-page">
      <header className="tee-page-header">
        <h1 className="tee-page-title">TEE architecture</h1>
        <p className="tee-page-subtitle">
          How Lucky Charm processes transcripts in a Trusted Execution Environment
        </p>
      </header>

      <section className="tee-section">
        <h2 className="tee-section-title">System flow</h2>
        <div className="tee-flow">
          <div className="tee-flow-step">
            <span className="tee-flow-label">Browser</span>
            <span className="tee-flow-desc">Upload transcript via HTTPS</span>
          </div>
          <span className="tee-flow-arrow">→</span>
          <div className="tee-flow-step">
            <span className="tee-flow-label">API Gateway</span>
            <span className="tee-flow-desc">Health, Process, Attestation</span>
          </div>
          <span className="tee-flow-arrow">→</span>
          <div className="tee-flow-step tee-flow-step--tee">
            <span className="tee-flow-label">Phala CVM (TEE)</span>
            <span className="tee-flow-desc">Ingest → Extract → Props Filter → Output</span>
          </div>
          <span className="tee-flow-arrow">→</span>
          <div className="tee-flow-step">
            <span className="tee-flow-label">Policy-filtered output</span>
            <span className="tee-flow-desc">Blockers, actions, decisions — no verbatim quotes</span>
          </div>
        </div>
      </section>

      <section className="tee-section">
        <h2 className="tee-section-title">Components</h2>
        <div className="tee-table-wrap">
          <table className="tee-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Frontend</td>
                <td>React app: login, upload, dashboard. Mock or Live TEE mode.</td>
              </tr>
              <tr>
                <td>Backend (Phala CVM)</td>
                <td>Flask app inside Confidential VM. Processes transcripts only in TEE.</td>
              </tr>
              <tr>
                <td>Props Filter</td>
                <td>Ensures only metrics, themes, velocity leave TEE. No verbatim quotes.</td>
              </tr>
              <tr>
                <td>U2SSO / sso-poc</td>
                <td>Optional: pseudonym-based auth. Submissions tied to opaque participant_id.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="tee-section tee-section--highlight">
        <h2 className="tee-section-title">Why isn&apos;t the Live TEE auto-deployed?</h2>
        <p className="tee-section-p">
          Running a production-grade TEE (Phala CVM) comes with significant cost and operational overhead.
          We keep the demo lightweight so you can explore without infrastructure:
        </p>
        <ul className="tee-list">
          <li>
            <strong>Confidential VM pricing</strong> — Phala CVM instances cost roughly 3–5× standard cloud VMs
            due to SGX/TDX isolation and attestation. Cold starts add latency and idle costs.
          </li>
          <li>
            <strong>Attestation services</strong> — Remote attestation (Intel PCS, AMD PCS, etc.) has per-report
            fees and rate limits. High-volume deployments need dedicated attestation contracts.
          </li>
          <li>
            <strong>Compliance and auditing</strong> — Production TEE deployments often require SOC2 alignment,
            threat-model documentation, and periodic re-attestation. Not needed for demos.
          </li>
          <li>
            <strong>Regional availability</strong> — Confidential compute isn&apos;t available in all regions.
            Auto-deploy would need failover logic and multi-region costs.
          </li>
        </ul>
      </section>

      <section className="tee-section">
        <h2 className="tee-section-title">If Live TEE were turned on</h2>
        <p className="tee-section-p">
          When you switch to <strong>Live TEE</strong> (via TEE Settings or data source toggle), here&apos;s what would happen:
        </p>
        <ul className="tee-list">
          <li>
            <strong>Transcripts go to the real backend</strong> — Each upload is sent to a deployed Phala CVM
            over HTTPS. The backend runs inside a Confidential VM; the host cannot read transcript contents.
          </li>
          <li>
            <strong>Props filter enforces output policy</strong> — Only blockers, actions, and decisions
            (categories and themes) leave the TEE. No verbatim quotes. See{' '}
            <a href="https://arxiv.org/abs/2410.20522" target="_blank" rel="noopener noreferrer">
              Props (2410.20522)
            </a>
            .
          </li>
          <li>
            <strong>Attestation for verification</strong> — The client can fetch an attestation report
            to verify the TEE is running genuine, unmodified code before sending sensitive data.
          </li>
          <li>
            <strong>U2SSO for replay resistance</strong> — If SSO is configured, each submission uses a
            unique nullifier so duplicate submissions are rejected. See{' '}
            <a href="https://eprint.iacr.org/2025/618" target="_blank" rel="noopener noreferrer">
              ASC (2025-618)
            </a>
            .
          </li>
        </ul>
      </section>

      <section className="tee-section tee-section--research">
        <h2 className="tee-section-title">Research alignment</h2>
        <table className="tee-table">
          <thead>
            <tr>
              <th>Area</th>
              <th>Paper</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Props</td>
              <td>
                <a href="https://arxiv.org/abs/2410.20522" target="_blank" rel="noopener noreferrer">
                  2410.20522
                </a>
                — contextual integrity, no verbatim output
              </td>
            </tr>
            <tr>
              <td>ASC / U2SSO</td>
              <td>
                <a href="https://eprint.iacr.org/2025/618" target="_blank" rel="noopener noreferrer">
                  2025-618
                </a>
                — unlinkable SSO, pseudonyms
              </td>
            </tr>
            <tr>
              <td>TEE</td>
              <td>
                <a href="https://arxiv.org/abs/2506.14964" target="_blank" rel="noopener noreferrer">
                  2506.14964
                </a>
                — threat model & deployment
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="tee-page-actions">
        <Link to="/upload" className="tee-btn tee-btn--primary">
          Back to Upload
        </Link>
        <Link to="/dashboard" className="tee-btn tee-btn--secondary">
          Dashboard
        </Link>
      </div>
    </div>
  )
}
