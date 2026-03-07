import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  DollarSign, TrendingDown, TrendingUp, AlertTriangle,
  Clock, CheckCircle2, RefreshCw, ArrowRight,
  Receipt, FileCheck2, Landmark, BarChart3,
} from 'lucide-react'
import { useFinanceiroDashboard } from '../../hooks/useFinanceiro'
import type { ContaPagar, FinanceiroKPIs } from '../../types/financeiro'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const EMPTY_KPIS: FinanceiroKPIs = {
  total_cp: 0, cp_a_vencer: 0, cp_vencidas: 0, cp_pagas_periodo: 0,
  valor_total_aberto: 0, valor_pago_periodo: 0, valor_a_vencer_7d: 0,
  aguardando_aprovacao: 0, total_cr: 0, valor_cr_aberto: 0,
}

const STATUS_LABEL: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  previsto:              { label: 'Previsto',       dot: 'bg-slate-400',   bg: 'bg-slate-50',    text: 'text-slate-600'   },
  aprovado:              { label: 'Aprovado',       dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700'    },
  aguardando_docs:       { label: 'Aguard. Docs',   dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700'   },
  aguardando_aprovacao:  { label: 'Aguard. Aprov.', dot: 'bg-orange-400',  bg: 'bg-orange-50',   text: 'text-orange-700'  },
  aprovado_pgto:         { label: 'Pgto Aprovado',  dot: 'bg-indigo-400',  bg: 'bg-indigo-50',   text: 'text-indigo-700'  },
  em_remessa:            { label: 'Em Remessa',     dot: 'bg-cyan-400',    bg: 'bg-cyan-50',     text: 'text-cyan-700'    },
  pago:                  { label: 'Pago',           dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  conciliado:            { label: 'Conciliado',     dot: 'bg-green-500',   bg: 'bg-green-50',    text: 'text-green-700'   },
  cancelado:             { label: 'Cancelado',      dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-500'    },
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_LABEL[status] ?? { label: status, dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

// ── Quick Action Cards ───────────────────────────────────────────────────────
const ACTIONS = [
  { icon: Receipt,    label: 'Contas a Pagar',  to: '/financeiro/cp',          color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { icon: FileCheck2, label: 'Aprovações',       to: '/financeiro/aprovacoes',  color: 'text-orange-600',  bg: 'bg-orange-50'  },
  { icon: Landmark,   label: 'Conciliação',      to: '/financeiro/conciliacao', color: 'text-blue-600',    bg: 'bg-blue-50'    },
  { icon: BarChart3,  label: 'Relatórios',       to: '/financeiro/relatorios',  color: 'text-violet-600',  bg: 'bg-violet-50'  },
]

// ── Component ────────────────────────────────────────────────────────────────
export default function DashboardFinanceiro() {
  const nav = useNavigate()
  const location = useLocation()
  const [periodo, setPeriodo] = useState('30d')

  useEffect(() => {
    setPeriodo('30d')
  }, [location.key])
  const { data, isLoading, refetch } = useFinanceiroDashboard(periodo)

  const kpis = data?.kpis ?? EMPTY_KPIS
  const porStatus = data?.por_status ?? []
  const porCC = data?.por_centro_custo ?? []
  const proximos = data?.vencimentos_proximos ?? []
  const recentes = data?.recentes ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Painel Financeiro</h1>
          <p className="text-xs text-slate-400 mt-0.5">Visão geral de pagamentos e recebimentos</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-600 transition-colors">
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* ── Período ───────────────────────────────────────────── */}
      <div className="flex gap-2">
        {[['7d', '7 dias'], ['30d', '30 dias'], ['90d', '90 dias'], ['365d', 'Ano']].map(([val, lbl]) => (
          <button key={val} onClick={() => setPeriodo(val)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              periodo === val ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200'
            }`}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── KPIs ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard titulo="Saldo em Aberto" valor={fmt(kpis.valor_total_aberto)}
          icon={DollarSign} cor="text-emerald-600" hexCor="#10B981" />
        <KpiCard titulo="Pago no Período" valor={fmt(kpis.valor_pago_periodo)}
          icon={CheckCircle2} cor="text-teal-600" hexCor="#14B8A6" />
        <KpiCard titulo="Vence em 7 dias" valor={fmt(kpis.valor_a_vencer_7d)}
          icon={Clock} cor="text-amber-600" hexCor="#D97706"
          subtitulo={`${kpis.cp_a_vencer} títulos`} />
        <KpiCard titulo="Vencidas" valor={kpis.cp_vencidas}
          icon={AlertTriangle} cor={kpis.cp_vencidas > 0 ? 'text-red-600' : 'text-slate-400'}
          hexCor={kpis.cp_vencidas > 0 ? '#DC2626' : '#94A3B8'}
          subtitulo={kpis.cp_vencidas > 0 ? 'Atenção!' : 'Nenhuma'} />
      </div>

      {/* ── Quick Actions ─────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {ACTIONS.map(({ icon: Icon, label, to, color, bg }) => (
          <button key={to} onClick={() => nav(to)}
            className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm
              hover:shadow-md hover:-translate-y-0.5 transition-all text-center group">
            <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mx-auto mb-2
              group-hover:scale-110 transition-transform`}>
              <Icon size={16} className={color} />
            </div>
            <p className="text-[10px] font-bold text-slate-600">{label}</p>
          </button>
        ))}
      </div>

      {/* ── Status Pipeline ───────────────────────────────────── */}
      {porStatus.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <TrendingUp size={12} /> Por Status
          </h2>
          <div className="grid grid-cols-3 lg:grid-cols-5 gap-2">
            {porStatus.map(s => {
              const cfg = STATUS_LABEL[s.status]
              return (
                <div key={s.status} className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                  <StatusBadge status={s.status} />
                  <p className="text-lg font-extrabold text-slate-800 mt-2">{s.total}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{fmt(s.valor)}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Two columns: Próximos Vencimentos + Por Centro de Custo ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Próximos vencimentos */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <Clock size={14} className="text-amber-500" /> Próximos Vencimentos
            </h2>
            <button onClick={() => nav('/financeiro/cp')}
              className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
              Ver todos <ArrowRight size={10} />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {proximos.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-8">Nenhum vencimento próximo</p>
            ) : (
              proximos.slice(0, 6).map((cp: ContaPagar) => {
                const vencido = new Date(cp.data_vencimento) < new Date()
                return (
                  <div key={cp.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold
                      ${vencido ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {fmtData(cp.data_vencimento).split('/')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{cp.fornecedor_nome}</p>
                      <p className="text-[10px] text-slate-400">{cp.natureza ?? 'Geral'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-extrabold ${vencido ? 'text-red-600' : 'text-slate-700'}`}>
                        {fmt(cp.valor_original)}
                      </p>
                      <p className={`text-[10px] font-medium ${vencido ? 'text-red-500' : 'text-slate-400'}`}>
                        {fmtData(cp.data_vencimento)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* Por Centro de Custo */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <TrendingDown size={14} className="text-violet-500" /> Por Centro de Custo
            </h2>
          </div>
          <div className="px-4 py-3 space-y-3">
            {porCC.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-6">Nenhum dado por CC</p>
            ) : (
              porCC.slice(0, 6).map(cc => {
                const maxVal = Math.max(...porCC.map(c => c.valor), 1)
                const pct = Math.round((cc.valor / maxVal) * 100)
                const pctPago = cc.valor ? Math.round((cc.pago / cc.valor) * 100) : 0
                return (
                  <div key={cc.centro_custo}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-bold text-slate-700">{cc.centro_custo}</span>
                      <span className="text-xs font-semibold text-slate-500">{fmt(cc.valor)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                        style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{pctPago}% pago · {cc.total} títulos</p>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>

      {/* ── Lançamentos Recentes ──────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Recentes</h2>
          <button onClick={() => nav('/financeiro/cp')}
            className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
            Ver todos <ArrowRight size={10} />
          </button>
        </div>
        <div className="space-y-2">
          {recentes.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-6">Nenhum lançamento registrado</p>
          ) : (
            recentes.slice(0, 6).map((cp: ContaPagar) => (
              <div key={cp.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4
                flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <Receipt size={16} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{cp.fornecedor_nome}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {cp.centro_custo ?? '—'} · Venc. {fmtData(cp.data_vencimento)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-extrabold text-emerald-600">{fmt(cp.valor_original)}</p>
                  <StatusBadge status={cp.status} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ titulo, valor, icon: Icon, cor, hexCor, subtitulo }: {
  titulo: string; valor: number | string; icon: typeof DollarSign;
  cor: string; hexCor: string; subtitulo?: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex">
      <div className="w-[3px] shrink-0" style={{ backgroundColor: hexCor }} />
      <div className="p-4 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
          style={{ backgroundColor: hexCor + '18' }}>
          <Icon size={14} className={cor} />
        </div>
        <p className={`text-xl font-extrabold ${cor} leading-none`}>{valor}</p>
        <p className="text-[10px] text-slate-400 font-semibold mt-1 uppercase tracking-widest">{titulo}</p>
        {subtitulo && <p className="text-[10px] text-slate-400 mt-0.5">{subtitulo}</p>}
      </div>
    </div>
  )
}
