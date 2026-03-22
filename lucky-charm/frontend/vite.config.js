import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/** Where the browser’s `/sso-api` requests are forwarded (U2SSO). Default 8081 — 8080 is often taken by other local apps. */
const defaultSsoProxyTarget = 'http://localhost:8081'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const ssoProxyTarget = env.VITE_SSO_PROXY_TARGET || defaultSsoProxyTarget

  return {
    plugins: [react()],
    server: {
      port: 3000,
      /** If 3000 is taken, fail fast with a clear error instead of silently using 3001 (breaks docs & SSO proxy mental model). */
      strictPort: true,
      proxy: {
        // Forward /api/tee/* to local Flask backend (run backend with: cd backend && flask run -p 5000)
        '/api/tee': {
          target: 'http://localhost:5001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/tee/, ''),
        },
        // U2SSO — set VITE_SSO_BASE_URL=/sso-api in .env; override backend port via VITE_SSO_PROXY_TARGET
        '/sso-api': {
          target: ssoProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/sso-api/, ''),
        },
      },
    },
  }
})
