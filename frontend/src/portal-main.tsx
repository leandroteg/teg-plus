import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ErrorBoundary from './components/ErrorBoundary'
import PortalApp from './components/PortalApp'
import './index.css'

window.addEventListener('error', (e) => {
  console.error('[Portal TEG Error]', { message: e.message, filename: e.filename, line: e.lineno })
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Portal TEG Unhandled Promise]', e.reason)
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      gcTime: 1000 * 60 * 30,
      networkMode: 'offlineFirst',
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <PortalApp />
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
)
