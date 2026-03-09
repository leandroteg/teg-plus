import { useState, useMemo } from 'react'
import { PieChart, Filter, ToggleLeft, ToggleRight } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useDRE, useDREConsolidado } from '../../hooks/useControladoria'
import { useLookupObras } from '../../hooks/useLookups'

// ── Helpers ───────────────────────────────────────────────────────────────────
const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const pct = (v: number) => v.toFixed(1) + '%'

const MES_LABEL: Record<number, string> = {
  1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DRE() {
  const { isLightSidebar: isLight } = useTheme()
  const obras = useLookupObras()

  const [filterObra, setFilterObra] = useState('')
  const [filterAno, setFilterAno] = useState<number | ''>('')
  const [consolidado, setConsolidado] = useState(false)

  const { data: dreData = [], isLoading } = useDRE({
    obra_id: filterObra || undefined,
    ano: filterAno || undefined,
  })

  const { data: dreConsolidado = [], isLoading: loadingConsolidado } = useDREConsolidado()

  // Extract unique years for filter
  const anos = useMemo(() => {
    const set = new Set(dreData.map(d => d.ano))
    return [...set].sort((a, b) => b - a)
  }, [dreData])

  const isLoadingAny = consolidado ? loadingConsolidado : isLoading

  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            DRE — Demonstrativo de Resultado
          </h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Receitas, custos e margens por obra e periodo
          </p>
        </div>
        <button
          onClick={() => setConsolidado(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            consolidado
              ? 'bg-teal-600 text-white shadow-sm'
              : isLight
                ? 'bg-white text-slate-500 border border-slate-200'
                : 'bg-white/[0.06] text-slate-400 border border-white/[0.08]'
          }`}
        >
          {consolidado ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          Consolidado
        </button>
      </div>

      {/* ── Filters (only for non-consolidated) ───────────────── */}
      {!consolidado && (
        <div className={`flex flex-wrap items-center gap-3 p-3 rounded-2xl border ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <Filter size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />

          <select
            value={filterObra}
            onChange={e => setFilterObra(e.target.value)}
            className={`px-3 py-1.5 rounded-lg text-xs border ${
              isLight
                ? 'bg-white border-slate-200 text-slate-700'
                : 'bg-white/[0.04] border-white/[0.08] text-white'
            }`}
          >
            <option value="">Todas as Obras</option>
            {obras.map(o => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>

          <select
            value={filterAno}
            onChange={e => setFilterAno(e.target.value ? Number(e.target.value) : '')}
            className={`px-3 py-1.5 rounded-lg text-xs border ${
              isLight
                ? 'bg-white border-slate-200 text-slate-700'
                : 'bg-white/[0.04] border-white/[0.08] text-white'
            }`}
          >
            <option value="">Todos os Anos</option>
            {anos.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <span className={`ml-auto text-xs font-semibold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            {dreData.length} registro{dreData.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        {isLoadingAny ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : consolidado ? (
          <ConsolidadoTable data={dreConsolidado} isLight={isLight} />
        ) : (
          <DetailTable data={dreData} isLight={isLight} />
        )}
      </div>
    </div>
  )
}

// ── Detail Table ──────────────────────────────────────────────────────────────
function DetailTable({ data, isLight }: { data: import('../../types/controladoria').CtrlDRE[]; isLight: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className={`${isLight ? 'bg-slate-50 text-slate-600' : 'bg-white/[0.02] text-slate-400'} text-xs font-semibold uppercase tracking-wider`}>
            <th className="px-4 py-3">Obra</th>
            <th className="px-4 py-3 text-center">Periodo</th>
            <th className="px-4 py-3 text-right">Rec. Medida</th>
            <th className="px-4 py-3 text-right">Rec. Faturada</th>
            <th className="px-4 py-3 text-right">Custo Total</th>
            <th className="px-4 py-3 text-right">Margem Bruta</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={6} className={`text-center py-12 text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                <PieChart size={32} className="mx-auto mb-2 opacity-30" />
                Nenhum registro de DRE encontrado
              </td>
            </tr>
          ) : (
            data.map(d => (
              <tr
                key={d.id}
                className={`border-b ${isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'}`}
              >
                <td className={`px-4 py-3 text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-white'}`}>
                  {d.obra?.nome ?? '—'}
                </td>
                <td className={`px-4 py-3 text-sm text-center font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  {MES_LABEL[d.mes] ?? d.mes}/{d.ano}
                </td>
                <td className={`px-4 py-3 text-sm text-right font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  {BRL(d.receita_medida)}
                </td>
                <td className={`px-4 py-3 text-sm text-right font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  {BRL(d.receita_faturada)}
                </td>
                <td className={`px-4 py-3 text-sm text-right font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  {BRL(d.custo_total)}
                </td>
                <td className={`px-4 py-3 text-sm text-right font-semibold ${
                  d.margem_bruta >= 0 ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {pct(d.margem_bruta)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Consolidated Table ────────────────────────────────────────────────────────
function ConsolidadoTable({ data, isLight }: { data: Record<string, unknown>[]; isLight: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className={`${isLight ? 'bg-slate-50 text-slate-600' : 'bg-white/[0.02] text-slate-400'} text-xs font-semibold uppercase tracking-wider`}>
            {data.length > 0 && Object.keys(data[0]).map(key => (
              <th key={key} className="px-4 py-3">
                {key.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={6} className={`text-center py-12 text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                <PieChart size={32} className="mx-auto mb-2 opacity-30" />
                Nenhum dado consolidado disponivel
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={i}
                className={`border-b ${isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'}`}
              >
                {Object.entries(row).map(([key, val]) => {
                  const numVal = Number(val)
                  const isNum = typeof val === 'number' || (!isNaN(numVal) && val !== null && val !== '')
                  const isMargem = key.toLowerCase().includes('margem')
                  return (
                    <td
                      key={key}
                      className={`px-4 py-3 text-sm ${
                        isNum ? 'text-right font-mono' : ''
                      } ${
                        isMargem && isNum
                          ? numVal >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'
                          : isLight ? 'text-slate-600' : 'text-slate-300'
                      }`}
                    >
                      {isMargem && isNum
                        ? pct(numVal)
                        : isNum && Math.abs(numVal) > 100
                          ? BRL(numVal)
                          : String(val ?? '—')}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
