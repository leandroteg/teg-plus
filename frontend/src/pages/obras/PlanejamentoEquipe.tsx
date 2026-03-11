import { useState } from 'react'
import { Users2, Filter, Calendar, DollarSign, Clock, Briefcase } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { usePlanejamentoEquipe } from '../../hooks/useObras'
import { useLookupObras } from '../../hooks/useLookups'
import type { CategoriaEquipePlan, StatusEquipePlan } from '../../types/obras'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'

const fmtCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })

const CAT_CONFIG: Record<CategoriaEquipePlan, { label: string; light: string; dark: string }> = {
  mod:            { label: 'MOD',            light: 'bg-blue-100 text-blue-700',       dark: 'bg-blue-500/15 text-blue-400' },
  moi:            { label: 'MOI',            light: 'bg-violet-100 text-violet-700',   dark: 'bg-violet-500/15 text-violet-400' },
  maquinario:     { label: 'Maquinario',     light: 'bg-amber-100 text-amber-700',     dark: 'bg-amber-500/15 text-amber-400' },
  terceirizado:   { label: 'Terceirizado',   light: 'bg-cyan-100 text-cyan-700',       dark: 'bg-cyan-500/15 text-cyan-400' },
}

const STATUS_CONFIG: Record<StatusEquipePlan, { label: string; light: string; dark: string }> = {
  planejado:      { label: 'Planejado',      light: 'bg-slate-100 text-slate-600',      dark: 'bg-slate-500/15 text-slate-400' },
  mobilizado:     { label: 'Mobilizado',     light: 'bg-blue-100 text-blue-700',        dark: 'bg-blue-500/15 text-blue-400' },
  ativo:          { label: 'Ativo',          light: 'bg-emerald-100 text-emerald-700',  dark: 'bg-emerald-500/15 text-emerald-400' },
  desmobilizado:  { label: 'Desmobilizado',  light: 'bg-amber-100 text-amber-700',      dark: 'bg-amber-500/15 text-amber-400' },
  cancelado:      { label: 'Cancelado',      light: 'bg-red-100 text-red-600',          dark: 'bg-red-500/15 text-red-400' },
}

const TURNO_LABEL: Record<string, string> = {
  diurno: 'Diurno',
  noturno: 'Noturno',
  revezamento: 'Revezamento',
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PlanejamentoEquipe() {
  const { isLightSidebar: isLight } = useTheme()
  const obras = useLookupObras()

  const [obraFilter, setObraFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')

  const { data: equipe = [], isLoading } = usePlanejamentoEquipe({
    obra_id: obraFilter || undefined,
    status: statusFilter || undefined,
    categoria: catFilter || undefined,
  })

  // Summary KPIs
  const totalAtivos = equipe.filter(e => e.status === 'ativo').length
  const totalMobilizados = equipe.filter(e => e.status === 'mobilizado').length
  const totalHorasDia = equipe.filter(e => e.status === 'ativo').reduce((s, e) => s + e.horas_dia, 0)
  const custoDiarioTotal = equipe.filter(e => ['ativo', 'mobilizado'].includes(e.status))
    .reduce((s, e) => s + e.custo_diaria, 0)

  const selectClass = `px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${isLight
    ? 'border border-slate-200 bg-white text-slate-600'
    : 'bg-white/[0.06] border border-white/[0.1] text-slate-300 [&>option]:bg-slate-900'
  }`

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Users2 size={20} className={isLight ? 'text-teal-600' : 'text-teal-400'} />
            Planejamento de Equipe
          </h1>
          <p className={`text-sm mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {equipe.length} profissional{equipe.length !== 1 ? 'is' : ''} planejados
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard isLight={isLight} label="Ativos" value={String(totalAtivos)} icon={Users2} color="text-emerald-500" />
        <KpiCard isLight={isLight} label="Mobilizados" value={String(totalMobilizados)} icon={Briefcase} color="text-blue-500" />
        <KpiCard isLight={isLight} label="Horas/dia" value={totalHorasDia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} icon={Clock} color="text-violet-500" />
        <KpiCard isLight={isLight} label="Custo diario" value={fmtCurrency(custoDiarioTotal)} icon={DollarSign} color="text-amber-500" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
        <select value={obraFilter} onChange={e => setObraFilter(e.target.value)} className={selectClass}>
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className={selectClass}>
          <option value="">Todas categorias</option>
          {Object.entries(CAT_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className={`w-8 h-8 border-[3px] rounded-full animate-spin ${isLight
            ? 'border-slate-200 border-t-teal-600'
            : 'border-slate-700 border-t-teal-400'
          }`} />
        </div>
      ) : equipe.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <Users2 size={32} className={`mx-auto mb-3 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
          <p className={`text-sm font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Nenhum profissional encontrado
          </p>
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Adicione membros ao planejamento de equipe
          </p>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`${isLight
                  ? 'bg-slate-50 text-slate-600'
                  : 'bg-white/[0.02] text-slate-400'
                } text-xs font-semibold uppercase tracking-wider`}>
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-4 py-3">Funcao</th>
                  <th className="text-left px-4 py-3">Categoria</th>
                  <th className="text-left px-4 py-3">Obra</th>
                  <th className="text-left px-4 py-3">Periodo</th>
                  <th className="text-left px-4 py-3">Turno</th>
                  <th className="text-right px-4 py-3">H/dia</th>
                  <th className="text-right px-4 py-3">Custo/dia</th>
                  <th className="text-left px-4 py-3">Tarefa EGP</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {equipe.map(p => {
                  const cat = CAT_CONFIG[p.categoria]
                  const st = STATUS_CONFIG[p.status]
                  return (
                    <tr key={p.id} className={`border-t transition-colors ${
                      isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'
                    }`}>
                      <td className={`px-4 py-3 font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {p.nome}
                      </td>
                      <td className={`px-4 py-3 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {p.funcao}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 ${isLight ? cat.light : cat.dark}`}>
                          {cat.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {p.obra?.nome ?? '-'}
                      </td>
                      <td className={`px-4 py-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {fmtDate(p.data_inicio)} - {fmtDate(p.data_fim)}
                        </span>
                      </td>
                      <td className={`px-4 py-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {TURNO_LABEL[p.turno] ?? p.turno}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {p.horas_dia}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {fmtCurrency(p.custo_diaria)}
                      </td>
                      <td className={`px-4 py-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {p.tarefa?.nome ? (
                          <span className={`inline-flex items-center gap-1 text-xs ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>
                            {p.tarefa.nome}
                          </span>
                        ) : (
                          <span className={`text-xs ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 ${isLight ? st.light : st.dark}`}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {equipe.length > 0 && (
                <tfoot>
                  <tr className={`border-t-2 ${isLight ? 'border-slate-200' : 'border-white/[0.08]'}`}>
                    <td colSpan={6} className={`px-4 py-3 text-right font-bold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                      Total ({equipe.length})
                    </td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      {equipe.reduce((s, e) => s + e.horas_dia, 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      {fmtCurrency(equipe.reduce((s, e) => s + e.custo_diaria, 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ isLight, label, value, icon: Icon, color }: {
  isLight: boolean; label: string; value: string; icon: typeof Users2; color: string
}) {
  return (
    <div className={`rounded-2xl border p-3 ${
      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={13} className={color} />
        <span className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          {label}
        </span>
      </div>
      <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{value}</p>
    </div>
  )
}
