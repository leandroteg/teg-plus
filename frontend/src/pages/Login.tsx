import { useState, useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Mail, Lock, ArrowRight, Zap, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

type Mode = 'password' | 'magic'
type View = 'login' | 'reset' | 'nova-senha' | 'magic-sent'

export default function Login() {
  const { user, loading, signIn, signInMagicLink, resetPassword, updatePassword } = useAuth()
  const [searchParams] = useSearchParams()

  const [mode,       setMode]       = useState<Mode>('password')
  const [view,       setView]       = useState<View>('login')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [newPass,    setNewPass]    = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [busy,       setBusy]       = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [success,    setSuccess]    = useState<string | null>(null)

  // Detecta se é um link de "nova senha" (type=recovery na URL)
  useEffect(() => {
    if (searchParams.get('type') === 'recovery') {
      setView('nova-senha')
    }
  }, [searchParams])

  if (!loading && user && view !== 'nova-senha') {
    return <Navigate to="/" replace />
  }

  const clr = () => { setError(null); setSuccess(null) }

  // ── Handlers ──────────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); clr(); setBusy(true)
    if (mode === 'magic') {
      const { error } = await signInMagicLink(email)
      setBusy(false)
      if (error) { setError(error); return }
      setView('magic-sent')
    } else {
      const { error } = await signIn(email, password)
      setBusy(false)
      if (error) setError(error)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault(); clr(); setBusy(true)
    const { error } = await resetPassword(email)
    setBusy(false)
    if (error) { setError(error); return }
    setSuccess('Link de recuperação enviado! Verifique seu e-mail.')
  }

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault(); clr(); setBusy(true)
    if (newPass.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      setBusy(false); return
    }
    const { error } = await updatePassword(newPass)
    setBusy(false)
    if (error) { setError(error); return }
    setSuccess('Senha atualizada! Redirecionando...')
    setTimeout(() => setView('login'), 2000)
  }

  // ── UI helpers ────────────────────────────────────────────────────

  const InputField = ({
    label, type = 'text', value, onChange, placeholder, autoFocus, icon: Icon,
    suffix,
  }: {
    label: string
    type?: string
    value: string
    onChange: (v: string) => void
    placeholder: string
    autoFocus?: boolean
    icon: React.ElementType
    suffix?: React.ReactNode
  }) => (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      <div className="relative">
        <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type={type}
          value={value}
          onChange={e => { onChange(e.target.value); clr() }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          required
          className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm
            focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
            transition-all bg-slate-50 focus:bg-white"
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>
        )}
      </div>
    </div>
  )

  const Feedback = () => (
    <>
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 rounded-xl px-3 py-2.5 text-sm">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-100 text-green-700 rounded-xl px-3 py-2.5 text-sm">
          <CheckCircle size={15} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}
    </>
  )

  const SubmitBtn = ({ label }: { label: string }) => (
    <button
      type="submit"
      disabled={busy}
      className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm
        flex items-center justify-center gap-2
        hover:bg-indigo-500 active:scale-[0.98] transition-all disabled:opacity-60"
    >
      {busy
        ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        : <><span>{label}</span><ArrowRight size={14} /></>
      }
    </button>
  )

  // ── Views ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo / Branding */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl
            bg-navy text-white text-2xl font-black mb-3 shadow-xl">
            T+
          </div>
          <h1 className="text-2xl font-black text-navy tracking-tight">TEG+</h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium tracking-wide uppercase">
            Sistema ERP · Acesso Restrito
          </p>
        </div>

        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">

          {/* ── View: LOGIN ── */}
          {view === 'login' && (
            <>
              {/* Tabs modo */}
              <div className="flex gap-1 bg-slate-100 m-5 mb-0 rounded-xl p-1">
                {([
                  { m: 'password' as Mode, label: 'Senha',       icon: null },
                  { m: 'magic'    as Mode, label: 'Link Mágico', icon: Zap  },
                ] as const).map(({ m, label, icon: Icon }) => (
                  <button key={m}
                    type="button"
                    onClick={() => { setMode(m); clr() }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg
                      text-xs font-semibold transition-all duration-150
                      ${mode === m
                        ? 'bg-white shadow text-navy'
                        : 'text-slate-500 hover:text-navy'
                      }`}
                  >
                    {Icon && <Icon size={12} />}
                    {label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleLogin} className="p-5 space-y-4">
                <InputField
                  label="E-mail corporativo"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="voce@teguniao.com.br"
                  icon={Mail}
                  autoFocus
                />

                {mode === 'password' && (
                  <InputField
                    label="Senha"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={setPassword}
                    placeholder="••••••••"
                    icon={Lock}
                    suffix={
                      <button type="button" onClick={() => setShowPass(v => !v)}
                        className="text-slate-400 hover:text-slate-600 transition-colors">
                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    }
                  />
                )}

                {mode === 'password' && (
                  <div className="text-right -mt-1">
                    <button type="button"
                      onClick={() => { setView('reset'); clr() }}
                      className="text-xs text-primary hover:underline font-medium">
                      Esqueci a senha
                    </button>
                  </div>
                )}

                <Feedback />
                <SubmitBtn label={mode === 'magic' ? 'Enviar link de acesso' : 'Entrar'} />

                {mode === 'magic' && (
                  <p className="text-center text-xs text-slate-400">
                    Você receberá um link seguro por e-mail — sem precisar de senha
                  </p>
                )}
              </form>
            </>
          )}

          {/* ── View: LINK ENVIADO ── */}
          {view === 'magic-sent' && (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Mail size={28} className="text-primary" />
              </div>
              <div>
                <p className="font-bold text-navy text-lg">E-mail enviado!</p>
                <p className="text-sm text-slate-500 mt-1">
                  Acesse o link que enviamos para <br />
                  <span className="font-semibold text-navy">{email}</span>
                </p>
              </div>
              <p className="text-xs text-slate-400">
                Não encontrou? Verifique a pasta de spam.
              </p>
              <button onClick={() => { setView('login'); setMode('password'); clr() }}
                className="text-xs text-primary hover:underline">
                Usar senha em vez disso
              </button>
            </div>
          )}

          {/* ── View: RECUPERAR SENHA ── */}
          {view === 'reset' && (
            <form onSubmit={handleReset} className="p-5 space-y-4">
              <div>
                <p className="font-bold text-navy">Recuperar senha</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enviaremos um link para redefinir sua senha
                </p>
              </div>
              <InputField
                label="Seu e-mail" type="email"
                value={email} onChange={setEmail}
                placeholder="voce@teguniao.com.br"
                icon={Mail} autoFocus
              />
              <Feedback />
              <SubmitBtn label="Enviar link de recuperação" />
              <button type="button"
                onClick={() => { setView('login'); clr() }}
                className="w-full text-center text-xs text-slate-500 hover:text-navy transition-colors">
                ← Voltar ao login
              </button>
            </form>
          )}

          {/* ── View: NOVA SENHA (link de recovery) ── */}
          {view === 'nova-senha' && (
            <form onSubmit={handleNewPassword} className="p-5 space-y-4">
              <div>
                <p className="font-bold text-navy">Criar nova senha</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Escolha uma senha segura para sua conta
                </p>
              </div>
              <InputField
                label="Nova senha"
                type={showPass ? 'text' : 'password'}
                value={newPass} onChange={setNewPass}
                placeholder="mínimo 6 caracteres"
                icon={Lock} autoFocus
                suffix={
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />
              <Feedback />
              <SubmitBtn label="Salvar nova senha" />
            </form>
          )}

        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-5">
          TEG+ ERP v2.0 · Acesso apenas para colaboradores autorizados
        </p>
      </div>
    </div>
  )
}
