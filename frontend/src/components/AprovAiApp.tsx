// ─────────────────────────────────────────────────────────────────────────────
// AprovAiApp.tsx — Shell do app AprovAi standalone (entry point separado)
// Se autenticado → renderiza AprovAi. Senão → mini login roxo inline.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { User, Lock, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react'
import AprovAi from '../pages/AprovAi'

// ── Normalize (mesma lógica do Login.tsx) ────────────────────────────────────

function normalizeLoginUsername(v: string) {
  return v
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9@._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\./, '')
}

// ── Mini Login roxo ─────────────────────────────────────────────────────────

function AprovAiLogin() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toEmail = (v: string) => v.includes('@') ? v : `${v}@login.teg.local`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await signIn(toEmail(username), password)
    setBusy(false)
    if (error) setError(error)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #312e81 0%, #4f46e5 40%, #6d28d9 100%)' }}
    >
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-4">
            <span className="text-2xl font-black text-white">T+</span>
          </div>
          <h1 className="text-xl font-bold text-white">AprovAi</h1>
          <p className="text-xs text-indigo-200 mt-1 font-medium tracking-wide">
            Aprovacoes inteligentes com 1 toque
          </p>
        </div>

        {/* Card de login */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 space-y-4"
        >
          {/* Usuario */}
          <div>
            <label className="block text-xs font-semibold text-indigo-200 mb-1.5">
              Usuario ou e-mail
            </label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-300 pointer-events-none" />
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(normalizeLoginUsername(e.target.value)); setError(null) }}
                placeholder="nome.sobrenome"
                autoFocus
                autoComplete="username"
                required
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-white/20 text-sm text-white
                  placeholder-indigo-300/60 bg-white/5 focus:bg-white/10
                  focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all"
              />
            </div>
          </div>

          {/* Senha */}
          <div>
            <label className="block text-xs font-semibold text-indigo-200 mb-1.5">
              Senha
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-300 pointer-events-none" />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(null) }}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-white/20 text-sm text-white
                  placeholder-indigo-300/60 bg-white/5 focus:bg-white/10
                  focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-300 hover:text-white transition-colors"
              >
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/20 border border-red-400/30 text-red-200 rounded-xl px-3 py-2.5 text-xs">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Botao */}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-white text-indigo-700 font-bold text-sm
              flex items-center justify-center gap-2
              hover:bg-indigo-50 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {busy
              ? <span className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-700 rounded-full animate-spin" />
              : <><span>Entrar</span><ArrowRight size={14} /></>
            }
          </button>
        </form>

        <p className="text-center text-[10px] text-indigo-300/60 mt-5">
          TEG+ ERP v2.0
        </p>
      </div>
    </div>
  )
}

// ── Shell ────────────────────────────────────────────────────────────────────

export default function AprovAiApp() {
  const { user, loading } = useAuth()

  // Splash enquanto verifica sessao
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(160deg, #312e81 0%, #4f46e5 40%, #6d28d9 100%)' }}
      >
        <div className="w-10 h-10 border-3 border-white/15 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <AprovAiLogin />

  return <AprovAi />
}
