import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Lock, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle,
  ArrowRight, LogIn, Mail,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import LogoTeg from '../components/LogoTeg'
import { PasswordStrengthBar } from '../components/SetPasswordModal'

type PageState = 'loading' | 'form' | 'success' | 'expired'

/**
 * Pagina dedicada para redefinicao de senha.
 * Exibida quando o usuario clica no link de recovery do Supabase.
 * O AuthContext detecta o evento PASSWORD_RECOVERY e seta pendingPasswordReset=true,
 * que faz o PrivateRoute redirecionar para esta pagina.
 *
 * Tambem acessivel diretamente pela URL /nova-senha quando o usuario
 * clica no link do email de recovery.
 */
export default function ResetPassword() {
  const { updatePassword, clearPasswordReset, pendingPasswordReset, user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()

  const [state, setState] = useState<PageState>('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Detect if we have a valid recovery session
  useEffect(() => {
    // If already flagged by AuthContext, show form immediately
    if (pendingPasswordReset) {
      setState('form')
      return
    }

    // Check URL hash for recovery tokens
    const hash = window.location.hash
    const hasRecoveryTokens = hash.includes('type=recovery') || hash.includes('access_token')

    if (hasRecoveryTokens) {
      // Wait for AuthContext to process the tokens
      const timeout = setTimeout(() => {
        // If after 5s we still don't have pendingPasswordReset or user, link is expired
        setState(prev => prev === 'loading' ? 'expired' : prev)
      }, 5000)

      return () => clearTimeout(timeout)
    }

    // No tokens in URL and no pending reset → user navigated here directly
    if (user) {
      // User is logged in, show form (maybe they want to change password)
      setState('form')
    } else {
      // No session, no tokens → expired/invalid link
      setState('expired')
    }
  }, [pendingPasswordReset, user])

  // React to pendingPasswordReset changing (from AuthContext processing tokens)
  useEffect(() => {
    if (pendingPasswordReset && state === 'loading') {
      setState('form')
    }
  }, [pendingPasswordReset, state])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      setError('As senhas nao coincidem')
      return
    }

    setBusy(true)
    const { error: passErr } = await updatePassword(password)
    setBusy(false)

    if (passErr) {
      setError(passErr)
      return
    }

    setState('success')
    clearPasswordReset()
    setTimeout(() => navigate('/', { replace: true }), 2000)
  }

  const handleRequestNewLink = () => {
    navigate('/login', { replace: true })
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      isDark
        ? 'bg-[#0c1222]'
        : 'bg-gradient-to-br from-slate-100 to-slate-200'
    }`}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center mb-3">
            <LogoTeg size={72} animated glowing={false} />
          </div>
          <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-navy'}`}>TEG+</h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium tracking-wide uppercase">
            Redefinicao de Senha
          </p>
        </div>

        {/* Card */}
        <div className={`rounded-2xl shadow-card overflow-hidden ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white'}`}>

          {/* Loading */}
          {state === 'loading' && (
            <div className="p-10 text-center space-y-4">
              <div className="w-10 h-10 border-[3px] border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Verificando link de recuperacao...
              </p>
            </div>
          )}

          {/* Expired / Invalid link */}
          {state === 'expired' && (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                <AlertCircle size={28} className="text-amber-600" />
              </div>
              <div>
                <p className={`font-bold text-lg ${isDark ? 'text-white' : 'text-navy'}`}>Link expirado</p>
                <p className="text-sm text-slate-500 mt-1">
                  Este link de recuperacao nao e mais valido. Solicite um novo link na tela de login.
                </p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={handleRequestNewLink}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold
                    hover:bg-indigo-500 active:scale-[0.98] transition-all"
                >
                  <Mail size={14} /> Solicitar novo link
                </button>
                <button
                  onClick={() => navigate('/login', { replace: true })}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600
                    hover:bg-slate-50 transition-all"
                >
                  <LogIn size={14} /> Ir para login
                </button>
              </div>
            </div>
          )}

          {/* Success */}
          {state === 'success' && (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <div>
                <p className={`font-bold text-lg ${isDark ? 'text-white' : 'text-navy'}`}>Senha atualizada!</p>
                <p className="text-sm text-slate-500 mt-1">Redirecionando...</p>
              </div>
            </div>
          )}

          {/* Form */}
          {state === 'form' && (
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ShieldCheck size={20} className="text-primary" />
                </div>
                <div>
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-navy'}`}>Criar nova senha</p>
                  <p className="text-xs text-slate-500">Escolha uma senha segura para sua conta</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nova senha</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(null) }}
                    placeholder="Minimo 6 caracteres"
                    autoFocus
                    required
                    autoComplete="new-password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm
                      focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                      bg-slate-50 focus:bg-white transition-all"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <div className="mt-2">
                  <PasswordStrengthBar password={password} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirmar senha</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError(null) }}
                    placeholder="Repita a senha"
                    required
                    autoComplete="new-password"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm
                      focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                      bg-slate-50 focus:bg-white transition-all"
                  />
                </div>
                {confirm && password && confirm !== password && (
                  <p className="text-[11px] text-red-500 mt-1 ml-1">As senhas nao coincidem</p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 rounded-xl px-3 py-2.5 text-sm">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm
                  flex items-center justify-center gap-2
                  hover:bg-indigo-500 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {busy
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><span>Salvar nova senha</span><ArrowRight size={14} /></>
                }
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          TEG+ ERP v2.0 · Acesso apenas para colaboradores autorizados
        </p>
      </div>
    </div>
  )
}
