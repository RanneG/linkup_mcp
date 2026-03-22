import { useState, useEffect, useRef } from 'react'
import { useDataSource } from '../context/DataSourceContext'
import {
  getLastTEEUploadAt,
  setLastTEEUploadAt,
  getIdleTimeoutMinutes,
  PHALA_DASHBOARD_URL,
} from '../utils/creditSaverStorage'
import './CreditSaver.css'

const CHECK_INTERVAL_MS = 60_000

export default function CreditSaver() {
  const { dataSource } = useDataSource()
  const [popupVisible, setPopupVisible] = useState(false)
  const remindTimerRef = useRef(null)

  useEffect(() => {
    if (dataSource !== 'real') return

    const last = getLastTEEUploadAt()
    if (last == null) setLastTEEUploadAt()

    const check = () => {
      const lastAt = getLastTEEUploadAt()
      if (lastAt == null) return
      const timeoutMin = getIdleTimeoutMinutes()
      const elapsed = Date.now() - lastAt
      if (elapsed >= timeoutMin * 60 * 1000) setPopupVisible(true)
    }

    check()
    const id = setInterval(check, CHECK_INTERVAL_MS)
    return () => {
      clearInterval(id)
      if (remindTimerRef.current) clearTimeout(remindTimerRef.current)
    }
  }, [dataSource])

  const handleDismiss = () => {
    setLastTEEUploadAt()
    setPopupVisible(false)
  }

  const handleRemindIn10 = () => {
    setPopupVisible(false)
    if (remindTimerRef.current) clearTimeout(remindTimerRef.current)
    remindTimerRef.current = setTimeout(() => setPopupVisible(true), 10 * 60 * 1000)
  }

  const handleGoToPhala = () => {
    window.open(PHALA_DASHBOARD_URL, '_blank', 'noopener,noreferrer')
    handleDismiss()
  }

  if (!popupVisible) return null

  return (
    <div className="credit-saver-overlay" role="dialog" aria-labelledby="credit-saver-title" aria-modal="true">
      <div className="credit-saver-backdrop" onClick={handleDismiss} aria-hidden />
      <div className="credit-saver-popup">
        <h2 id="credit-saver-title" className="credit-saver-title">
          ⚠️ TEE Credit Saver
        </h2>
        <p className="credit-saver-message">
          You&apos;ve been idle for {getIdleTimeoutMinutes()} minutes with the Real TEE connected.
          Remember to stop your GPU instance if you&apos;re done for the night.
        </p>
        <div className="credit-saver-actions">
          <button type="button" className="credit-saver-btn credit-saver-btn--dismiss" onClick={handleDismiss}>
            Dismiss
          </button>
          <button type="button" className="credit-saver-btn credit-saver-btn--remind" onClick={handleRemindIn10}>
            Remind me in 10 min
          </button>
          <button type="button" className="credit-saver-btn credit-saver-btn--phala" onClick={handleGoToPhala}>
            Go to Phala Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
