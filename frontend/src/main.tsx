import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { toUpperNorm } from './components/UpperInput'
import './index.css'

// ── Global uppercase enforcement ─────────────────────────────────────────────
// Transforms text input values to uppercase before React processes the event.
// Skips: readonly, disabled, email, url, password, number, date/time inputs,
// and any element inside a [data-no-upper] container (e.g. contract printing).
;(function installGlobalUppercase() {
  const TEXT_TYPES = new Set(['', 'text', 'search', 'tel'])
  const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set

  // Track every input that was ever type="password" so show-password toggles
  // (which switch to type="text") are never uppercased.
  const passwordEls = new WeakSet<HTMLInputElement>()
  const trackEl = (el: Element) => {
    if (el instanceof HTMLInputElement && el.type === 'password') passwordEls.add(el)
  }
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'childList') {
        m.addedNodes.forEach(n => {
          if (n instanceof Element) {
            trackEl(n)
            n.querySelectorAll('input[type="password"]').forEach(trackEl)
          }
        })
      } else if (m.type === 'attributes') {
        trackEl(m.target as Element)
      }
    }
  })
  mo.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['type'],
  })

  document.addEventListener(
    'input',
    (e) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement
      const tag = target.tagName
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') return
      if (tag === 'INPUT' && !TEXT_TYPES.has((target as HTMLInputElement).type)) return
      if (target.readOnly || target.disabled) return
      if (target.closest('[data-no-upper]')) return
      // Skip any input that was ever type="password" (covers show-password toggles)
      if (tag === 'INPUT' && passwordEls.has(target as HTMLInputElement)) return
      // Fallback: skip by autocomplete or name/id hints
      const ac = (target.getAttribute('autocomplete') || '').toLowerCase()
      if (ac.includes('password')) return
      const nm = (target.getAttribute('name') || target.id || '').toLowerCase()
      if (nm.includes('password') || nm.includes('senha')) return

      const upper = toUpperNorm(target.value)
      if (upper === target.value) return

      const start = target.selectionStart
      const end = target.selectionEnd
      const setter = tag === 'INPUT' ? inputSetter : textareaSetter
      setter?.call(target, upper)
      requestAnimationFrame(() => target.setSelectionRange(start, end))
    },
    true, // capture phase — runs before React's root-level handlers
  )
})()

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
