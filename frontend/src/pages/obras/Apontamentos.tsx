import { useState } from 'react'
import { ClipboardList, Plus, Filter } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useApontamentos } from '../../hooks/useObras'
import { useLookupObras } from '../../hooks/useLookups'
import type { StatusApontamento } from '../../types/obras'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const STATUS_CONFIG: Record<StatusApontamento, { label: string; light: string; dark: string }> = {
  rascunho:   { label: 'Rascunho',   light: 'bg-slate-100 text-slate-600',       dark: 'bg-slate-500/15 text-slate-400' },
  confirmado: { label: 'Confirmado', light: 'bg-blue-100 text-blue-700',         dark: 'bg-blue-500/15 text-blue-300' },
  validado:   { label: 'Validado',   light: 'bg-emerald-100 text-emerald-700',   dark: 'bg-emerald-500/15 text-emerald-300' },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Apontamentos() {
  const { isLightSidebar: isLight } = useTheme()
  const obras = useLookupObras()

  const [obraFilter, setObraFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: apontamentos = [], isLoading } = useApontamentos({
    obra_id: obraFilter || undefined,
    status: statusFilter || undefined,
  })

  const selectClass = `px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${isLight
    ? 'border border-slate-200 bg-white text-slate-600'
    : 'bg-white/[0.06] border border-white/[0.1] text-slate-300 [&>option]:bg-slate-900'
  }`

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <ClipboardList size={20} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
            Apontamentos
          </h1>
          <p className={`text-sm mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {apontamentos.length} registros
          </p>
        </div>
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors ${isLight
            ? 'bg-teal-600 hover:bg-teal-700 shadow-sm'
            : 'bg-teal-600 hover:bg-teal-500'
          }`}
        >
          <Plus size={15} /> Novo Apontamento
        </button>
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
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className={`w-8 h-8 border-[3px] rounded-full animate-spin ${isLight
            ? 'border-teal-500 border-t-transparent'
            : 'border-teal-400 border-t-transparent'
          }`} />
        </div>
      ) : apontamentos.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${isLight
          ? 'bg-white border-slate-200'
          : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <ClipboardList size={40} className={`mx-auto mb-3 ${isLight ? 'text-slate-200' : 'text-slate-700'}`} />
          <p className={`font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Nenhum apontamento encontrado
          </p>
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Ajuste os filtros ou crie um novo apontamento
          </p>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`${isLight
                  ? 'bg-slate-50 text-slate-600'
                  : 'bg-white/[0.02] text-slate-400'
                } text-xs font-semibold uppercase tracking-wider`}>
                  <th className="text-left px-4 py-3">Data</th>
                  <th className="text-left px-4 py-3">Obra</th>
                  <th className="text-left px-4 py-3">Frente</th>
                  <th className="text-left px-4 py-3">Atividade</th>
                  <th className="text-right px-4 py-3">Qtd.</th>
                  <th className="text-left px-4 py-3">Unidade</th>
                  <th className="text-right px-4 py-3">Horas</th>
                  <th className="text-center px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {apontamentos.map(ap => {
                  const st = STATUS_CONFIG[ap.status] ?? STATUS_CONFIG.rascunho
                  return (
                    <tr
                      key={ap.id}
                      className={`border-b ${isLight
                        ? 'border-slate-100 hover:bg-slate-50'
                        : 'border-white/[0.04] hover:bg-white/[0.02]'
                      } transition-colors`}
                    >
                      <td className={`px-4 py-3 text-sm font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {fmtDate(ap.data_apontamento)}
                      </td>
                      <td className={`px-4 py-3 text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {ap.obra?.nome ?? '—'}
                      </td>
                      <td className={`px-4 py-3 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {ap.frente?.nome ?? '—'}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium max-w-[200px] truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {ap.atividade}
                      </td>
                      <td className={`px-4 py-3 text-sm font-bold text-right ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {ap.quantidade_executada.toLocaleString('pt-BR')}
                      </td>
                      <td className={`px-4 py-3 text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        {ap.unidade ?? '—'}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {ap.horas_trabalhadas}h
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isLight ? st.light : st.dark}`}>
                          {st.label}
                        </span>
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
