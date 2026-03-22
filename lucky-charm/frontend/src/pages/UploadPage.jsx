import { useState, useCallback, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { parseTranscriptPreview } from '../utils/parseTranscript'
import { useDataSource } from '../context/DataSourceContext'
import { useTeam } from '../contexts/TeamContext'
import { getOrCreateUserId, getUserTeam } from '../utils/teamStorage'
import { useTEEStatus } from '../context/TEEStatusContext'
import { useAuth } from '../context/AuthContext'
import {
  checkTEEHealth,
  processTranscript,
  TEE_UNREACHABLE_MESSAGE,
} from '../services/teeService'
import { fetchSubmissionNullifier } from '../services/ssoService'
import { generateClientNullifier } from '../services/walletAuthService'
import { getTEEResult, setTEEResult } from '../utils/teeResultStorage'
import { getCurrentPhaseNumber, getArchivedPhases, getCurrentDeliverableLabel, createFirstDeliverable } from '../utils/phaseStorage'
import { adaptTEEResponse } from '../utils/propsResultAdapter'
import { getMockResultForFile } from '../data/mockHackathonResults'
import { setLastTEEUploadAt } from '../utils/creditSaverStorage'
import { DEMO_GUIDE_UPDATE } from '../components/SecurityConcierge'
import DropZone from '../components/DropZone'
import FilePreview from '../components/FilePreview'
import UploadStatus from '../components/UploadStatus'
import SuccessMessage from '../components/SuccessMessage'

export default function UploadPage() {
  const { dataSource, setDataSource } = useDataSource()
  const { currentTeam, currentUserDisplayName } = useTeam()
  const { status: teeStatus } = useTEEStatus()
  const { auth, isSsoMode, isWalletMode, ssoBaseUrl } = useAuth()

  const uid = getOrCreateUserId()
  const teamFromStorage = getUserTeam(uid)
  const storageTeamId = teamFromStorage?.teamId ?? null
  const contextTeamId = currentTeam?.teamId ?? null
  /** Prefer context; fall back to localStorage (same tick as create/join). */
  const effectiveTeam = currentTeam ?? teamFromStorage
  const canUpload = useMemo(
    () => !!(storageTeamId || contextTeamId),
    [storageTeamId, contextTeamId],
  )
  const [files, setFiles] = useState([])
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState('idle') // idle | connecting | uploading | success
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [lastResult, setLastResult] = useState(null) // aggregation shown after successful upload
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [createProjectLabel, setCreateProjectLabel] = useState('')
  const [teeResult, setTeeResultState] = useState(() => getTEEResult())
  const [justUploaded, setJustUploaded] = useState(null) // { filename } — shown briefly after success

  useEffect(() => {
    const handler = () => setTeeResultState(getTEEResult())
    window.addEventListener('storage', handler)
    window.addEventListener(DEMO_GUIDE_UPDATE, handler)
    setTeeResultState(getTEEResult())
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener(DEMO_GUIDE_UPDATE, handler)
    }
  }, [])

  const uploadedSessions = teeResult?.sessions ?? []

  const archivedPhases = getArchivedPhases()
  const phaseNum = getCurrentPhaseNumber()
  const storedLabel = getCurrentDeliverableLabel()
  const isFreshNoDeliverable = phaseNum === 1 && archivedPhases.length === 0 && !storedLabel
  const canUploadWithDeliverable = canUpload && !isFreshNoDeliverable

  const handleCreateProject = useCallback(() => {
    if (createFirstDeliverable(createProjectLabel.trim() || undefined)) {
      setShowCreateProjectModal(false)
      setCreateProjectLabel('')
      window.dispatchEvent(new CustomEvent(DEMO_GUIDE_UPDATE))
    }
  }, [createProjectLabel])

  const handleFiles = useCallback((acceptedFiles) => {
    if (!acceptedFiles?.length || !canUploadWithDeliverable) return
    const arr = Array.isArray(acceptedFiles) ? acceptedFiles : [acceptedFiles]
    setFiles(arr)
    setError(null)
    const first = arr[0]
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result ?? ''
      setPreview(parseTranscriptPreview(text))
    }
    reader.readAsText(first)
    setStatus('idle')
    setProgress(0)
  }, [canUploadWithDeliverable])

  const uploadToTEE = useCallback(async () => {
    if (!files?.length || !canUploadWithDeliverable) return
    setError(null)
    setProgress(0)

    const assigneeForYou = (currentUserDisplayName || '').trim() || 'Team lead'

    if (dataSource === 'mock') {
      setStatus('uploading')
      const total = files.length
      const duration = total * 400
      const step = 100 / (duration / 50)
      let elapsed = 0
      const id = setInterval(() => {
        elapsed += 50
        if (elapsed >= duration) {
          clearInterval(id)
          if (effectiveTeam) {
            for (const file of files) {
              const mockResult = getMockResultForFile(file.name)
              const adapted = adaptTEEResponse(mockResult)
              const stored = {
                filename: file.name,
                blockers: adapted.blockers.map((b, i) =>
                  i < 2 ? { ...b, reported_by: assigneeForYou } : b
                ),
                action_items: adapted.action_items.map((a, i) =>
                  i < 3 ? { ...a, assignee: assigneeForYou } : a
                ),
                decisions: adapted.decisions,
                teamId: effectiveTeam.teamId,
                teamName: effectiveTeam.teamName,
              }
              setTEEResult(stored)
            }
            const lastFile = total > 1 ? `${total} files` : files[0].name
            setJustUploaded(lastFile)
            setFiles([])
            setPreview(null)
            setStatus('idle')
            setTeeResultState(getTEEResult())
          }
          setProgress(100)
          if (!effectiveTeam) setStatus('success')
          window.dispatchEvent(new CustomEvent(DEMO_GUIDE_UPDATE))
        } else {
          setProgress((p) => Math.min(99, p + step))
        }
      }, 50)
      return
    }

    setStatus('connecting')
    const { reachable, message } = await checkTEEHealth()
    if (!reachable) {
      setError(message || TEE_UNREACHABLE_MESSAGE)
      setStatus('idle')
      return
    }

    setStatus('uploading')
    try {
      const participantId = auth.participantId || auth.userId
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        let nullifier = null
        if (isSsoMode && ssoBaseUrl && participantId) {
          try {
            const nfRes = await fetchSubmissionNullifier(ssoBaseUrl, participantId, auth.sessionToken)
            nullifier = nfRes?.nullifier ?? null
          } catch (nfErr) {
            setError(nfErr?.message ?? 'Could not obtain submission nullifier from SSO')
            setStatus('idle')
            return
          }
        } else if (isWalletMode && participantId) {
          try {
            nullifier = await generateClientNullifier(participantId)
          } catch (nfErr) {
            setError(nfErr?.message ?? 'Could not generate submission nullifier')
            setStatus('idle')
            return
          }
        }
        const opts = { participantId }
        if (nullifier) opts.nullifier = nullifier
        const body = await processTranscript(file, (p) => setProgress(((i / files.length) + (p / 100) / files.length) * 100), opts)
        const adapted = adaptTEEResponse(body)
        const stored = {
          filename: file.name,
          blockers: adapted.blockers,
          action_items: adapted.action_items,
          decisions: adapted.decisions,
          teamId: effectiveTeam?.teamId ?? null,
          teamName: effectiveTeam?.teamName ?? null,
        }
        setTEEResult(stored)
      }
      const lastFile = files.length > 1 ? `${files.length} files` : files[0].name
      setJustUploaded(lastFile)
      setFiles([])
      setPreview(null)
      setLastTEEUploadAt()
      setProgress(100)
      setStatus('idle')
      setTeeResultState(getTEEResult())
      window.dispatchEvent(new CustomEvent(DEMO_GUIDE_UPDATE))
    } catch (err) {
      const msg = err?.message ?? 'Upload failed'
      setError(msg === 'Network error — TEE may be unreachable' ? TEE_UNREACHABLE_MESSAGE : msg)
      setStatus('idle')
      setProgress(0)
    }
  }, [files, dataSource, canUploadWithDeliverable, effectiveTeam, auth, currentUserDisplayName, isSsoMode, isWalletMode, ssoBaseUrl])

  const reset = useCallback(() => {
    setFiles([])
    setPreview(null)
    setStatus('idle')
    setProgress(0)
    setError(null)
    setLastResult(null)
  }, [])

  const switchToMock = useCallback(() => {
    setDataSource('mock')
    setError(null)
    setStatus('idle')
    setProgress(0)
  }, [setDataSource])

  const SAMPLE_FILES = [
    { file: 'lucky_charm_standup_01.tab', label: 'Meeting 1 — No plan' },
    { file: 'lucky_charm_standup_02.tab', label: 'Meeting 2 — Concept' },
    { file: 'lucky_charm_standup_03.tab', label: 'Meeting 3 — Goals' },
    { file: 'lucky_charm_standup_04.tab', label: 'Meeting 4 — Planning' },
    { file: 'lucky_charm_standup_05.tab', label: 'Meeting 5 — Execution' },
    { file: 'lucky_charm_standup_06.tab', label: 'Meeting 6 — Finished' },
  ]

  useEffect(() => {
    if (!justUploaded) return
    const t = setTimeout(() => setJustUploaded(null), 3000)
    return () => clearTimeout(t)
  }, [justUploaded])

  const loadSampleTranscript = useCallback(async (filename) => {
    if (!canUploadWithDeliverable || dataSource !== 'mock') return
    setError(null)
    try {
      const res = await fetch(`/mock_hackathon_data/${filename}`)
      if (!res.ok) throw new Error('Sample transcript not found')
      const blob = await res.blob()
      const file = new File([blob], filename, { type: 'text/tab-separated-values' })
      handleFiles([file])
    } catch (err) {
      setError(err?.message ?? 'Failed to load sample transcript')
    }
  }, [canUploadWithDeliverable, dataSource, handleFiles])

  const showTEEUnreachableWarning = dataSource === 'real' && teeStatus === 'offline'
  const isConnectingOrUploading = status === 'connecting' || status === 'uploading'
  const uploadDisabled = isConnectingOrUploading || !canUploadWithDeliverable

  const SAMPLE_LABELS = {
    'lucky_charm_standup_01.tab': 'Meeting 1 — No plan',
    'lucky_charm_standup_02.tab': 'Meeting 2 — Concept',
    'lucky_charm_standup_03.tab': 'Meeting 3 — Goals',
    'lucky_charm_standup_04.tab': 'Meeting 4 — Planning',
    'lucky_charm_standup_05.tab': 'Meeting 5 — Execution',
    'lucky_charm_standup_06.tab': 'Meeting 6 — Finished',
  }
  const sessionLabel = (s, i) => SAMPLE_LABELS[s.filename] ?? `Meeting ${i + 1}`

  return (
    <>
      {status === 'success' && !uploadedSessions.length ? (
        <SuccessMessage
          onUploadAnother={reset}
          variant={dataSource === 'real' ? 'real' : 'mock'}
          result={lastResult}
        />
      ) : (
        <>
          {!canUpload && (
            <p className="upload-warning upload-warning--team" role="alert">
              Join or create a team on the <strong>Team</strong> tab before uploading.
            </p>
          )}
          {canUpload && isFreshNoDeliverable && (
            <div className="upload-create-project-gate">
              <div className="upload-create-project-icon" aria-hidden>
                <span className="material-symbols-outlined">folder_open</span>
              </div>
              <p className="upload-create-project-title">Create your project first</p>
              <p className="upload-create-project-desc">
                Name your deliverable before uploading transcripts. This sets up your project structure.
              </p>
              <div className="upload-create-project-actions">
                <button
                  type="button"
                  className="upload-btn"
                  onClick={() => setShowCreateProjectModal(true)}
                >
                  Create Project
                </button>
                <Link to="/dashboard" className="upload-btn upload-btn--secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  Or go to Dashboard
                </Link>
              </div>
            </div>
          )}
          {showCreateProjectModal && (
            <div
              className="dashboard-modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="upload-create-modal-title"
              onClick={() => setShowCreateProjectModal(false)}
            >
              <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
                <h2 id="upload-create-modal-title" className="dashboard-modal-title">Create Project</h2>
                <p className="dashboard-modal-desc">Name your first deliverable to get started.</p>
                <label className="dashboard-modal-label" htmlFor="upload-create-label">Deliverable name</label>
                <input
                  id="upload-create-label"
                  className="dashboard-modal-input"
                  type="text"
                  value={createProjectLabel}
                  onChange={(e) => setCreateProjectLabel(e.target.value)}
                  placeholder="e.g. MVP, Sprint 1"
                />
                <div className="dashboard-modal-actions">
                  <button type="button" className="dashboard-btn dashboard-btn--primary" onClick={handleCreateProject}>
                    Create
                  </button>
                  <button type="button" className="dashboard-btn dashboard-btn--secondary" onClick={() => { setShowCreateProjectModal(false); setCreateProjectLabel('') }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          {canUploadWithDeliverable && showTEEUnreachableWarning && (
            <p className="upload-warning" role="alert">
              TEE is unreachable. Uploads will fail until the connection is restored, or switch to Mock Data.
            </p>
          )}
          {canUploadWithDeliverable && error && (
            <div className="upload-error-wrap">
              <p className="upload-error" role="alert">
                {error}
              </p>
              <div className="upload-error-actions">
                <button type="button" className="upload-btn" onClick={uploadToTEE}>
                  Retry
                </button>
                <button
                  type="button"
                  className="upload-btn upload-btn--secondary"
                  onClick={switchToMock}
                >
                  Use Mock Data instead
                </button>
              </div>
            </div>
          )}
          {canUploadWithDeliverable && justUploaded && (
            <div className="upload-just-added" role="status">
              <span className="upload-just-added-icon" aria-hidden>✓</span>
              <span>{justUploaded} added to your story.</span>
            </div>
          )}
          {canUploadWithDeliverable && uploadedSessions.length > 0 && (
            <div className="upload-meetings-list">
              <h3 className="upload-meetings-list-title">Meetings uploaded ({uploadedSessions.length})</h3>
              <ul className="upload-meetings-list-items">
                {uploadedSessions.map((s, i) => (
                  <li key={s.id ?? i} className="upload-meetings-list-item">
                    <span className="material-symbols-outlined upload-meetings-list-check">check_circle</span>
                    {sessionLabel(s, i)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {canUploadWithDeliverable && dataSource === 'mock' && (
            <div className="upload-sample-hint">
              <label htmlFor="upload-sample-select" className="upload-sample-label">Load sample transcript:</label>
              <select
                id="upload-sample-select"
                className="upload-sample-select"
                value=""
                onChange={(e) => {
                  const v = e.target.value
                  if (v) {
                    loadSampleTranscript(v)
                    e.target.value = ''
                  }
                }}
                disabled={uploadDisabled}
                aria-label="Choose a sample transcript to load"
              >
                <option value="">Choose meeting...</option>
                {SAMPLE_FILES.map(({ file, label }) => (
                  <option key={file} value={file}>{label}</option>
                ))}
              </select>
              <span className="upload-sample-hint-text">Each adds to your project story. Upload to TEE after selecting.</span>
            </div>
          )}
          {canUploadWithDeliverable && (
            <DropZone
              onFiles={handleFiles}
              disabled={uploadDisabled}
              hasFiles={files.length > 0}
              fileCount={files.length}
            />
          )}
          {canUploadWithDeliverable && files.length > 0 && preview && (
            <FilePreview
              fileName={files.length > 1 ? `${files.length} files selected (preview: ${files[0].name})` : files[0].name}
              preview={preview}
            />
          )}
          {canUploadWithDeliverable && files.length > 0 && status === 'idle' && (
            <button
              type="button"
              className="upload-btn"
              onClick={uploadToTEE}
              disabled={!canUploadWithDeliverable}
            >
              Upload to TEE
            </button>
          )}
          {canUploadWithDeliverable && status === 'connecting' && (
            <UploadStatus
              progress={0}
              statusText="Connecting to secure TEE..."
              showProgressBar={false}
            />
          )}
          {canUploadWithDeliverable && status === 'uploading' && (
            <UploadStatus
              progress={progress}
              statusText={dataSource === 'real' ? 'Sending to secure TEE…' : 'Uploading to TEE…'}
              showProgressBar={true}
            />
          )}
        </>
      )}
    </>
  )
}
