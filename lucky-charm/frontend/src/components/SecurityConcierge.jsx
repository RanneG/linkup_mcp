import { useMemo, useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTeam } from '../contexts/TeamContext'
import {
  getCurrentDeliverableLabel,
  getArchivedPhases,
} from '../utils/phaseStorage'
import { getTEEResult } from '../utils/teeResultStorage'
import './SecurityConcierge.css'

export const DEMO_GUIDE_UPDATE = 'lucky-charm-guide-update'
export const DASHBOARD_TAB_CHANGE = 'lucky-charm-dashboard-tab'
const SKIP_DEMO_KEY = 'lucky-charm-skip-demo'

function getSkipDemo() {
  try {
    return localStorage.getItem(SKIP_DEMO_KEY) === '1'
  } catch {
    return false
  }
}

function setSkipDemo() {
  try {
    localStorage.setItem(SKIP_DEMO_KEY, '1')
  } catch {}
}

const DASHBOARD_SEGMENT_MESSAGES = {
  overview: 'Overview: project story, summary, key insights. When ready, click Metrics in the sidebar.',
  metrics: 'Metrics — the velocity chart shows blockers, actions, and decisions over time per meeting. See your project momentum at a glance. When ready, click Actions.',
  actions: 'Actions — items grouped by due date: This week, Next week, Later, Overdue. Click a bar to filter. Helps you prioritize what to tackle first. When ready, click Blockers.',
  blockers: 'Blockers: grouped by theme. When ready, click Takeaways.',
  decisions_0: 'Takeaways — key decisions the team made, with who decided and when. Props-compliant: structured summaries, no verbatim quotes. Meeting pills filter by meeting.\n\nPress Next to learn about Copy for LLM.',
  decisions_1: 'Copy for LLM — Teams need AI help for status reports and planning, but pasting raw transcripts into ChatGPT exposes who said what and risks leaking sensitive details. PROPS (arxiv.org/abs/2410.20522) shows we can keep that intelligence while dropping the verbatim. This pastes only categories, themes, and structured summaries — what left the TEE. You get AI assistance without the privacy tradeoff.\n\nPress Next for Download JSON.',
  decisions_2: 'Download JSON — Same idea for machines. RAG and APIs need project context; feeding them raw transcripts is unsafe. This exports the Props-filtered output so you can ingest it into vector DBs, Jira, or BI tools — AI gets the signal without ever seeing the sensitive source. TEE Settings at the bottom.\n\nPress Next to load more samples and see the dashboard evolve.',
  decisions_3: 'Use the sample dropdown to load meetings 2–6 (Concept, Goals, Planning, Execution, Finished). Select one, upload to TEE, then upload another. Each adds to your project story. Press Next when you\'ve added a few.',
  decisions_4: 'See the meeting pills — each one is a meeting in your story. Click a pill to filter. The trajectory and blocker charts update as you add more. Press Next.',
  decisions_5: 'Mark deliverable complete to archive this phase. Use Previous deliverables to switch. Create a new deliverable for the next sprint. You\'re all set!',
}

function getNextStepMessage(pathname, { hasTeam, hasProject, hasUploaded }, dashboardTab, decisionsSubstep = 0) {
  if (pathname === '/login') return "Let's get you signed in — you can use your wallet, or just hit demo mode if you're exploring."
  if (pathname === '/host-console' || pathname.startsWith('/host-console')) return "Manage teams and oversee the hackathon from here."
  if (pathname === '/tee' || pathname.startsWith('/tee')) return "Here you can see the TEE architecture, why it's not auto-deployed (cost, attestation), and what happens when Live TEE is on."
  if (pathname === '/team' || pathname.startsWith('/team')) {
    if (!hasTeam) return "Welcome! To begin, your team needs to be set up first. Create a team or join one with a code."
    return "Great! Next: go to Upload and create a project."
  }
  if (pathname === '/upload' || pathname.startsWith('/upload')) {
    if (decisionsSubstep >= 3) {
      const key = `decisions_${decisionsSubstep}`
      return DASHBOARD_SEGMENT_MESSAGES[key] ?? DASHBOARD_SEGMENT_MESSAGES.decisions_3
    }
    if (!hasProject) return "I'll help you create a project, then you can start uploading your transcripts to the secure TEE!"
    if (!hasUploaded) return "Drag & drop a transcript here, or use the sample dropdown to try the demo."
    return "You've uploaded! Go to Dashboard to see your project story."
  }
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard')) {
    if (!hasUploaded) return "Upload a transcript first, then your project story will appear here."
    if (decisionsSubstep >= 3) {
      const key = `decisions_${decisionsSubstep}`
      return DASHBOARD_SEGMENT_MESSAGES[key] ?? DASHBOARD_SEGMENT_MESSAGES.decisions_3
    }
    if (dashboardTab === 'decisions') {
      const key = `decisions_${decisionsSubstep}`
      return DASHBOARD_SEGMENT_MESSAGES[key] ?? DASHBOARD_SEGMENT_MESSAGES.decisions_0
    }
    return DASHBOARD_SEGMENT_MESSAGES[dashboardTab] ?? DASHBOARD_SEGMENT_MESSAGES.overview
  }
  return "Navigate using Team, Upload, and Dashboard above."
}

