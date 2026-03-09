import { useState, useMemo, Fragment } from 'react'
import { ChevronDown, Star, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Target } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useControleOrcamentario } from '../../hooks/useControladoria'
import type { ControleOrcamentarioRow } from '../../hooks/useControladoria'

// ── Cost Center Structure ────────────────────────────────────────────────────

interface Section {
  title: string
  items: string[]
}

const SECTIONS: Section[] = [
  {
    title: 'CUSTOS DIRETOS E IND. OBRAS',
    items: [
      'Materiais (Aco, Concreto, EPIs)',
      'Mao de Obra Direta',
      'Alojamentos e Alimentacao',
      'Frotas',
      'Servicos Terc. + Outros C. Diretos',
      'Equipamentos e EPIs',
    ],
  },
  {
    title: 'DESPESAS ADMINISTRATIVAS',
    items: [
      'Pessoal',
      'Administrativo',
      'Servicos Administrativos',
      'Sistemas',
      'Desp Fin. e Outra Desp Adm',
    ],
  },
  {
    title: 'DESPESAS APOS O LUCRO',
    items: [
      'Amortizacoes',
      'Impostos (PIS/COFINS/IRPJ/CSLL)',
    ],
  },
]

const ALL_ITEMS = SECTIONS.flatMap(s => s.items)

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (v: number): string =>
  v === 0
    ? '\u2014'
    : new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      }).format(v)

const fmtVariacao = (v: number): string => {
  if (v === 0) return '\u2014'
  const prefix = v > 0 ? '+' : ''
  return prefix + new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(v)
}

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

// ── Component ────────────────────────────────────────────────────────────────

