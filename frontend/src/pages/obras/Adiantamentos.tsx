import { useState } from 'react'
import { Wallet, Plus, Filter } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAdiantamentos } from '../../hooks/useObras'
import { useLookupObras } from '../../hooks/useLookups'
import type { StatusAdiantamento } from '../../types/obras'

// ── Helpers ──────────────────────────────────────────────────────────────────

const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const STATUS_CONFIG: Record<StatusAdiantamento, { label: string; light: string; dark: string }> = {
  solicitado: { label: 'Solicitado', light: 'bg-blue-100 text-blue-700',       dark: 'bg-blue-500/15 text-blue-300' },
  aprovado:   { label: 'Aprovado',   light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-300' },
  parcial:    { label: 'Parcial',    light: 'bg-amber-100 text-amber-700',     dark: 'bg-amber-500/15 text-amber-300' },
  prestado:   { label: 'Prestado',   light: 'bg-slate-100 text-slate-600',     dark: 'bg-slate-500/15 text-slate-400' },
  vencido:    { label: 'Vencido',    light: 'bg-red-100 text-red-700',         dark: 'bg-red-500/15 text-red-300' },
}

// ── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, accent, isLight,
}: {
  label: string; value: string; accent: string; isLight: boolean
}) {
  return (
    <div className={`rounded-2xl border p-4 border-l-4 ${isLight
      ? `bg-white border-slate-200 shadow-sm border-l-${accent}-500`
      : `bg-white/[0.03] border-white/[0.06] border-l-${accent}-500`
    }`}>
      <p className={`text-[11px] uppercase tracking-wider mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
        {label}
      </p>
      <p className={`text-xl font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>
        {value}
      </p>
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Adiantamentos() {
  const { isLightSidebar: isLight } = useTheme()
  const obras = useLookupObras()

  const [obraFilter, setObraFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: adiantamentos = [], isLoading } = useAdiantamentos({
    obra_id: obraFilter || undefined,
    status: statusFilter || undefined,
  })

  // Summary calculations
  const totalSolicitado = adiantamentos.reduce((s, a) => s + (a.valor_solicitado ?? 0), 0)
  const totalAprovado = adiantamentos.reduce((s, a) => s + (a.valor_aprovado ?? 0), 0)
  const totalSaldoPendente = adiantamentos.reduce((s, a) => s + (a.saldo_pendente ?? 0), 0)

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
            <Wallet size={20} className={isLight ? 'text-violet-600' : 'text-violet-400'} />
            Adiantamentos
          </h1>
          <p className={`text-sm mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {adiantamentos.length} registros
          </p>
        </div>
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors ${isLight
            ? 'bg-teal-600 hover:bg-teal-700 shadow-sm'
            : 'bg-teal-600 hover:bg-teal-500'
          }`}
        >
          <Plus size={15} /> Novo Adiantamento
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Total Solicitado" value={BRL(totalSolicitado)} accent="blue" isLight={isLight} />
        <SummaryCard label="Total Aprovado" value={BRL(totalAprovado)} accent="emerald" isLight={isLight} />
        <SummaryCard label="Saldo Pendente" value={BRL(totalSaldoPendente)} accent="amber" isLight={isLight} />
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
      ) : adiantamentos.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${isLight
          ? 'bg-white border-slate-200'
          : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <Wallet size={40} className={`mx-auto mb-3 ${isLight ? 'text-slate-200' : 'text-slate-700'}`} />
          <p className={`font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Nenhum adiantamento encontrado
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
                  <th className="text-left px-4 py-3">Obra</th>
                  <th className="text-left px-4 py-3">Solicitante</th>
                  <th className="text-left px-4 py-3">Finalidade</th>
                  <th className="text-right px-4 py-3">Solicitado</th>
                  <th className="text-right px-4 py-3">Aprovado</th>
                  <th className="text-right px-4 py-3">Saldo Pend.</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Limite</th>
                </tr>
              </thead>
              <tbody>
                {adiantamentos.map(ad => {
                  const st = STATUS_CONFIG[ad.status] ?? STATUS_CONFIG.solicitado
                  const isVencido = ad.data_limite_prestacao && new Date(ad.data_limite_prestacao) < new Date()
                  return (
                    <tr
                      key={ad.id}
                      className={`border-b ${isLight
                        ? 'border-slate-100 hover:bg-slate-50'
                        : 'border-white/[0.04] hover:bg-white/[0.02]'
                      } transition-colors`}
                    >
                      <td className={`px-4 py-3 text-sm font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {ad.obra?.nome ?? '—'}
                      </td>
                      <td className={`px-4 py-3 text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {ad.solicitante?.nome ?? '—'}
                      </td>
                      <td className={`px-4 py-3 text-sm max-w-[180px] truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        {ad.finalidade}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium text-right ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {BRL(ad.valor_solicitado)}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium text-right ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                        {ad.valor_aprovado > 0 ? BRL(ad.valor_aprovado) : '—'}
                      </td>
                      <td className={`px-4 py-3 text-sm font-bold text-right ${ad.saldo_pendente > 0
                        ? (isLight ? 'text-amber-700' : 'text-amber-400')
                        : (isLight ? 'text-slate-400' : 'text-slate-500')
                      }`}>
                        {ad.saldo_pendente > 0 ? BRL(ad.saldo_pendente) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isLight ? st.light : st.dark}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm ${isVencido
                        ? 'text-red-500 font-bold'
                        : isLight ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {ad.data_limite_prestacao ? fmtDate(ad.data_limite_prestacao) : '—'}
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
