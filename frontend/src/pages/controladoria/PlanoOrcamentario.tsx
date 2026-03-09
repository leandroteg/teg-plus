import { useState, useMemo, Fragment } from 'react'
import { ChevronDown, TrendingUp, DollarSign, Target, Wallet } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { usePlanoOrcamentario } from '../../hooks/useControladoria'
import type { PlanoOrcamentarioRow } from '../../hooks/useControladoria'

// ── Cost Center Structure ────────────────────────────────────────────────────

interface Section {
  title: string
  items: string[]
}

const SECTIONS: Section[] = [
  {
    title: 'CUSTOS DIRETOS E IND. OBRAS',
    items: [
      'Materiais (Aço, Concreto, EPIs)',
      'Mão de Obra Direta',
      'Alojamentos e Alimentação',
      'Frotas',
      'Serviços Terc. + Outros C. Diretos',
      'Equipamentos e EPIs',
    ],
  },
  {
    title: 'DESPESAS ADMINISTRATIVAS',
    items: [
      'Pessoal',
      'Administrativo',
      'Serviços Administrativos',
      'Sistemas',
      'Desp Fin. e Outra Desp Adm',
    ],
  },
  {
    title: 'DESPESAS APÓS O LUCRO',
    items: [
      'Amortizações',
      'Impostos (PIS/COFINS/IRPJ/CSLL)',
    ],
  },
]

const ALL_ITEMS = SECTIONS.flatMap(s => s.items)

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtM = (v: number): string => {
  if (v === 0) return '—'
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M'
  if (abs >= 1_000) return (v / 1_000).toFixed(0) + 'K'
  return v.toFixed(0)
}

