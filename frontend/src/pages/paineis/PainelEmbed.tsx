import { Suspense, useRef } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { PAINEIS } from './registry'
import PainelActions from './PainelActions'

// Embeda o painel REAL do módulo (componente existente, via lazy do registro).
// Valida permissão e oferece "voltar" + "abrir módulo completo".
export default function PainelEmbed() {
  const { moduleKey } = useParams()
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { isAdmin, hasModule } = useAuth()
  const def = PAINEIS.find(p => p.key === moduleKey)
  const panelRef = useRef<HTMLDivElement>(null)

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const pill = isDark
    ? 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border-white/[0.08]'
    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'

  if (!def) return <Navigate to="/paineis" replace />

  const semAcesso = !isAdmin && !hasModule(def.key)

  return (
    <div className="space-y-3">
      {/* Barra de contexto */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => navigate('/paineis')}
            title="Voltar à Visão Geral"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${pill}`}
          >
            <ArrowLeft size={14} /> <span className="hidden sm:inline">Painéis</span>
          </button>
          <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>/</span>
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <span className="text-base shrink-0">{def.emoji}</span>
            <span className={`font-bold truncate ${txt}`}>{def.label}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {!semAcesso && <PainelActions target={panelRef} label={def.label} painelKey={def.key} />}
          <button
            onClick={() => navigate(def.route)}
            title="Abrir o módulo completo"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${pill}`}
          >
            <span className="hidden sm:inline">Abrir módulo completo</span>
            <span className="sm:hidden">Abrir</span>
            <ExternalLink size={13} />
          </button>
        </div>
      </div>

      {/* Painel real do módulo */}
      {semAcesso ? (
        <div className={`rounded-2xl border p-12 text-center ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <p className={`text-sm ${muted}`}>Você não tem acesso ao painel de <b className={txt}>{def.label}</b>.</p>
        </div>
      ) : (
        <div ref={panelRef}>
          <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-indigo-500" /></div>}>
            <def.Painel />
          </Suspense>
        </div>
      )}
    </div>
  )
}
