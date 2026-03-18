import { useState, useMemo } from 'react'
import { CalendarDays, Filter, Plus, Users, FileText } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useReunioes, usePortfolios } from '../../hooks/usePMO'
import type { PMOReuniao, TipoReuniao, StatusReuniao } from '../../types/pmo'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtData = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '-'

const TIPO_LABEL: Record<TipoReuniao, string> = {
  dds: 'DDS',
  alinhamento_semanal: 'Alinhamento Semanal',
  gestao_mensal: 'Gestao Mensal',
  cliente_mensal: 'Cliente Mensal',
  analise_trimestral: 'Analise Trimestral',
}

const STATUS_BADGE: Record<StatusReuniao, { label: string; light: string; dark: string }> = {
  agendada:  { label: 'Agendada',  light: 'bg-blue-100 text-blue-700',    dark: 'bg-blue-500/15 text-blue-400' },
  realizada: { label: 'Realizada', light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  cancelada: { label: 'Cancelada', light: 'bg-red-100 text-red-600',      dark: 'bg-red-500/15 text-red-400' },
}

const TIPO_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  ...Object.entries(TIPO_LABEL).map(([k, v]) => ({ value: k, label: v })),
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function Reunioes() {
  const { isLightSidebar: isLight } = useTheme()

  const [filterPortfolio, setFilterPortfolio] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterDataDe, setFilterDataDe] = useState('')
  const [filterDataAte, setFilterDataAte] = useState('')

  const { data: portfolios = [] } = usePortfolios()
  const { data: reunioes, isLoading } = useReunioes(filterPortfolio || undefined)

  const filtered = useMemo(() => {
    let list = reunioes ?? []
    if (filterTipo) list = list.filter(r => r.tipo === filterTipo)
    if (filterDataDe) list = list.filter(r => r.data >= filterDataDe)
    if (filterDataAte) list = list.filter(r => r.data <= filterDataAte)
    return list
  }, [reunioes, filterTipo, filterDataDe, filterDataAte])

  const portfolioName = (id?: string) =>
    portfolios.find(p => p.id === id)?.nome_obra ?? '-'

  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <CalendarDays size={20} className="text-blue-500" />
            Reunioes
          </h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Historico de reunioes e alinhamentos
          </p>
        </div>

        <button
          onClick={() => alert('Nova Reuniao: em desenvolvimento')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={14} /> Nova Reuniao
        </button>
      </div>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className={`flex flex-wrap items-center gap-3 p-3 rounded-2xl border ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <Filter size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />

        <select
          value={filterPortfolio}
          onChange={e => setFilterPortfolio(e.target.value)}
          className={`px-3 py-1.5 rounded-lg text-xs border ${
            isLight
              ? 'bg-white border-slate-200 text-slate-700'
              : 'bg-slate-800 border-slate-600 text-white'
          }`}
        >
          <option value="">Todos os Portfolios</option>
          {portfolios.map(p => (
            <option key={p.id} value={p.id}>{p.nome_obra}</option>
          ))}
        </select>

        <select
          value={filterTipo}
          onChange={e => setFilterTipo(e.target.value)}
          className={`px-3 py-1.5 rounded-lg text-xs border ${
            isLight
              ? 'bg-white border-slate-200 text-slate-700'
              : 'bg-slate-800 border-slate-600 text-white'
          }`}
        >
          {TIPO_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <input
          type="date"
          value={filterDataDe}
          onChange={e => setFilterDataDe(e.target.value)}
          className={`px-3 py-1.5 rounded-lg text-xs border ${
            isLight
              ? 'bg-white border-slate-200 text-slate-700'
              : 'bg-slate-800 border-slate-600 text-white'
          }`}
          placeholder="De"
        />

        <input
          type="date"
          value={filterDataAte}
          onChange={e => setFilterDataAte(e.target.value)}
          className={`px-3 py-1.5 rounded-lg text-xs border ${
            isLight
              ? 'bg-white border-slate-200 text-slate-700'
              : 'bg-slate-800 border-slate-600 text-white'
          }`}
          placeholder="Ate"
        />
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <FileText size={40} className={`mx-auto mb-3 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
          <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Nenhuma reuniao encontrada
          </p>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={`text-[10px] font-semibold uppercase tracking-wider ${
                  isLight ? 'text-slate-400 bg-slate-50/80' : 'text-slate-500 bg-white/[0.02]'
                }`}>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Portfolio</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Participantes</th>
                  <th className="px-4 py-3">Pauta</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-white/[0.04]'}`}>
                {filtered.map(r => {
                  const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.agendada
                  return (
                    <tr key={r.id} className={`transition-colors ${
                      isLight ? 'hover:bg-slate-50/50' : 'hover:bg-white/[0.02]'
                    }`}>
                      <td className={`px-4 py-3 text-xs font-medium ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                        {fmtData(r.data)}
                      </td>
                      <td className={`px-4 py-3 text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {portfolioName(r.portfolio_id)}
                      </td>
                      <td className={`px-4 py-3 text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {TIPO_LABEL[r.tipo] ?? r.tipo}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Users size={12} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
                          <span className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                            {r.participantes?.length ?? 0}
                          </span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-xs max-w-[200px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {r.pauta ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-2.5 py-1 ${
                          isLight ? badge.light : badge.dark
                        }`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => alert(`Detalhes da reuniao ${r.id}`)}
                          className={`text-xs font-medium transition-colors ${
                            isLight ? 'text-blue-600 hover:text-blue-800' : 'text-blue-400 hover:text-blue-300'
                          }`}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
