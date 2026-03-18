import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderKanban, Search, Plus, ChevronRight, Filter } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { usePortfolios } from '../../hooks/usePMO'
import type { StatusPortfolio } from '../../types/pmo'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-'

const STATUS_MAP: Record<string, { label: string; light: string; dark: string }> = {
  em_analise_ate:   { label: 'Em Analise ATE',   light: 'bg-amber-100 text-amber-700',    dark: 'bg-amber-500/15 text-amber-400' },
  revisao_cliente:  { label: 'Revisao Cliente',   light: 'bg-purple-100 text-purple-700',  dark: 'bg-purple-500/15 text-purple-400' },
  liberado_iniciar: { label: 'Liberado Iniciar',   light: 'bg-blue-100 text-blue-700',     dark: 'bg-blue-500/15 text-blue-400' },
  obra_andamento:   { label: 'Em Andamento',       light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  obra_paralisada:  { label: 'Paralisada',         light: 'bg-red-100 text-red-700',       dark: 'bg-red-500/15 text-red-400' },
  obra_concluida:   { label: 'Concluida',          light: 'bg-slate-100 text-slate-600',   dark: 'bg-slate-500/15 text-slate-400' },
  cancelada:        { label: 'Cancelada',           light: 'bg-gray-100 text-gray-500',     dark: 'bg-gray-500/15 text-gray-400' },
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'em_analise_ate', label: 'Em Analise ATE' },
  { value: 'revisao_cliente', label: 'Revisao Cliente' },
  { value: 'liberado_iniciar', label: 'Liberado Iniciar' },
  { value: 'obra_andamento', label: 'Em Andamento' },
  { value: 'obra_paralisada', label: 'Paralisada' },
  { value: 'obra_concluida', label: 'Concluida' },
  { value: 'cancelada', label: 'Cancelada' },
]

export default function Portfolio() {
  const { isLightSidebar: isLight } = useTheme()
  const nav = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data: portfolios, isLoading } = usePortfolios(
    statusFilter ? { status: statusFilter } : undefined
  )

  const filtered = (portfolios ?? []).filter(p =>
    p.nome_obra.toLowerCase().includes(search.toLowerCase()) ||
    p.numero_osc.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <FolderKanban size={20} className="text-indigo-500" />
            Portfolios
          </h1>
          <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {filtered.length} portfolio{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => nav('/egp/portfolio/novo')}
          className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-colors"
        >
          <Plus size={14} /> Novo Portfolio
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className={`flex-1 flex items-center gap-2 rounded-xl border px-3 py-2 ${
          isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <Search size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
          <input
            type="text"
            placeholder="Buscar por nome ou numero OSC..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 ${
              isLight ? 'text-slate-700' : 'text-slate-200'
            }`}
          />
        </div>
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
          isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <Filter size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className={`text-sm outline-none ${isLight ? 'bg-transparent text-slate-700' : 'bg-slate-800 text-white'}`}
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
                <th className="text-left font-semibold px-4 py-3">OSC</th>
                <th className="text-left font-semibold px-4 py-3">Obra</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-right font-semibold px-4 py-3">Valor Total</th>
                <th className="text-left font-semibold px-4 py-3">Inicio</th>
                <th className="text-left font-semibold px-4 py-3">Termino</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`text-center py-12 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    Nenhum portfolio encontrado
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const sc = STATUS_MAP[p.status] ?? { label: p.status, light: 'bg-gray-100 text-gray-500', dark: 'bg-gray-500/15 text-gray-400' }
                  return (
                    <tr
                      key={p.id}
                      onClick={() => nav(`/egp/portfolio/${p.id}`)}
                      className={`cursor-pointer border-t transition-colors ${
                        isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className={`px-4 py-3 font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {p.numero_osc}
                      </td>
                      <td className={`px-4 py-3 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {p.nome_obra}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${isLight ? sc.light : sc.dark}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {fmt(p.valor_total_osc)}
                      </td>
                      <td className={`px-4 py-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {fmtData(p.data_inicio_contratual)}
                      </td>
                      <td className={`px-4 py-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {fmtData(p.data_termino_contratual)}
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight size={14} className={isLight ? 'text-slate-300' : 'text-slate-600'} />
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
