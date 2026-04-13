import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

const CHUNK_RELOAD_KEY = 'teg_chunk_reload_at'

function isChunkLoadFailure(reason: unknown): boolean {
  const message =
    typeof reason === 'string'
      ? reason
      : reason instanceof Error
        ? reason.message
        : typeof reason === 'object' && reason && 'message' in reason
          ? String((reason as { message?: unknown }).message ?? '')
          : ''

  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Loading chunk') ||
    message.includes('Loading CSS chunk') ||
    message.includes('Importing a module script failed')
  )
}

function reloadOnceForChunkFailure() {
  const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0)
  const now = Date.now()
  if (now - lastReload <= 10_000) return
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now))
  window.location.reload()
}

// ── Global error reporting (swap for Sentry in production) ──────────────────
window.addEventListener('error', (e) => {
  console.error('[TEG+ Error]', { message: e.message, filename: e.filename, line: e.lineno, col: e.colno })
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('[TEG+ Unhandled Promise]', e.reason)
  if (isChunkLoadFailure(e.reason)) {
    reloadOnceForChunkFailure()
  }
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      gcTime: 1000 * 60 * 5,        // 5min — evita cache antigo
      refetchOnWindowFocus: true,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
