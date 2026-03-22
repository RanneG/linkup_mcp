import { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getProvider } from '../services/walletAuthService'
import { fetchLoginChallenge } from '../services/ssoService'
import { getPostLoginPath } from '../utils/postLoginRedirect'
import { getMockCredentialUsers } from '../utils/mockCredentialsStorage'
import './LoginPage.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname
  const {
    auth,
    ready,
    loginWithMockCredentials,
    completeWalletLogin,
    completeDemoGate,
    completeSsoLogin,
    ssoBaseUrl,
    ssoReachable,
  } = useAuth()

  const walletAvailable = useMemo(() => !!getProvider(), [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [usePseudonym, setUsePseudonym] = useState(false)
  const [demoModeSkip, setDemoModeSkip] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const [name, setName] = useState('')
  const [challenge, setChallenge] = useState('')
  const [sname, setSname] = useState('')
  const [spk, setSpk] = useState('')
  const [signature, setSignature] = useState('')

  const mockUsersTable = useMemo(() => getMockCredentialUsers(), [])

  useEffect(() => {
    if (!ready || !auth.gateCompleted) return
    const target = from && from !== '/login' ? from : getPostLoginPath(auth.dashboardRole)
    navigate(target, { replace: true })
  }, [ready, auth.gateCompleted, auth.dashboardRole, from, navigate])

  const loadChallenge = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      const { challenge: ch, sname: sn } = await fetchLoginChallenge(ssoBaseUrl)
      setChallenge(ch)
      setSname(sn)
    } catch (e) {
      setError(e?.message || 'Could not reach SSO server')
    } finally {
      setBusy(false)
    }
  }, [ssoBaseUrl])

  const onMockSubmit = async (e) => {
    e.preventDefault()
    if (demoModeSkip) return
    setError(null)
    setBusy(true)
    try {
      const next = loginWithMockCredentials(email, password, rememberMe, usePseudonym)
      navigate(from && from !== '/login' ? from : getPostLoginPath(next.dashboardRole), { replace: true })
    } catch (err) {
      setError(err?.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  const onDemoModeContinue = () => {
    setError(null)
    setBusy(true)
    try {
      completeDemoGate(rememberMe, usePseudonym)
      navigate(from && from !== '/login' ? from : getPostLoginPath('team-lead'), { replace: true })
    } catch (err) {
      setError(err?.message || 'Could not start demo mode')
    } finally {
      setBusy(false)
    }
  }

  const onWalletConnect = async () => {
    setError(null)
    setBusy(true)
    try {
      const next = await completeWalletLogin(rememberMe)
      navigate(from && from !== '/login' ? from : getPostLoginPath(next.dashboardRole), { replace: true })
    } catch (err) {
      setError(err?.message || 'Wallet connection failed')
    } finally {
      setBusy(false)
    }
  }

  const onSsoSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const next = await completeSsoLogin({ name, challenge, sname, spk, signature })
      navigate(from && from !== '/login' ? from : getPostLoginPath(next.dashboardRole), { replace: true })
    } catch (err) {
      setError(err?.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) {
    return (
      <div className="login-page login-page--boot">
        <p className="login-boot-msg">Loading…</p>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-split">
        {/* Left: branding (desktop) */}
        <div className="login-brand">
          <div className="login-brand-content">
            <div className="login-brand-logo">Lucky Charm</div>
            <h1 className="login-brand-title">
              Your Privacy,<br />
              <span>Perfected.</span>
            </h1>
            <p className="login-brand-desc">
              Step into a Trusted Execution Environment where your data remains yours. Secure, private, and effortlessly handled.
            </p>
          </div>
          <div className="login-brand-content">
            <div className="login-brand-badge">
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>verified_user</span>
              TEE Verified Connection
            </div>
          </div>
          <div className="login-brand-decor" aria-hidden>
            <div className="login-brand-blur-1" />
            <div className="login-brand-blur-2" />
          </div>
        </div>

        {/* Right: form */}
        <div className="login-form-panel">
          <div className="login-mobile-logo">Lucky Charm</div>
          <div className="login-form-wrap">
            <h2 className="login-form-title">Welcome back</h2>
            <p className="login-form-lead">Connect your identity to access your private dashboard.</p>

            {error && <p className="login-error">{error}</p>}

            <div className="login-primary-actions">
              {walletAvailable ? (
                <button
                  type="button"
                  className="login-btn login-btn--wallet"
                  onClick={onWalletConnect}
                  disabled={busy}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span className="material-symbols-outlined">account_balance_wallet</span>
                    {busy ? 'Connecting…' : 'Connect Wallet'}
                  </span>
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              ) : (
                <p className="login-wallet-unavailable">
                  Install MetaMask or Coinbase Wallet to connect. Or continue in demo mode below.
                </p>
              )}

              <button
                type="button"
                className="login-btn login-btn--demo"
                onClick={onDemoModeContinue}
                disabled={busy}
              >
                {busy ? 'Continuing…' : 'Continue in demo mode'}
              </button>
            </div>

            <div className="login-pseudonym-row">
              <div className="login-pseudonym-label">
                <strong>Use pseudonym</strong>
                <span className="login-pseudonym-hint">Hide your real wallet address from the UI</span>
              </div>
              <label className="login-checkbox-row" style={{ margin: 0, flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={usePseudonym}
                  onChange={(ev) => setUsePseudonym(ev.target.checked)}
                />
              </label>
            </div>

            <details className="login-other-options">
              <summary className="login-other-summary">Other sign-in options (email/pass)</summary>
              <label className="login-checkbox-row">
                <input
                  type="checkbox"
                  checked={demoModeSkip}
                  onChange={(ev) => setDemoModeSkip(ev.target.checked)}
                />
                <span>Show email/password form (mock accounts)</span>
              </label>
              {demoModeSkip && (
                <form className="login-form" onSubmit={onMockSubmit} style={{ marginTop: '1rem' }}>
                  <div className="login-mock-table-wrap" aria-label="Demo accounts" style={{ overflowX: 'auto', marginBottom: '1rem', borderRadius: 8, border: '1px solid var(--lc-outline-variant)' }}>
                    <table className="login-mock-table" style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left' }}>Role</th>
                          <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left' }}>Email</th>
                          <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left' }}>Password</th>
                          <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left' }}>Team</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mockUsersTable.map((u) => (
                          <tr key={u.email}>
                            <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                              {u.role === 'hackathon-host' ? 'Host' : u.role === 'team-lead' ? 'Team Lead' : 'Team Member'}
                            </td>
                            <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}><code>{u.email}</code></td>
                            <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}><code>{u.password}</code></td>
                            <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{u.teamName ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <label className="login-label">
                    Email
                    <input className="login-input" type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} autoComplete="username" required />
                  </label>
                  <label className="login-label">
                    Password
                    <input className="login-input" type="password" value={password} onChange={(ev) => setPassword(ev.target.value)} autoComplete="current-password" required />
                  </label>
                  <label className="login-checkbox-row">
                    <input type="checkbox" checked={rememberMe} onChange={(ev) => setRememberMe(ev.target.checked)} />
                    <span>Remember me</span>
                  </label>
                  <button type="submit" className="login-btn login-btn--demo" disabled={busy}>
                    {busy ? 'Signing in…' : 'Log in with mock'}
                  </button>
                </form>
              )}
            </details>

            {ssoReachable && ssoBaseUrl && (
              <>
                <div className="login-divider" />
                <details className="login-sso-details">
                  <summary className="login-sso-summary" style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>Advanced: U2SSO (hex challenge)</summary>
                  <p className="login-sso-lead" style={{ fontSize: '0.8rem', margin: '0.75rem 0 1rem', color: 'var(--lc-on-surface-variant)' }}>
                    Use sso-poc-stub for local dev. Set VITE_SSO_BASE_URL=/sso-api in .env.
                  </p>
                  <form className="login-form" onSubmit={onSsoSubmit}>
                    <label className="login-label">Display name <input className="login-input" value={name} onChange={(ev) => setName(ev.target.value)} required /></label>
                    <div className="login-challenge-row" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <button type="button" className="login-btn login-btn--demo" onClick={loadChallenge} disabled={busy}>{challenge ? 'Refresh challenge' : 'Get login challenge'}</button>
                    </div>
                    <label className="login-label">Challenge (hex) <input className="login-input login-input--mono" value={challenge} onChange={(ev) => setChallenge(ev.target.value)} required /></label>
                    <label className="login-label">sname (hex) <input className="login-input login-input--mono" value={sname} onChange={(ev) => setSname(ev.target.value)} required /></label>
                    <label className="login-label">spk (hex) <input className="login-input login-input--mono" value={spk} onChange={(ev) => setSpk(ev.target.value)} required /></label>
                    <label className="login-label">Signature (hex) <input className="login-input login-input--mono" value={signature} onChange={(ev) => setSignature(ev.target.value)} required /></label>
                    <button type="submit" className="login-btn login-btn--demo" disabled={busy}>Sign in with SSO</button>
                  </form>
                </details>
              </>
            )}
          </div>

          <p className="login-legal">End-to-End Encrypted • ISO 27001 Certified • No Tracking</p>
        </div>
      </div>
    </div>
  )
}
