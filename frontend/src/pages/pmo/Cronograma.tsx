import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Filter } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useTarefas, usePortfolio } from '../../hooks/usePMO'
import type { StatusTarefa, PrioridadeTarefa } from '../../types/pmo'

const fmtData = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-'

const STATUS_MAP: Record<StatusTarefa, { label: string; light: string; dark: string }> = {
  a_fazer:        { label: 'A Fazer',       light: 'bg-slate-100 text-slate-600',    dark: 'bg-slate-500/15 text-slate-400' },
  em_andamento:   { label: 'Em Andamento',  light: 'bg-blue-100 text-blue-700',      dark: 'bg-blue-500/15 text-blue-400' },
  concluido:      { label: 'Concluido',     light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  nao_iniciado:   { label: 'Nao Iniciado',  light: 'bg-gray-100 text-gray-500',      dark: 'bg-gray-500/15 text-gray-400' },
  cancelado:      { label: 'Cancelado',     light: 'bg-red-100 text-red-600',        dark: 'bg-red-500/15 text-red-400' },
}

const PRIORIDADE_MAP: Record<PrioridadeTarefa, { label: string; light: string; dark: string }> = {
  alta:  { label: 'Alta',  light: 'bg-red-100 text-red-700',    dark: 'bg-red-500/15 text-red-400' },
  media: { label: 'Media', light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-500/15 text-amber-400' },
  baixa: { label: 'Baixa', light: 'bg-slate-100 text-slate-600', dark: 'bg-slate-500/15 text-slate-400' },
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'a_fazer', label: 'A Fazer' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluido', label: 'Concluido' },
  { value: 'nao_iniciado', label: 'Nao Iniciado' },
  { value: 'cancelado', label: 'Cancelado' },
]

export default function Cronograma() {
  const { isLightSidebar: isLight } = useTheme()
  const { portfolioId } = useParams<{ portfolioId: string }>()
  const nav = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')

  const { data: portfolio } = usePortfolio(portfolioId)
  const { data: tarefas, isLoading } = useTarefas(
    portfolioId,
    statusFilter ? { status: statusFilter } : undefined
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  const items = tarefas ?? []

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Back */}
      <button onClick={() => nav(portfolioId ? `/pmo/portfolio/${portfolioId}` : '/pmo/portfolio')}
        className={`flex items-center gap-1 text-sm transition-colors ${
          isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'
        }`}>
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <CalendarDays size={20} className="text-blue-500" />
            Cronograma
          </h1>
          {portfolio && (
            <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {portfolio.nome_obra} - {items.length} tarefa{items.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
          isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <Filter size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className={`bg-transparent text-sm outline-none ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-2xl border overflow-hidden ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={isLight ? 'bg-slate-50 text-slate-600' : 'bg-white/[0.02] text-slate-400'}>
                <th className="text-left font-semibold px-4 py-3">Tarefa</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-left font-semibold px-4 py-3">Prioridade</th>
                <th className="text-left font-semibold px-4 py-3">Responsavel</th>
                <th className="text-left font-semibold px-4 py-3">Inicio Plan.</th>
                <th className="text-left font-semibold px-4 py-3">Termino Plan.</th>
                <th className="text-left font-semibold px-4 py-3 w-36">Progresso</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`text-center py-12 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    Nenhuma tarefa encontrada
                  </td>
                </tr>
              ) : (
                items.map(t => {
                  const sc = STATUS_MAP[t.status]
                  const pc = PRIORIDADE_MAP[t.prioridade]
                  return (
                    <tr key={t.id} className={`border-t transition-colors ${
                      isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'
                    }`}>
                      <td className={`px-4 py-3 font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {t.codigo && (
                          <span className={`text-[10px] font-mono mr-1.5 ${isLight ? 'text-indigo-500' : 'text-indigo-400'}`}>
                            {t.codigo}
                          </span>
                        )}
                        {t.tarefa}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 ${isLight ? sc.light : sc.dark}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 ${isLight ? pc.light : pc.dark}`}>
                          {pc.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {t.responsavel ?? '-'}
                      </td>
                      <td className={`px-4 py-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {fmtData(t.data_inicio_planejado)}
                      </td>
                      <td className={`px-4 py-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {fmtData(t.data_termino_planejado)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`flex-1 h-2 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`}>
                            <div
                              className={`h-full rounded-full transition-all ${
                                t.percentual_concluido >= 100 ? 'bg-emerald-500'
                                : t.percentual_concluido >= 50 ? 'bg-blue-500'
                                : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(t.percentual_concluido, 100)}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-semibold w-8 text-right ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            {t.percentual_concluido}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
