import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { DataSourceProvider } from './context/DataSourceContext'
import { AuthProvider } from './context/AuthContext'
import { TeamProvider } from './contexts/TeamContext'
import { TEEStatusProvider } from './context/TEEStatusContext'
import { DashboardRoleProvider } from './context/DashboardRoleContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import App from './App'
import './index.css'
import './styles/stitch-design.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <DataSourceProvider>
        <AuthProvider>
          <TeamProvider>
            <DashboardRoleProvider>
              <TEEStatusProvider>
                <ErrorBoundary>
                  <App />
                </ErrorBoundary>
              </TEEStatusProvider>
            </DashboardRoleProvider>
          </TeamProvider>
        </AuthProvider>
      </DataSourceProvider>
    </BrowserRouter>
  </React.StrictMode>
)
