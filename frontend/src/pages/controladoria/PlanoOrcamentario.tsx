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

  // ── Year options ─────────────────────────────────────────────────
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  // ── Render ─────────────────────────────────────────────────────────────────

  const cellCls = `px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap`
  const headerCellCls = `px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider`

  return (
    <div className="space-y-5">

      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Plano Orcamentario
          </h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Visao executiva de custos e despesas por trimestre
          </p>
        </div>
        <div className="relative">
          <select
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
            className={`appearance-none pl-4 pr-9 py-2 rounded-xl text-sm font-semibold border cursor-pointer transition-all ${
              isLight
                ? 'bg-white border-slate-200 text-slate-700 hover:border-orange-300 shadow-sm'
                : 'bg-white/[0.06] border-white/[0.1] text-white hover:border-orange-500/50'
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
      <div className={`rounded-2xl overflow-hidden border ${
        isLight ? 'border-slate-200 shadow-sm' : 'border-white/[0.06]'
      }`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">

              {/* ── Orange gradient header ─────────────────────── */}
              <thead>
                <tr>
                  <th colSpan={6} className="px-5 py-3.5 text-left bg-gradient-to-r from-orange-500 to-amber-500">
                    <span className="text-white font-extrabold text-sm tracking-wide uppercase">
                      Custos e Despesas &mdash; {ano}
                    </span>
                  </th>
                </tr>

                {/* ── Column headers ───────────────────────────── */}
                <tr className="bg-slate-900 text-white">
                  <th className={`${headerCellCls} text-left min-w-[260px]`}>Centro de Custo</th>
                  <th className={headerCellCls}>1o Tri</th>
                  <th className={headerCellCls}>2o Tri</th>
                  <th className={headerCellCls}>3o Tri</th>
                  <th className={headerCellCls}>4o Tri</th>
                  <th className={headerCellCls}>Total Ano</th>
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
                        <td colSpan={6} className={`px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider ${
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
                            className={`border-b transition-colors ${
                              isLight
                                ? `${isEven ? 'bg-white' : 'bg-slate-50/50'} border-slate-100 hover:bg-orange-50/40`
                                : `${isEven ? 'bg-transparent' : 'bg-white/[0.01]'} border-white/[0.04] hover:bg-white/[0.03]`
                            }`}
                          >
                            <td className={`px-5 py-2.5 text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                              <span className="text-orange-400 mr-2">&bull;</span>
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
                          ? 'bg-orange-50/60 border-b-2 border-orange-200/60'
                          : 'bg-orange-950/20 border-b-2 border-orange-500/20'
                      }>
                        <td className={`px-5 py-2 text-xs font-bold ${
                          isLight ? 'text-orange-700' : 'text-orange-400'
                        }`}>
                          Subtotal
                        </td>
                        <td className={`${cellCls} font-bold ${isLight ? 'text-orange-700' : 'text-orange-400'}`}>
                          {fmtM(st.tri1)}
                        </td>
                        <td className={`${cellCls} font-bold ${isLight ? 'text-orange-700' : 'text-orange-400'}`}>
                          {fmtM(st.tri2)}
                        </td>
                        <td className={`${cellCls} font-bold ${isLight ? 'text-orange-700' : 'text-orange-400'}`}>
                          {fmtM(st.tri3)}
                        </td>
                        <td className={`${cellCls} font-bold ${isLight ? 'text-orange-700' : 'text-orange-400'}`}>
                          {fmtM(st.tri4)}
                        </td>
                        <td className={`${cellCls} font-bold ${isLight ? 'text-orange-800' : 'text-orange-300'}`}>
                          {fmtM(st.total)}
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}

                {/* ── Grand Total ──────────────────────────────── */}
                <tr className="bg-gradient-to-r from-slate-900 to-slate-800">
                  <td className="px-5 py-3.5 text-xs font-extrabold text-white uppercase tracking-wide">
                    Total Custos + Impostos
                  </td>
                  <td className={`${cellCls} font-extrabold text-orange-400`}>
                    {fmtM(grandTotal.tri1)}
                  </td>
                  <td className={`${cellCls} font-extrabold text-orange-400`}>
                    {fmtM(grandTotal.tri2)}
                  </td>
                  <td className={`${cellCls} font-extrabold text-orange-400`}>
                    {fmtM(grandTotal.tri3)}
                  </td>
                  <td className={`${cellCls} font-extrabold text-orange-400`}>
                    {fmtM(grandTotal.tri4)}
                  </td>
                  <td className={`${cellCls} font-extrabold text-white text-sm`}>
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
      valueCls: 'text-emerald-600',
    },
    red: {
      iconBg: isLight ? 'bg-red-50' : 'bg-red-500/10',
      iconText: 'text-red-500',
      valueCls: 'text-red-500',
    },
    amber: {
      iconBg: isLight ? 'bg-amber-50' : 'bg-amber-500/10',
      iconText: 'text-amber-500',
      valueCls: 'text-amber-600',
    },
    orange: {
      iconBg: isLight ? 'bg-orange-50' : 'bg-orange-500/10',
      iconText: 'text-orange-500',
      valueCls: 'text-orange-600',
    },
  }

  const c = colorMap[color] ?? colorMap.emerald

  return (
    <div className={`rounded-2xl border p-4 transition-all hover:scale-[1.01] ${
      isLight
        ? 'bg-white border-slate-200 shadow-sm hover:shadow-md'
        : 'bg-white/[0.03] border-white/[0.06] hover:border-white/[0.1]'
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
