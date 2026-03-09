import { useState, useMemo } from 'react'
import { AlertTriangle, Filter, DollarSign, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useMultas, usePortfolios } from '../../hooks/usePMO'
import type { StatusMulta, TipoMulta } from '../../types/pmo'

// ── Helpers ───────────────────────────────────────────────────────────────────

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtData = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '-'

const TIPO_LABEL: Record<TipoMulta, string> = {
  atraso_prazo: 'Atraso Prazo',
  qualidade: 'Qualidade',
  ssma: 'SSMA',
  documental: 'Documental',
  subcontratacao: 'Subcontratacao',
  outra: 'Outra',
}

const STATUS_BADGE: Record<StatusMulta, { label: string; light: string; dark: string }> = {
  risco:       { label: 'Risco',      light: 'bg-amber-100 text-amber-700',    dark: 'bg-amber-500/15 text-amber-400' },
  notificada:  { label: 'Notificada', light: 'bg-red-100 text-red-700',        dark: 'bg-red-500/15 text-red-400' },
  contestada:  { label: 'Contestada', light: 'bg-orange-100 text-orange-700',  dark: 'bg-orange-500/15 text-orange-400' },
  confirmada:  { label: 'Confirmada', light: 'bg-red-100 text-red-600',        dark: 'bg-red-500/15 text-red-400' },
  paga:        { label: 'Paga',       light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  cancelada:   { label: 'Cancelada',  light: 'bg-slate-100 text-slate-600',    dark: 'bg-slate-500/15 text-slate-400' },
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  ...Object.entries(STATUS_BADGE).map(([k, v]) => ({ value: k, label: v.label })),
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function Multas() {
  const { isLightSidebar: isLight } = useTheme()

  const [filterPortfolio, setFilterPortfolio] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const { data: portfolios = [] } = usePortfolios()
  const { data: multas, isLoading } = useMultas(filterPortfolio || undefined)

  const filtered = useMemo(() => {
    let list = multas ?? []
    if (filterStatus) list = list.filter(m => m.status === filterStatus)
    return list
  }, [multas, filterStatus])

  const portfolioName = (id: string) =>
    portfolios.find(p => p.id === id)?.nome_obra ?? '-'

  // Summary stats
  const totalMultas = filtered.length
  const valorTotal = filtered.reduce((s, m) => s + (m.valor_confirmado || m.valor_estimado), 0)
  const emAberto = filtered.filter(m => ['risco', 'notificada', 'contestada', 'confirmada'].includes(m.status)).length
  const quitadas = filtered.filter(m => m.status === 'paga').length

  const summaryCards = [
    { label: 'Total Multas', value: String(totalMultas), icon: AlertTriangle, color: 'text-blue-500' },
    { label: 'Valor Total', value: BRL(valorTotal), icon: DollarSign, color: 'text-amber-500' },
    { label: 'Em Aberto', value: String(emAberto), icon: ShieldAlert, color: 'text-red-500' },
    { label: 'Quitadas', value: String(quitadas), icon: CheckCircle2, color: 'text-emerald-500' },
  ]

  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <AlertTriangle size={20} className="text-blue-500" />
          Multas
        </h1>
        <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Penalidades e multas contratuais por portfolio
        </p>
      </div>

      {/* ── Summary Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <div key={card.label} className={`rounded-2xl border p-5 shadow-sm ${
            isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <card.icon size={16} className={card.color} />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                isLight ? 'text-slate-400' : 'text-slate-500'
              }`}>{card.label}</span>
            </div>
            <p className={`text-lg font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>
              {card.value}
            </p>
          </div>
        ))}
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
              : 'bg-white/[0.04] border-white/[0.08] text-white'
          }`}
        >
          <option value="">Todos os Portfolios</option>
          {portfolios.map(p => (
            <option key={p.id} value={p.id}>{p.nome_obra}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className={`px-3 py-1.5 rounded-lg text-xs border ${
            isLight
              ? 'bg-white border-slate-200 text-slate-700'
              : 'bg-white/[0.04] border-white/[0.08] text-white'
          }`}
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
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
          <XCircle size={40} className={`mx-auto mb-3 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
          <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Nenhuma multa encontrada
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
                  <th className="px-4 py-3">Descricao</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Responsavel</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-white/[0.04]'}`}>
                {filtered.map(m => {
                  const badge = STATUS_BADGE[m.status] ?? STATUS_BADGE.risco
                  const valor = m.valor_confirmado || m.valor_estimado
                  return (
                    <tr key={m.id} className={`transition-colors ${
                      isLight ? 'hover:bg-slate-50/50' : 'hover:bg-white/[0.02]'
                    }`}>
                      <td className={`px-4 py-3 text-xs font-medium ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                        {fmtData(m.data_notificacao ?? m.created_at)}
                      </td>
                      <td className={`px-4 py-3 text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {portfolioName(m.portfolio_id)}
                      </td>
                      <td className={`px-4 py-3 text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {TIPO_LABEL[m.tipo_multa] ?? m.tipo_multa}
                      </td>
                      <td className={`px-4 py-3 text-xs max-w-[220px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {m.descricao}
                      </td>
                      <td className={`px-4 py-3 text-xs font-semibold text-right ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {BRL(valor)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-2.5 py-1 ${
                          isLight ? badge.light : badge.dark
                        }`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {m.responsavel ?? '-'}
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
