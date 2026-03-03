import { useState } from 'react'
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign,
  Calendar, Download, FileText, PieChart, ArrowUpRight,
  ArrowDownRight, Minus, Filter,
} from 'lucide-react'
import { useContasPagar, useContasReceber } from '../../hooks/useFinanceiro'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

type ReportType = 'dre' | 'fluxo' | 'cc' | 'aging'

const REPORTS: { key: ReportType; label: string; desc: string; icon: typeof BarChart3; color: string }[] = [
  { key: 'dre',   label: 'DRE',             desc: 'Demonstrativo de Resultado',  icon: BarChart3,   color: 'emerald' },
  { key: 'fluxo', label: 'Fluxo de Caixa',  desc: 'Entradas e saídas previstas', icon: TrendingUp,  color: 'blue'    },
  { key: 'cc',    label: 'Centro de Custo',  desc: 'Gastos por CC / Projeto',     icon: PieChart,    color: 'violet'  },
  { key: 'aging', label: 'Aging',            desc: 'Títulos por vencimento',      icon: Calendar,    color: 'amber'   },
]

export default function Relatorios() {
  const [activeReport, setActiveReport] = useState<ReportType>('dre')
  const { data: cp = [] } = useContasPagar()
  const { data: cr = [] } = useContasReceber()

  // Compute data
  const totalDespesas = cp
    .filter(c => ['pago', 'conciliado'].includes(c.status))
    .reduce((s, c) => s + c.valor_pago, 0)
  const totalReceitas = cr
    .filter(c => ['recebido', 'conciliado'].includes(c.status))
    .reduce((s, c) => s + c.valor_recebido, 0)
  const resultado = totalReceitas - totalDespesas

  // Centro de custo breakdown
  const ccMap = new Map<string, { pago: number; aberto: number }>()
  cp.forEach(c => {
    const cc = c.centro_custo || 'Sem CC'
    const curr = ccMap.get(cc) ?? { pago: 0, aberto: 0 }
    if (['pago', 'conciliado'].includes(c.status)) curr.pago += c.valor_pago
    else if (c.status !== 'cancelado') curr.aberto += c.valor_original
    ccMap.set(cc, curr)
  })
  const ccData = [...ccMap.entries()]
    .map(([cc, v]) => ({ cc, ...v, total: v.pago + v.aberto }))
    .sort((a, b) => b.total - a.total)
  const maxCC = ccData[0]?.total || 1

  // Aging buckets
  const now = new Date()
  const aging = { corrente: 0, ate30: 0, ate60: 0, ate90: 0, acima90: 0 }
  cp.filter(c => !['pago', 'conciliado', 'cancelado'].includes(c.status)).forEach(c => {
    const venc = new Date(c.data_vencimento)
    const diff = Math.floor((now.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24))
    if (diff <= 0) aging.corrente += c.valor_original
    else if (diff <= 30) aging.ate30 += c.valor_original
    else if (diff <= 60) aging.ate60 += c.valor_original
    else if (diff <= 90) aging.ate90 += c.valor_original
    else aging.acima90 += c.valor_original
  })

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <BarChart3 size={20} className="text-emerald-600" />
            Relatórios Financeiros
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">DRE, Fluxo de Caixa, Centro de Custo e Aging</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200
          text-[11px] font-semibold text-slate-600 hover:border-emerald-400 hover:text-emerald-600
          transition-all shadow-sm">
          <Download size={12} />
          Exportar
        </button>
      </div>

      {/* ── Report selector ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {REPORTS.map(r => (
          <button key={r.key} onClick={() => setActiveReport(r.key)}
            className={`rounded-2xl p-3 text-left transition-all border
              ${activeReport === r.key
                ? `bg-${r.color}-50 border-${r.color}-200 shadow-sm`
                : 'bg-white border-slate-200 hover:border-slate-300'
              }`}>
            <r.icon size={16} className={activeReport === r.key ? `text-${r.color}-600` : 'text-slate-400'} />
            <p className={`text-[11px] font-bold mt-1.5 ${activeReport === r.key ? `text-${r.color}-700` : 'text-slate-700'}`}>
              {r.label}
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5">{r.desc}</p>
          </button>
        ))}
      </div>

      {/* ── Report content ──────────────────────────────────── */}
      {activeReport === 'dre' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowUpRight size={14} className="text-emerald-500" />
                <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-widest">Receitas</p>
              </div>
              <p className="text-lg font-extrabold text-emerald-600">{fmt(totalReceitas)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowDownRight size={14} className="text-red-500" />
                <p className="text-[10px] text-red-500 font-semibold uppercase tracking-widest">Despesas</p>
              </div>
              <p className="text-lg font-extrabold text-red-600">{fmt(totalDespesas)}</p>
            </div>
            <div className={`bg-white rounded-2xl p-4 border shadow-sm
              ${resultado >= 0 ? 'border-emerald-200' : 'border-red-200'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <Minus size={14} className={resultado >= 0 ? 'text-emerald-500' : 'text-red-500'} />
                <p className={`text-[10px] font-semibold uppercase tracking-widest
                  ${resultado >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>Resultado</p>
              </div>
              <p className={`text-lg font-extrabold ${resultado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {fmt(resultado)}
              </p>
            </div>
          </div>

          {/* DRE table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-bold text-slate-600">Demonstrativo de Resultado do Exercício</p>
            </div>
            <div className="divide-y divide-slate-100">
              <DRERow label="(+) Receita Operacional" value={totalReceitas} bold isPositive />
              <DRERow label="(-) Despesas Operacionais" value={totalDespesas} isPositive={false} />
              <DRERow label="(-) Folha de Pagamento" value={0} isPositive={false} sub />
              <DRERow label="(-) Fornecedores" value={totalDespesas} isPositive={false} sub />
              <DRERow label="(-) Impostos" value={0} isPositive={false} sub />
              <DRERow label="(=) Resultado Operacional" value={resultado} bold isPositive={resultado >= 0} highlight />
              <DRERow label="(+/-) Resultado Financeiro" value={0} isPositive />
              <DRERow label="(=) Resultado Líquido" value={resultado} bold isPositive={resultado >= 0} highlight />
            </div>
          </div>
        </div>
      )}

      {activeReport === 'fluxo' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs font-bold text-slate-600 mb-4">Fluxo de Caixa — Próximos 30 dias</p>
            <div className="space-y-3">
              <FluxoBar label="Receitas Previstas"
                value={cr.filter(c => !['recebido', 'conciliado', 'cancelado'].includes(c.status))
                  .reduce((s, c) => s + c.valor_original, 0)}
                color="emerald" max={Math.max(
                  cr.filter(c => !['recebido', 'conciliado', 'cancelado'].includes(c.status))
                    .reduce((s, c) => s + c.valor_original, 0),
                  cp.filter(c => !['pago', 'conciliado', 'cancelado'].includes(c.status))
                    .reduce((s, c) => s + c.valor_original, 0)
                ) || 1}
              />
              <FluxoBar label="Pagamentos Previstos"
                value={cp.filter(c => !['pago', 'conciliado', 'cancelado'].includes(c.status))
                  .reduce((s, c) => s + c.valor_original, 0)}
                color="red" max={Math.max(
                  cr.filter(c => !['recebido', 'conciliado', 'cancelado'].includes(c.status))
                    .reduce((s, c) => s + c.valor_original, 0),
                  cp.filter(c => !['pago', 'conciliado', 'cancelado'].includes(c.status))
                    .reduce((s, c) => s + c.valor_original, 0)
                ) || 1}
              />
            </div>
          </div>

          {/* Weekly breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-bold text-slate-600">Vencimentos — Próximas 4 Semanas</p>
            </div>
            <div className="divide-y divide-slate-100">
              {[
                { label: 'Semana 1', days: 7 },
                { label: 'Semana 2', days: 14 },
                { label: 'Semana 3', days: 21 },
                { label: 'Semana 4', days: 28 },
              ].map((w, i) => {
                const start = new Date()
                start.setDate(start.getDate() + (i * 7))
                const end = new Date()
                end.setDate(end.getDate() + w.days)
                const weekCP = cp
                  .filter(c => !['pago', 'conciliado', 'cancelado'].includes(c.status))
                  .filter(c => {
                    const d = new Date(c.data_vencimento)
                    return d >= start && d < end
                  })
                  .reduce((s, c) => s + c.valor_original, 0)
                return (
                  <div key={w.label} className="flex items-center justify-between px-4 py-3">
                    <p className="text-xs font-semibold text-slate-600">{w.label}</p>
                    <p className="text-xs font-bold text-slate-800">{fmt(weekCP)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {activeReport === 'cc' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-bold text-slate-600">Gastos por Centro de Custo</p>
            </div>
            {ccData.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-xs text-slate-400">Nenhum dado disponível</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {ccData.map(item => (
                  <div key={item.cc}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-slate-700">{item.cc}</p>
                      <p className="text-xs font-bold text-slate-800">{fmt(item.total)}</p>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full flex">
                        <div
                          className="bg-emerald-500 rounded-l-full"
                          style={{ width: `${(item.pago / maxCC) * 100}%` }}
                        />
                        <div
                          className="bg-amber-400"
                          style={{ width: `${(item.aberto / maxCC) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-4 mt-1 text-[9px] text-slate-400">
                      <span>Pago: {fmt(item.pago)}</span>
                      <span>Aberto: {fmt(item.aberto)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 text-[10px] text-slate-400 px-1">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Pago</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Em Aberto</span>
          </div>
        </div>
      )}

      {activeReport === 'aging' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-bold text-slate-600">Aging — Títulos por Faixa de Vencimento</p>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: 'Corrente (a vencer)', value: aging.corrente, color: 'bg-emerald-500' },
                { label: '1-30 dias vencido',   value: aging.ate30,    color: 'bg-amber-400'   },
                { label: '31-60 dias vencido',   value: aging.ate60,    color: 'bg-orange-500'  },
                { label: '61-90 dias vencido',   value: aging.ate90,    color: 'bg-red-400'     },
                { label: '90+ dias vencido',     value: aging.acima90,  color: 'bg-red-600'     },
              ].map(bucket => {
                const maxAging = Math.max(aging.corrente, aging.ate30, aging.ate60, aging.ate90, aging.acima90) || 1
                return (
                  <div key={bucket.label}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-slate-600">{bucket.label}</p>
                      <p className="text-xs font-bold text-slate-800">{fmt(bucket.value)}</p>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${bucket.color} transition-all`}
                        style={{ width: `${(bucket.value / maxAging) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────

function DRERow({ label, value, bold, isPositive, sub, highlight }: {
  label: string; value: number; bold?: boolean; isPositive: boolean; sub?: boolean; highlight?: boolean
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5
      ${highlight ? 'bg-slate-50' : ''}
      ${sub ? 'pl-8' : ''}`}>
      <p className={`text-xs ${bold ? 'font-bold text-slate-800' : 'font-medium text-slate-500'}
        ${sub ? 'text-[11px]' : ''}`}>
        {label}
      </p>
      <p className={`text-xs font-mono ${bold ? 'font-bold' : 'font-medium'}
        ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
        {fmt(value)}
      </p>
    </div>
  )
}

function FluxoBar({ label, value, color, max }: {
  label: string; value: number; color: string; max: number
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-slate-600">{label}</p>
        <p className={`text-xs font-bold text-${color}-600`}>{fmt(value)}</p>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-${color}-500 transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
