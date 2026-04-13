import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  DollarSign, TrendingDown, TrendingUp, AlertTriangle,
  Clock, CheckCircle2, RefreshCw, ArrowRight,
  Receipt, Zap, CalendarClock, ChevronRight,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useFinanceiroDashboard } from '../../hooks/useFinanceiro'
import type { ContaPagar, FinanceiroKPIs } from '../../types/financeiro'

const fmt = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (Math.abs(v) >= 10_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}k`
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const EMPTY_KPIS: FinanceiroKPIs = {
  total_cp: 0, cp_a_vencer: 0, cp_vencidas: 0, cp_pagas_periodo: 0,
  valor_total_aberto: 0, valor_pago_periodo: 0, valor_a_vencer_7d: 0,
  aguardando_aprovacao: 0, total_cr: 0, valor_cr_aberto: 0,
}

const STATUS_LABEL: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  previsto:      { label: 'Previsto',      dot: 'bg-slate-400',   bg: 'bg-slate-50',    text: 'text-slate-600' },
  confirmado:    { label: 'Confirmado',    dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700' },
  em_lote:       { label: 'Em Lote',       dot: 'bg-violet-400',  bg: 'bg-violet-50',   text: 'text-violet-700' },
  aprovado_pgto: { label: 'Pgto Aprovado', dot: 'bg-indigo-400',  bg: 'bg-indigo-50',   text: 'text-indigo-700' },
  em_pagamento:  { label: 'Em Pagamento',  dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700' },
  pago:          { label: 'Pago',          dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  conciliado:    { label: 'Conciliado',    dot: 'bg-green-500',   bg: 'bg-green-50',    text: 'text-green-700' },
  cancelado:     { label: 'Cancelado',     dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-500' },
}

function StatusBadge({ status, isDark }: { status: string; isDark?: boolean }) {
  const c = STATUS_LABEL[status] ?? { label: status, dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${isDark ? 'bg-white/[0.06]' : c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

// ── SpotlightMetric ──────────────────────────────────────────────────────────
function SpotlightMetric({ label, value, tone, note, isDark }: {
  label: string; value: string | number; tone: string; note?: string; isDark: boolean
}) {
  const tones: Record<string, string> = {
    emerald: isDark ? 'text-emerald-400' : 'text-emerald-600',
    teal: isDark ? 'text-teal-400' : 'text-teal-600',
    amber: isDark ? 'text-amber-400' : 'text-amber-600',
    red: isDark ? 'text-red-400' : 'text-red-600',
    slate: isDark ? 'text-slate-400' : 'text-slate-500',
  }
  return (
    <div className={`rounded-2xl p-3 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-[1.85rem] font-extrabold leading-none ${tones[tone] || tones.slate}`}>{value}</p>
      {note && <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

// ── MiniInfoCard ─────────────────────────────────────────────────────────────
function MiniInfoCard({ label, value, note, icon: Icon, iconTone, isDark }: {
  label: string; value: string | number; note?: string; icon: typeof DollarSign; iconTone: string; isDark: boolean
}) {
  return (
    <div className={`rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 flex-1 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <Icon size={16} className={iconTone} />
      <p className={`text-2xl font-extrabold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      <p className={`text-[9px] font-bold uppercase tracking-wider text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      {note && <p className={`text-[8px] text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────
export default function DashboardFinanceiro() {
  const { isDark } = useTheme()
  const nav = useNavigate()
  const location = useLocation()
  const [periodo, setPeriodo] = useState('30d')

  useEffect(() => { setPeriodo('30d') }, [location.key])
  const { data, isLoading, refetch } = useFinanceiroDashboard(periodo)

  const kpis = data?.kpis ?? EMPTY_KPIS
  const porStatus = data?.por_status ?? []
  const porCC = data?.por_centro_custo ?? []
  const proximos = data?.vencimentos_proximos ?? []
  const recentes = data?.recentes ?? []

  const cardClass = isDark ? 'bg-[#111827] border border-white/[0.06]' : 'bg-white border border-slate-200'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Pipeline data
  const PIPELINE_ORDER = ['previsto','confirmado','em_lote','aprovado_pgto','em_pagamento','pago','conciliado']
  const ordered = PIPELINE_ORDER
    .map(key => porStatus.find((s: any) => s.status === key))
    .filter((s): s is any => !!s && s.total > 0)
  const totalPipeline = ordered.reduce((sum: number, s: any) => sum + s.total, 0) || 1
  const BAR_COLORS: Record<string, string> = {
    previsto: 'bg-slate-400', confirmado: 'bg-blue-400', em_lote: 'bg-violet-500',
    aprovado_pgto: 'bg-indigo-500', em_pagamento: 'bg-amber-400',
    pago: 'bg-emerald-500', conciliado: 'bg-green-500',
  }

  return (
    <div className="space-y-3">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Painel Financeiro</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Visao geral de pagamentos e recebimentos</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Periodo */}
          <div className="flex gap-1">
            {[['7d', '7d'], ['30d', '30d'], ['90d', '90d'], ['365d', 'Ano']].map(([val, lbl]) => (
              <button key={val} onClick={() => setPeriodo(val)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  periodo === val
                    ? 'bg-emerald-600 text-white'
                    : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                }`}>
                {lbl}
              </button>
            ))}
          </div>
          <button onClick={() => refetch()}
            className={`flex items-center gap-1 text-xs ${isDark ? 'text-slate-500 hover:text-emerald-400' : 'text-slate-400 hover:text-emerald-600'}`}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* ── Hero: Indicadores + Janela Critica ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3 items-stretch">
        {/* Indicadores */}
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Nucleo Financeiro
                </p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Indicadores do periodo
                </h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                <DollarSign size={18} className="text-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric label="Saldo em Aberto" value={fmt(kpis.valor_total_aberto)} tone="emerald" isDark={isDark} note={`${kpis.total_cp} titulos`} />
              <SpotlightMetric label="Pago no Periodo" value={fmt(kpis.valor_pago_periodo)} tone="teal" isDark={isDark} note={`${kpis.cp_pagas_periodo} pagamentos`} />
              <SpotlightMetric label="Vence em 7 dias" value={fmt(kpis.valor_a_vencer_7d)} tone={kpis.cp_a_vencer > 0 ? 'amber' : 'slate'} isDark={isDark} note={`${kpis.cp_a_vencer} titulos`} />
            </div>
          </div>
        </section>

        {/* Janela Critica */}
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Janela Critica
                </p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  O que exige acao agora
                </h2>
              </div>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                kpis.cp_vencidas > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'
              }`}>
                <Zap size={14} className={kpis.cp_vencidas > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniInfoCard label="Vencidas" value={kpis.cp_vencidas} icon={AlertTriangle}
                iconTone={kpis.cp_vencidas > 0 ? 'text-red-500' : 'text-slate-400'}
                note={kpis.cp_vencidas > 0 ? 'Atencao!' : 'tudo ok'} isDark={isDark} />
              <MiniInfoCard label="Aguard. Aprovacao" value={kpis.aguardando_aprovacao} icon={CalendarClock}
                iconTone={kpis.aguardando_aprovacao > 0 ? 'text-amber-500' : 'text-slate-400'}
                note="pagamentos pendentes" isDark={isDark} />
            </div>
          </div>
        </section>
      </div>

      {/* ── Pulso Financeiro ── */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <TrendingUp size={14} className="text-emerald-500" /> Pulso Financeiro
          </h2>
          <div className="flex items-center gap-3">
            {ordered.slice(0, 4).map((s: any) => (
              <span key={s.status} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-full ${BAR_COLORS[s.status]}`} />
                <span className="text-[10px] text-slate-500">{STATUS_LABEL[s.status]?.label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="px-4 py-3">
          {ordered.length === 0 ? (
            <div className={`h-10 rounded-xl flex items-center justify-center text-[10px] font-semibold ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
              Nenhum titulo no periodo
            </div>
          ) : (
            <div className={`flex h-10 rounded-xl overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
              {ordered.map((s: any) => {
                const pct = (s.total / totalPipeline) * 100
                return (
                  <div key={s.status} className={`${BAR_COLORS[s.status] ?? 'bg-gray-300'} relative flex items-center justify-center transition-all`}
                    style={{ width: `${Math.max(pct, 4)}%` }} title={`${STATUS_LABEL[s.status]?.label}: ${s.total} — ${fmt(s.valor)}`}>
                    {pct >= 14 && (
                      <span className="text-[10px] font-bold text-white drop-shadow-sm truncate px-1">
                        {STATUS_LABEL[s.status]?.label} {s.total}{pct >= 22 ? ` · ${fmt(s.valor)}` : ''}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Row: Proximos Vencimentos + Por Centro de Custo ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* Proximos Vencimentos */}
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Clock size={14} className="text-amber-500" /> Proximos Vencimentos
            </h2>
            <button onClick={() => nav('/financeiro/cp')} className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-semibold">
              Ver todos <ChevronRight size={11} />
            </button>
          </div>
          <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
            {proximos.length === 0 ? (
              <p className={`text-center text-sm py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum vencimento proximo</p>
            ) : proximos.slice(0, 6).map((cp: ContaPagar) => {
              const vencido = new Date(cp.data_vencimento) < new Date()
              return (
                <div key={cp.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    vencido ? 'bg-red-50 text-red-600' : isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {fmtData(cp.data_vencimento).split('/')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{cp.fornecedor_nome}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{cp.natureza ?? 'Geral'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-extrabold ${vencido ? 'text-red-600' : isDark ? 'text-slate-200' : 'text-slate-700'}`}>{fmt(cp.valor_original)}</p>
                    <p className={`text-[10px] font-medium ${vencido ? 'text-red-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtData(cp.data_vencimento)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Por Centro de Custo */}
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <TrendingDown size={14} className="text-emerald-500" /> Por Centro de Custo
            </h2>
          </div>
          <div className="p-4 space-y-2.5">
            {porCC.length === 0 ? (
              <p className={`text-center text-sm py-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum dado por CC</p>
            ) : porCC.slice(0, 8).map((cc: any) => {
              const maxVal = Math.max(...porCC.map((c: any) => c.valor), 1)
              return (
                <div key={cc.centro_custo} className="flex items-center gap-3">
                  <p className={`text-[11px] font-semibold text-right shrink-0 w-[80px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{cc.centro_custo}</p>
                  <div className="flex-1 relative">
                    <div className={`h-6 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-600 transition-all duration-500"
                        style={{ width: `${Math.max((cc.valor / maxVal) * 100, 4)}%` }} />
                    </div>
                  </div>
                  <p className={`text-[11px] font-extrabold shrink-0 w-[70px] text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{fmt(cc.valor)}</p>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
