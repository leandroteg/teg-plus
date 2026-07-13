import { useState, useEffect, lazy, Suspense } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMemo } from 'react'
import {
  DollarSign, TrendingUp, AlertTriangle,
  Clock, CheckCircle2, RefreshCw, ArrowRight,
  Receipt, Zap, CalendarClock, ChevronRight, ChevronDown, Lock, Scale,
} from 'lucide-react'

const PainelPagamentos = lazy(() => import('./PainelPagamentos'))
// Import estático: a toolbar do período renderiza no header (mesma linha do título)
import Relatorios, { RelatoriosToolbar, relPeriodoDefault, fluxoPeriodoDefault } from './Relatorios'

// Sub-painéis do seletor: painel padrão, pgtos previstos e as telas de Relatórios
type PainelKey = 'painel' | 'pgtos_previstos' | 'rel_fluxo' | 'rel_aging'
const REL_TIPO: Record<string, 'fluxo' | 'aging'> = {
  rel_fluxo: 'fluxo', rel_aging: 'aging',
}
import { useTheme } from '../../contexts/ThemeContext'
import { useFinanceiroDashboard, useContasReceber } from '../../hooks/useFinanceiro'
import type { ContaPagar, FinanceiroKPIs, ContaReceber } from '../../types/financeiro'

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

