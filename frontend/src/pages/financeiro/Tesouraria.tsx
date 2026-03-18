import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import {
  Landmark, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Plus, Upload, Wallet, Building2, CircleDollarSign, Search,
  Filter, X, Calendar, ChevronDown, Eye, FileText, Check,
  AlertTriangle, Zap, RefreshCw, ArrowDownUp, Link2,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Line, ComposedChart,
} from 'recharts'
import {
  useTesourariaDashboard, useCriarContaBancaria, useCriarMovimentacao, useImportExtrato,
} from '../../hooks/useTesouraria'
import { useContasPagar, useContasReceber } from '../../hooks/useFinanceiro'
import type { TesourariaDashboardData, CategoriaMovimentacao } from '../../types/financeiro'
import {
  useOmieCredentials,
  useOmieContasCorrentes,
  useOmieLancamentos,
  useSincronizarSaldoContaOmie,
} from '../../hooks/useOmieApi'

// ── Formatters ──────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

const fmtFull = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const PERIODOS = [
  ['7d', '7 dias'],
  ['30d', '30 dias'],
  ['60d', '60 dias'],
  ['90d', '90 dias'],
] as const

const CATEGORIAS: { value: CategoriaMovimentacao; label: string }[] = [
  { value: 'pagamento_fornecedor', label: 'Pagamento Fornecedor' },
  { value: 'recebimento_cliente', label: 'Recebimento Cliente' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'taxa_bancaria', label: 'Taxa Bancaria' },
  { value: 'rendimento', label: 'Rendimento' },
  { value: 'imposto', label: 'Imposto' },
  { value: 'folha', label: 'Folha de Pagamento' },
  { value: 'outros', label: 'Outros' },
]

const CORES_PRESET = [
  '#14B8A6', '#8B5CF6', '#F59E0B', '#EF4444', '#3B82F6',
  '#10B981', '#EC4899', '#6366F1', '#F97316', '#06B6D4',
]

type TesourariaTab = 'painel' | 'movimentacoes' | 'contas' | 'conciliacao' | 'omie'

const TESOURARIA_TABS: Array<{ key: TesourariaTab; label: string }> = [
  { key: 'painel', label: 'Painel' },
  { key: 'movimentacoes', label: 'Movimentações' },
  { key: 'contas', label: 'Contas e Saldos' },
  { key: 'conciliacao', label: 'Conciliação' },
  { key: 'omie', label: 'Omie ERP' },
]

const TAB_ICONS = {
  painel: Landmark,
  movimentacoes: FileText,
  contas: Building2,
  conciliacao: Check,
  omie: Zap,
} as const

const TAB_ACCENT = {
  painel: {
    bg: 'hover:bg-teal-50',
    bgActive: 'bg-teal-50',
    text: 'text-teal-600',
    textActive: 'text-teal-800',
    border: 'border-teal-500',
    badge: 'bg-teal-100 text-teal-700',
  },
  movimentacoes: {
    bg: 'hover:bg-sky-50',
    bgActive: 'bg-sky-50',
    text: 'text-sky-600',
    textActive: 'text-sky-800',
    border: 'border-sky-500',
    badge: 'bg-sky-100 text-sky-700',
  },
  contas: {
    bg: 'hover:bg-emerald-50',
    bgActive: 'bg-emerald-50',
    text: 'text-emerald-600',
    textActive: 'text-emerald-800',
    border: 'border-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  conciliacao: {
    bg: 'hover:bg-violet-50',
    bgActive: 'bg-violet-50',
    text: 'text-violet-600',
    textActive: 'text-violet-800',
    border: 'border-violet-500',
    badge: 'bg-violet-100 text-violet-700',
  },
  omie: {
    bg: 'hover:bg-emerald-50',
    bgActive: 'bg-emerald-50',
    text: 'text-emerald-600',
    textActive: 'text-emerald-800',
    border: 'border-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
  },
} as const

const EMPTY_AGING = { hoje: 0, d7: 0, d30: 0, d60: 0 }