const fmtBRL = (v: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

const currentYear = new Date().getFullYear()

// ── Component ────────────────────────────────────────────────────────────────

export default function PlanoOrcamentario() {
  const { isLightSidebar: isLight } = useTheme()
  const [ano, setAno] = useState(currentYear)
  const { data: rows = [], isLoading } = usePlanoOrcamentario(ano)

  // Build lookup map
  const dataMap = useMemo(() => {
    const m = new Map<string, PlanoOrcamentarioRow>()
    for (const r of rows) m.set(r.categoria, r)
    return m
  }, [rows])

  // Get row for a cost center (return zeros if no data)
  const getRow = (cat: string): PlanoOrcamentarioRow =>
    dataMap.get(cat) ?? {
      categoria: cat,
      tri1_planejado: 0, tri1_realizado: 0,
      tri2_planejado: 0, tri2_realizado: 0,
      tri3_planejado: 0, tri3_realizado: 0,
      tri4_planejado: 0, tri4_realizado: 0,
      total_planejado: 0, total_realizado: 0,
    }

  // Grand totals
  const grandTotal = useMemo(() => {
    const t = {
      tri1: 0, tri2: 0, tri3: 0, tri4: 0, total: 0,
      tri1r: 0, tri2r: 0, tri3r: 0, tri4r: 0, totalr: 0,
    }
    for (const cat of ALL_ITEMS) {
      const r = getRow(cat)
      t.tri1 += r.tri1_planejado; t.tri1r += r.tri1_realizado
      t.tri2 += r.tri2_planejado; t.tri2r += r.tri2_realizado
      t.tri3 += r.tri3_planejado; t.tri3r += r.tri3_realizado
      t.tri4 += r.tri4_planejado; t.tri4r += r.tri4_realizado
      t.total += r.total_planejado; t.totalr += r.total_realizado
    }
    return t
  }, [dataMap])

  // Section subtotals
  const sectionTotal = (items: string[]) => {
    const t = { tri1: 0, tri2: 0, tri3: 0, tri4: 0, total: 0 }
    for (const cat of items) {
      const r = getRow(cat)
      t.tri1 += r.tri1_planejado
      t.tri2 += r.tri2_planejado
      t.tri3 += r.tri3_planejado
      t.tri4 += r.tri4_planejado
      t.total += r.total_planejado
    }
    return t
  }

  // KPI cards data
  const kpis = useMemo(() => {
    const fat = grandTotal.totalr
    const meta = grandTotal.total
    const desvio = meta > 0 ? ((fat - meta) / meta) * 100 : 0
    const margem = fat > 0 ? ((fat - grandTotal.totalr) / fat) * 100 : 0
    return { fat, meta, desvio, margem }
  }, [grandTotal])

  // ── Year options ─────────────────────────────────────────────
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  // ── Render ─────────────────────────────────────────────────────────────────

  const cellCls = `px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap`
  const headerCellCls = `px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider`

  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Target size={20} className="text-violet-500" />
            Plano Orcamentario
          </h1>
          <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Visao executiva de custos e despesas por trimestre
          </p>
        </div>
        <div className="relative">
          <select
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
            className={`appearance-none pl-4 pr-9 py-2 rounded-xl text-sm font-semibold border cursor-pointer transition-all ${
              isLight
                ? 'bg-white border-slate-200 text-slate-700 hover:border-violet-300 shadow-sm'
                : 'bg-white/[0.06] border-white/[0.1] text-white hover:border-violet-500/50'
            }`}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
            isLight ? 'text-slate-400' : 'text-slate-500'
          }`} />
        </div>
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

              {/* ── Violet gradient header ─────────────────────── */}
              <thead>
                <tr>
                  <th colSpan={6} className={`px-5 py-3 text-left ${
                    isLight
                      ? 'bg-gradient-to-r from-violet-600 to-purple-500'
                      : 'bg-gradient-to-r from-violet-700 to-purple-600'
                  }`}>
                    <span className="text-white font-bold text-sm tracking-wide uppercase">
                      Custos e Despesas &mdash; {ano}
                    </span>
                  </th>
                </tr>

                {/* ── Column headers ───────────────────────────── */}
                <tr className={isLight ? 'bg-slate-50' : 'bg-slate-700/50'}>
                  <th className={`${headerCellCls} text-left min-w-[260px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Centro de Custo</th>
                  <th className={`${headerCellCls} ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>1o Tri</th>
                  <th className={`${headerCellCls} ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>2o Tri</th>
                  <th className={`${headerCellCls} ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>3o Tri</th>
                  <th className={`${headerCellCls} ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>4o Tri</th>
                  <th className={`${headerCellCls} ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Total Ano</th>
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
                        <td colSpan={6} className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider ${
                          isLight ? 'text-slate-700' : 'text-slate-200'
                        }`}>
                          {section.title}
                        </td>
                      </tr>

                      {/* ── Row items ────────────────────────────── */}
                      {section.items.map((item, ii) => {
                        const r = getRow(item)
                        const isEven = ii % 2 === 0
                        return (
                          <tr
                            key={item}
                            className={`transition-colors ${
                              isLight
                                ? `${isEven ? 'bg-white' : 'bg-slate-50/50'} hover:bg-violet-50/40`
                                : `${isEven ? 'bg-transparent' : 'bg-white/[0.01]'} hover:bg-slate-700/30`
                            }`}
                          >
                            <td className={`px-5 py-2.5 text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                              <span className="text-violet-400 mr-2">&bull;</span>
                              {item}
                            </td>
                            <td className={`${cellCls} ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                              {fmtM(r.tri1_planejado)}
                            </td>
                            <td className={`${cellCls} ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                              {fmtM(r.tri2_planejado)}
                            </td>
                            <td className={`${cellCls} ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                              {fmtM(r.tri3_planejado)}
                            </td>
                            <td className={`${cellCls} ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                              {fmtM(r.tri4_planejado)}
                            </td>
                            <td className={`${cellCls} font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                              {fmtM(r.total_planejado)}
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
                        <td className={`${cellCls} font-bold ${isLight ? 'text-violet-700' : 'text-violet-400'}`}>
                          {fmtM(st.tri1)}
                        </td>
                        <td className={`${cellCls} font-bold ${isLight ? 'text-violet-700' : 'text-violet-400'}`}>
                          {fmtM(st.tri2)}
                        </td>
                        <td className={`${cellCls} font-bold ${isLight ? 'text-violet-700' : 'text-violet-400'}`}>
                          {fmtM(st.tri3)}
                        </td>
                        <td className={`${cellCls} font-bold ${isLight ? 'text-violet-700' : 'text-violet-400'}`}>
                          {fmtM(st.tri4)}
                        </td>
                        <td className={`${cellCls} font-bold ${isLight ? 'text-violet-800' : 'text-violet-300'}`}>
                          {fmtM(st.total)}
                        </td>
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
                    Total Custos + Impostos
                  </td>
                  <td className={`${cellCls} font-bold text-violet-200`}>
                    {fmtM(grandTotal.tri1)}
                  </td>
                  <td className={`${cellCls} font-bold text-violet-200`}>
                    {fmtM(grandTotal.tri2)}
                  </td>
                  <td className={`${cellCls} font-bold text-violet-200`}>
                    {fmtM(grandTotal.tri3)}
                  </td>
                  <td className={`${cellCls} font-bold text-violet-200`}>
                    {fmtM(grandTotal.tri4)}
                  </td>
                  <td className={`${cellCls} font-bold text-white text-sm`}>
                    {fmtM(grandTotal.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Faturamento Real vs Meta */}
        <KPICard
          isLight={isLight}
          icon={<DollarSign size={18} />}
          label="Faturamento Real vs Meta"
          value={fmtBRL(kpis.fat)}
          sub={`Meta: ${fmtBRL(kpis.meta)}`}
          color="emerald"
        />
        {/* Margem Liquida */}
        <KPICard
          isLight={isLight}
          icon={<TrendingUp size={18} />}
          label="Margem Liquida"
          value={`${kpis.margem.toFixed(1)}%`}
          sub={kpis.margem >= 0 ? 'Positiva' : 'Negativa'}
          color={kpis.margem >= 0 ? 'emerald' : 'red'}
        />
        {/* Desvio de Custos */}
        <KPICard
          isLight={isLight}
          icon={<Target size={18} />}
          label="Desvio de Custos"
          value={`${kpis.desvio >= 0 ? '+' : ''}${kpis.desvio.toFixed(1)}%`}
          sub={Math.abs(kpis.desvio) <= 5 ? 'Dentro da faixa' : 'Fora da faixa'}
          color={Math.abs(kpis.desvio) <= 5 ? 'emerald' : 'amber'}
        />
        {/* Fluxo de Caixa */}
        <KPICard
          isLight={isLight}
          icon={<Wallet size={18} />}
          label="Fluxo de Caixa"
          value={fmtBRL(kpis.fat - grandTotal.totalr)}
          sub={kpis.fat - grandTotal.totalr >= 0 ? 'Superavit' : 'Deficit'}
          color={kpis.fat - grandTotal.totalr >= 0 ? 'emerald' : 'red'}
        />
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
  sub,
  color,
}: {
  isLight: boolean
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: string
}) {
  const colorMap: Record<string, { iconBg: string; iconText: string; valueCls: string }> = {
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
    <div className={`rounded-2xl border p-4 transition-all hover:scale-[1.01] ${
      isLight
        ? 'bg-white border-slate-200 shadow-sm hover:shadow-md'
        : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
    }`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.iconBg} ${c.iconText}`}>
          {icon}
        </div>
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${
          isLight ? 'text-slate-400' : 'text-slate-500'
        }`}>
          {label}
        </span>
      </div>
      <div className={`text-xl font-extrabold ${c.valueCls}`}>
        {value}
      </div>
      <div className={`text-[11px] mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
        {sub}
      </div>
    </div>
  )
}
