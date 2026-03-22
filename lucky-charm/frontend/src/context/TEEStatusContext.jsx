import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useDataSource } from './DataSourceContext'
import { checkTEEReachable } from '../services/teeService'

const POLL_INTERVAL_MS = 30000

export const TEEStatusContext = createContext({
  status: 'offline', // 'checking' | 'connected' | 'offline'
  checkNow: () => {},
})

export function TEEStatusProvider({ children }) {
  const { dataSource } = useDataSource()
  const [status, setStatus] = useState('offline')

  const checkNow = useCallback(async () => {
    if (dataSource !== 'real') return
    setStatus('checking')
    const { reachable } = await checkTEEReachable()
    setStatus(reachable ? 'connected' : 'offline')
  }, [dataSource])

  useEffect(() => {
    if (dataSource !== 'real') {
      setStatus('offline')
      return
    }
    checkNow()
    const id = setInterval(checkNow, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [dataSource, checkNow])

  return (
    <TEEStatusContext.Provider value={{ status, checkNow }}>
      {children}
    </TEEStatusContext.Provider>
  )
}

export function useTEEStatus() {
  const ctx = useContext(TEEStatusContext)
  if (!ctx) throw new Error('useTEEStatus must be used within TEEStatusProvider')
  return ctx
}
