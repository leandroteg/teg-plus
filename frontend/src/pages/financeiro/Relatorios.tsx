import { useState } from 'react'
import {
  Download, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useContasPagar, useContasReceber } from '../../hooks/useFinanceiro'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export type ReportType = 'dre' | 'fluxo' | 'cc' | 'aging'

// ── Filtro de período De → Até (mês/ano) — mesmo padrão do EGP ────────────────
function ymHoje() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const MESES_OPT: Array<[string, string]> = [
  ['01', 'Jan'], ['02', 'Fev'], ['03', 'Mar'], ['04', 'Abr'], ['05', 'Mai'], ['06', 'Jun'],
  ['07', 'Jul'], ['08', 'Ago'], ['09', 'Set'], ['10', 'Out'], ['11', 'Nov'], ['12', 'Dez'],
]
function PeriodoSelect({ value, onChange, isDark }: { value: string; onChange: (v: string) => void; isDark: boolean }) {
  const [y, m] = value.split('-')
  const anoAtual = new Date().getFullYear()
  const anos: number[] = []; for (let a = 2024; a <= anoAtual + 1; a++) anos.push(a)
  const cls = `appearance-none rounded-lg pl-2 pr-2 py-1 border text-xs font-semibold cursor-pointer ${isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`
  return (
    <span className="inline-flex items-center gap-1">
      <select value={m} onChange={e => onChange(`${y}-${e.target.value}`)} className={cls} aria-label="Mês">{MESES_OPT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <select value={y} onChange={e => onChange(`${e.target.value}-${m}`)} className={cls} aria-label="Ano">{anos.map(a => <option key={a} value={a}>{a}</option>)}</select>
    </span>
  )
}

// Os cards-atalho e o título saíram — o acesso às telas é pelo seletor do Painel
// Financeiro (initialTipo); esta página só renderiza o relatório escolhido.

// Toolbar (filtro De → Até + Exportar) — reutilizada pelo header do Painel
// Financeiro (linha do título) e pela página standalone /financeiro/relatorios.
export function RelatoriosToolbar({ de, ate, setDe, setAte, isDark }: {
  de: string; ate: string; setDe: (v: string) => void; setAte: (v: string) => void; isDark: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center gap-1.5">
        <PeriodoSelect value={de} onChange={setDe} isDark={isDark} />
        <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>→</span>
        <PeriodoSelect value={ate} onChange={setAte} isDark={isDark} />
      </span>
      <button className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-semibold transition-all shadow-sm
        ${isDark ? 'bg-[#1e293b] border-white/[0.06] text-slate-300 hover:border-emerald-400 hover:text-emerald-500' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-600'}`}>
        <Download size={12} />
        Exportar
      </button>
    </div>
  )
}

export const relPeriodoDefault = () => ({ de: `${new Date().getFullYear()}-01`, ate: ymHoje() })

export default function Relatorios({ initialTipo, de: deProp, ate: ateProp }: {
  initialTipo?: ReportType
  /** Período controlado pelo pai (Painel Financeiro renderiza a toolbar no header). */
  de?: string; ate?: string
} = {}) {
  const { isDark } = useTheme()
  const activeReport: ReportType = initialTipo ?? 'dre'
  const controlado = deProp != null && ateProp != null
  const [deState, setDeState] = useState(`${new Date().getFullYear()}-01`)  // padrão: jan → mês atual
  const [ateState, setAteState] = useState(ymHoje())
  const de = deProp ?? deState
  const ate = ateProp ?? ateState
  const { data: cp = [] } = useContasPagar()
  const { data: cr = [] } = useContasReceber()

  // Período: compara por competência YYYY-MM. Pagos/recebidos usam a data do
  // pagamento/recebimento (fallback vencimento); em aberto usa o vencimento.
  const noPeriodo = (d?: string | null) => { const ym = (d ?? '').slice(0, 7); return ym >= de && ym <= ate }
  const cpPeriodo = cp.filter(c => noPeriodo(
    ['pago', 'conciliado'].includes(c.status) ? (c.data_pagamento || c.data_vencimento) : c.data_vencimento))
  const crPeriodo = cr.filter(c => noPeriodo(
    ['recebido', 'conciliado'].includes(c.status) ? (c.data_recebimento || c.data_vencimento) : c.data_vencimento))

  // Compute data
  const totalDespesas = cpPeriodo
    .filter(c => ['pago', 'conciliado'].includes(c.status))
    .reduce((s, c) => s + c.valor_pago, 0)
  const totalReceitas = crPeriodo
    .filter(c => ['recebido', 'conciliado'].includes(c.status))
    .reduce((s, c) => s + c.valor_recebido, 0)
  const resultado = totalReceitas - totalDespesas

  // Centro de custo breakdown
  const ccMap = new Map<string, { pago: number; aberto: number }>()
  cpPeriodo.forEach(c => {
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

  // Aging buckets (universo = títulos em aberto com vencimento no período)
  const now = new Date()
  const aging = { corrente: 0, ate30: 0, ate60: 0, ate90: 0, acima90: 0 }
  cpPeriodo.filter(c => !['pago', 'conciliado', 'cancelado'].includes(c.status)).forEach(c => {
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

      {/* ── Toolbar interna — só quando NÃO controlado pelo pai (standalone) ── */}
      {!controlado && (
        <div className="flex items-center justify-end">
          <RelatoriosToolbar de={de} ate={ate} setDe={setDeState} setAte={setAteState} isDark={isDark} />
        </div>
      )}

      {/* ── Report content ──────────────────────────────────── */}
      {activeReport === 'dre' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className={`rounded-2xl p-4 border shadow-sm ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowUpRight size={14} className="text-emerald-500" />
                <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-widest">Receitas</p>
              </div>
              <p className="text-lg font-extrabold text-emerald-600">{fmt(totalReceitas)}</p>
            </div>
            <div className={`rounded-2xl p-4 border shadow-sm ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowDownRight size={14} className="text-red-500" />
                <p className="text-[10px] text-red-500 font-semibold uppercase tracking-widest">Despesas</p>
              </div>
              <p className="text-lg font-extrabold text-red-600">{fmt(totalDespesas)}</p>
            </div>
            <div className={`rounded-2xl p-4 border shadow-sm ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white'}
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
          <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
            <div className={`px-4 py-3 border-b ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-100'}`}>
              <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Demonstrativo de Resultado do Exercício</p>
            </div>
            <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-100'}`}>
              <DRERow isDark={isDark} label="(+) Receita Operacional" value={totalReceitas} bold isPositive />
              <DRERow isDark={isDark} label="(-) Despesas Operacionais" value={totalDespesas} isPositive={false} />
              <DRERow isDark={isDark} label="(-) Folha de Pagamento" value={0} isPositive={false} sub />
              <DRERow isDark={isDark} label="(-) Fornecedores" value={totalDespesas} isPositive={false} sub />
              <DRERow isDark={isDark} label="(-) Impostos" value={0} isPositive={false} sub />
              <DRERow isDark={isDark} label="(=) Resultado Operacional" value={resultado} bold isPositive={resultado >= 0} highlight />
              <DRERow isDark={isDark} label="(+/-) Resultado Financeiro" value={0} isPositive />
              <DRERow isDark={isDark} label="(=) Resultado Líquido" value={resultado} bold isPositive={resultado >= 0} highlight />
            </div>
          </div>
        </div>
      )}

      {activeReport === 'fluxo' && (
        <div className="space-y-4">
          <div className={`rounded-2xl border shadow-sm p-5 ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs font-bold mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Fluxo de Caixa — Previsto no período</p>
            <div className="space-y-3">
              <FluxoBar isDark={isDark} label="Receitas Previstas"
                value={crPeriodo.filter(c => !['recebido', 'conciliado', 'cancelado'].includes(c.status))
                  .reduce((s, c) => s + c.valor_original, 0)}
                textColor="text-emerald-600" barColor="bg-emerald-500"
                max={Math.max(
                  crPeriodo.filter(c => !['recebido', 'conciliado', 'cancelado'].includes(c.status))
                    .reduce((s, c) => s + c.valor_original, 0),
                  cpPeriodo.filter(c => !['pago', 'conciliado', 'cancelado'].includes(c.status))
                    .reduce((s, c) => s + c.valor_original, 0)
                ) || 1}
              />
              <FluxoBar isDark={isDark} label="Pagamentos Previstos"
                value={cpPeriodo.filter(c => !['pago', 'conciliado', 'cancelado'].includes(c.status))
                  .reduce((s, c) => s + c.valor_original, 0)}
                textColor="text-red-600" barColor="bg-red-500"
                max={Math.max(
                  crPeriodo.filter(c => !['recebido', 'conciliado', 'cancelado'].includes(c.status))
                    .reduce((s, c) => s + c.valor_original, 0),
                  cpPeriodo.filter(c => !['pago', 'conciliado', 'cancelado'].includes(c.status))
                    .reduce((s, c) => s + c.valor_original, 0)
                ) || 1}
              />
            </div>
          </div>

          {/* Weekly breakdown */}
          <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
            <div className={`px-4 py-3 border-b ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-100'}`}>
              <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Vencimentos — Próximas 4 Semanas</p>
            </div>
            <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-100'}`}>
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
                    <p className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{w.label}</p>
                    <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmt(weekCP)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {activeReport === 'cc' && (
        <div className="space-y-4">
          <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
            <div className={`px-4 py-3 border-b ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-100'}`}>
              <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Gastos por Centro de Custo</p>
            </div>
            {ccData.length === 0 ? (
              <div className="p-8 text-center">
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum dado disponível</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {ccData.map(item => (
                  <div key={item.cc}>
                    <div className="flex items-center justify-between mb-1">
                      <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{item.cc}</p>
                      <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmt(item.total)}</p>
                    </div>
                    <div className={`h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
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
          <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
            <div className={`px-4 py-3 border-b ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-100'}`}>
              <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Aging — Títulos por Faixa de Vencimento</p>
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
                      <p className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{bucket.label}</p>
                      <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmt(bucket.value)}</p>
                    </div>
                    <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
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

function DRERow({ label, value, bold, isPositive, sub, highlight, isDark }: {
  label: string; value: number; bold?: boolean; isPositive: boolean; sub?: boolean; highlight?: boolean; isDark: boolean
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5
      ${highlight ? (isDark ? 'bg-white/[0.02]' : 'bg-slate-50') : ''}
      ${sub ? 'pl-8' : ''}`}>
      <p className={`text-xs ${bold ? (isDark ? 'font-bold text-white' : 'font-bold text-slate-800') : (isDark ? 'font-medium text-slate-400' : 'font-medium text-slate-500')}
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

function FluxoBar({ label, value, textColor, barColor, max, isDark }: {
  label: string; value: number; textColor: string; barColor: string; max: number; isDark: boolean
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{label}</p>
        <p className={`text-xs font-bold ${textColor}`}>{fmt(value)}</p>
      </div>
      <div className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
