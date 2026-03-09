import { useState, useMemo } from 'react'
import {
  ChevronDown, TrendingUp, TrendingDown, DollarSign, Users,
  Percent, ArrowUpRight, ArrowDownRight, BarChart3,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useIndicadoresProducao, usePainelResumo } from '../../hooks/useControladoria'
import type { PainelResumo } from '../../hooks/useControladoria'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (v: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(v)

const fmtBRL2 = (v: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)

const fmtPct = (v: number): string => `${v.toFixed(1)}%`

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// ── Fallback Sample Data ─────────────────────────────────────────────────────

interface IndicadorCard {
  num: string
  tipo: string
  categoria: string
  tagColor: string
  label: string
  valorPrincipal: string
  descricao: string
  pctFaturamento: number
  custoTotal: number
  metricaExtra: string
}

const FALLBACK_INDICADORES: IndicadorCard[] = [
  {
    num: '02',
    tipo: 'INSUMO',
    categoria: 'CONCRETO',
    tagColor: 'emerald',
    label: 'Custo / m\u00B3',
    valorPrincipal: 'R$ 85,56',
    descricao: 'Custo unitario por metro cubico de concreto usinado',
    pctFaturamento: 2.3,
    custoTotal: 68_444,
    metricaExtra: '800 m\u00B3 aplicados',
  },
  {
    num: '03',
    tipo: 'INSUMO',
    categoria: 'ACO',
    tagColor: 'emerald',
    label: 'Custo / ton',
    valorPrincipal: 'R$ 193,75',
    descricao: 'Custo por tonelada de aco estrutural CA-50/60',
    pctFaturamento: 0.6,
    custoTotal: 18_600,
    metricaExtra: '~96 ton consumidas',
  },
  {
    num: '04',
    tipo: 'RH',
    categoria: 'OBRA',
    tagColor: 'amber',
    label: 'Desp. Variavel / Colaborador',
    valorPrincipal: 'R$ 1.318',
    descricao: 'Despesas variaveis medias por colaborador CLT em campo',
    pctFaturamento: 12.2,
    custoTotal: 366_400,
    metricaExtra: '278 CLT ativos',
  },
  {
    num: '05',
    tipo: 'FROTA',
    categoria: 'MANUTENCAO',
    tagColor: 'rose',
    label: 'Custo Manut. / Veiculo',
    valorPrincipal: 'R$ 2.730',
    descricao: 'Custo medio de manutencao preventiva e corretiva por veiculo',
    pctFaturamento: 2.3,
    custoTotal: 68_250,
    metricaExtra: '25 veiculos',
  },
  {
    num: '06',
    tipo: 'FROTA',
    categoria: 'COMBUSTIVEL',
    tagColor: 'violet',
    label: 'Custo Combustivel / Producao',
    valorPrincipal: '6,0%',
    descricao: 'Percentual de combustivel sobre a producao mensal',
    pctFaturamento: 6.0,
    custoTotal: 180_000,
    metricaExtra: 'Ticket medio R$ 9.000',
  },
  {
    num: '07',
    tipo: 'ADMINISTRATIVO',
    categoria: 'GERAL',
    tagColor: 'blue',
    label: 'Desp. Adm / Colaborador',
    valorPrincipal: 'R$ 3.047',
    descricao: 'Despesas administrativas por colaborador PJ/terceirizado',
    pctFaturamento: 2.0,
    custoTotal: 60_940,
    metricaExtra: '20 PJ ativos',
  },
]

const FALLBACK_RESUMO: PainelResumo = {
  total_entradas: 2_999_789,
  total_saidas: 1_812_840,
  saldo: 1_186_949,
  pct_saidas_entradas: 60.4,
  margem_operacional: 39.6,
  folha_valor: 790_000,
  folha_qtd_clt: 278,
  folha_pct_faturamento: 26.3,
  folha_custo_medio: 2_842,
  folha_desvio_orcado: 65_000,
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PainelIndicadores() {
  const { isLightSidebar: isLight } = useTheme()
  const [ano, setAno] = useState(currentYear)
  const [mes, setMes] = useState(currentMonth)

  const mesKey = `${ano}-${String(mes).padStart(2, '0')}-01`
  const { data: indicadoresRaw = [], isLoading: loadingInd } = useIndicadoresProducao(mesKey)
  const { data: resumoRaw, isLoading: loadingRes } = usePainelResumo(ano, mes)

  // Use fallback if no data
  const resumo = useMemo<PainelResumo>(() => {
    if (resumoRaw && resumoRaw.total_entradas > 0) return resumoRaw
    return FALLBACK_RESUMO
  }, [resumoRaw])

  const indicadores = useMemo<IndicadorCard[]>(() => {
    if (indicadoresRaw.length > 0) {
      const tagColors: Record<string, string> = {
        INSUMO: 'emerald',
        RH: 'amber',
        FROTA: 'rose',
        ADMINISTRATIVO: 'blue',
      }
      return indicadoresRaw.map((r, i) => ({
        num: String(i + 2).padStart(2, '0'),
        tipo: r.tipo_indicador,
        categoria: r.categoria,
        tagColor: tagColors[r.tipo_indicador] ?? 'slate',
        label: r.label,
        valorPrincipal: r.valor_unitario
          ? fmtBRL(r.valor_unitario)
          : fmtPct(r.pct_faturamento),
        descricao: r.detalhe ?? '',
        pctFaturamento: r.pct_faturamento ?? 0,
        custoTotal: r.custo_total ?? 0,
        metricaExtra: r.volume
          ? `${r.volume} ${r.unidade ?? ''}`
          : '',
      }))
    }
    return FALLBACK_INDICADORES
  }, [indicadoresRaw])

  const isLoading = loadingInd || loadingRes

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  // ── Donut Chart data ───────────────────────────────────────────────
  const donutPctSaidas = resumo.pct_saidas_entradas
  const donutPctSaldo = 100 - donutPctSaidas

  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <BarChart3 size={20} className="text-violet-500" />
            Painel de Indicadores
          </h1>
          <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Dashboard executivo de custos unitarios e indicadores de producao
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Month picker */}
          <div className="relative">
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              className={`appearance-none pl-4 pr-9 py-2 rounded-xl text-sm font-semibold border cursor-pointer transition-all ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-700 hover:border-violet-300 shadow-sm'
                  : 'bg-slate-700 border-slate-600 text-white hover:border-violet-500/50'
              }`}
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <ChevronDown size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
              isLight ? 'text-slate-400' : 'text-slate-500'
            }`} />
          </div>
          {/* Year picker */}
          <div className="relative">
            <select
              value={ano}
              onChange={e => setAno(Number(e.target.value))}
              className={`appearance-none pl-4 pr-9 py-2 rounded-xl text-sm font-semibold border cursor-pointer transition-all ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-700 hover:border-violet-300 shadow-sm'
                  : 'bg-slate-700 border-slate-600 text-white hover:border-violet-500/50'
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
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── TOP 3 SUMMARY CARDS ─────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* CARD 1 — SAIDAS / ENTRADAS + DONUT */}
            <SummaryCard isLight={isLight}>
              <div className="flex items-start gap-5">
                {/* Donut Chart */}
                <div className="relative flex-shrink-0">
                  <svg width="110" height="110" viewBox="0 0 110 110" className="transform -rotate-90">
                    {/* Background ring */}
                    <circle
                      cx="55" cy="55" r="44"
                      fill="none"
                      stroke={isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)'}
                      strokeWidth="12"
                    />
                    {/* Saidas arc (coral/red) */}
                    <circle
                      cx="55" cy="55" r="44"
                      fill="none"
                      stroke="#f87171"
                      strokeWidth="12"
                      strokeDasharray={`${(donutPctSaidas / 100) * 276.46} 276.46`}
                      strokeLinecap="round"
                      className="transition-all duration-700"
                    />
                    {/* Saldo arc (teal) */}
                    <circle
                      cx="55" cy="55" r="44"
                      fill="none"
                      stroke="#2dd4bf"
                      strokeWidth="12"
                      strokeDasharray={`${(donutPctSaldo / 100) * 276.46} 276.46`}
                      strokeDashoffset={`${-(donutPctSaidas / 100) * 276.46}`}
                      strokeLinecap="round"
                      className="transition-all duration-700"
                    />
                  </svg>
                  {/* Center text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      {fmtPct(donutPctSaidas)}
                    </span>
                  </div>
                </div>
                {/* Text */}
                <div className="flex-1 min-w-0 pt-1">
                  <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${
                    isLight ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    Total Saidas / Total Entradas
                  </div>
                  <div className="space-y-1.5">
                    <MetricRow
                      isLight={isLight}
                      dot="#f87171"
                      label="Saidas"
                      value={fmtBRL(resumo.total_saidas)}
                    />
                    <MetricRow
                      isLight={isLight}
                      dot="#2dd4bf"
                      label="Saldo"
                      value={fmtBRL(resumo.saldo)}
                    />
                    <div className={`text-[11px] font-medium pt-1 border-t ${
                      isLight ? 'border-slate-100 text-slate-500' : 'border-slate-700 text-slate-400'
                    }`}>
                      Entradas {fmtBRL(resumo.total_entradas)}
                    </div>
                  </div>
                  <div className={`text-[10px] mt-2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    Relacao saidas sobre entradas
                  </div>
                </div>
              </div>
            </SummaryCard>

            {/* CARD 2 — MAIOR CUSTO: FOLHA DE PAGAMENTO */}
            <SummaryCard isLight={isLight}>
              <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${
                isLight ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Maior Custo &mdash; Folha de Pagamento
              </div>
              <div className={`text-3xl font-black tracking-tight ${isLight ? 'text-slate-800' : 'text-white'}`}>
                {fmtBRL(resumo.folha_valor)}
              </div>
              <div className={`text-xs mt-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Folha realizada &middot; {resumo.folha_qtd_clt} CLT, {fmtPct(resumo.folha_pct_faturamento)} do faturamento
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <SubMetric
                  isLight={isLight}
                  icon={<Users size={13} />}
                  label="Custo medio/colaborador"
                  value={fmtBRL(resumo.folha_custo_medio)}
                />
                <SubMetric
                  isLight={isLight}
                  icon={resumo.folha_desvio_orcado >= 0
                    ? <ArrowUpRight size={13} className="text-red-400" />
                    : <ArrowDownRight size={13} className="text-emerald-400" />
                  }
                  label="Desvio vs orcado"
                  value={`${resumo.folha_desvio_orcado >= 0 ? '+' : ''}${fmtBRL(resumo.folha_desvio_orcado)}`}
                  valueColor={resumo.folha_desvio_orcado > 0 ? 'text-red-400' : 'text-emerald-400'}
                />
              </div>
            </SummaryCard>

            {/* CARD 3 — MARGEM OPERACIONAL ESTIMADA */}
            <SummaryCard isLight={isLight}>
              <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${
                isLight ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Margem Operacional Estimada
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-black tracking-tight ${
                  resumo.margem_operacional >= 40
                    ? 'text-emerald-500'
                    : resumo.margem_operacional >= 30
                    ? (isLight ? 'text-amber-600' : 'text-amber-400')
                    : 'text-red-500'
                }`}>
                  {fmtPct(resumo.margem_operacional)}
                </span>
                {resumo.margem_operacional >= 40
                  ? <TrendingUp size={18} className="text-emerald-500" />
                  : <TrendingDown size={18} className="text-amber-500" />
                }
              </div>
              <div className={`text-xs mt-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Saldo sobre faturamento {fmtBRL2(resumo.saldo)}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <MiniKPI
                  isLight={isLight}
                  label="Meta referencia"
                  value="> 40%"
                  color="emerald"
                />
                <MiniKPI
                  isLight={isLight}
                  label="PIS/COFINS realiz."
                  value={fmtBRL(117_000)}
                  color="amber"
                />
                <MiniKPI
                  isLight={isLight}
                  label="Economia vs orcado"
                  value={`-${fmtBRL(148_000)}`}
                  color="blue"
                />
              </div>
            </SummaryCard>
          </div>

          {/* ── INDICADORES POR UNIDADE DE PRODUCAO ─────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-violet-500" />
              <h2 className={`text-sm font-bold uppercase tracking-wider ${
                isLight ? 'text-slate-700' : 'text-slate-200'
              }`}>
                Indicadores por Unidade de Producao
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {indicadores.map(ind => (
                <IndicadorCardUI key={ind.num} isLight={isLight} {...ind} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Summary Card Container ───────────────────────────────────────────────────

function SummaryCard({ isLight, children }: { isLight: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-5 transition-all ${
      isLight
        ? 'bg-white border-slate-200 shadow-sm hover:shadow-md'
        : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
    }`}>
      {children}
    </div>
  )
}

// ── Metric Row (dot + label + value) ─────────────────────────────────────────

function MetricRow({
  isLight, dot, label, value,
}: { isLight: boolean; dot: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dot }} />
        <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>{label}</span>
      </div>
      <span className={`font-bold font-mono ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{value}</span>
    </div>
  )
}

// ── Sub Metric (icon + label + value) ────────────────────────────────────────

function SubMetric({
  isLight, icon, label, value, valueColor,
}: { isLight: boolean; icon: React.ReactNode; label: string; value: string; valueColor?: string }) {
  return (
    <div className={`rounded-xl p-2.5 ${
      isLight ? 'bg-slate-50' : 'bg-slate-700/30'
    }`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>{icon}</span>
        <span className={`text-[10px] font-medium ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          {label}
        </span>
      </div>
      <div className={`text-sm font-bold font-mono ${
        valueColor ?? (isLight ? 'text-slate-700' : 'text-slate-200')
      }`}>
        {value}
      </div>
    </div>
  )
}

// ── Mini KPI pill ────────────────────────────────────────────────────────────

function MiniKPI({
  isLight, label, value, color,
}: { isLight: boolean; label: string; value: string; color: string }) {
  const bgMap: Record<string, string> = {
    emerald: isLight ? 'bg-emerald-50' : 'bg-emerald-500/10',
    amber: isLight ? 'bg-amber-50' : 'bg-amber-500/10',
    blue: isLight ? 'bg-blue-50' : 'bg-blue-500/10',
    red: isLight ? 'bg-red-50' : 'bg-red-500/10',
  }
  const textMap: Record<string, string> = {
    emerald: isLight ? 'text-emerald-600' : 'text-emerald-400',
    amber: isLight ? 'text-amber-600' : 'text-amber-400',
    blue: isLight ? 'text-blue-600' : 'text-blue-400',
    red: isLight ? 'text-red-600' : 'text-red-400',
  }
  return (
    <div className={`rounded-xl p-2 text-center ${bgMap[color] ?? bgMap.emerald}`}>
      <div className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${
        isLight ? 'text-slate-400' : 'text-slate-500'
      }`}>
        {label}
      </div>
      <div className={`text-xs font-bold font-mono ${textMap[color] ?? textMap.emerald}`}>
        {value}
      </div>
    </div>
  )
}

// ── Indicador Card (production metric) ───────────────────────────────────────

function IndicadorCardUI({
  isLight,
  num,
  tipo,
  categoria,
  tagColor,
  label,
  valorPrincipal,
  descricao,
  pctFaturamento,
  custoTotal,
  metricaExtra,
}: IndicadorCard & { isLight: boolean }) {
  const tagBg: Record<string, string> = {
    emerald: isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-400',
    amber: isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-400',
    rose: isLight ? 'bg-rose-100 text-rose-700' : 'bg-rose-500/20 text-rose-400',
    violet: isLight ? 'bg-violet-100 text-violet-700' : 'bg-violet-500/20 text-violet-400',
    blue: isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400',
    slate: isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-500/20 text-slate-400',
  }

  const barColorMap: Record<string, string> = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    violet: 'bg-violet-500',
    blue: 'bg-blue-500',
    slate: 'bg-slate-500',
  }

  // Clamp progress bar to 0-100
  const barPct = Math.min(100, Math.max(0, pctFaturamento * 3.5))

  return (
    <div className={`group rounded-2xl border p-5 transition-all hover:scale-[1.01] ${
      isLight
        ? 'bg-white border-slate-200 shadow-sm hover:shadow-lg'
        : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
    }`}>
      {/* Top: number badge + category tag */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
            isLight
              ? 'bg-violet-100 text-violet-700'
              : 'bg-violet-500/20 text-violet-400'
          }`}>
            {num}
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            tagBg[tagColor] ?? tagBg.slate
          }`}>
            {tipo} &middot; {categoria}
          </span>
        </div>
        <Percent size={14} className={`opacity-0 group-hover:opacity-40 transition-opacity ${
          isLight ? 'text-slate-400' : 'text-slate-500'
        }`} />
      </div>

      {/* Main value */}
      <div className={`text-2xl font-black tracking-tight mb-0.5 ${
        isLight ? 'text-slate-800' : 'text-white'
      }`}>
        {valorPrincipal}
      </div>
      <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${
        isLight ? 'text-slate-400' : 'text-slate-500'
      }`}>
        {label}
      </div>
      <div className={`text-[11px] leading-relaxed mb-4 ${
        isLight ? 'text-slate-400' : 'text-slate-500'
      }`}>
        {descricao}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>% Faturamento</span>
          <span className={`font-bold font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            {fmtPct(pctFaturamento)}
          </span>
        </div>
        <div className={`w-full h-2 rounded-full overflow-hidden ${
          isLight ? 'bg-slate-100' : 'bg-slate-700/50'
        }`}>
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColorMap[tagColor] ?? barColorMap.slate}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      {/* Bottom metrics */}
      <div className={`flex items-center justify-between text-[11px] pt-3 border-t ${
        isLight ? 'border-slate-100' : 'border-slate-700'
      }`}>
        <div className="flex items-center gap-1.5">
          <DollarSign size={12} className={isLight ? 'text-slate-300' : 'text-slate-600'} />
          <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Total</span>
          <span className={`font-bold font-mono ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
            {fmtBRL(custoTotal)}
          </span>
        </div>
        <span className={`font-medium ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          {metricaExtra}
        </span>
      </div>
    </div>
  )
}