export default function ControleOrcamentario() {
  const { isLightSidebar: isLight } = useTheme()
  const [ano, setAno] = useState(currentYear)
  const [mes, setMes] = useState(currentMonth)
  const { data: rows = [], isLoading } = useControleOrcamentario(ano, mes)

  // Build lookup map
  const dataMap = useMemo(() => {
    const m = new Map<string, ControleOrcamentarioRow>()
    for (const r of rows) m.set(r.categoria, r)
    return m
  }, [rows])

  const getRow = (cat: string): ControleOrcamentarioRow =>
    dataMap.get(cat) ?? {
      categoria: cat,
      premissa: '',
      valor_orcado: 0,
      valor_realizado: 0,
      variacao: 0,
      desvio_explicacao: '',
      plano_acao: '',
    }

  // Totals
  const grandTotal = useMemo(() => {
    let orcado = 0, realizado = 0
    for (const cat of ALL_ITEMS) {
      const r = getRow(cat)
      orcado += r.valor_orcado
      realizado += r.valor_realizado
    }
    return { orcado, realizado, variacao: orcado - realizado }
  }, [dataMap])

  const sectionTotal = (items: string[]) => {
    let orcado = 0, realizado = 0
    for (const cat of items) {
      const r = getRow(cat)
      orcado += r.valor_orcado
      realizado += r.valor_realizado
    }
    return { orcado, realizado, variacao: orcado - realizado }
  }

  // KPIs
  const kpis = useMemo(() => {
    const planoAcaoCount = ALL_ITEMS.filter(cat => getRow(cat).plano_acao).length
    const desvioTotal = grandTotal.orcado > 0
      ? ((grandTotal.realizado - grandTotal.orcado) / grandTotal.orcado) * 100
      : 0
    const favoravelCount = ALL_ITEMS.filter(cat => getRow(cat).variacao > 0).length
    const desfavoravelCount = ALL_ITEMS.filter(cat => getRow(cat).variacao < 0).length
    return { planoAcaoCount, desvioTotal, favoravelCount, desfavoravelCount }
  }, [dataMap, grandTotal])

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)
  const mesLabel = MONTHS[mes - 1] ?? ''

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Dark Navy Header ──────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-[#0f172a] to-[#1e1b4b] border border-white/[0.06] shadow-2xl">
        <div className="px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                <span className="text-indigo-400">TEG</span>
                <span className="text-white/30">&middot;</span>
                <span>ORCADO vs. REALIZADO</span>
                <span className="text-white/30">&middot;</span>
                <span className="text-sky-400 uppercase">{mesLabel} / {ano}</span>
              </h1>
              <p className="text-[11px] text-slate-400 mt-1 tracking-wide">
                Painel Executivo de Acompanhamento Orcamentario &middot; Visao Diretoria
              </p>
              <p className="text-[10px] text-amber-400/80 mt-1.5 flex items-center gap-1.5">
                <Star size={10} className="fill-amber-400 text-amber-400" />
                Contas marcadas com <span className="font-bold">&#9733;</span> possuem Plano de Acao ativo
              </p>
            </div>

            {/* ── Month / Year selectors ───────────────────── */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={mes}
                  onChange={e => setMes(Number(e.target.value))}
                  className="appearance-none pl-3 pr-8 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all bg-white/[0.06] border-white/[0.1] text-white hover:border-indigo-500/50"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i + 1} className="bg-slate-900 text-white">{m}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
              </div>
              <div className="relative">
                <select
                  value={ano}
                  onChange={e => setAno(Number(e.target.value))}
                  className="appearance-none pl-3 pr-8 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all bg-white/[0.06] border-white/[0.1] text-white hover:border-indigo-500/50"
                >
                  {years.map(y => (
                    <option key={y} value={y} className="bg-slate-900 text-white">{y}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
              </div>
            </div>
          </div>
        </div>

        {/* ── KPI Strip ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-white/[0.06]">
          <KPIStrip
            icon={<Target size={14} />}
            label="Desvio Total"
            value={`${kpis.desvioTotal >= 0 ? '+' : ''}${kpis.desvioTotal.toFixed(1)}%`}
            color={Math.abs(kpis.desvioTotal) <= 5 ? 'emerald' : 'red'}
          />
          <KPIStrip
            icon={<TrendingDown size={14} />}
            label="Favoraveis"
            value={`${kpis.favoravelCount} contas`}
            color="emerald"
          />
          <KPIStrip
            icon={<TrendingUp size={14} />}
            label="Desfavoraveis"
            value={`${kpis.desfavoravelCount} contas`}
            color="red"
          />
          <KPIStrip
            icon={<Star size={14} className="fill-amber-400 text-amber-400" />}
            label="Planos de Acao"
            value={`${kpis.planoAcaoCount} ativos`}
            color="amber"
          />
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className={`rounded-2xl overflow-hidden border ${
        isLight ? 'border-slate-200 shadow-sm' : 'border-white/[0.06]'
      }`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">

              {/* ── Column headers ───────────────────────────── */}
              <thead>
                <tr>
                  <th colSpan={7} className="px-5 py-3 text-left bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900">
                    <span className="text-white font-extrabold text-xs tracking-wide uppercase">
                      Controle Orcamentario &mdash; {mesLabel} / {ano}
                    </span>
                  </th>
                </tr>
                <tr className="bg-slate-900 text-white">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider min-w-[200px]">
                    Conta / Descricao
                  </th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider min-w-[180px]">
                    Premissa do Orcamento
                  </th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                    Orcado {mes}/{ano}
                  </th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                    Realizado {mes}/{ano}
                  </th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider min-w-[110px]">
                    Variacao (R$)
                  </th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider min-w-[180px]">
                    Desvio / Variacao
                  </th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider min-w-[180px]">
                    <span className="flex items-center gap-1">
                      <Star size={10} className="fill-amber-400 text-amber-400" />
                      Plano de Acao
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {SECTIONS.map((section, si) => {
                  const st = sectionTotal(section.items)
                  return (
                    <Fragment key={si}>
                      {/* ── Section header ───────────────────────── */}
                      <tr className={isLight
                        ? 'bg-slate-100 border-b border-slate-200'
                        : 'bg-white/[0.04] border-b border-white/[0.06]'
                      }>
                        <td colSpan={7} className={`px-5 py-2.5 text-[10px] font-extrabold uppercase tracking-wider ${
                          isLight ? 'text-slate-700' : 'text-slate-200'
                        }`}>
                          {section.title}
                        </td>
                      </tr>

                      {/* ── Row items ────────────────────────────── */}
                      {section.items.map((item, ii) => {
                        const r = getRow(item)
                        const hasPlano = !!r.plano_acao
                        const isEven = ii % 2 === 0
                        const isFavoravel = r.variacao > 0
                        const isDesfavoravel = r.variacao < 0

                        // Gold highlight for rows with active plan
                        const goldHighlightLight = hasPlano ? 'bg-amber-50/60 border-l-2 border-l-amber-400' : ''
                        const goldHighlightDark = hasPlano ? 'bg-amber-950/10 border-l-2 border-l-amber-500/40' : ''

                        return (
                          <tr
                            key={item}
                            className={`border-b transition-colors ${
                              isLight
                                ? `${isEven ? 'bg-white' : 'bg-slate-50/50'} ${goldHighlightLight} border-slate-100 hover:bg-indigo-50/40`
                                : `${isEven ? 'bg-transparent' : 'bg-white/[0.01]'} ${goldHighlightDark} border-white/[0.04] hover:bg-white/[0.03]`
                            }`}
                          >
                            {/* Conta */}
                            <td className={`px-4 py-2.5 text-xs ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                              <span className="flex items-center gap-1.5">
                                {hasPlano && (
                                  <Star size={11} className="fill-amber-400 text-amber-400 flex-shrink-0" />
                                )}
                                <span className={`${isLight ? 'text-indigo-500' : 'text-indigo-400'} mr-1`}>&bull;</span>
                                {item}
                              </span>
                            </td>

                            {/* Premissa */}
                            <td className={`px-3 py-2.5 text-[10px] leading-tight ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                              {r.premissa || <span className="text-slate-400/40 italic">---</span>}
                            </td>

                            {/* Orcado */}
                            <td className={`px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                              {fmtBRL(r.valor_orcado)}
                            </td>

                            {/* Realizado */}
                            <td className={`px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                              {fmtBRL(r.valor_realizado)}
                            </td>

                            {/* Variacao */}
                            <td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                                isFavoravel
                                  ? 'bg-emerald-500/10 text-emerald-500'
                                  : isDesfavoravel
                                    ? 'bg-red-500/10 text-red-500'
                                    : isLight ? 'text-slate-400' : 'text-slate-500'
                              }`}>
                                {isFavoravel && <TrendingDown size={10} />}
                                {isDesfavoravel && <TrendingUp size={10} />}
                                {fmtVariacao(r.variacao)}
                              </span>
                            </td>

                            {/* Desvio explicacao */}
                            <td className={`px-3 py-2.5 text-[10px] leading-tight ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                              {r.desvio_explicacao || <span className="text-slate-400/40 italic">---</span>}
                            </td>

                            {/* Plano de acao */}
                            <td className={`px-3 py-2.5 text-[10px] leading-tight ${
                              hasPlano
                                ? 'text-amber-600 dark:text-amber-400 font-medium'
                                : isLight ? 'text-slate-400/40' : 'text-slate-600'
                            }`}>
                              {r.plano_acao || <span className="italic">---</span>}
                            </td>
                          </tr>
                        )
                      })}

                      {/* ── Section subtotal ─────────────────────── */}
                      <tr className={
                        isLight
                          ? 'bg-indigo-50/60 border-b-2 border-indigo-200/60'
                          : 'bg-indigo-950/20 border-b-2 border-indigo-500/20'
                      }>
                        <td className={`px-5 py-2 text-xs font-bold ${
                          isLight ? 'text-indigo-700' : 'text-indigo-400'
                        }`}>
                          Subtotal
                        </td>
                        <td />
                        <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${
                          isLight ? 'text-indigo-700' : 'text-indigo-400'
                        }`}>
                          {fmtBRL(st.orcado)}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${
                          isLight ? 'text-indigo-700' : 'text-indigo-400'
                        }`}>
                          {fmtBRL(st.realizado)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-bold">
                          <span className={st.variacao >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                            {fmtVariacao(st.variacao)}
                          </span>
                        </td>
                        <td />
                        <td />
                      </tr>
                    </Fragment>
                  )
                })}

                {/* ── Grand Total ──────────────────────────────── */}
                <tr className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900">
                  <td className="px-5 py-3.5 text-xs font-extrabold text-white uppercase tracking-wide">
                    Total Geral
                  </td>
                  <td />
                  <td className="px-3 py-3.5 text-right font-mono text-xs font-extrabold text-indigo-300">
                    {fmtBRL(grandTotal.orcado)}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-xs font-extrabold text-white">
                    {fmtBRL(grandTotal.realizado)}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-xs font-extrabold">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs ${
                      grandTotal.variacao >= 0
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {grandTotal.variacao >= 0 ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                      {fmtVariacao(grandTotal.variacao)}
                    </span>
                  </td>
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Legend ──────────────────────────────────────────── */}
      <div className={`flex flex-wrap items-center gap-5 px-4 py-3 rounded-xl text-[10px] ${
        isLight ? 'bg-slate-50 text-slate-500' : 'bg-white/[0.02] text-slate-500'
      }`}>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          Favoravel (abaixo do orcado)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          Desfavoravel (acima do orcado)
        </span>
        <span className="flex items-center gap-1.5">
          <Star size={10} className="fill-amber-400 text-amber-400" />
          Plano de Acao ativo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
          Subtotais de secao
        </span>
      </div>
    </div>
  )
}

// ── KPI Strip Item ─────────────────────────────────────────────────────────────

function KPIStrip({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: 'emerald' | 'red' | 'amber' | 'indigo'
}) {
  const colorMap = {
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
    indigo: 'text-indigo-400',
  }

  return (
    <div className="flex items-center gap-2.5 px-5 py-3 border-r border-white/[0.06] last:border-r-0">
      <div className={`${colorMap[color]}`}>{icon}</div>
      <div>
        <div className={`text-sm font-extrabold ${colorMap[color]}`}>{value}</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  )
}
