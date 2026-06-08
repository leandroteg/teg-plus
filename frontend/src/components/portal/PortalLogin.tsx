import { useState, FormEvent } from 'react'
import { LogIn, Loader2, Sparkles, IdCard, Cake } from 'lucide-react'
import { usePortalAuth } from '../../hooks/usePortalAuth'

function formatCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
}

export default function PortalLogin() {
  const { login, isLoading, error } = usePortalAuth()
  const [cpf, setCpf] = useState('')
  const [dataNasc, setDataNasc] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await login(cpf, dataNasc)
    } catch { /* erro já está no state via hook */ }
  }

  const canSubmit = cpf.replace(/\D/g, '').length === 11 && /^\d{4}-\d{2}-\d{2}$/.test(dataNasc)

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ background: 'linear-gradient(160deg, #0F172A 0%, #134E4A 50%, #0F766E 100%)' }}
    >
      {/* Logo + título */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-teal-500/15 backdrop-blur-sm border border-teal-400/25 mb-4">
          <Sparkles className="w-10 h-10 text-teal-300" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Portal <span className="text-teal-300">TEG</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1.5 font-medium">
          Acesso rápido para colaboradores
        </p>
      </div>

      {/* Form card */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white/[0.04] backdrop-blur-md border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-2xl"
      >
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
            <IdCard size={12} /> CPF
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            placeholder="000.000.000-00"
            autoComplete="off"
            className="w-full px-4 py-3 rounded-xl text-sm bg-white/[0.06] border border-white/[0.1] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400/50 transition-all"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Cake size={12} /> Data de Nascimento
          </label>
          <input
            type="date"
            value={dataNasc}
            onChange={(e) => setDataNasc(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm bg-white/[0.06] border border-white/[0.1] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400/50 transition-all [color-scheme:dark]"
          />
        </div>

        {error && (
          <div className="rounded-xl px-3 py-2 text-xs font-semibold bg-red-500/15 border border-red-500/25 text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || isLoading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-teal-500/40"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          {isLoading ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="text-[11px] text-center text-slate-500 mt-3">
          Use seu CPF e data de nascimento cadastrados no RH
        </p>
      </form>

      <p className="text-[10px] text-slate-600 mt-6 font-medium">
        Portal TEG v1.0 · TEG União Engenharia
      </p>
    </div>
  )
}
