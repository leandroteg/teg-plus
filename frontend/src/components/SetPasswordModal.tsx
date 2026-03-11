import { useState, useMemo } from 'react'
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

// ── Password strength utils (shared) ─────────────────────────────────────────
export function getPasswordStrength(pw: string) {
  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score // 0-5
}

const STRENGTH_CONFIG = [
  { label: 'Muito fraca', color: 'bg-red-500',    text: 'text-red-600' },
  { label: 'Fraca',       color: 'bg-orange-500', text: 'text-orange-600' },
  { label: 'Regular',     color: 'bg-amber-500',  text: 'text-amber-600' },
  { label: 'Boa',         color: 'bg-lime-500',   text: 'text-lime-600' },
  { label: 'Forte',       color: 'bg-green-500',  text: 'text-green-600' },
  { label: 'Excelente',   color: 'bg-emerald-500',text: 'text-emerald-600' },
]

export function PasswordStrengthBar({ password }: { password: string }) {
  const score = getPasswordStrength(password)
  if (!password) return null
  const cfg = STRENGTH_CONFIG[score]
  const checks = [
    { ok: password.length >= 6,      label: 'Mín. 6 caracteres' },
    { ok: password.length >= 8,      label: '8+ caracteres' },
    { ok: /[A-Z]/.test(password),    label: 'Letra maiúscula' },
    { ok: /[0-9]/.test(password),    label: 'Número' },
    { ok: /[^A-Za-z0-9]/.test(password), label: 'Caractere especial' },
  ]
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-0.5">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i < score ? cfg.color : 'bg-slate-200'
            }`} />
          ))}
        </div>
        <span className={`text-[10px] font-bold ${cfg.text}`}>{cfg.label}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {checks.map(({ ok, label }) => (
          <span key={label} className={`flex items-center gap-1 text-[10px] transition-colors ${
            ok ? 'text-green-600' : 'text-slate-400'
          }`}>
            <Check size={9} className={ok ? 'opacity-100' : 'opacity-0'} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Modal bloqueante exibido quando o usuário faz login via magic link
 * pela primeira vez e ainda não definiu uma senha.
 * Bloqueia toda navegação até que a senha seja definida.
 */
export default function SetPasswordModal() {
  const { updatePassword, markSenhaDefinida } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strength = useMemo(() => getPasswordStrength(password), [password])

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
    if (passErr) {
      setError(passErr)
      setBusy(false)
      return
    }

    const { error: markErr } = await markSenhaDefinida()
    if (markErr) {
      setError(markErr)
      setBusy(false)
      return
    }

    setBusy(false)
    // perfil.senha_definida is now true → modal will unmount automatically
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary to-indigo-600 px-6 py-5 text-center">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={28} className="text-white" />
          </div>
          <h2 className="text-lg font-black text-white">Defina sua senha</h2>
          <p className="text-sm text-white/80 mt-1">
            Para sua segurança, crie uma senha de acesso ao TEG+
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
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
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                  bg-slate-50 focus:bg-white transition-all"
              />
            </div>
            {confirm && password && confirm !== password && (
              <p className="text-[11px] text-red-500 mt-1 ml-1">As senhas não coincidem</p>
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
              : <><ShieldCheck size={14} /> Salvar e continuar</>
            }
          </button>

          <p className="text-center text-xs text-slate-400">
            Você poderá alterar sua senha a qualquer momento no perfil
          </p>
        </form>
      </div>
    </div>
  )
}
