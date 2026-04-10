import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Mail, Lock, ArrowRight, AlertCircle, CheckCircle, Eye, EyeOff, Download, X, Share2, MoreVertical } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { usePWAInstall } from '../hooks/usePWAInstall'
import LogoTeg from '../components/LogoTeg'
import ThemeToggle from '../components/ThemeToggle'

type View = 'login' | 'reset'

function normalizeLoginUsername(v: string) {
  const cleaned = v
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const normalized = cleaned
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9@._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\./, '')
  return normalized
}

// ── Sub-componentes fora do Login para evitar remount a cada render ──────────
// IMPORTANTE: definir componentes DENTRO do componente pai faz React
// desmontar/remontar a cada re-render, causando perda de foco nos inputs.

interface InputFieldProps {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  autoFocus?: boolean
  icon: React.ElementType
  suffix?: React.ReactNode
}

function InputField({
  label, type = 'text', value, onChange, placeholder, autoFocus, icon: Icon, suffix,
}: InputFieldProps) {
  // autoComplete correto evita que o browser autofill pule de campo
  const autoComplete = type === 'password' ? 'current-password'
    : type === 'email'    ? 'username email'
    : 'off'

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      <div className="relative">
        <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
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
}

function Feedback({ error, success }: { error: string | null; success: string | null }) {
  return (
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
}

function SubmitBtn({ label, busy }: { label: string; busy: boolean }) {
  return (
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
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function Login() {
  const { user, loading, signIn, resetPassword } = useAuth()
  const { isDark, isLightSidebar: isLight } = useTheme()
  const { canInstall, isInstalled, promptInstall, isIOS } = usePWAInstall()

  const [view,      setView]      = useState<View>('login')
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const [loginUser, setLoginUser] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)

  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  const clr = () => { setError(null); setSuccess(null) }

  // ── Handlers ──────────────────────────────────────────────────────

  const toEmail = (v: string) => v.includes('@') ? v : `${v}@login.teg.local`

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); clr(); setBusy(true)
    const { error } = await signIn(toEmail(loginUser), password)
    setBusy(false)
    if (error) setError(error)
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault(); clr(); setBusy(true)
    const { error } = await resetPassword(toEmail(resetEmail))
    setBusy(false)
    if (error) { setError(error); return }
    setSuccess('Link de recupera\u00e7\u00e3o enviado! Verifique seu e-mail.')
  }

  // ── Views ─────────────────────────────────────────────────────────

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      isDark
        ? 'bg-[#0c1222]'
        : 'bg-gradient-to-br from-slate-100 to-slate-200'
    }`}>
      <div className="w-full max-w-sm">

        {/* Theme toggle */}
        <div className="flex justify-center mb-4">
          <ThemeToggle variant={isDark ? 'dark' : 'light'} compact />
        </div>

        {/* Logo / Branding */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center mb-2">
            <LogoTeg size={120} animated={false} glowing={false} />
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-medium tracking-wide uppercase">
            {'Sistema ERP \u00b7 Acesso Restrito'}
          </p>
        </div>

        {/* Card principal */}
        <div className={`rounded-2xl shadow-card overflow-hidden ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white'}`}>

          {/* ── View: LOGIN ── */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="p-5 space-y-4">
              <InputField
                label={'Usu\u00e1rio ou e-mail'}
                type="text"
                value={loginUser}
                onChange={v => { setLoginUser(normalizeLoginUsername(v)); clr() }}
                placeholder="nome.sobrenome ou email"
                icon={Mail}
                autoFocus
              />

              <InputField
                label="Senha"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={v => { setPassword(v); clr() }}
                placeholder="••••••••"
                icon={Lock}
                suffix={
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="text-slate-400 hover:text-slate-600 transition-colors">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                }
              />

              <div className="text-right -mt-1">
                <button type="button"
                  onClick={() => { setView('reset'); setResetEmail(''); clr() }}
                  className="text-xs text-primary hover:underline font-medium">
                  Esqueci a senha
                </button>
              </div>

              <Feedback error={error} success={success} />
              <SubmitBtn label="Entrar" busy={busy} />
            </form>
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
                label={'Usu\u00e1rio ou e-mail'} type="text"
                value={resetEmail}
                onChange={v => { setResetEmail(normalizeLoginUsername(v)); clr() }}
                placeholder="nome.sobrenome ou email"
                icon={Mail} autoFocus
              />
              <Feedback error={error} success={success} />
              <SubmitBtn label={'Enviar link de recupera\u00e7\u00e3o'} busy={busy} />
              <button type="button"
                onClick={() => { setView('login'); clr() }}
                className="w-full text-center text-xs text-slate-500 hover:text-navy transition-colors">
                {'\u2190 Voltar ao login'}
              </button>
            </form>
          )}

        </div>

        {/* Install App Button — always visible */}
        <button
          onClick={async () => {
            const accepted = await promptInstall()
            if (!accepted) setShowInstallGuide(true)
          }}
          className={`w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
            isDark
              ? 'bg-teal-500/15 border border-teal-400/25 text-teal-300 hover:bg-teal-500/25'
              : 'bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100'
          }`}
        >
          <Download size={16} />
          Instalar App TEG+
        </button>

        {/* Install Guide Modal */}
        {showInstallGuide && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`w-full max-w-sm rounded-2xl p-6 space-y-5 ${
              isDark ? 'bg-slate-900 border border-white/10' : 'bg-white border border-slate-200 shadow-2xl'
            }`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Instalar TEG+
                </h3>
                <button onClick={() => setShowInstallGuide(false)} className="p-1 rounded-lg hover:bg-slate-100/10">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              {isIOS ? (
                <div className="space-y-4">
                  <InstallStep n={1} isDark={isDark}>
                    Toque em <Share2 size={14} className="inline text-blue-500 -mt-0.5" /> <strong>Compartilhar</strong> na barra do Safari
                  </InstallStep>
                  <InstallStep n={2} isDark={isDark}>
                    Role e toque em <strong>"Adicionar à Tela de Início"</strong>
                  </InstallStep>
                  <InstallStep n={3} isDark={isDark}>
                    Toque em <strong>"Adicionar"</strong>
                  </InstallStep>
                </div>
              ) : (
                <div className="space-y-4">
                  <InstallStep n={1} isDark={isDark}>
                    Clique no menu <MoreVertical size={14} className="inline text-slate-500 -mt-0.5" /> do navegador (canto superior direito)
                  </InstallStep>
                  <InstallStep n={2} isDark={isDark}>
                    Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>
                  </InstallStep>
                  <InstallStep n={3} isDark={isDark}>
                    Confirme clicando em <strong>"Instalar"</strong>
                  </InstallStep>
                </div>
              )}

              <p className={`text-[11px] text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                O TEG+ vai abrir como um app nativo no seu dispositivo
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-5">
          {'TEG+ ERP v2.0 \u00b7 Acesso apenas para colaboradores autorizados'}
        </p>
      </div>
    </div>
  )
}

function InstallStep({ n, isDark, children }: { n: number; isDark: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
        isDark ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-700'
      }`}>
        {n}
      </div>
      <p className={`text-sm pt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        {children}
      </p>
    </div>
  )
}
