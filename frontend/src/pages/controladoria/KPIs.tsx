import { useState, useMemo } from 'react'
import { TrendingUp, Filter, BarChart3, Activity } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useKPIs } from '../../hooks/useControladoria'
import { useLookupObras } from '../../hooks/useLookups'
import type { CtrlKPISnapshot, TipoKPISnapshot } from '../../types/controladoria'

// ── Helpers ───────────────────────────────────────────────────────────────────
const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const pct = (v: number) => v.toFixed(1) + '%'

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

function indicatorColor(value: number | undefined | null): string {
  if (value == null) return 'text-slate-400'
  if (value >= 1.0) return 'text-emerald-500'
  if (value >= 0.8) return 'text-amber-500'
  return 'text-red-500'
}

function indicatorBg(value: number | undefined | null, isLight: boolean): string {
  if (value == null) return isLight ? 'bg-slate-50' : 'bg-white/[0.02]'
  if (value >= 1.0) return isLight ? 'bg-emerald-50' : 'bg-emerald-500/10'
  if (value >= 0.8) return isLight ? 'bg-amber-50' : 'bg-amber-500/10'
  return isLight ? 'bg-red-50' : 'bg-red-500/10'
}

const TIPO_LABEL: Record<TipoKPISnapshot, string> = {
  semanal: 'Semanal',
  mensal: 'Mensal',
  trimestral: 'Trimestral',
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function KPIs() {
  const { isLightSidebar: isLight } = useTheme()
  const obras = useLookupObras()

  const [filterObra, setFilterObra] = useState('')
  const [filterTipo, setFilterTipo] = useState('')

  const { data: kpis = [], isLoading } = useKPIs({
    obra_id: filterObra || undefined,
    tipo: filterTipo || undefined,
  })

  // Get latest KPI snapshot per obra
  const latestByObra = useMemo(() => {
    const map = new Map<string, CtrlKPISnapshot>()
    for (const k of kpis) {
      const obraKey = k.obra_id ?? '__global__'
      if (!map.has(obraKey)) {
        map.set(obraKey, k) // already sorted desc by data_snapshot
      }
    }
    return [...map.values()]
  }, [kpis])

  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            KPIs de Performance
          </h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Indicadores de custo e prazo por obra (IDC / IDP)
          </p>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/[0.06] text-slate-400'
        }`}>
          {kpis.length} snapshot{kpis.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Filters ───────────────────────────────────────────── */}
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
          value={filterTipo}
          onChange={e => setFilterTipo(e.target.value)}
          className={`px-3 py-1.5 rounded-lg text-xs border ${
            isLight
              ? 'bg-white border-slate-200 text-slate-700'
              : 'bg-white/[0.04] border-white/[0.08] text-white'
          }`}
        >
          <option value="">Todos os Tipos</option>
          <option value="semanal">Semanal</option>
          <option value="mensal">Mensal</option>
          <option value="trimestral">Trimestral</option>
        </select>
      </div>

      {/* ── Cards Grid (latest per obra) ──────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`rounded-2xl h-48 animate-pulse ${
              isLight ? 'bg-slate-100' : 'bg-white/[0.04]'
            }`} />
          ))}
        </div>
      ) : latestByObra.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <Activity size={40} className={`mx-auto mb-3 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
          <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Nenhum snapshot de KPI disponivel
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {latestByObra.map(k => {
            const obraName = obras.find(o => o.id === k.obra_id)?.nome ?? 'Global'
            return (
              <KPICard key={k.id} kpi={k} obraName={obraName} isLight={isLight} />
            )
          })}
        </div>
      )}

      {/* ── Chart Placeholder ─────────────────────────────────── */}
      <div className={`rounded-2xl border p-6 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <h2 className={`text-sm font-extrabold flex items-center gap-2 mb-4 ${
          isLight ? 'text-slate-800' : 'text-white'
        }`}>
          <BarChart3 size={15} className="text-violet-500" />
          Faturamento vs Producao
        </h2>
        <div className={`flex items-center justify-center py-12 rounded-xl border-2 border-dashed ${
          isLight ? 'border-slate-200 bg-slate-50' : 'border-white/[0.06] bg-white/[0.01]'
        }`}>
          <div className="text-center">
            <BarChart3 size={48} className={`mx-auto mb-3 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
            <p className={`text-sm font-semibold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              Grafico em desenvolvimento
            </p>
            <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>
              Sera implementado com Recharts ou similar
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ kpi, obraName, isLight }: {
  kpi: CtrlKPISnapshot
  obraName: string
  isLight: boolean
}) {
  return (
    <div className={`rounded-2xl border p-4 ${
      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className={`text-sm font-bold ${isLight ? 'text-slate-700' : 'text-white'}`}>
            {obraName}
          </p>
          <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            {fmtDate(kpi.data_snapshot)} - {TIPO_LABEL[kpi.tipo] ?? kpi.tipo}
          </p>
        </div>
        <TrendingUp size={16} className={`${indicatorColor(kpi.idc)}`} />
      </div>

      {/* IDC / IDP */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className={`rounded-xl p-3 text-center ${indicatorBg(kpi.idc, isLight)}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          }`}>IDC</p>
          <p className={`text-xl font-black ${indicatorColor(kpi.idc)}`}>
            {kpi.idc != null ? kpi.idc.toFixed(2) : '—'}
          </p>
        </div>
        <div className={`rounded-xl p-3 text-center ${indicatorBg(kpi.idp, isLight)}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          }`}>IDP</p>
          <p className={`text-xl font-black ${indicatorColor(kpi.idp)}`}>
            {kpi.idp != null ? kpi.idp.toFixed(2) : '—'}
          </p>
        </div>
      </div>

      {/* Extra metrics */}
      <div className="space-y-1.5">
        {kpi.eac != null && (
          <MetricRow label="EAC" value={BRL(kpi.eac)} isLight={isLight} />
        )}
        {kpi.margem_real != null && (
          <MetricRow
            label="Margem Real"
            value={pct(kpi.margem_real)}
            isLight={isLight}
            colorClass={kpi.margem_real >= 0 ? 'text-emerald-500' : 'text-red-500'}
          />
        )}
        {kpi.faturamento_mes != null && (
          <MetricRow label="Faturamento" value={BRL(kpi.faturamento_mes)} isLight={isLight} />
        )}
        {kpi.producao_mes != null && (
          <MetricRow label="Producao" value={BRL(kpi.producao_mes)} isLight={isLight} />
        )}
      </div>
    </div>
  )
}

function MetricRow({ label, value, isLight, colorClass }: {
  label: string
  value: string
  isLight: boolean
  colorClass?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>{label}</span>
      <span className={`text-xs font-semibold ${colorClass ?? (isLight ? 'text-slate-700' : 'text-slate-300')}`}>
        {value}
      </span>
    </div>
  )
}
