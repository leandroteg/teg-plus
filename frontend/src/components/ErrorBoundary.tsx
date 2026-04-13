import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  moduleName?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

// Detecta erros de carregamento de chunk (cache stale após novo deploy)
function isChunkLoadError(error: Error): boolean {
  const msg = error.message ?? ''
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    msg.includes('Importing a module script failed')
  )
}

const CHUNK_RELOAD_KEY = 'teg_chunk_reload_at'

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const module = this.props.moduleName || 'unknown'
    console.error('[TEG+ ErrorBoundary]', {
      module,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    })

    // Auto-reload uma vez quando for erro de chunk (deploy novo)
    if (isChunkLoadError(error)) {
      const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0)
      const now = Date.now()
      if (now - lastReload > 10_000) {           // evita loop: máx 1 reload a cada 10s
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now))
        window.location.reload()
      }
    }
  }

  handleRetry = () => {
    if (this.state.error && isChunkLoadError(this.state.error)) {
      window.location.reload()
    } else {
      this.setState({ hasError: false, error: null })
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">
            Algo deu errado
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {this.props.moduleName
              ? `Ocorreu um erro no módulo ${this.props.moduleName}.`
              : 'Ocorreu um erro inesperado.'}
            {' '}Tente recarregar a página.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900
                dark:hover:bg-slate-300 transition-colors"
            >
              <RefreshCw size={14} />
              Tentar novamente
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 transition-colors"
            >
              Ir ao início
            </button>
          </div>
          {this.state.error && (
            <pre className="mt-6 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-left text-red-600 dark:text-red-400 overflow-auto max-h-60">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      </div>
    )
  }
}
