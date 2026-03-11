import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import LogoTeg from '../components/LogoTeg'
import { PasswordStrengthBar } from '../components/SetPasswordModal'

/**
 * Página dedicada para redefinição de senha.
 * Exibida quando o usuário clica no link de recovery do Supabase.
 * O AuthContext detecta o evento PASSWORD_RECOVERY e seta pendingPasswordReset=true,
 * que faz o PrivateRoute redirecionar para esta página.
 */
export default function ResetPassword() {
  const { updatePassword, clearPasswordReset } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem')
      return
    }

    setBusy(true)
    const { error: passErr } = await updatePassword(password)
    setBusy(false)

    if (passErr) {
      setError(passErr)
      return
    }

    setSuccess(true)
    clearPasswordReset()
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
            Redefinição de Senha
          </p>
        </div>

        {/* Card */}
        <div className={`rounded-2xl shadow-card overflow-hidden ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white'}`}>
          {success ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <div>
                <p className={`font-bold text-lg ${isDark ? 'text-white' : 'text-navy'}`}>Senha atualizada!</p>
                <p className="text-sm text-slate-500 mt-1">Redirecionando...</p>
              </div>
            </div>
          ) : (
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
                    placeholder="Mínimo 6 caracteres"
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
