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
    <div className="space-y-6 p-4 md:p-6">

      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Target size={20} className="text-violet-500" />
            Orcado vs. Realizado
          </h1>
          <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Painel Executivo de Acompanhamento Orcamentario &middot; {mesLabel} / {ano}
          </p>
          <p className={`text-[10px] mt-1.5 flex items-center gap-1.5 ${isLight ? 'text-amber-600' : 'text-amber-400/80'}`}>
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
              className={`appearance-none pl-3 pr-8 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-700 hover:border-violet-300 shadow-sm'
                  : 'bg-slate-700 border-slate-600 text-white hover:border-violet-500/50'
              }`}
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <ChevronDown size={12} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
              isLight ? 'text-slate-400' : 'text-slate-500'
            }`} />
          </div>
          <div className="relative">
            <select
              value={ano}
              onChange={e => setAno(Number(e.target.value))}
              className={`appearance-none pl-3 pr-8 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-700 hover:border-violet-300 shadow-sm'
                  : 'bg-slate-700 border-slate-600 text-white hover:border-violet-500/50'
              }`}
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown size={12} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
              isLight ? 'text-slate-400' : 'text-slate-500'
            }`} />
          </div>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          isLight={isLight}
          icon={<Target size={14} />}
          label="Desvio Total"
          value={`${kpis.desvioTotal >= 0 ? '+' : ''}${kpis.desvioTotal.toFixed(1)}%`}
          color={Math.abs(kpis.desvioTotal) <= 5 ? 'emerald' : 'red'}
        />
        <KPICard
          isLight={isLight}
          icon={<TrendingDown size={14} />}
          label="Favoraveis"
          value={`${kpis.favoravelCount} contas`}
          color="emerald"
        />
        <KPICard
          isLight={isLight}
          icon={<TrendingUp size={14} />}
          label="Desfavoraveis"
          value={`${kpis.desfavoravelCount} contas`}
          color="red"
        />
        <KPICard
          isLight={isLight}
          icon={<Star size={14} className="fill-amber-400 text-amber-400" />}
          label="Planos de Acao"
          value={`${kpis.planoAcaoCount} ativos`}
          color="amber"
        />
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className={`rounded-2xl overflow-hidden border shadow-sm ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-800/60 border-slate-700'
      }`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">

              {/* ── Column headers ───────────────────────────── */}
              <thead>
                <tr>
                  <th colSpan={7} className={`px-5 py-3 text-left ${
                    isLight
                      ? 'bg-gradient-to-r from-violet-600 to-purple-500'
                      : 'bg-gradient-to-r from-violet-700 to-purple-600'
                  }`}>
                    <span className="text-white font-bold text-xs tracking-wide uppercase">
                      Controle Orcamentario &mdash; {mesLabel} / {ano}
                    </span>
                  </th>
                </tr>
                <tr className={isLight ? 'bg-slate-50' : 'bg-slate-700/50'}>
                  <th className={`px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider min-w-[200px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Conta / Descricao
                  </th>
                  <th className={`px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider min-w-[180px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Premissa do Orcamento
                  </th>
                  <th className={`px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Orcado {mes}/{ano}
                  </th>
                  <th className={`px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Realizado {mes}/{ano}
                  </th>
                  <th className={`px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider min-w-[110px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Variacao (R$)
                  </th>
                  <th className={`px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider min-w-[180px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Desvio / Variacao
                  </th>
                  <th className={`px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider min-w-[180px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    <span className="flex items-center gap-1">
                      <Star size={10} className="fill-amber-400 text-amber-400" />
                      Plano de Acao
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-700'}`}>
                {SECTIONS.map((section, si) => {
                  const st = sectionTotal(section.items)
                  return (
                    <Fragment key={si}>
                      {/* ── Section header ───────────────────────── */}
                      <tr className={isLight
                        ? 'bg-slate-100 border-b border-slate-200'
                        : 'bg-white/[0.04] border-b border-white/[0.06]'
                      }>
                        <td colSpan={7} className={`px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider ${
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
                            className={`transition-colors ${
                              isLight
                                ? `${isEven ? 'bg-white' : 'bg-slate-50/50'} ${goldHighlightLight} hover:bg-violet-50/40`
                                : `${isEven ? 'bg-transparent' : 'bg-white/[0.01]'} ${goldHighlightDark} hover:bg-slate-700/30`
                            }`}
                          >
                            {/* Conta */}
                            <td className={`px-4 py-2.5 text-xs ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                              <span className="flex items-center gap-1.5">
                                {hasPlano && (
                                  <Star size={11} className="fill-amber-400 text-amber-400 flex-shrink-0" />
                                )}
                                <span className={`${isLight ? 'text-violet-500' : 'text-violet-400'} mr-1`}>&bull;</span>
                                {item}
                              </span>
                            </td>

                            {/* Premissa */}
                            <td className={`px-3 py-2.5 text-[10px] leading-tight ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                              {r.premissa || <span className={`italic ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>---</span>}
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
                                  ? (isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400')
                                  : isDesfavoravel
                                    ? (isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/15 text-red-400')
                                    : isLight ? 'text-slate-400' : 'text-slate-500'
                              }`}>
                                {isFavoravel && <TrendingDown size={10} />}
                                {isDesfavoravel && <TrendingUp size={10} />}
                                {fmtVariacao(r.variacao)}
                              </span>
                            </td>

                            {/* Desvio explicacao */}
                            <td className={`px-3 py-2.5 text-[10px] leading-tight ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                              {r.desvio_explicacao || <span className={`italic ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>---</span>}
                            </td>

                            {/* Plano de acao */}
                            <td className={`px-3 py-2.5 text-[10px] leading-tight ${
                              hasPlano
                                ? (isLight ? 'text-amber-600 font-medium' : 'text-amber-400 font-medium')
                                : isLight ? 'text-slate-300' : 'text-slate-600'
                            }`}>
                              {r.plano_acao || <span className="italic">---</span>}
                            </td>
                          </tr>
                        )
                      })}

                      {/* ── Section subtotal ─────────────────────── */}
                      <tr className={
                        isLight
                          ? 'bg-violet-50/60 border-b-2 border-violet-200/60'
                          : 'bg-violet-950/20 border-b-2 border-violet-500/20'
                      }>
                        <td className={`px-5 py-2 text-xs font-bold ${
                          isLight ? 'text-violet-700' : 'text-violet-400'
                        }`}>
                          Subtotal
                        </td>
                        <td />
                        <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${
                          isLight ? 'text-violet-700' : 'text-violet-400'
                        }`}>
                          {fmtBRL(st.orcado)}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${
                          isLight ? 'text-violet-700' : 'text-violet-400'
                        }`}>
                          {fmtBRL(st.realizado)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-bold">
                          <span className={st.variacao >= 0
                            ? (isLight ? 'text-emerald-600' : 'text-emerald-400')
                            : (isLight ? 'text-red-600' : 'text-red-400')
                          }>
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
                <tr className={
                  isLight
                    ? 'bg-gradient-to-r from-violet-600 to-purple-500'
                    : 'bg-gradient-to-r from-violet-700 to-purple-600'
                }>
                  <td className="px-5 py-3.5 text-xs font-bold text-white uppercase tracking-wide">
                    Total Geral
                  </td>
                  <td />
                  <td className="px-3 py-3.5 text-right font-mono text-xs font-bold text-violet-200">
                    {fmtBRL(grandTotal.orcado)}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-xs font-bold text-white">
                    {fmtBRL(grandTotal.realizado)}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-xs font-bold">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs ${
                      grandTotal.variacao >= 0
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-red-500/20 text-red-300'
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
        isLight ? 'bg-slate-50 text-slate-500' : 'bg-slate-800/60 text-slate-500'
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
          <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
          Subtotais de secao
        </span>
      </div>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  isLight,
  icon,
  label,
  value,
  color,
}: {
  isLight: boolean
  icon: React.ReactNode
  label: string
  value: string
  color: 'emerald' | 'red' | 'amber' | 'violet'
}) {
  const colorMap = {
    emerald: {
      iconBg: isLight ? 'bg-emerald-50' : 'bg-emerald-500/10',
      iconText: 'text-emerald-500',
      valueCls: isLight ? 'text-emerald-600' : 'text-emerald-400',
    },
    red: {
      iconBg: isLight ? 'bg-red-50' : 'bg-red-500/10',
      iconText: 'text-red-500',
      valueCls: isLight ? 'text-red-600' : 'text-red-400',
    },
    amber: {
      iconBg: isLight ? 'bg-amber-50' : 'bg-amber-500/10',
      iconText: 'text-amber-500',
      valueCls: isLight ? 'text-amber-600' : 'text-amber-400',
    },
    violet: {
      iconBg: isLight ? 'bg-violet-50' : 'bg-violet-500/10',
      iconText: 'text-violet-500',
      valueCls: isLight ? 'text-violet-600' : 'text-violet-400',
    },
  }

  const c = colorMap[color] ?? colorMap.emerald

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      isLight
        ? 'bg-white border-slate-200 shadow-sm'
        : 'bg-slate-800/60 border-slate-700'
    }`}>
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${c.iconBg} ${c.iconText}`}>
          {icon}
        </div>
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${
          isLight ? 'text-slate-400' : 'text-slate-500'
        }`}>
          {label}
        </span>
      </div>
      <div className={`text-lg font-extrabold ${c.valueCls}`}>{value}</div>
    </div>
  )
}
