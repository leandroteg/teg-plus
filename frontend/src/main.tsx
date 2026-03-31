import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

// ── Global error reporting (swap for Sentry in production) ──────────────────
window.addEventListener('error', (e) => {
  console.error('[TEG+ Error]', { message: e.message, filename: e.filename, line: e.lineno, col: e.colno })
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('[TEG+ Unhandled Promise]', e.reason)
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      gcTime: 1000 * 60 * 60 * 24, // 24h — keep cache for offline access
      networkMode: 'offlineFirst',  // Return cached data immediately, then revalidate
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
