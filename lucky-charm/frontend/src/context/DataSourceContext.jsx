import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'lucky-charm-data-source'
const DEFAULT_SOURCE = 'mock'

export const DataSourceContext = createContext({
  dataSource: DEFAULT_SOURCE,
  setDataSource: () => {},
})

export function DataSourceProvider({ children }) {
  const [dataSource, setDataSourceState] = useState(DEFAULT_SOURCE)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'real' || stored === 'mock') {
        setDataSourceState(stored)
      }
    } catch {
      // ignore
    }
    setMounted(true)
  }, [])

  const setDataSource = useCallback((value) => {
    setDataSourceState(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // ignore
    }
  }, [])

  return (
    <DataSourceContext.Provider
      value={{
        dataSource: mounted ? dataSource : DEFAULT_SOURCE,
        setDataSource,
      }}
    >
      {children}
    </DataSourceContext.Provider>
  )
}

export function useDataSource() {
  const ctx = useContext(DataSourceContext)
  if (!ctx) throw new Error('useDataSource must be used within DataSourceProvider')
  return ctx
}