export default function SecurityConcierge() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { currentTeam } = useTeam()
  const [tick, setTick] = useState(0)
  const [dashboardTab, setDashboardTab] = useState('overview')
  const [decisionsSubstep, setDecisionsSubstep] = useState(0)
  const [skipped, setSkipped] = useState(() => getSkipDemo())
  const [showWhyLogin, setShowWhyLogin] = useState(false)

  const isLogin = pathname === '/login' || pathname.startsWith('/login')

  useEffect(() => {
    if (dashboardTab !== 'decisions' && decisionsSubstep < 3) setDecisionsSubstep(0)
  }, [dashboardTab, decisionsSubstep])

  useEffect(() => {
    if (!isLogin) setShowWhyLogin(false)
  }, [isLogin])

  useEffect(() => {
    const handler = () => setTick((t) => t + 1)
    window.addEventListener(DEMO_GUIDE_UPDATE, handler)
    return () => window.removeEventListener(DEMO_GUIDE_UPDATE, handler)
  }, [])

  useEffect(() => {
    const handler = (e) => setDashboardTab(e?.detail?.tab ?? 'overview')
    window.addEventListener(DASHBOARD_TAB_CHANGE, handler)
    return () => window.removeEventListener(DASHBOARD_TAB_CHANGE, handler)
  }, [])

  const state = useMemo(() => {
    const hasTeam = !!currentTeam
    const label = getCurrentDeliverableLabel()
    const archived = getArchivedPhases()
    const hasProject = !!(label?.trim() || archived.length > 0)
    const teeResult = getTEEResult()
    const hasUploaded = !!(teeResult?.sessions?.length || teeResult?.blockers?.length)
    return { hasTeam, hasProject, hasUploaded }
  }, [pathname, currentTeam, tick])

  const message = useMemo(
    () => getNextStepMessage(pathname, state, dashboardTab, decisionsSubstep),
    [pathname, state.hasTeam, state.hasProject, state.hasUploaded, dashboardTab, decisionsSubstep]
  )

  const whyLoginMessage = 'Wallet sign-in is privacy-preserving: we only use a hash of your address — we never see your keys or full address. The "Use pseudonym" option hides your address from the UI so even teammates can\'t link contributions to you. Unlinkable SSO research underpins this design: pseudonyms and nullifiers prevent replay and reduce linkability. See paper below.'

  const showNextButton =
    (pathname.startsWith('/dashboard') && dashboardTab === 'decisions' && decisionsSubstep < 3) ||
    (decisionsSubstep >= 3 && decisionsSubstep < 5 && (pathname.startsWith('/dashboard') || pathname.startsWith('/upload')))

  const handleNext = () => {
    if (decisionsSubstep >= 5) return
    const next = decisionsSubstep + 1
    setDecisionsSubstep(next)
    if (decisionsSubstep === 2) navigate('/upload')
    else if (decisionsSubstep === 3) navigate('/dashboard')
  }

  const handleSkip = () => {
    setSkipDemo()
    setSkipped(true)
  }

  if (skipped) return null

  const displayMessage = isLogin && showWhyLogin ? whyLoginMessage : message

  return (
    <div className="security-concierge" aria-label="Security concierge assistant">
      <div className="security-concierge-bubble">
        <p className="security-concierge-text">{displayMessage}</p>
        {isLogin && showWhyLogin && (
          <p className="security-concierge-text security-concierge-text--small">
            <a href="https://eprint.iacr.org/2025/618" target="_blank" rel="noopener noreferrer" className="security-concierge-link">
              ASC / Unlinkable SSO (eprint.iacr.org/2025/618)
            </a>
          </p>
        )}
        <div className="security-concierge-actions">
          {isLogin && (
            <button
              type="button"
              className="security-concierge-why"
              onClick={() => setShowWhyLogin((v) => !v)}
            >
              {showWhyLogin ? 'Back' : 'Why?'}
            </button>
          )}
          {showNextButton && (
            <button
              type="button"
              className="security-concierge-next"
              onClick={handleNext}
            >
              Next
            </button>
          )}
          <button
            type="button"
            className="security-concierge-skip"
            onClick={handleSkip}
          >
            Not my first rodeo
          </button>
        </div>
      </div>
      <button
        type="button"
        className="security-concierge-fab security-concierge-fab--cat"
        aria-label="Demo guide — your security concierge"
        title="Demo guide"
      >
        <span className="security-concierge-cat-emoji" aria-hidden>🐱</span>
      </button>
    </div>
  )
}
