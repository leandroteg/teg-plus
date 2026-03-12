import { useState, useMemo, useEffect } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  Landmark, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Plus, Upload, Wallet, Building2, CircleDollarSign, Search,
  Filter, X, Calendar, ChevronDown, Eye, FileText, Check,
  AlertTriangle,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Line, ComposedChart,
} from 'recharts'
import {
  useTesourariaDashboard, useCriarContaBancaria, useCriarMovimentacao,
} from '../../hooks/useTesouraria'
import type { TesourariaDashboardData, CategoriaMovimentacao } from '../../types/financeiro'

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

  const canSubmit = form.nome.trim().length > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    criar.mutate(
      { nome: form.nome, banco_nome: form.banco_nome || undefined, agencia: form.agencia || undefined, conta: form.conta || undefined, tipo: form.tipo, cor: form.cor },
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

// ── NovaMovimentacaoModal ───────────────────────────────────────────────────

function NovaMovimentacaoModal({ isDark, contas, onClose }: {
  isDark: boolean
  contas: TesourariaDashboardData['contas']
  onClose: () => void
}) {
  const criar = useCriarMovimentacao()
  const [form, setForm] = useState({
    conta_id: contas[0]?.id ?? '',
    tipo: 'entrada' as 'entrada' | 'saida' | 'transferencia',
    valor: '',
    data_movimentacao: new Date().toISOString().split('T')[0],
    descricao: '',
    categoria: 'outros' as CategoriaMovimentacao,
  })

  const canSubmit = form.conta_id && parseFloat(form.valor) > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    criar.mutate(
      {
        conta_id: form.conta_id,
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
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as any }))}
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

export default function Tesouraria() {
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