const alertToneClasses: Record<string, string> = {
  critico: 'border-rose-200 bg-rose-50 text-rose-700',
  alto: 'border-amber-200 bg-amber-50 text-amber-700',
  medio: 'border-sky-200 bg-sky-50 text-sky-700',
  baixo: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

// ── KpiCard ─────────────────────────────────────────────────────────────────

function KpiCard({ titulo, valor, icon: Icon, hexCor, subtitulo, trend, isDark }: {
  titulo: string
  valor: string
  icon: typeof Landmark
  hexCor: string
  subtitulo?: string
  trend?: { value: number; positive: boolean }
  isDark: boolean
}) {
  const [displayed, setDisplayed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDisplayed(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className={`rounded-2xl shadow-sm overflow-hidden flex transition-all duration-500 ${
        displayed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      } ${
        isDark
          ? 'backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] shadow-xl'
          : 'bg-white shadow-sm border border-slate-100'
      }`}
    >
      <div className="w-[3px] shrink-0" style={{ backgroundColor: hexCor }} />
      <div className="p-4 flex-1 min-w-0">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
          style={{ backgroundColor: hexCor + '18' }}
        >
          <Icon size={14} style={{ color: hexCor }} />
        </div>
        <p className="text-xl font-extrabold leading-none" style={{ color: hexCor }}>
          {valor}
        </p>
        <p className={`text-[10px] font-semibold mt-1 uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {titulo}
        </p>
        {(subtitulo || trend) && (
          <div className="flex items-center gap-1 mt-1">
            {trend && (
              <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                trend.positive ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                {trend.positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {Math.abs(trend.value).toFixed(0)}%
              </span>
            )}
            {subtitulo && (
              <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {subtitulo}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ErrorState({ isDark, onRetry }: { isDark: boolean; onRetry: () => void }) {
  return (
    <div className={`rounded-2xl border p-6 ${isDark ? 'border-white/[0.08] bg-white/[0.04]' : 'border-rose-200 bg-white'}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-xl p-2 ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}>
          <AlertTriangle size={18} className="text-rose-500" />
        </div>
        <div className="flex-1">
          <h2 className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
            Falha ao carregar a Tesouraria
          </h2>
          <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            A tela nao recebeu os dados consolidados do banco. O modulo foi mantido isolado e nenhum fluxo de CP/CR foi alterado.
          </p>
        </div>
        <button
          onClick={onRetry}
          className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-teal-700"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}

function IndicadoresPanel({ dashboard, isDark }: {
  dashboard: TesourariaDashboardData
  isDark: boolean
}) {
  const indicadoresDashboard = dashboard.indicadores ?? {
    saldo_disponivel: dashboard.saldo_total ?? 0,
    saldo_projetado_30d: (dashboard.saldo_total ?? 0) + (dashboard.previsao_cr ?? 0) - (dashboard.previsao_cp ?? 0),
    queima_media_diaria: 0,
    cobertura_dias: null,
  }

  const indicadores = [
    {
      label: 'Saldo disponivel',
      value: fmt(indicadoresDashboard.saldo_disponivel),
      hint: 'Disponibilidade real consolidada',
    },
    {
      label: 'Saldo projetado 30d',
      value: fmt(indicadoresDashboard.saldo_projetado_30d),
      hint: indicadoresDashboard.saldo_projetado_30d >= 0 ? 'Janela confortavel' : 'Atencao ao caixa futuro',
    },
    {
      label: 'Queima media diaria',
      value: fmt(indicadoresDashboard.queima_media_diaria),
      hint: 'Baseada nas saidas do periodo',
    },
    {
      label: 'Cobertura de caixa',
      value: indicadoresDashboard.cobertura_dias == null ? '--' : `${indicadoresDashboard.cobertura_dias.toFixed(1)} dias`,
      hint: 'Dias de cobertura no ritmo atual',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {indicadores.map((item) => (
        <div
          key={item.label}
          className={`rounded-2xl p-4 ${isDark ? 'border border-white/[0.08] bg-white/[0.04]' : 'border border-slate-100 bg-white shadow-sm'}`}
        >
          <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {item.label}
          </p>
          <p className={`mt-2 text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {item.value}
          </p>
          <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            {item.hint}
          </p>
        </div>
      ))}
    </div>
  )
}

function AlertasPanel({ alertas, isDark }: {
  alertas: TesourariaDashboardData['alertas']
  isDark: boolean
}) {
  return (
    <div className={`rounded-2xl overflow-hidden ${isDark ? 'border border-white/[0.08] bg-white/[0.04]' : 'border border-slate-100 bg-white shadow-sm'}`}>
      <div className={`flex items-center gap-2 px-4 py-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
        <AlertTriangle size={14} className="text-amber-500" />
        <h3 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Alertas e insights
        </h3>
      </div>
      <div className="space-y-3 p-4">
        {alertas.length === 0 ? (
          <div className={`rounded-xl border border-dashed p-4 text-sm ${isDark ? 'border-white/[0.08] text-slate-400' : 'border-slate-200 text-slate-500'}`}>
            Nenhum alerta critico no periodo. O caixa esta sob controle.
          </div>
        ) : (
          alertas.map((alerta) => (
            <div
              key={alerta.id}
              className={`rounded-xl border p-3 ${isDark ? 'border-white/[0.08] bg-white/[0.03] text-slate-200' : alertToneClasses[alerta.tipo] ?? 'border-slate-200 bg-slate-50 text-slate-700'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold">{alerta.titulo}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-white/70 text-slate-600'}`}>
                  {alerta.tipo}
                </span>
              </div>
              <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-current'}`}>
                {alerta.descricao}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function TabsBar({ activeTab, onChange, isDark }: {
  activeTab: TesourariaTab
  onChange: (tab: TesourariaTab) => void
  isDark: boolean
}) {
  return (
    <div className={`flex gap-1 overflow-x-auto hide-scrollbar rounded-2xl border p-1 pb-2 ${
      isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
    }`}>
      {TESOURARIA_TABS.map((tab) => {
        const isActive = activeTab === tab.key
        const Icon = TAB_ICONS[tab.key]
        const accent = TAB_ACCENT[tab.key]
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`min-w-fit whitespace-nowrap rounded-xl border px-4 py-2.5 text-sm transition-all md:flex-1 ${
              isActive
                ? `${accent.bgActive} ${accent.textActive} ${accent.border} font-bold shadow-sm`
                : `${accent.bg} ${accent.text} border-transparent font-medium hover:bg-white hover:shadow-sm`
            } flex items-center justify-center gap-2`}
          >
            <Icon size={15} className="shrink-0" />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

function TesourariaToolbar({ activeTab, periodo, setPeriodo, isDark, onNovaMovimentacao, onImportOFX, onNovaConta }: {
  activeTab: TesourariaTab
  periodo: string
  setPeriodo: (p: string) => void
  isDark: boolean
  onNovaMovimentacao: () => void
  onImportOFX: () => void
  onNovaConta: () => void
}) {
  const shellCls = `rounded-2xl border px-4 py-2.5 flex flex-wrap items-center gap-2 ${
    isDark ? 'border-white/[0.06] bg-[#0f172a]' : 'border-slate-200 bg-white'
  }`
  const pillCls = (active: boolean) => `rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
    active
      ? 'bg-teal-600 text-white shadow-sm'
      : isDark
        ? 'border border-white/[0.06] bg-[#1e293b] text-slate-400 hover:bg-white/[0.06]'
        : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
  }`

  if (activeTab === 'omie') return null

  if (activeTab === 'contas') {
    return (
      <div className={shellCls}>
        <button onClick={onNovaConta} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700">
          <Plus size={13} /> Nova Conta
        </button>
        <button onClick={onImportOFX} className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold ${isDark ? 'border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]' : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
          <Upload size={13} /> Importar OFX
        </button>
      </div>
    )
  }

  return (
    <div className={shellCls}>
      {activeTab === 'movimentacoes' && (
        <button onClick={onNovaMovimentacao} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700">
          <Plus size={13} /> Nova Movimentacao
        </button>
      )}
      {(activeTab === 'painel' || activeTab === 'movimentacoes' || activeTab === 'conciliacao') && (
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODOS.map(([val, lbl]) => (
            <button key={val} onClick={() => setPeriodo(val)} className={pillCls(periodo === val)}>
              {lbl}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ConciliacaoPanel({ movimentacoes, isDark }: {
  movimentacoes: TesourariaDashboardData['movimentacoes_recentes']
  isDark: boolean
}) {
  const { data: contasPagar = [] } = useContasPagar()
  const { data: contasReceber = [] } = useContasReceber()

  const movimentacoesBanco = useMemo(
    () => movimentacoes.filter((mov) => !mov.conciliado).slice(0, 20),
    [movimentacoes],
  )

  const sistemaPendente = useMemo(() => {
    const cp = contasPagar
      .filter((item) => !['pago', 'conciliado', 'cancelado'].includes(item.status))
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        tipo: 'CP',
        titulo: item.fornecedor_nome,
        descricao: item.descricao || item.numero_documento || 'Conta a pagar do sistema',
        valor: item.valor_original - (item.valor_pago || 0),
        data: item.data_vencimento,
        status: item.status,
      }))

    const cr = contasReceber
      .filter((item) => !['recebido', 'conciliado', 'cancelado'].includes(item.status))
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        tipo: 'CR',
        titulo: item.cliente_nome,
        descricao: item.descricao || item.numero_nf || 'Conta a receber do sistema',
        valor: item.valor_original - (item.valor_recebido || 0),
        data: item.data_vencimento,
        status: item.status,
      }))

    return [...cp, ...cr]
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(0, 20)
  }, [contasPagar, contasReceber])

  const cardCls = isDark
    ? 'border border-white/[0.08] bg-white/[0.04]'
    : 'border border-slate-100 bg-white shadow-sm'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className={`rounded-2xl p-4 ${cardCls}`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Pendencias do sistema</p>
          <p className={`mt-2 text-2xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{sistemaPendente.length}</p>
        </div>
        <div className={`rounded-2xl p-4 ${cardCls}`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Movimentos bancarios pendentes</p>
          <p className={`mt-2 text-2xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{movimentacoesBanco.length}</p>
        </div>
        <div className={`rounded-2xl p-4 ${cardCls}`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Visao operacional</p>
          <p className={`mt-2 text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Sistema de um lado e banco do outro, para conciliacao tradicional.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={`rounded-2xl overflow-hidden ${cardCls}`}>
          <div className={`flex items-center gap-2 px-4 py-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <FileText size={14} className="text-violet-500" />
            <h3 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Movimentacoes do sistema</h3>
          </div>
          <div className="divide-y divide-slate-100 p-2">
            {sistemaPendente.length === 0 ? (
              <p className={`px-2 py-6 text-center text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma pendencia do sistema</p>
            ) : sistemaPendente.map((item) => (
              <div key={`${item.tipo}-${item.id}`} className="rounded-xl px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{item.titulo}</p>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{item.descricao}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.tipo === 'CP' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{item.tipo}</span>
                </div>
                <div className={`mt-2 flex items-center justify-between text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span>{new Date(item.data + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                  <span className="font-bold">{fmtFull(item.valor)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-2xl overflow-hidden ${cardCls}`}>
          <div className={`flex items-center gap-2 px-4 py-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <Landmark size={14} className="text-teal-500" />
            <h3 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Extrato bancario</h3>
          </div>
          <div className="divide-y divide-slate-100 p-2">
            {movimentacoesBanco.length === 0 ? (
              <p className={`px-2 py-6 text-center text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum movimento bancario pendente</p>
            ) : movimentacoesBanco.map((mov) => (
              <div key={mov.id} className="rounded-xl px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{mov.descricao || mov.categoria || 'Movimentacao bancaria'}</p>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{mov.conta_nome || 'Conta bancaria'}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${mov.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{mov.tipo}</span>
                </div>
                <div className={`mt-2 flex items-center justify-between text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span>{new Date(mov.data_movimentacao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                  <span className="font-bold">{fmtFull(mov.valor)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── FluxoCaixaChart ─────────────────────────────────────────────────────────

function FluxoCaixaChart({ data, isDark }: {
  data: Array<{ data: string; entradas: number; saidas: number; saldo: number; dataFmt: string }>
  isDark: boolean
}) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className={`rounded-xl p-3 shadow-lg text-xs ${
        isDark
          ? 'bg-slate-800 border border-white/10'
          : 'bg-white border border-slate-200'
      }`}>
        <p className={`font-bold mb-1.5 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              {p.dataKey === 'entradas' ? 'Entradas' : p.dataKey === 'saidas' ? 'Saidas' : 'Saldo'}
            </span>
            <span className={`font-bold ml-auto ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              {fmtFull(p.value)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-[280px] rounded-2xl ${
        isDark ? 'bg-white/[0.02]' : 'bg-slate-50'
      }`}>
        <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Sem dados de fluxo para o periodo selecionado
        </p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
        <defs>
          <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#14B8A6" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradSaidas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#F43F5E" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}
          vertical={false}
        />
        <XAxis
          dataKey="dataFmt"
          tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => fmt(v)}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="entradas"
          stroke="#14B8A6"
          strokeWidth={2}
          fill="url(#gradEntradas)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, fill: isDark ? '#1e293b' : '#fff' }}
        />
        <Area
          type="monotone"
          dataKey="saidas"
          stroke="#F43F5E"
          strokeWidth={2}
          fill="url(#gradSaidas)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, fill: isDark ? '#1e293b' : '#fff' }}
        />
        <Line
          type="monotone"
          dataKey="saldo"
          stroke={isDark ? '#64748b' : '#94a3b8'}
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, fill: isDark ? '#1e293b' : '#fff' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ── ContasBancariasPanel ────────────────────────────────────────────────────

function ContasBancariasPanel({ contas, isDark, onNovaConta, onImportOFX }: {
  contas: TesourariaDashboardData['contas']
  isDark: boolean
  onNovaConta: () => void
  onImportOFX: () => void
}) {
  return (
    <div className={`rounded-2xl overflow-hidden ${
      isDark
        ? 'backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] shadow-xl'
        : 'bg-white shadow-sm border border-slate-100'
    }`}>
      <div className={`px-4 py-3 flex items-center gap-2 ${
        isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'
      }`}>
        <Building2 size={14} className="text-teal-500" />
        <h3 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Contas Bancarias
        </h3>
      </div>

      <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
        {contas.length === 0 ? (
          <p className={`text-center text-xs py-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Nenhuma conta cadastrada
          </p>
        ) : (
          contas.map(c => (
            <div
              key={c.id}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.cor }} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  {c.nome}
                </p>
                {c.banco_nome && (
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {c.banco_nome}
                  </p>
                )}
              </div>
              <p className={`text-xs font-extrabold shrink-0 ${
                c.saldo_atual >= 0
                  ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                  : 'text-rose-500'
              }`}>
                {fmtFull(c.saldo_atual)}
              </p>
            </div>
          ))
        )}
      </div>

      <div className={`px-4 py-3 flex gap-2 ${
        isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'
      }`}>
        <button
          onClick={onNovaConta}
          className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold py-2 rounded-xl transition-colors
            bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
        >
          <Plus size={12} /> Nova Conta
        </button>
        <button
          onClick={onImportOFX}
          className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold py-2 rounded-xl transition-colors ${
            isDark
              ? 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 border border-white/[0.08]'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Upload size={12} /> Import OFX
        </button>
      </div>
    </div>
  )
}

// ── AgingPanel ──────────────────────────────────────────────────────────────

function AgingPanel({ agingCp, agingCr, isDark }: {
  agingCp: { hoje: number; d7: number; d30: number; d60: number }
  agingCr: { hoje: number; d7: number; d30: number; d60: number }
  isDark: boolean
}) {
  const rows = [
    { label: 'Hoje', cp: agingCp.hoje, cr: agingCr.hoje, urgency: 3 },
    { label: '7 dias', cp: agingCp.d7, cr: agingCr.d7, urgency: 2 },
    { label: '30 dias', cp: agingCp.d30, cr: agingCr.d30, urgency: 1 },
    { label: '60d+', cp: agingCp.d60, cr: agingCr.d60, urgency: 0 },
  ]

  const maxCp = Math.max(...rows.map(r => r.cp), 1)
  const maxCr = Math.max(...rows.map(r => r.cr), 1)

  const urgencyColor = (u: number) =>
    u === 3 ? '#EF4444' : u === 2 ? '#F59E0B' : u === 1 ? '#3B82F6' : '#10B981'

  return (
    <div className={`rounded-2xl overflow-hidden ${
      isDark
        ? 'backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] shadow-xl'
        : 'bg-white shadow-sm border border-slate-100'
    }`}>
      <div className={`px-4 py-3 flex items-center gap-2 ${
        isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'
      }`}>
        <AlertTriangle size={14} className="text-amber-500" />
        <h3 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Aging
        </h3>
      </div>

      {/* Header */}
      <div className={`grid grid-cols-[70px_1fr_1fr] px-4 py-2 text-[10px] font-bold uppercase tracking-widest ${
        isDark ? 'text-slate-500 border-b border-white/[0.04]' : 'text-slate-400 border-b border-slate-50'
      }`}>
        <span />
        <span className="text-center">A Pagar</span>
        <span className="text-center">A Receber</span>
      </div>

      {/* Rows */}
      <div className="px-4 py-2 space-y-2.5">
        {rows.map(r => (
          <div key={r.label} className="grid grid-cols-[70px_1fr_1fr] items-center gap-2">
            <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {r.label}
            </span>

            {/* CP bar */}
            <div className="flex items-center gap-2">
              <div className={`flex-1 h-3 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max((r.cp / maxCp) * 100, 2)}%`,
                    backgroundColor: urgencyColor(r.urgency),
                    opacity: 0.8,
                  }}
                />
              </div>
              <span className={`text-[10px] font-bold min-w-[48px] text-right ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {fmt(r.cp)}
              </span>
            </div>

            {/* CR bar */}
            <div className="flex items-center gap-2">
              <div className={`flex-1 h-3 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max((r.cr / maxCr) * 100, 2)}%`,
                    backgroundColor: '#14B8A6',
                    opacity: 0.8,
                  }}
                />
              </div>
              <span className={`text-[10px] font-bold min-w-[48px] text-right ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {fmt(r.cr)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── MovimentacoesTable ──────────────────────────────────────────────────────

function MovimentacoesTable({ movimentacoes, isDark, onNovaMovimentacao }: {
  movimentacoes: TesourariaDashboardData['movimentacoes_recentes']
  isDark: boolean
  onNovaMovimentacao: () => void
}) {
  const [filtroTipo, setFiltroTipo] = useState<'all' | 'entrada' | 'saida'>('all')
  const [busca, setBusca] = useState('')

  const filtered = useMemo(() => {
    let items = [...movimentacoes]
    if (filtroTipo !== 'all') items = items.filter(m => m.tipo === filtroTipo)
    if (busca.trim()) {
      const q = busca.toLowerCase()
      items = items.filter(m =>
        (m.descricao ?? '').toLowerCase().includes(q) ||
        (m.conta_nome ?? '').toLowerCase().includes(q) ||
        (m.categoria ?? '').toLowerCase().includes(q)
      )
    }
    return items.slice(0, 50)
  }, [movimentacoes, filtroTipo, busca])

  return (
    <div className={`rounded-2xl overflow-hidden ${
      isDark
        ? 'backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] shadow-xl'
        : 'bg-white shadow-sm border border-slate-100'
    }`}>
      {/* Header */}
      <div className={`px-4 py-3 flex flex-wrap items-center gap-2 ${
        isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'
      }`}>
        <FileText size={14} className="text-violet-500" />
        <h3 className={`text-sm font-extrabold mr-auto ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Movimentacoes Recentes
        </h3>

        {/* Tipo filter */}
        <div className={`flex rounded-lg overflow-hidden text-[10px] font-bold ${
          isDark ? 'border border-white/[0.08]' : 'border border-slate-200'
        }`}>
          {(['all', 'entrada', 'saida'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              className={`px-2.5 py-1 transition-colors ${
                filtroTipo === t
                  ? 'bg-teal-600 text-white'
                  : isDark
                    ? 'bg-white/[0.02] text-slate-400 hover:bg-white/[0.06]'
                    : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t === 'all' ? 'Todos' : t === 'entrada' ? 'Entradas' : 'Saidas'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${
          isDark
            ? 'bg-white/[0.04] border border-white/[0.08]'
            : 'bg-slate-50 border border-slate-200'
        }`}>
          <Search size={12} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
          <input
            type="text"
            placeholder="Buscar..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className={`bg-transparent outline-none text-xs w-28 ${
              isDark ? 'text-slate-200 placeholder:text-slate-600' : 'text-slate-700 placeholder:text-slate-400'
            }`}
          />
          {busca && (
            <button onClick={() => setBusca('')}>
              <X size={10} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
            </button>
          )}
        </div>

        <button
          onClick={onNovaMovimentacao}
          className="flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors
            bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
        >
          <Plus size={12} /> Lancamento
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className={isDark ? 'border-b border-white/[0.04]' : 'border-b border-slate-50'}>
              {['Data', 'Descricao', 'Valor', 'Conta', 'Status'].map(h => (
                <th key={h} className={`px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className={`text-center py-8 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Nenhuma movimentacao encontrada
                </td>
              </tr>
            ) : (
              filtered.map(m => (
                <tr
                  key={m.id}
                  className={`transition-colors ${
                    isDark
                      ? 'hover:bg-white/[0.03] border-b border-white/[0.03]'
                      : 'hover:bg-slate-50 border-b border-slate-50'
                  }`}
                >
                  <td className={`px-4 py-2.5 font-medium whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {fmtData(m.data_movimentacao)}
                  </td>
                  <td className={`px-4 py-2.5 max-w-[200px] truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {m.descricao || m.categoria || '—'}
                  </td>
                  <td className={`px-4 py-2.5 font-extrabold whitespace-nowrap ${
                    m.tipo === 'entrada' ? 'text-emerald-500' : 'text-rose-500'
                  }`}>
                    {m.tipo === 'entrada' ? '+' : '-'}{fmtFull(m.valor)}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {m.conta_cor && (
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.conta_cor }} />
                      )}
                      <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                        {m.conta_nome || '—'}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {m.conciliado ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-500">
                        <Check size={10} /> Conciliado
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-500'
                      }`}>
                        Pendente
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── NovaContaModal ──────────────────────────────────────────────────────────

function NovaContaModal({ isDark, onClose }: { isDark: boolean; onClose: () => void }) {
  const criar = useCriarContaBancaria()
  const [form, setForm] = useState({
    nome: '',
    banco_nome: '',
    agencia: '',
    conta: '',
    tipo: 'corrente' as 'corrente' | 'poupanca' | 'investimento',
    cor: CORES_PRESET[0],
  })
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)

  const canSubmit = form.nome.trim().length > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    setErroSalvar(null)
    criar.mutate(
      { nome: form.nome, banco_nome: form.banco_nome || undefined, agencia: form.agencia || undefined, conta: form.conta || undefined, tipo: form.tipo, cor: form.cor },
      {
        onSuccess: () => onClose(),
        onError: (err) => {
          const msg = err instanceof Error ? err.message : 'Erro ao salvar conta bancária'
          setErroSalvar(msg)
        },
      },
    )
  }

  const inputCls = `w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors ${
    isDark
      ? 'bg-white/[0.06] border border-white/[0.08] text-slate-200 placeholder:text-slate-500 focus:border-teal-500/50'
      : 'bg-slate-50 border border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-teal-500'
  }`

  const labelCls = `text-[10px] font-bold uppercase tracking-widest mb-1 block ${
    isDark ? 'text-slate-400' : 'text-slate-500'
  }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
        isDark
          ? 'bg-slate-900 border border-white/[0.08]'
          : 'bg-white border border-slate-200'
      }`}>
        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between ${
          isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'
        }`}>
          <h2 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
            Nova Conta Bancaria
          </h2>
          <button onClick={onClose} className={`p-1 rounded-lg transition-colors ${
            isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'
          }`}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Nome da Conta *</label>
            <input
              className={inputCls}
              placeholder="Ex: Itau Empresarial"
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Banco</label>
              <input
                className={inputCls}
                placeholder="Ex: Itau"
                value={form.banco_nome}
                onChange={e => setForm(f => ({ ...f, banco_nome: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <select
                className={inputCls}
                value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as any }))}
              >
                <option value="corrente">Corrente</option>
                <option value="poupanca">Poupanca</option>
                <option value="investimento">Investimento</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Agencia</label>
              <input
                className={inputCls}
                placeholder="0001"
                value={form.agencia}
                onChange={e => setForm(f => ({ ...f, agencia: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Conta</label>
              <input
                className={inputCls}
                placeholder="12345-6"
                value={form.conta}
                onChange={e => setForm(f => ({ ...f, conta: e.target.value }))}
              />
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className={labelCls}>Cor</label>
            <div className="flex gap-2 flex-wrap">
              {CORES_PRESET.map(cor => (
                <button
                  key={cor}
                  onClick={() => setForm(f => ({ ...f, cor }))}
                  className={`w-7 h-7 rounded-lg transition-all ${
                    form.cor === cor
                      ? 'ring-2 ring-offset-2 ring-teal-500 scale-110'
                      : 'hover:scale-105'
                  } ${isDark ? 'ring-offset-slate-900' : 'ring-offset-white'}`}
                  style={{ backgroundColor: cor }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Error feedback (#91) */}
        {erroSalvar && (
          <div className="mx-5 mb-2 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-500" />
            <p className="text-xs text-red-700">{erroSalvar}</p>
          </div>
        )}

        {/* Footer */}
        <div className={`px-5 py-4 flex justify-end gap-2 ${
          isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              isDark
                ? 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || criar.isPending}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {criar.isPending ? 'Salvando...' : 'Criar Conta'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ImportExtratoModal({ isDark, contas, onClose }: {
  isDark: boolean
  contas: TesourariaDashboardData['contas']
  onClose: () => void
}) {
  const importar = useImportExtrato()
  const [contaId, setContaId] = useState(contas[0]?.id ?? '')
  const [file, setFile] = useState<File | null>(null)

  const canSubmit = Boolean(contaId && file)

  const inputCls = `w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors ${
    isDark
      ? 'bg-white/[0.06] border border-white/[0.08] text-slate-200 placeholder:text-slate-500 focus:border-teal-500/50'
      : 'bg-slate-50 border border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-teal-500'
  }`

  const labelCls = `text-[10px] font-bold uppercase tracking-widest mb-1 block ${
    isDark ? 'text-slate-400' : 'text-slate-500'
  }`

  const handleSubmit = () => {
    if (!canSubmit || !file) return
    importar.mutate({ contaId, file }, { onSuccess: () => onClose() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl ${
        isDark ? 'border border-white/[0.08] bg-slate-900' : 'border border-slate-200 bg-white'
      }`}>
        <div className={`flex items-center justify-between px-5 py-4 ${
          isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'
        }`}>
          <h2 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
            Importar extrato
          </h2>
          <button onClick={onClose} className={`rounded-lg p-1 transition-colors ${
            isDark ? 'text-slate-400 hover:bg-white/[0.06]' : 'text-slate-500 hover:bg-slate-100'
          }`}>
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className={labelCls}>Conta *</label>
            <select className={inputCls} value={contaId} onChange={(e) => setContaId(e.target.value)}>
              {contas.map((conta) => (
                <option key={conta.id} value={conta.id}>{conta.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Arquivo OFX ou CSV *</label>
            <input
              type="file"
              accept=".ofx,.csv"
              className={inputCls}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className={`mt-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              O upload usa um bucket dedicado da Tesouraria e permanece isolado dos fluxos fiscais.
            </p>
          </div>
        </div>

        <div className={`flex justify-end gap-2 px-5 py-4 ${
          isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'
        }`}>
          <button
            onClick={onClose}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              isDark ? 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || importar.isPending}
            className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importar.isPending ? 'Importando...' : 'Enviar extrato'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── NovaMovimentacaoModal ───────────────────────────────────────────────────

function NovaMovimentacaoModal({ isDark, contas, onClose }: {
  isDark: boolean
  contas: TesourariaDashboardData['contas']
  onClose: () => void
}) {
  const criar = useCriarMovimentacao()
  const [form, setForm] = useState({
    conta_id: contas[0]?.id ?? '',
    conta_destino_id: '',
    tipo: 'entrada' as 'entrada' | 'saida' | 'transferencia',
    valor: '',
    data_movimentacao: new Date().toISOString().split('T')[0],
    descricao: '',
    categoria: 'outros' as CategoriaMovimentacao,
  })

  const canSubmit = Boolean(
    form.conta_id &&
    parseFloat(form.valor) > 0 &&
    (form.tipo !== 'transferencia' || (form.conta_destino_id && form.conta_destino_id !== form.conta_id))
  )

  const handleSubmit = () => {
    if (!canSubmit) return
    criar.mutate(
      {
        conta_id: form.conta_id,
        conta_destino_id: form.tipo === 'transferencia' ? form.conta_destino_id : undefined,
        tipo: form.tipo,
        valor: parseFloat(form.valor),
        data_movimentacao: form.data_movimentacao,
        descricao: form.descricao || undefined,
        categoria: form.categoria,
      },
      { onSuccess: () => onClose() },
    )
  }

  const inputCls = `w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors ${
    isDark
      ? 'bg-white/[0.06] border border-white/[0.08] text-slate-200 placeholder:text-slate-500 focus:border-teal-500/50'
      : 'bg-slate-50 border border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-teal-500'
  }`

  const labelCls = `text-[10px] font-bold uppercase tracking-widest mb-1 block ${
    isDark ? 'text-slate-400' : 'text-slate-500'
  }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
        isDark
          ? 'bg-slate-900 border border-white/[0.08]'
          : 'bg-white border border-slate-200'
      }`}>
        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between ${
          isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'
        }`}>
          <h2 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
            Novo Lancamento
          </h2>
          <button onClick={onClose} className={`p-1 rounded-lg transition-colors ${
            isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'
          }`}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Conta *</label>
            <select
              className={inputCls}
              value={form.conta_id}
              onChange={e => setForm(f => ({ ...f, conta_id: e.target.value }))}
            >
              {contas.length === 0 && <option value="">Nenhuma conta</option>}
              {contas.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tipo *</label>
              <select
                className={inputCls}
                value={form.tipo}
                onChange={e => setForm(f => ({
                  ...f,
                  tipo: e.target.value as any,
                  conta_destino_id: e.target.value === 'transferencia' ? f.conta_destino_id : '',
                  categoria: e.target.value === 'transferencia' ? 'transferencia' : f.categoria,
                }))}
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saida</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Valor *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputCls}
                placeholder="0,00"
                value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
              />
            </div>
          </div>

          {form.tipo === 'transferencia' && (
            <div>
              <label className={labelCls}>Conta destino *</label>
              <select
                className={inputCls}
                value={form.conta_destino_id}
                onChange={e => setForm(f => ({ ...f, conta_destino_id: e.target.value }))}
              >
                <option value="">Selecione a conta de destino</option>
                {contas
                  .filter(c => c.id !== form.conta_id)
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data *</label>
              <input
                type="date"
                className={inputCls}
                value={form.data_movimentacao}
                onChange={e => setForm(f => ({ ...f, data_movimentacao: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Categoria</label>
              <select
                className={inputCls}
                value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value as CategoriaMovimentacao }))}
              >
                {CATEGORIAS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Descricao</label>
            <input
              className={inputCls}
              placeholder="Descricao do lancamento"
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 flex justify-end gap-2 ${
          isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              isDark
                ? 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || criar.isPending}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {criar.isPending ? 'Salvando...' : 'Criar Lancamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ isDark, onAddConta }: { isDark: boolean; onAddConta: () => void }) {
  return (
    <div className={`flex flex-col items-center justify-center py-20 px-6 rounded-2xl text-center ${
      isDark
        ? 'backdrop-blur-xl bg-white/[0.04] border border-white/[0.08]'
        : 'bg-white shadow-sm border border-slate-100'
    }`}>
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
        isDark ? 'bg-teal-500/10' : 'bg-teal-50'
      }`}>
        <Landmark size={28} className="text-teal-500" />
      </div>
      <h2 className={`text-lg font-extrabold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
        Nenhuma conta bancaria cadastrada
      </h2>
      <p className={`text-sm max-w-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Adicione sua primeira conta para comecar a usar a Tesouraria.
        Voce podera acompanhar saldos, fluxo de caixa e movimentacoes.
      </p>
      <button
        onClick={onAddConta}
        className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold
          bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-500/20 transition-all hover:scale-[1.02]"
      >
        <Plus size={16} /> Adicionar Conta
      </button>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

function TesourariaLegacy() {
  const { isDark } = useTheme()
  const [periodo, setPeriodo] = useState('30d')
  const [showNovaConta, setShowNovaConta] = useState(false)
  const [showNovaMovimentacao, setShowNovaMovimentacao] = useState(false)

  const { data: dashboard, isLoading } = useTesourariaDashboard(periodo)

  const contas = dashboard?.contas ?? []
  const movimentacoes = dashboard?.movimentacoes_recentes ?? []
  const agingCp = dashboard?.aging_cp ?? { hoje: 0, d7: 0, d30: 0, d60: 0 }
  const agingCr = dashboard?.aging_cr ?? { hoje: 0, d7: 0, d30: 0, d60: 0 }

  const chartData = useMemo(() => {
    let saldo = 0
    return (dashboard?.fluxo_diario ?? []).map(d => {
      saldo += d.entradas - d.saidas
      return {
        ...d,
        saldo,
        dataFmt: new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      }
    })
  }, [dashboard?.fluxo_diario])

  // Previsao 30d: diferenca entre CR e CP
  const previsao30d = (dashboard?.previsao_cr ?? 0) - (dashboard?.previsao_cp ?? 0)

  // ── Loading ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Empty state ─────────────────────────────────────────────
  if (contas.length === 0 && movimentacoes.length === 0) {
    return (
      <div className="space-y-5">
        <Header isDark={isDark} periodo={periodo} setPeriodo={setPeriodo} />
        <EmptyState isDark={isDark} onAddConta={() => setShowNovaConta(true)} />
        {showNovaConta && <NovaContaModal isDark={isDark} onClose={() => setShowNovaConta(false)} />}
      </div>
    )
  }

  // ── Main Layout ─────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <Header isDark={isDark} periodo={periodo} setPeriodo={setPeriodo} />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          titulo="Saldo Total"
          valor={fmt(dashboard?.saldo_total ?? 0)}
          icon={Wallet}
          hexCor="#14B8A6"
          isDark={isDark}
        />
        <KpiCard
          titulo="Entradas no Periodo"
          valor={fmt(dashboard?.entradas_periodo ?? 0)}
          icon={TrendingUp}
          hexCor="#10B981"
          trend={{ value: 12, positive: true }}
          isDark={isDark}
        />
        <KpiCard
          titulo="Saidas no Periodo"
          valor={fmt(dashboard?.saidas_periodo ?? 0)}
          icon={TrendingDown}
          hexCor="#F43F5E"
          trend={{ value: 8, positive: false }}
          isDark={isDark}
        />
        <KpiCard
          titulo="Previsao 30d"
          valor={fmt(previsao30d)}
          icon={CircleDollarSign}
          hexCor={previsao30d >= 0 ? '#8B5CF6' : '#EF4444'}
          subtitulo={previsao30d >= 0 ? 'Superavit previsto' : 'Deficit previsto'}
          isDark={isDark}
        />
      </div>

      {/* Main grid: chart + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Fluxo de Caixa Chart */}
          <div className={`rounded-2xl p-4 ${
            isDark
              ? 'backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] shadow-xl'
              : 'bg-white shadow-sm border border-slate-100'
          }`}>
            <div className="flex items-center gap-2 mb-4">
              <Eye size={14} className="text-teal-500" />
              <h3 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Fluxo de Caixa
              </h3>
              <div className="ml-auto flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-1 rounded-full bg-teal-500" /> Entradas
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-1 rounded-full bg-rose-500" /> Saidas
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-0.5 rounded-full bg-slate-400" style={{ borderTop: '1px dashed' }} /> Saldo
                </span>
              </div>
            </div>
            <FluxoCaixaChart data={chartData} isDark={isDark} />
          </div>

          {/* Movimentacoes */}
          <MovimentacoesTable
            movimentacoes={movimentacoes}
            isDark={isDark}
            onNovaMovimentacao={() => setShowNovaMovimentacao(true)}
          />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <ContasBancariasPanel
            contas={contas}
            isDark={isDark}
            onNovaConta={() => setShowNovaConta(true)}
            onImportOFX={() => {
              /* Import OFX placeholder — will show a file picker or dedicated modal */
            }}
          />
          <AgingPanel agingCp={agingCp} agingCr={agingCr} isDark={isDark} />
        </div>
      </div>

      {/* Modals */}
      {showNovaConta && (
        <NovaContaModal isDark={isDark} onClose={() => setShowNovaConta(false)} />
      )}
      {showNovaMovimentacao && (
        <NovaMovimentacaoModal
          isDark={isDark}
          contas={contas}
          onClose={() => setShowNovaMovimentacao(false)}
        />
      )}
    </div>
  )
}

// ── Header ──────────────────────────────────────────────────────────────────

function Header({ isDark, periodo, setPeriodo }: {
  isDark: boolean
  periodo: string
  setPeriodo: (p: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          <Landmark size={20} className="text-teal-500" />
          Tesouraria
        </h1>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Cockpit financeiro — saldos, fluxo de caixa e movimentacoes
        </p>
      </div>

      <div className="flex gap-1.5">
        {PERIODOS.map(([val, lbl]) => (
          <button
            key={val}
            onClick={() => setPeriodo(val)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              periodo === val
                ? 'bg-teal-600 text-white shadow-sm'
                : isDark
                  ? 'bg-[#1e293b] text-slate-400 border border-white/[0.06] hover:bg-white/[0.06]'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── OmiePanel ────────────────────────────────────────────────────────────────

function OmiePanel({ isDark }: { isDark: boolean }) {
  const { data: omieResult, isLoading: loadingCreds } = useOmieCredentials()
  const credentials = omieResult?.credentials ?? null
  const isSandbox   = omieResult?.isSandbox ?? false
  const { data: contas = [], isLoading: loadingContas, refetch, isRefetching } = useOmieContasCorrentes(credentials)
  const sincronizarSaldo = useSincronizarSaldoContaOmie()
  const [selectedConta, setSelectedConta] = useState<number | null>(null)
  const [sincStatus, setSincStatus] = useState<Record<number, string>>({})

  // Data range for lançamentos: últimos 30 dias
  const hoje = new Date()
  const inicio = new Date(hoje)
  inicio.setDate(inicio.getDate() - 30)
  const fmtOmie = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`

  const { data: lancamentos = [], isLoading: loadingLanc } = useOmieLancamentos(
    credentials,
    selectedConta ? {
      nCodCC: selectedConta,
      dataInicio: fmtOmie(inicio),
      dataFim: fmtOmie(hoje),
    } : {},
  )

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

  const card = `rounded-2xl border shadow-sm ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`

  if (loadingCreds) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  if (!credentials) {
    return (
      <div className={`rounded-2xl border p-8 text-center ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
        <Zap size={32} className="mx-auto mb-3 text-slate-300" />
        <p className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Integração Omie não configurada</p>
        <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Acesse Financeiro → Configurações e informe APP_KEY e APP_SECRET do Omie.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-base font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Zap size={16} className="text-emerald-500" />
            Contas Correntes — Omie ERP
            {isSandbox && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                SANDBOX
              </span>
            )}
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {isSandbox
              ? 'Dados de homologação — aplicação de teste Omie'
              : 'Saldos e movimentações integradas diretamente do Omie'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={loadingContas || isRefetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-50"
        >
          <RefreshCw size={12} className={(loadingContas || isRefetching) ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Contas Grid */}
      {loadingContas ? (
        <div className="flex justify-center py-8"><div className="w-7 h-7 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : contas.length === 0 ? (
        <div className={`${card} p-8 text-center`}>
          <Building2 size={28} className="mx-auto mb-3 text-slate-300" />
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nenhuma conta corrente encontrada no Omie</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {contas.map(conta => (
            <div
              key={conta.nCodCC}
              onClick={() => setSelectedConta(prev => prev === conta.nCodCC ? null : conta.nCodCC)}
              className={`${card} p-4 cursor-pointer transition-all hover:shadow-md ${
                selectedConta === conta.nCodCC
                  ? isDark ? 'ring-2 ring-emerald-500/40' : 'ring-2 ring-emerald-400'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{conta.cDescricao}</p>
                  <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {conta.cNomeBanco || `Banco ${conta.nCodBanco}`}
                    {conta.cAgencia && ` · Ag. ${conta.cAgencia}`}
                    {conta.cConta && ` · C. ${conta.cConta}`}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                  conta.cTipoConta === 'CC' ? 'bg-blue-50 text-blue-700' :
                  conta.cTipoConta === 'CP' ? 'bg-purple-50 text-purple-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {conta.cTipoConta === 'CC' ? 'Corrente' : conta.cTipoConta === 'CP' ? 'Poupança' : conta.cTipoConta}
                </span>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Saldo Omie</p>
                  <p className={`text-lg font-extrabold ${conta.nSaldo >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmt(conta.nSaldo)}
                  </p>
                </div>
                <button
                  onClick={async e => {
                    e.stopPropagation()
                    const contaId = prompt(`ID da conta interna TEG+ para vincular com "${conta.cDescricao}":`)
                    if (!contaId) return
                    try {
                      await sincronizarSaldo.mutateAsync({ contaInternaId: contaId.trim(), nCodCC: conta.nCodCC, saldo: conta.nSaldo })
                      setSincStatus(prev => ({ ...prev, [conta.nCodCC]: 'Sincronizado!' }))
                      setTimeout(() => setSincStatus(prev => { const n = {...prev}; delete n[conta.nCodCC]; return n }), 3000)
                    } catch {
                      setSincStatus(prev => ({ ...prev, [conta.nCodCC]: 'Erro ao sincronizar' }))
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all"
                >
                  <ArrowDownUp size={10} />
                  Sincronizar
                </button>
              </div>
              {sincStatus[conta.nCodCC] && (
                <p className="text-[10px] text-emerald-600 font-medium mt-1">{sincStatus[conta.nCodCC]}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lançamentos da conta selecionada */}
      {selectedConta && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Link2 size={14} className="text-slate-400" />
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Lançamentos — {contas.find(c => c.nCodCC === selectedConta)?.cDescricao ?? 'Conta'} (últimos 30 dias)
            </h3>
          </div>

          {loadingLanc ? (
            <div className="flex justify-center py-6"><div className="w-6 h-6 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : lancamentos.length === 0 ? (
            <div className={`${card} p-6 text-center`}>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Sem lançamentos no período</p>
            </div>
          ) : (
            <div className={`${card} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-white/[0.04]' : 'border-slate-100'}`}>
                      <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400 uppercase">Data</th>
                      <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400 uppercase">Descrição</th>
                      <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400 uppercase hidden md:table-cell">Categoria</th>
                      <th className="text-right px-4 py-2 text-[10px] font-bold text-slate-400 uppercase">Valor</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-white/[0.03]' : 'divide-slate-50'}`}>
                    {lancamentos.slice(0, 50).map(lanc => (
                      <tr key={lanc.nCodLanc} className={`${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/60'} transition-colors`}>
                        <td className="px-4 py-2">
                          <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{lanc.dData}</span>
                        </td>
                        <td className="px-4 py-2">
                          <p className={`text-xs truncate max-w-[200px] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{lanc.cDescricao}</p>
                        </td>
                        <td className="px-4 py-2 hidden md:table-cell">
                          <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{lanc.cCodCateg || '—'}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className={`text-sm font-bold ${lanc.cTipoLanc === 'E' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {lanc.cTipoLanc === 'E' ? '+' : '-'}{fmt(Math.abs(lanc.nValor))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Tesouraria() {
  const { isDark } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const [periodo, setPeriodo] = useState('30d')
  const [showNovaConta, setShowNovaConta] = useState(false)
  const [showNovaMovimentacao, setShowNovaMovimentacao] = useState(false)
  const [showImportExtrato, setShowImportExtrato] = useState(false)
  const activeTab = (searchParams.get('tab') as TesourariaTab | null) ?? 'painel'

  const { data: dashboard, isLoading, isError, refetch } = useTesourariaDashboard(periodo)

  const contas = dashboard?.contas ?? []
  const movimentacoes = dashboard?.movimentacoes_recentes ?? []
  const agingCp = dashboard?.aging_cp ?? EMPTY_AGING
  const agingCr = dashboard?.aging_cr ?? EMPTY_AGING
  const alertas = dashboard?.alertas ?? []
  const comparativos = dashboard?.comparativos ?? { entradas_percentual: 0, saidas_percentual: 0 }
  const indicadores = dashboard?.indicadores ?? {
    saldo_disponivel: 0,
    saldo_projetado_30d: 0,
    queima_media_diaria: 0,
    cobertura_dias: null,
  }

  const chartData = useMemo(() => {
    let saldo = dashboard?.saldo_inicial_periodo ?? 0
    return (dashboard?.fluxo_diario ?? []).map((d) => {
      saldo += d.entradas - d.saidas
      return {
        ...d,
        saldo,
        dataFmt: new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      }
    })
  }, [dashboard?.fluxo_diario, dashboard?.saldo_inicial_periodo])

  const previsao30d = (dashboard?.previsao_cr ?? 0) - (dashboard?.previsao_cp ?? 0)
  const hasData = contas.length > 0 || movimentacoes.length > 0
  const setActiveTab = (tab: TesourariaTab) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-teal-500 border-t-transparent" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-5">
        <TesourariaHeader isDark={isDark} />
        <TabsBar activeTab={activeTab} onChange={setActiveTab} isDark={isDark} />
        <TesourariaToolbar
          activeTab={activeTab}
          periodo={periodo}
          setPeriodo={setPeriodo}
          isDark={isDark}
          onNovaMovimentacao={() => setShowNovaMovimentacao(true)}
          onImportOFX={() => setShowImportExtrato(true)}
          onNovaConta={() => setShowNovaConta(true)}
        />
        <ErrorState isDark={isDark} onRetry={() => { void refetch() }} />
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="space-y-5">
        <TesourariaHeader isDark={isDark} />
        <TabsBar activeTab={activeTab} onChange={setActiveTab} isDark={isDark} />
        <TesourariaToolbar
          activeTab={activeTab}
          periodo={periodo}
          setPeriodo={setPeriodo}
          isDark={isDark}
          onNovaMovimentacao={() => setShowNovaMovimentacao(true)}
          onImportOFX={() => setShowImportExtrato(true)}
          onNovaConta={() => setShowNovaConta(true)}
        />
        <EmptyState isDark={isDark} onAddConta={() => setShowNovaConta(true)} />
        {showNovaConta && <NovaContaModal isDark={isDark} onClose={() => setShowNovaConta(false)} />}
        {showImportExtrato && (
          <ImportExtratoModal isDark={isDark} contas={contas} onClose={() => setShowImportExtrato(false)} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <TesourariaHeader isDark={isDark} />
      <TabsBar activeTab={activeTab} onChange={setActiveTab} isDark={isDark} />
      <TesourariaToolbar
        activeTab={activeTab}
        periodo={periodo}
        setPeriodo={setPeriodo}
        isDark={isDark}
        onNovaMovimentacao={() => setShowNovaMovimentacao(true)}
        onImportOFX={() => setShowImportExtrato(true)}
        onNovaConta={() => setShowNovaConta(true)}
      />

      {activeTab === 'painel' && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              titulo="Saldo Total"
              valor={fmt(dashboard?.saldo_total ?? 0)}
              icon={Wallet}
              hexCor="#14B8A6"
              isDark={isDark}
            />
            <KpiCard
              titulo="Entradas no Periodo"
              valor={fmt(dashboard?.entradas_periodo ?? 0)}
              icon={TrendingUp}
              hexCor="#10B981"
              trend={{ value: comparativos.entradas_percentual, positive: comparativos.entradas_percentual >= 0 }}
              subtitulo={`${fmt(dashboard?.entradas_periodo_anterior ?? 0)} periodo anterior`}
              isDark={isDark}
            />
            <KpiCard
              titulo="Saidas no Periodo"
              valor={fmt(dashboard?.saidas_periodo ?? 0)}
              icon={TrendingDown}
              hexCor="#F43F5E"
              trend={{ value: comparativos.saidas_percentual, positive: comparativos.saidas_percentual <= 0 }}
              subtitulo={`${fmt(dashboard?.saidas_periodo_anterior ?? 0)} periodo anterior`}
              isDark={isDark}
            />
            <KpiCard
              titulo="Previsao 30d"
              valor={fmt(indicadores.saldo_projetado_30d)}
              icon={CircleDollarSign}
              hexCor={indicadores.saldo_projetado_30d >= 0 ? '#8B5CF6' : '#EF4444'}
              subtitulo={previsao30d >= 0 ? 'Superavit previsto' : 'Deficit previsto'}
              isDark={isDark}
            />
          </div>
          {dashboard && <IndicadoresPanel dashboard={dashboard} isDark={isDark} />}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className={`rounded-2xl p-4 ${
                isDark
                  ? 'backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] shadow-xl'
                  : 'bg-white shadow-sm border border-slate-100'
              }`}>
                <div className="mb-4 flex items-center gap-2">
                  <Eye size={14} className="text-teal-500" />
                  <h3 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    Fluxo de Caixa
                  </h3>
                  <div className="ml-auto flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1">
                      <span className="h-1 w-2.5 rounded-full bg-teal-500" /> Entradas
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-1 w-2.5 rounded-full bg-rose-500" /> Saidas
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-0.5 w-2.5 rounded-full bg-slate-400" style={{ borderTop: '1px dashed' }} /> Saldo
                    </span>
                  </div>
                </div>
                <div className={`mb-3 flex flex-wrap items-center gap-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span>Saldo inicial: <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>{fmt(dashboard?.saldo_inicial_periodo ?? 0)}</strong></span>
                  <span>Saldo final: <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>{fmt(dashboard?.saldo_final_periodo ?? 0)}</strong></span>
                </div>
                <FluxoCaixaChart data={chartData} isDark={isDark} />
              </div>

              <MovimentacoesTable
                movimentacoes={movimentacoes}
                isDark={isDark}
                onNovaMovimentacao={() => setShowNovaMovimentacao(true)}
              />
            </div>

            <div className="space-y-4">
              <AlertasPanel alertas={alertas} isDark={isDark} />
              <ContasBancariasPanel
                contas={contas}
                isDark={isDark}
                onNovaConta={() => setShowNovaConta(true)}
                onImportOFX={() => setShowImportExtrato(true)}
              />
              <AgingPanel agingCp={agingCp} agingCr={agingCr} isDark={isDark} />
            </div>
          </div>
        </>
      )}

      {activeTab === 'movimentacoes' && (
        <MovimentacoesTable
          movimentacoes={movimentacoes}
          isDark={isDark}
          onNovaMovimentacao={() => setShowNovaMovimentacao(true)}
        />
      )}

      {activeTab === 'contas' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {dashboard && <IndicadoresPanel dashboard={dashboard} isDark={isDark} />}
            <div className={`rounded-2xl p-4 ${
              isDark
                ? 'backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] shadow-xl'
                : 'bg-white shadow-sm border border-slate-100'
            }`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Contas e disponibilidade</h3>
                  <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Gestao de contas, saldos e importacao de extrato no mesmo lugar.</p>
                </div>
                <button
                  onClick={() => setShowImportExtrato(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700"
                >
                  <Upload size={13} /> Importar extrato
                </button>
              </div>
              <ContasBancariasPanel
                contas={contas}
                isDark={isDark}
                onNovaConta={() => setShowNovaConta(true)}
                onImportOFX={() => setShowImportExtrato(true)}
              />
            </div>
          </div>
          <AgingPanel agingCp={agingCp} agingCr={agingCr} isDark={isDark} />
        </div>
      )}

      {activeTab === 'conciliacao' && (
        <ConciliacaoPanel movimentacoes={movimentacoes} isDark={isDark} />
      )}

      {activeTab === 'omie' && (
        <OmiePanel isDark={isDark} />
      )}

      {showNovaConta && (
        <NovaContaModal isDark={isDark} onClose={() => setShowNovaConta(false)} />
      )}
      {showNovaMovimentacao && (
        <NovaMovimentacaoModal
          isDark={isDark}
          contas={contas}
          onClose={() => setShowNovaMovimentacao(false)}
        />
      )}
      {showImportExtrato && (
        <ImportExtratoModal
          isDark={isDark}
          contas={contas}
          onClose={() => setShowImportExtrato(false)}
        />
      )}
    </div>
  )
}

function TesourariaHeader({ isDark }: {
  isDark: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className={`flex items-center gap-2 text-xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
          <Landmark size={20} className="text-teal-500" />
          Tesouraria
        </h1>
        <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Cockpit financeiro com disponibilidade, projecao de caixa e operacao rapida.
        </p>
      </div>
    </div>
  )
}
