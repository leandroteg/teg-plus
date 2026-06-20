import { useParams, useNavigate } from 'react-router-dom'
import { Map as MapIcon, ChevronLeft } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useOrcamento } from '../../hooks/useOrcamentacao'
import { StatusBadge } from './_ui'
import OrcamentoWizard from './OrcamentoWizard'

export default function OrcamentoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { data: orc, isLoading } = useOrcamento(id)

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
  }
  if (!orc) {
    return (
      <div className="p-4">
        <button onClick={() => nav('/orcamentacao')} className={`inline-flex items-center gap-1.5 text-sm ${txtMuted}`}><ChevronLeft size={16} /> Voltar</button>
        <p className={`mt-6 text-center text-sm ${txtMuted}`}>Orçamento não encontrado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => nav('/orcamentacao/orcamentos')} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{orc.numero ?? '—'}</span>
            <StatusBadge status={orc.status} isDark={isDark} />
            {orc.lote && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>lote: {orc.lote}</span>}
          </div>
          <h1 className={`text-lg font-extrabold flex items-center gap-2 truncate ${txt}`}>
            <MapIcon size={20} className="text-amber-500 shrink-0" /> {orc.nome}
          </h1>
        </div>
      </div>

      {/* Wizard de estágios (sessão SuperTEG persistente) */}
      <OrcamentoWizard orc={orc} isDark={isDark} />
    </div>
  )
}
