import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Lock, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle,
  ArrowRight, LogIn,
} from 'lucide-react'
import { supabase } from '../services/supabase'
import { useTheme } from '../contexts/ThemeContext'
import LogoTeg from '../components/LogoTeg'
import { PasswordStrengthBar } from '../components/SetPasswordModal'

type PageState = 'loading' | 'welcome' | 'success' | 'error'

/**
 * Pagina publica de boas-vindas para usuarios convidados.
 * Processa o magic link do Supabase e exibe formulario de senha.
 * Rota: /bem-vindo
 */
export default function BemVindo() {
  const { isDark } = useTheme()
  const navigate = useNavigate()

  const [state, setState] = useState<PageState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [userName, setUserName] = useState('')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // On mount: process magic link tokens from URL hash
  useEffect(() => {
    let cancelled = false

    async function processToken() {
      try {
        // Supabase processes hash params automatically via onAuthStateChange,
        // but we also call getSession to ensure tokens are consumed
        const { data: { session }, error } = await supabase.auth.getSession()

        if (cancelled) return

        if (error || !session) {
          // Wait a bit for onAuthStateChange to fire
          await new Promise(r => setTimeout(r, 2000))
          const { data: { session: retrySession } } = await supabase.auth.getSession()

          if (cancelled) return

          if (!retrySession) {
            setState('error')
            setErrorMsg('Link expirado ou invalido. Solicite um novo convite ao administrador.')
            return
          }

          // Got session on retry
          const nome = (retrySession.user.user_metadata?.full_name as string)
            || (retrySession.user.user_metadata?.nome as string)
            || retrySession.user.email?.split('@')[0]
            || ''
          setUserName(nome)
          setState('welcome')
          return
        }

        // Check if user already has password set
        const { data: perfil } = await supabase
          .from('sys_perfis')
          .select('senha_definida, nome')
          .eq('auth_id', session.user.id)
          .single()

        if (cancelled) return

        if (perfil?.senha_definida) {
          // Already has password — go to home
          navigate('/', { replace: true })
          return
        }

        const nome = perfil?.nome
          || (session.user.user_metadata?.full_name as string)
          || (session.user.user_metadata?.nome as string)
          || session.user.email?.split('@')[0]
          || ''
        setUserName(nome)
        setState('welcome')
      } catch {
        if (!cancelled) {
          setState('error')
          setErrorMsg('Erro ao processar o link. Tente novamente.')
        }
      }
    }

    processToken()
    return () => { cancelled = true }
  }, [navigate])

  // Submit password
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (password.length < 6) {
      setFormError('A senha deve ter pelo menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      setFormError('As senhas nao coincidem')
      return
    }

    setBusy(true)

    const { error: passErr } = await supabase.auth.updateUser({ password })
    if (passErr) {
      setFormError(passErr.message)
      setBusy(false)
      return
    }

    // Mark senha_definida in profile
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await supabase
        .from('sys_perfis')
        .update({ senha_definida: true })
        .eq('auth_id', session.user.id)
    }

    setBusy(false)
    setState('success')
    setTimeout(() => navigate('/', { replace: true }), 2000)
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
            Bem-vindo ao Sistema
          </p>
        </div>

        {/* Card */}
        <div className={`rounded-2xl shadow-card overflow-hidden ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white'}`}>

          {/* Loading */}
          {state === 'loading' && (
            <div className="p-10 text-center space-y-4">
              <div className="w-10 h-10 border-[3px] border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Processando seu convite...
              </p>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <AlertCircle size={28} className="text-red-600" />
              </div>
              <div>
                <p className={`font-bold text-lg ${isDark ? 'text-white' : 'text-navy'}`}>Link invalido</p>
                <p className="text-sm text-slate-500 mt-1">{errorMsg}</p>
              </div>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold
                  hover:bg-indigo-500 active:scale-[0.98] transition-all"
              >
                <LogIn size={14} /> Ir para login
              </button>
            </div>
          )}

          {/* Success */}
          {state === 'success' && (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <div>
                <p className={`font-bold text-lg ${isDark ? 'text-white' : 'text-navy'}`}>Tudo pronto!</p>
                <p className="text-sm text-slate-500 mt-1">Sua senha foi definida. Redirecionando...</p>
              </div>
            </div>
          )}

          {/* Welcome — Password form */}
          {state === 'welcome' && (
            <>
              <div className="bg-gradient-to-br from-primary to-indigo-600 px-6 py-5 text-center">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck size={28} className="text-white" />
                </div>
                <h2 className="text-lg font-black text-white">
                  {userName ? `Ola, ${userName.split(' ')[0]}!` : 'Bem-vindo!'}
                </h2>
                <p className="text-sm text-white/80 mt-1">
                  Crie uma senha para acessar o TEG+
                </p>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nova senha</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => { setPassword(e.target.value); setFormError(null) }}
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
                      onChange={e => { setConfirm(e.target.value); setFormError(null) }}
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

                {formError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 rounded-xl px-3 py-2.5 text-sm">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    <span>{formError}</span>
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
                    : <><ShieldCheck size={14} /> Definir senha e entrar<ArrowRight size={14} /></>
                  }
                </button>

                <p className="text-center text-xs text-slate-400">
                  Voce podera alterar sua senha a qualquer momento no perfil
                </p>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          TEG+ ERP v2.0 · Acesso apenas para colaboradores autorizados
        </p>
      </div>
    </div>
  )
}