// ── DualMetric (par de valores: ex. Recebido / A Receber) ────────────────────
function DualMetric({ label, a, b, aTone, bTone, isDark, aNote, bNote }: {
  label: string; a: string; b: string; aTone: string; bTone: string; isDark: boolean; aNote: string; bNote: string
}) {
  const tones: Record<string, string> = {
    emerald: isDark ? 'text-emerald-400' : 'text-emerald-600',
    teal: isDark ? 'text-teal-400' : 'text-teal-600',
    amber: isDark ? 'text-amber-400' : 'text-amber-600',
    red: isDark ? 'text-red-400' : 'text-red-600',
    slate: isDark ? 'text-slate-300' : 'text-slate-600',
  }
  return (
    <div className={`rounded-2xl p-3 flex flex-col ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className="leading-none flex items-baseline gap-1 flex-wrap">
        <span className={`text-[1.55rem] font-extrabold ${tones[aTone] || tones.slate}`}>{a}</span>
        <span className={`text-lg font-bold ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>/</span>
        <span className={`text-[1.55rem] font-extrabold ${tones[bTone] || tones.slate}`}>{b}</span>
      </p>
      <p className={`text-[9px] mt-1.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
        <span className={tones[aTone]}>●</span> {aNote} · <span className={tones[bTone]}>●</span> {bNote}
      </p>
    </div>
  )
}

// ── SingleMetric (Diferenca: 1 valor, cor pelo sinal) ────────────────────────
function SingleMetric({ label, value, tone, note, isDark }: {
  label: string; value: string; tone: string; note: string; isDark: boolean
}) {
  const tones: Record<string, string> = {
    emerald: isDark ? 'text-emerald-400' : 'text-emerald-600',
    red: isDark ? 'text-red-400' : 'text-red-600',
  }
  return (
    <div className={`rounded-2xl p-3 flex flex-col justify-center ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-[1.85rem] font-extrabold leading-none ${tones[tone] || tones.emerald}`}>{value}</p>
      <p className={`text-[9px] mt-1.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────
export default function DashboardFinanceiro() {
  const { isDark } = useTheme()
  const nav = useNavigate()
  const location = useLocation()
  const [periodo, setPeriodo] = useState('30d')
  const [painelAtivo, setPainelAtivo] = useState<PainelKey>('painel')
  const [relPeriodo, setRelPeriodo] = useState(relPeriodoDefault)  // De → Até dos relatórios (vive no header)

  // Fluxo de Caixa SEMPRE abre olhando pra frente: próximo mês → fim do ano
  useEffect(() => {
    if (REL_TIPO[painelAtivo] === 'fluxo') setRelPeriodo(fluxoPeriodoDefault())
    else if (painelAtivo in REL_TIPO) setRelPeriodo(relPeriodoDefault())
  }, [painelAtivo])

  useEffect(() => { setPeriodo('30d') }, [location.key])
  const { data, isLoading, refetch } = useFinanceiroDashboard(periodo)

  const kpis = data?.kpis ?? EMPTY_KPIS
  const porStatus = data?.por_status ?? []
  const porCC = data?.por_centro_custo ?? []
  const proximos = data?.vencimentos_proximos ?? []
  const recentes = data?.recentes ?? []

  // Contas a Receber (para os blocos de recebimento)
  const { data: crList = [] } = useContasReceber()
  const cr = useMemo(() => {
    const isBloq = (b?: string) => !!b && b !== 'sem_bloqueio' && b !== 'resolvido'
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const a = { recebido: 0, aReceber: 0, bloqueado: 0, vencido: 0, emAberto: 0 }
    const ccReceita: Record<string, number> = {}
    for (const c of crList as ContaReceber[]) {
      const v = c.valor_original
      if (['recebido', 'conciliado'].includes(c.status)) { a.recebido += v; continue }
      a.aReceber += v
      const k = c.centro_custo || '—'; ccReceita[k] = (ccReceita[k] || 0) + v
      if (isBloq(c.bloqueio_tipo)) a.bloqueado += v
      else if (new Date(c.data_vencimento + 'T00:00:00') < hoje) a.vencido += v
      else a.emAberto += v
    }
    return { ...a, ccReceita }
  }, [crList])

  // KPIs consolidados
  const cpPago = kpis.valor_pago_periodo
  const cpAPagar = kpis.valor_total_aberto
  const diferenca = cr.aReceber - cpAPagar

  // Por Centro de Custo: receita (CR) + despesa (CP) por CC
  const ccRows = useMemo(() => {
    const m: Record<string, { receita: number; despesa: number }> = {}
    for (const [k, v] of Object.entries(cr.ccReceita)) { (m[k] ??= { receita: 0, despesa: 0 }).receita += v }
    for (const c of porCC as { centro_custo: string; valor: number }[]) { (m[c.centro_custo || '—'] ??= { receita: 0, despesa: 0 }).despesa += c.valor }
    return Object.entries(m).map(([cc, v]) => ({ cc, ...v }))
      .sort((a, b) => (b.receita + b.despesa) - (a.receita + a.despesa)).slice(0, 8)
  }, [cr.ccReceita, porCC])
  const maxCC = Math.max(1, ...ccRows.flatMap(r => [r.receita, r.despesa]))

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
        <div className="flex items-center gap-3">
          <div>
            <h1 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Painel Financeiro</h1>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Visao geral de pagamentos e recebimentos</p>
          </div>
          <div className="relative">
            <select
              value={painelAtivo}
              onChange={e => setPainelAtivo(e.target.value as PainelKey)}
              className={`appearance-none text-xs font-semibold rounded-lg pl-3 pr-7 py-1.5 cursor-pointer border transition-all ${
                isDark
                  ? 'bg-white/[0.06] border-white/[0.1] text-slate-300 hover:bg-white/[0.1]'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <option value="painel">Painel</option>
              <option value="pgtos_previstos">Pgtos Previstos</option>
              <option value="rel_fluxo">Fluxo de Caixa</option>
              <option value="rel_aging">Aging</option>
            </select>
            <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {painelAtivo === 'painel' && (
            <>
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
            </>
          )}
          {painelAtivo in REL_TIPO && (
            <RelatoriosToolbar
              de={relPeriodo.de} ate={relPeriodo.ate}
              setDe={v => setRelPeriodo(p => ({ ...p, de: v }))}
              setAte={v => setRelPeriodo(p => ({ ...p, ate: v }))}
              isDark={isDark}
            />
          )}
        </div>
      </div>

      {painelAtivo === 'pgtos_previstos' && (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>}>
          <PainelPagamentos />
        </Suspense>
      )}

      {/* Telas da visão Relatórios como sub-painéis — key remonta p/ abrir na tela certa;
          período controlado pelo header (RelatoriosToolbar acima) */}
      {painelAtivo in REL_TIPO && (
        <Relatorios key={painelAtivo} initialTipo={REL_TIPO[painelAtivo]} de={relPeriodo.de} ate={relPeriodo.ate} />
      )}

      {painelAtivo === 'painel' && (<>

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
              <DualMetric label="Recebido / A Receber" a={fmt(cr.recebido)} b={fmt(cr.aReceber)}
                aTone="emerald" bTone="amber" isDark={isDark} aNote="recebido" bNote="a receber" />
              <DualMetric label="Pago / A Pagar" a={fmt(cpPago)} b={fmt(cpAPagar)}
                aTone="teal" bTone="red" isDark={isDark} aNote="pago" bNote="a pagar" />
              <SingleMetric label="Diferenca" value={fmt(diferenca)} tone={diferenca >= 0 ? 'emerald' : 'red'} isDark={isDark}
                note={diferenca >= 0 ? 'a receber supera a pagar' : 'a pagar supera a receber'} />
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
                cr.bloqueado > 0 || kpis.cp_vencidas > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'
              }`}>
                <Zap size={14} className={cr.bloqueado > 0 || kpis.cp_vencidas > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniInfoCard label="Recebimentos Bloqueados" value={fmt(cr.bloqueado)} icon={Lock}
                iconTone={cr.bloqueado > 0 ? 'text-rose-500' : 'text-slate-400'}
                note={cr.bloqueado > 0 ? 'retidos' : 'nenhum'} isDark={isDark} />
              <MiniInfoCard label="Pagamentos Vencidos" value={kpis.cp_vencidas} icon={AlertTriangle}
                iconTone={kpis.cp_vencidas > 0 ? 'text-red-500' : 'text-slate-400'}
                note={kpis.cp_vencidas > 0 ? 'Atencao!' : 'tudo ok'} isDark={isDark} />
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

      {/* ── Pulso de Recebimentos (Contas a Receber) ── */}
      {(() => {
        const segs = [
          { key: 'recebido', label: 'Recebido', val: cr.recebido, color: 'bg-emerald-500' },
          { key: 'bloqueado', label: 'Bloqueado', val: cr.bloqueado, color: 'bg-rose-500' },
          { key: 'vencido', label: 'Vencido', val: cr.vencido, color: 'bg-orange-500' },
          { key: 'aberto', label: 'Em aberto', val: cr.emAberto, color: 'bg-sky-500' },
        ]
        const total = segs.reduce((s, x) => s + x.val, 0)
        const active = segs.filter(s => s.val > 0)
        return (
          <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
            <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
              <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                <Receipt size={14} className="text-sky-500" /> Pulso de Recebimentos
              </h2>
              <div className="flex items-center gap-3">
                {segs.map(s => (
                  <span key={s.key} className="flex items-center gap-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                    <span className="text-[10px] text-slate-500">{s.label}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="px-4 py-3">
              {total === 0 ? (
                <div className={`h-10 rounded-xl flex items-center justify-center text-[10px] font-semibold ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
                  Nenhum recebimento no periodo
                </div>
              ) : (
                <div className={`flex h-10 rounded-xl overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                  {active.map(s => {
                    const pct = (s.val / total) * 100
                    return (
                      <div key={s.key} className={`${s.color} relative flex items-center justify-center transition-all`}
                        style={{ width: `${Math.max(pct, 4)}%` }} title={`${s.label}: ${fmt(s.val)}`}>
                        {pct >= 14 && (
                          <span className="text-[10px] font-bold text-white drop-shadow-sm truncate px-1">
                            {s.label}{pct >= 22 ? ` · ${fmt(s.val)}` : ''}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )
      })()}

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

        {/* Por Centro de Custo — receita (CR) x despesa (CP) */}
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Scale size={14} className="text-emerald-500" /> Por Centro de Custo
            </h2>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-[10px] text-slate-500">Receita</span></span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /><span className="text-[10px] text-slate-500">Despesa</span></span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {ccRows.length === 0 ? (
              <p className={`text-center text-sm py-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum dado por CC</p>
            ) : ccRows.map((cc) => (
              <div key={cc.cc} className="flex items-center gap-3">
                <p className={`text-[11px] font-semibold text-right shrink-0 w-[84px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`} title={cc.cc}>{cc.cc}</p>
                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className={`flex-1 h-4 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-600 transition-all duration-500"
                        style={{ width: `${Math.max((cc.receita / maxCC) * 100, cc.receita > 0 ? 3 : 0)}%` }} />
                    </div>
                    <p className={`text-[10px] font-bold shrink-0 w-[62px] text-right ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{cc.receita > 0 ? fmt(cc.receita) : '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`flex-1 h-4 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                      <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-red-600 transition-all duration-500"
                        style={{ width: `${Math.max((cc.despesa / maxCC) * 100, cc.despesa > 0 ? 3 : 0)}%` }} />
                    </div>
                    <p className={`text-[10px] font-bold shrink-0 w-[62px] text-right ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>{cc.despesa > 0 ? fmt(cc.despesa) : '—'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      </>)}
    </div>
  )
}
