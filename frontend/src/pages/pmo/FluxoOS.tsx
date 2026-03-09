import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ClipboardList, Filter, Clock, MapPin } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useFluxoOS, usePortfolio } from '../../hooks/usePMO'
import type { EtapaFluxoOS } from '../../types/pmo'

const ETAPA_MAP: Record<EtapaFluxoOS, { label: string; light: string; dark: string; order: number }> = {
  recebida:                    { label: 'Recebida',             light: 'bg-slate-100 text-slate-600',    dark: 'bg-slate-500/15 text-slate-400',    order: 0 },
  classificada:                { label: 'Classificada',         light: 'bg-blue-100 text-blue-700',      dark: 'bg-blue-500/15 text-blue-400',      order: 1 },
  em_analise:                  { label: 'Em Analise',           light: 'bg-indigo-100 text-indigo-700',  dark: 'bg-indigo-500/15 text-indigo-400',  order: 2 },
  devolvida_comentarios:       { label: 'Dev. Comentarios',     light: 'bg-amber-100 text-amber-700',    dark: 'bg-amber-500/15 text-amber-400',    order: 3 },
  retornada_cliente:           { label: 'Retornada Cliente',    light: 'bg-purple-100 text-purple-700',  dark: 'bg-purple-500/15 text-purple-400',  order: 4 },
  cancelada:                   { label: 'Cancelada',            light: 'bg-red-100 text-red-600',        dark: 'bg-red-500/15 text-red-400',        order: 5 },
  planejamento_logistica:      { label: 'Plan. Logistica',      light: 'bg-teal-100 text-teal-700',      dark: 'bg-teal-500/15 text-teal-400',      order: 6 },
  planejamento_materiais:      { label: 'Plan. Materiais',      light: 'bg-cyan-100 text-cyan-700',      dark: 'bg-cyan-500/15 text-cyan-400',      order: 7 },
  checagem_materiais:          { label: 'Checagem Materiais',   light: 'bg-sky-100 text-sky-700',        dark: 'bg-sky-500/15 text-sky-400',        order: 8 },
  aguardando_suprimentos:      { label: 'Ag. Suprimentos',      light: 'bg-orange-100 text-orange-700',  dark: 'bg-orange-500/15 text-orange-400',  order: 9 },
  aguardando_material_cemig:   { label: 'Ag. Material CEMIG',   light: 'bg-yellow-100 text-yellow-700',  dark: 'bg-yellow-500/15 text-yellow-400',  order: 10 },
  pronta_iniciar:              { label: 'Pronta Iniciar',       light: 'bg-lime-100 text-lime-700',      dark: 'bg-lime-500/15 text-lime-400',      order: 11 },
  em_execucao:                 { label: 'Em Execucao',          light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400', order: 12 },
}

const ETAPA_OPTIONS = [
  { value: '', label: 'Todas as etapas' },
  ...Object.entries(ETAPA_MAP)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([k, v]) => ({ value: k, label: v.label })),
]

const fmtData = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '-'

export default function FluxoOS() {
  const { isLightSidebar: isLight } = useTheme()
  const { portfolioId } = useParams<{ portfolioId: string }>()
  const nav = useNavigate()
  const [etapaFilter, setEtapaFilter] = useState('')

  const { data: portfolio } = usePortfolio(portfolioId)
  const { data: items, isLoading } = useFluxoOS(portfolioId)

  const filtered = (items ?? []).filter(
    os => !etapaFilter || os.etapa_atual === etapaFilter
  )

  // Group by etapa for kanban display
  const grouped = Object.entries(ETAPA_MAP)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, meta]) => ({
      key: key as EtapaFluxoOS,
      ...meta,
      items: filtered.filter(os => os.etapa_atual === key),
    }))
    .filter(g => g.items.length > 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Back */}
      <button onClick={() => nav(portfolioId ? `/egp/portfolio/${portfolioId}` : '/egp')}
        className={`flex items-center gap-1 text-sm transition-colors ${
          isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'
        }`}>
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <ClipboardList size={20} className="text-blue-500" />
            Fluxo de OS
          </h1>
          {portfolio && (
            <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {portfolio.nome_obra} - {filtered.length} OS
            </p>
          )}
        </div>
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
          isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <Filter size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
          <select
            value={etapaFilter}
            onChange={e => setEtapaFilter(e.target.value)}
            className={`bg-transparent text-sm outline-none ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
          >
            {ETAPA_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Kanban-like columns */}
      {grouped.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Nenhuma OS encontrada
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {grouped.map(group => (
            <div key={group.key} className={`rounded-2xl border overflow-hidden ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
            }`}>
              {/* Column header */}
              <div className={`px-4 py-2.5 border-b flex items-center justify-between ${
                isLight ? 'border-slate-100' : 'border-white/[0.04]'
              }`}>
                <span className={`inline-flex items-center gap-1.5 rounded-full text-[10px] font-semibold px-2.5 py-1 ${isLight ? group.light : group.dark}`}>
                  {group.label}
                </span>
                <span className={`text-xs font-semibold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  {group.items.length}
                </span>
              </div>
              {/* Cards */}
              <div className={`p-2 space-y-2 max-h-80 overflow-y-auto ${isLight ? 'divide-slate-50' : 'divide-white/[0.04]'}`}>
                {group.items.map(os => (
                  <div key={os.id} className={`rounded-xl border p-3 transition-colors ${
                    isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'
                  }`}>
                    <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      {os.numero_os}
                    </p>
                    {os.tipo_servico && (
                      <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        <MapPin size={10} className="inline mr-1" />
                        {os.tipo_servico}
                      </p>
                    )}
                    {os.data_recebimento && (
                      <p className={`text-[10px] mt-1 flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        <Clock size={10} /> Recebida: {fmtData(os.data_recebimento)}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {os.informacoes_completas && (
                        <span className={`text-[9px] font-semibold rounded-full px-1.5 py-0.5 ${isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/15 text-emerald-400'}`}>
                          Info OK
                        </span>
                      )}
                      {os.tipo_obra && (
                        <span className={`text-[9px] font-semibold rounded-full px-1.5 py-0.5 ${isLight ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/15 text-blue-400'}`}>
                          {os.tipo_obra === 'nova' ? 'Nova' : 'Em Andamento'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
