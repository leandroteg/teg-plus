import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import {
  Truck, Package, Search, Plus, X, LayoutGrid, List, CalendarRange,
  CheckCircle2, PauseCircle, Wrench, MapPin, Calendar, Clock,
  AlertTriangle, ChevronDown, ChevronUp, ArrowRight, Send, Filter,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useVeiculos, useAlocacoes, useCriarAlocacao, useSalvarVeiculo } from '../../hooks/useFrotas'
import { useObras } from '../../hooks/useFinanceiro'
import type { FroVeiculo, FroAlocacao, StatusVeiculo, CategoriaVeiculo } from '../../types/frotas'

// ── Constants ───────────────────────────────────────────────────────────────────

const CATEGORIA_LABEL: Record<CategoriaVeiculo, string> = {
  passeio: 'Passeio', pickup: 'Pickup', van: 'Van', vuc: 'VUC',
  truck: 'Truck', carreta: 'Carreta', moto: 'Moto', onibus: 'Onibus',
}

const STATUS_LABEL: Record<StatusVeiculo, { label: string; color: string; bg: string; bgDark: string }> = {
  disponivel:        { label: 'Disponivel',     color: 'text-emerald-600', bg: 'bg-emerald-50', bgDark: 'bg-emerald-500/10' },
  em_uso:            { label: 'Em uso',         color: 'text-blue-600',    bg: 'bg-blue-50',    bgDark: 'bg-blue-500/10' },
  em_manutencao:     { label: 'Manutencao',     color: 'text-amber-600',   bg: 'bg-amber-50',   bgDark: 'bg-amber-500/10' },
  bloqueado:         { label: 'Bloqueado',      color: 'text-rose-600',    bg: 'bg-rose-50',    bgDark: 'bg-rose-500/10' },
  baixado:           { label: 'Baixado',        color: 'text-slate-500',   bg: 'bg-slate-100',  bgDark: 'bg-slate-500/10' },
  em_entrada:        { label: 'Em entrada',     color: 'text-indigo-600',  bg: 'bg-indigo-50',  bgDark: 'bg-indigo-500/10' },
  aguardando_saida:  { label: 'Aguarda saida',  color: 'text-violet-600',  bg: 'bg-violet-50',  bgDark: 'bg-violet-500/10' },
}

type TabKey = 'lista' | 'gantt' | 'kanban'

// ── Helpers ─────────────────────────────────────────────────────────────────────

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }

// ── Main Page ───────────────────────────────────────────────────────────────────

export default function AlocacaoRecursos() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const [tab, setTab] = useState<TabKey>('lista')
  const [novaAlocOpen, setNovaAlocOpen] = useState(false)
  const [novaAlocPreset, setNovaAlocPreset] = useState<{ veiculoId?: string; obraId?: string } | null>(null)

  const { data: veiculos = [], isLoading: loadingVeic } = useVeiculos()
  const { data: alocacoes = [], isLoading: loadingAloc } = useAlocacoes()
  const { data: obras = [] } = useObras()

  // Map: veiculo_id -> alocacao ativa (se houver)
  const alocAtivaByVeic = useMemo(() => {
    const m = new Map<string, FroAlocacao>()
    alocacoes.filter(a => a.status === 'ativa').forEach(a => { m.set(a.veiculo_id, a) })
    return m
  }, [alocacoes])

  const txtMain  = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const handleOpenNova = (preset: { veiculoId?: string; obraId?: string } | null = null) => {
    setNovaAlocPreset(preset)
    setNovaAlocOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className={`text-lg font-bold ${txtMain}`}>Alocacao de Recursos</h1>
          <p className={`text-xs ${txtMuted}`}>
            Frota x Obras — visao integrada com o modulo Frotas
          </p>
        </div>
        <button
          onClick={() => handleOpenNova()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 text-white px-3 py-2 text-xs font-bold hover:bg-orange-600 transition-colors shadow-sm"
        >
          <Plus size={14} /> Nova Alocacao
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className={`inline-flex rounded-xl border p-0.5 ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
        {([
          { k: 'lista',  icon: List,         label: 'Lista' },
          { k: 'gantt',  icon: CalendarRange, label: 'Cronograma' },
          { k: 'kanban', icon: LayoutGrid,   label: 'Kanban' },
        ] as const).map(t => {
          const Icon = t.icon
          const active = tab === t.k
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                active
                  ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-800'
                  : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={13} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* ── Content ── */}
      {loadingVeic || loadingAloc ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === 'lista' && (
            <ListaView
              veiculos={veiculos}
              obras={obras}
              alocAtivaByVeic={alocAtivaByVeic}
              isDark={isDark}
              onAlocar={(veiculoId) => handleOpenNova({ veiculoId })}
            />
          )}
          {tab === 'gantt' && (
            <GanttView
              veiculos={veiculos}
              alocacoes={alocacoes}
              isDark={isDark}
            />
          )}
          {tab === 'kanban' && (
            <KanbanView
              veiculos={veiculos}
              alocacoes={alocacoes}
              obras={obras}
              isDark={isDark}
              onMoveToObra={(veiculoId, obraId) => handleOpenNova({ veiculoId, obraId })}
              onNewObra={() => handleOpenNova()}
            />
          )}
        </>
      )}

      {/* ── Modal Nova Alocação ── */}
      {novaAlocOpen && (
        <NovaAlocacaoModal
          isDark={isDark}
          obras={obras}
          veiculos={veiculos}
          preset={novaAlocPreset}
          onClose={() => { setNovaAlocOpen(false); setNovaAlocPreset(null) }}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// LISTA VIEW
// ══════════════════════════════════════════════════════════════════════════════

function ListaView({
  veiculos, obras, alocAtivaByVeic, isDark, onAlocar,
}: {
  veiculos: FroVeiculo[]
  obras: { id: string; nome: string; codigo: string }[]
  alocAtivaByVeic: Map<string, FroAlocacao>
  isDark: boolean
  onAlocar: (veiculoId: string) => void
}) {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusVeiculo | 'todos'>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaVeiculo | 'todos'>('todos')
  const [filtroObra, setFiltroObra] = useState<'todas' | string>('todas')

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const txtMain  = isDark ? 'text-white' : 'text-slate-800'
  const cardCls  = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'
  const inputCls = `w-full rounded-xl border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-orange-500/30 ${
    isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'bg-white border-slate-200'
  }`

  // KPIs
  const kpis = useMemo(() => {
    const total        = veiculos.length
    const emUso        = veiculos.filter(v => v.status === 'em_uso').length
    const disponivel   = veiculos.filter(v => v.status === 'disponivel').length
    const manutencao   = veiculos.filter(v => v.status === 'em_manutencao').length
    return { total, emUso, disponivel, manutencao }
  }, [veiculos])

  // Filter
  const filtered = useMemo(() => {
    let list = veiculos
    if (busca) {
      const q = busca.toLowerCase()
      list = list.filter(v =>
        v.placa?.toLowerCase().includes(q) ||
        v.marca?.toLowerCase().includes(q) ||
        v.modelo?.toLowerCase().includes(q) ||
        v.numero_serie?.toLowerCase().includes(q)
      )
    }
    if (filtroStatus !== 'todos')    list = list.filter(v => v.status === filtroStatus)
    if (filtroCategoria !== 'todos') list = list.filter(v => v.categoria === filtroCategoria)
    if (filtroObra !== 'todas') {
      list = list.filter(v => alocAtivaByVeic.get(v.id)?.obra_id === filtroObra)
    }
    return list
  }, [veiculos, busca, filtroStatus, filtroCategoria, filtroObra, alocAtivaByVeic])

  // Group by obra for the "por canteiro" view
  const porObra = useMemo(() => {
    const map = new Map<string, { obraNome: string; veiculos: FroVeiculo[] }>()
    const semObra: FroVeiculo[] = []
    veiculos.forEach(v => {
      const aloc = alocAtivaByVeic.get(v.id)
      if (aloc?.obra?.nome) {
        const key = aloc.obra_id || 'sem'
        const current = map.get(key) || { obraNome: aloc.obra.nome, veiculos: [] }
        current.veiculos.push(v)
        map.set(key, current)
      } else {
        semObra.push(v)
      }
    })
    const arr = Array.from(map.entries()).map(([k, v]) => ({ obraId: k, ...v }))
    arr.sort((a, b) => a.obraNome.localeCompare(b.obraNome))
    return { porObra: arr, semObra }
  }, [veiculos, alocAtivaByVeic])

  return (
    <div className="space-y-4">
      {/* KPI summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiCard isDark={isDark} icon={Truck}         label="Total"       value={kpis.total}      color="slate"  onClick={() => setFiltroStatus('todos')}        active={filtroStatus === 'todos'} />
        <KpiCard isDark={isDark} icon={CheckCircle2}  label="Em uso"      value={kpis.emUso}      color="blue"   onClick={() => setFiltroStatus('em_uso')}       active={filtroStatus === 'em_uso'} />
        <KpiCard isDark={isDark} icon={PauseCircle}   label="Disponivel"  value={kpis.disponivel} color="emerald" onClick={() => setFiltroStatus('disponivel')} active={filtroStatus === 'disponivel'} />
        <KpiCard isDark={isDark} icon={Wrench}        label="Manutencao"  value={kpis.manutencao} color="amber"  onClick={() => setFiltroStatus('em_manutencao')} active={filtroStatus === 'em_manutencao'} />
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Placa, modelo, serie..."
            className={`${inputCls} pl-8 pr-7`}
          />
          {busca && (
            <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          )}
        </div>
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value as CategoriaVeiculo | 'todos')} className={`${inputCls} max-w-[140px]`}>
          <option value="todos">Todos os tipos</option>
          {Object.entries(CATEGORIA_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} className={`${inputCls} max-w-[160px]`}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <span className={`ml-auto text-[11px] ${txtMuted}`}>{filtered.length} resultado(s)</span>
      </div>

      {/* Table */}
      <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={isDark ? 'bg-white/[0.02] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">TIPO</th>
                <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">IDENTIFICACAO</th>
                <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">MARCA / MODELO</th>
                <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">ANO</th>
                <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">COR</th>
                <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">STATUS</th>
                <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">OBRA ATUAL</th>
                <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">ACAO</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className={`text-center py-8 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Nenhum equipamento encontrado</td></tr>
              ) : filtered.map(v => {
                const aloc = alocAtivaByVeic.get(v.id)
                const stCfg = STATUS_LABEL[v.status]
                return (
                  <tr key={v.id} className={isDark ? 'border-b border-white/[0.04] hover:bg-white/[0.04]' : 'border-b border-slate-100 hover:bg-slate-50'}>
                    <td className={`px-3 py-2.5 font-semibold ${txtMain}`}>{CATEGORIA_LABEL[v.categoria]}</td>
                    <td className={`px-3 py-2.5 font-mono ${txtMain}`}>{v.placa || v.numero_serie || '—'}</td>
                    <td className={`px-3 py-2.5 ${txtMain}`}>{v.marca} {v.modelo}</td>
                    <td className={`px-3 py-2.5 ${txtMuted}`}>{v.ano_fab || '—'}</td>
                    <td className={`px-3 py-2.5 ${txtMuted}`}>{v.cor || '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isDark ? `${stCfg.bgDark} ${stCfg.color}` : `${stCfg.bg} ${stCfg.color}`
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${stCfg.color.replace('text-', 'bg-')}`} />
                        {stCfg.label}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 ${txtMuted}`}>{aloc?.obra?.nome || '—'}</td>
                    <td className="px-3 py-2.5 text-right">
                      {v.status === 'disponivel' ? (
                        <button
                          onClick={() => onAlocar(v.id)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                        >
                          <Send size={10} /> Alocar
                        </button>
                      ) : (
                        <span className={`text-[10px] ${txtMuted}`}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribuição por canteiro */}
      {porObra.porObra.length > 0 && (
        <div>
          <h3 className={`text-sm font-bold mb-2 ${txtMain}`}>Distribuicao por canteiro</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {porObra.porObra.map(grp => (
              <div key={grp.obraId} className={`rounded-xl border p-3 ${cardCls}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-[12px] font-bold truncate ${txtMain}`}>{grp.obraNome}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-orange-500/15 text-orange-300' : 'bg-orange-50 text-orange-600'}`}>
                    {grp.veiculos.length}
                  </span>
                </div>
                <ul className={`space-y-0.5 text-[11px] ${txtMuted}`}>
                  {grp.veiculos.slice(0, 5).map(v => (
                    <li key={v.id} className="truncate">
                      • {CATEGORIA_LABEL[v.categoria]} — <span className="font-mono">{v.placa || v.numero_serie}</span>
                    </li>
                  ))}
                  {grp.veiculos.length > 5 && <li className="text-[10px] italic opacity-70">+ {grp.veiculos.length - 5} mais...</li>}
                </ul>
              </div>
            ))}
            {porObra.semObra.length > 0 && (
              <div className={`rounded-xl border border-dashed p-3 ${isDark ? 'border-white/10' : 'border-slate-300'}`}>
                <p className={`text-[12px] font-bold mb-2 ${txtMuted}`}>Sem obra ({porObra.semObra.length})</p>
                <p className={`text-[10px] ${txtMuted}`}>Disponiveis para alocacao</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ isDark, icon: Icon, label, value, color, onClick, active }: {
  isDark: boolean
  icon: typeof Truck
  label: string
  value: number
  color: 'slate' | 'blue' | 'emerald' | 'amber'
  onClick: () => void
  active?: boolean
}) {
  const colorMap = {
    slate:   { text: 'text-slate-600',   textDark: 'text-slate-400',   bg: 'bg-slate-50',   bgDark: 'bg-slate-500/10' },
    blue:    { text: 'text-blue-600',    textDark: 'text-blue-300',    bg: 'bg-blue-50',    bgDark: 'bg-blue-500/10' },
    emerald: { text: 'text-emerald-600', textDark: 'text-emerald-300', bg: 'bg-emerald-50', bgDark: 'bg-emerald-500/10' },
    amber:   { text: 'text-amber-600',   textDark: 'text-amber-300',   bg: 'bg-amber-50',   bgDark: 'bg-amber-500/10' },
  }
  const clr = colorMap[color]
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-all ${
        active
          ? isDark ? `${clr.bgDark} border-white/[0.12]` : `${clr.bg} border-slate-300 shadow-sm`
          : isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <Icon size={14} className={isDark ? clr.textDark : clr.text} strokeWidth={2.2} />
        <span className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{value}</span>
      </div>
      <p className={`text-[10px] font-semibold ${isDark ? clr.textDark : clr.text}`}>{label}</p>
    </button>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// GANTT VIEW
// ══════════════════════════════════════════════════════════════════════════════

function GanttView({
  veiculos, alocacoes, isDark,
}: {
  veiculos: FroVeiculo[]
  alocacoes: FroAlocacao[]
  isDark: boolean
}) {
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaVeiculo | 'todos'>('todos')
  const [sortBy, setSortBy] = useState<'tipo' | 'data_inicio' | 'data_fim' | 'obra'>('data_inicio')
  const [expanded, setExpanded] = useState(true)

  const veicById = useMemo(() => {
    const m = new Map<string, FroVeiculo>()
    veiculos.forEach(v => m.set(v.id, v))
    return m
  }, [veiculos])

  const rows = useMemo(() => {
    const list = alocacoes.filter(a => a.status === 'ativa' || a.status === 'encerrada')
      .map(a => ({ aloc: a, veic: veicById.get(a.veiculo_id) }))
      .filter(r => !!r.veic) as { aloc: FroAlocacao; veic: FroVeiculo }[]

    let out = filtroCategoria === 'todos' ? list : list.filter(r => r.veic.categoria === filtroCategoria)

    out.sort((a, b) => {
      switch (sortBy) {
        case 'tipo':        return CATEGORIA_LABEL[a.veic.categoria].localeCompare(CATEGORIA_LABEL[b.veic.categoria])
        case 'data_inicio': return new Date(a.aloc.data_saida).getTime() - new Date(b.aloc.data_saida).getTime()
        case 'data_fim':    return new Date(a.aloc.data_retorno_prev || a.aloc.data_saida).getTime() - new Date(b.aloc.data_retorno_prev || b.aloc.data_saida).getTime()
        case 'obra':        return (a.aloc.obra?.nome || '').localeCompare(b.aloc.obra?.nome || '')
      }
    })
    return out
  }, [alocacoes, veicById, filtroCategoria, sortBy])

  // Timeline window: min data_saida → max data_retorno_prev (ou +60d se ativa sem fim)
  const window = useMemo(() => {
    if (rows.length === 0) {
      const now = new Date()
      return { start: addDays(now, -7), end: addDays(now, 60) }
    }
    const starts = rows.map(r => new Date(r.aloc.data_saida))
    const ends = rows.map(r => new Date(r.aloc.data_retorno_real || r.aloc.data_retorno_prev || addDays(new Date(), 30).toISOString()))
    const min = new Date(Math.min(...starts.map(d => d.getTime())))
    const max = new Date(Math.max(...ends.map(d => d.getTime())))
    return {
      start: addDays(min, -2),
      end: addDays(max, 2),
    }
  }, [rows])

  const totalDays = daysBetween(window.start, window.end) || 1
  const today = new Date()
  const todayOffset = daysBetween(window.start, today)
  const todayPct = Math.max(0, Math.min(100, (todayOffset / totalDays) * 100))

  const txtMain  = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const border   = isDark ? 'border-white/[0.06]' : 'border-slate-200'

  // Generate month labels
  const monthLabels = useMemo(() => {
    const labels: { label: string; pct: number }[] = []
    const cursor = new Date(window.start.getFullYear(), window.start.getMonth(), 1)
    while (cursor <= window.end) {
      const offset = daysBetween(window.start, cursor)
      labels.push({
        label: cursor.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        pct: (offset / totalDays) * 100,
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return labels
  }, [window, totalDays])

  return (
    <div className="space-y-3">
      {/* Header controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setExpanded(e => !e)}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
            isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? 'Recolher' : 'Expandir'}
        </button>

        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
          isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'bg-white border-slate-200'
        }`}>
          <option value="tipo">Ordenar: Tipo</option>
          <option value="data_inicio">Ordenar: Inicio</option>
          <option value="data_fim">Ordenar: Termino</option>
          <option value="obra">Ordenar: Canteiro</option>
        </select>

        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value as CategoriaVeiculo | 'todos')} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
          isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'bg-white border-slate-200'
        }`}>
          <option value="todos">Todos os tipos</option>
          {Object.entries(CATEGORIA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <span className={`ml-auto text-[11px] ${txtMuted}`}>{rows.length} alocacoes</span>
      </div>

      {/* Gantt */}
      <div className={`rounded-xl border overflow-hidden ${border}`}>
        {/* Month header */}
        <div className={`flex items-center border-b ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
          <div className={`w-[240px] shrink-0 px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Equipamento / Obra</div>
          <div className="flex-1 relative h-8">
            {monthLabels.map((m, i) => (
              <div key={i} className={`absolute top-0 bottom-0 flex items-center text-[10px] font-semibold ${txtMuted} border-l ${border}`} style={{ left: `${m.pct}%`, paddingLeft: '4px' }}>
                {m.label}
              </div>
            ))}
            {/* Today line */}
            <div className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-10 pointer-events-none" style={{ left: `${todayPct}%` }}>
              <div className="absolute -top-0.5 -translate-x-1/2 text-[9px] font-bold text-red-500 whitespace-nowrap">hoje</div>
            </div>
          </div>
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div className={`text-center py-12 ${txtMuted}`}>
            <CalendarRange size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">Nenhuma alocacao cadastrada</p>
          </div>
        ) : expanded && rows.map(r => {
          const start = new Date(r.aloc.data_saida)
          const end = new Date(r.aloc.data_retorno_real || r.aloc.data_retorno_prev || addDays(new Date(), 30).toISOString())
          const startOffset = daysBetween(window.start, start)
          const duration = Math.max(1, daysBetween(start, end))
          const leftPct = (startOffset / totalDays) * 100
          const widthPct = Math.max(1, (duration / totalDays) * 100)

          const isEncerrada = r.aloc.status === 'encerrada'
          const isLate = !isEncerrada && r.aloc.data_retorno_prev && new Date(r.aloc.data_retorno_prev) < today
          const isNearEnd = !isEncerrada && !isLate && r.aloc.data_retorno_prev &&
            daysBetween(today, new Date(r.aloc.data_retorno_prev)) <= 7

          const barColor = isEncerrada
            ? 'bg-slate-400'
            : isLate
              ? 'bg-red-500'
              : isNearEnd
                ? 'bg-amber-500'
                : 'bg-emerald-500'

          return (
            <div key={r.aloc.id} className={`flex items-center border-b ${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-slate-100 hover:bg-slate-50'}`}>
              <div className="w-[240px] shrink-0 px-3 py-2">
                <p className={`text-xs font-bold truncate ${txtMain}`}>
                  {CATEGORIA_LABEL[r.veic.categoria]} · <span className="font-mono text-[10px]">{r.veic.placa || r.veic.numero_serie}</span>
                </p>
                <p className={`text-[10px] truncate ${txtMuted}`}>{r.aloc.obra?.nome || 'Sem obra'}</p>
              </div>
              <div className="flex-1 relative h-10">
                {/* Today line repeated in each row */}
                <div className="absolute top-0 bottom-0 w-[1px] bg-red-500/40 pointer-events-none" style={{ left: `${todayPct}%` }} />
                {/* Bar */}
                <div
                  className={`absolute top-1/2 -translate-y-1/2 h-5 rounded ${barColor} shadow-sm text-white text-[9px] font-bold flex items-center px-1.5 overflow-hidden`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: 12 }}
                  title={`${fmtDate(r.aloc.data_saida)} - ${fmtDate(r.aloc.data_retorno_prev)} · ${r.aloc.obra?.nome || ''}`}
                >
                  {widthPct > 8 && (
                    <>
                      {fmtDate(r.aloc.data_saida)}
                      {widthPct > 20 && (
                        <>
                          <ArrowRight size={9} className="mx-1 opacity-60" />
                          {fmtDate(r.aloc.data_retorno_prev)}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className={`flex flex-wrap gap-3 text-[10px] ${txtMuted}`}>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded bg-emerald-500" /> Em andamento</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded bg-amber-500" /> Proximo do termino</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded bg-red-500" /> Atrasado</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded bg-slate-400" /> Concluido</span>
        <span className="inline-flex items-center gap-1"><span className="w-[2px] h-3 bg-red-500" /> Dia atual</span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// KANBAN VIEW
// ══════════════════════════════════════════════════════════════════════════════

function KanbanView({
  veiculos, alocacoes, obras, isDark, onMoveToObra, onNewObra,
}: {
  veiculos: FroVeiculo[]
  alocacoes: FroAlocacao[]
  obras: { id: string; nome: string; codigo: string }[]
  isDark: boolean
  onMoveToObra: (veiculoId: string, obraId: string) => void
  onNewObra: () => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [filtroOpen, setFiltroOpen] = useState(false)
  const [obrasSelecionadas, setObrasSelecionadas] = useState<Set<string>>(
    () => new Set(['pool', ...obras.map(o => o.id)])
  )
  const [buscaObra, setBuscaObra] = useState('')
  const topScrollRef = useRef<HTMLDivElement | null>(null)
  const mainScrollRef = useRef<HTMLDivElement | null>(null)

  // Sincroniza scroll superior <-> inferior
  useEffect(() => {
    const top = topScrollRef.current
    const main = mainScrollRef.current
    if (!top || !main) return
    let syncing = false
    const onTop = () => {
      if (syncing) return
      syncing = true; main.scrollLeft = top.scrollLeft
      requestAnimationFrame(() => syncing = false)
    }
    const onMain = () => {
      if (syncing) return
      syncing = true; top.scrollLeft = main.scrollLeft
      requestAnimationFrame(() => syncing = false)
    }
    top.addEventListener('scroll', onTop)
    main.addEventListener('scroll', onMain)
    return () => { top.removeEventListener('scroll', onTop); main.removeEventListener('scroll', onMain) }
  }, [])

  // Atualiza selecao quando obras mudam
  useEffect(() => {
    setObrasSelecionadas(prev => {
      if (prev.size === 0) return new Set(['pool', ...obras.map(o => o.id)])
      return prev
    })
  }, [obras])

  const alocAtivaByVeic = useMemo(() => {
    const m = new Map<string, FroAlocacao>()
    alocacoes.filter(a => a.status === 'ativa').forEach(a => m.set(a.veiculo_id, a))
    return m
  }, [alocacoes])

  // Group veiculos by current obra
  const columns = useMemo(() => {
    const cols: Array<{ id: string; name: string; veiculos: FroVeiculo[] }> = []
    cols.push({
      id: 'pool',
      name: 'Disponiveis',
      veiculos: veiculos.filter(v => !alocAtivaByVeic.get(v.id) && v.status !== 'baixado'),
    })
    obras.forEach(o => {
      cols.push({
        id: o.id,
        name: o.nome,
        veiculos: veiculos.filter(v => alocAtivaByVeic.get(v.id)?.obra_id === o.id),
      })
    })
    return cols
  }, [veiculos, obras, alocAtivaByVeic])

  // Colunas visiveis apos filtro
  const visibleColumns = useMemo(() => {
    return columns.filter(c => obrasSelecionadas.has(c.id))
  }, [columns, obrasSelecionadas])

  // Largura total do conteudo pra sincronizar a barra superior
  const contentWidth = (visibleColumns.length * (280 + 12)) + 212 // cols + gap + "nova alocacao"

  const txtMain  = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const onDragStart = (veiculoId: string) => setDragId(veiculoId)
  const onDragEnd = () => setDragId(null)

  const onDropToObra = useCallback((obraId: string) => {
    if (!dragId) return
    if (obraId === 'pool') {
      alert('Para liberar do canteiro, va em Frotas > Operacao > Encerrar alocacao.')
      return
    }
    const aloc = alocAtivaByVeic.get(dragId)
    if (aloc && aloc.obra_id === obraId) return
    onMoveToObra(dragId, obraId)
    setDragId(null)
  }, [dragId, onMoveToObra, alocAtivaByVeic])

  const toggleObra = (id: string) => {
    setObrasSelecionadas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selecionarTodas = () => setObrasSelecionadas(new Set(['pool', ...obras.map(o => o.id)]))
  const limparSelecao = () => setObrasSelecionadas(new Set())

  const obrasFiltradas = useMemo(() => {
    if (!buscaObra) return obras
    const q = buscaObra.toLowerCase()
    return obras.filter(o => o.nome.toLowerCase().includes(q) || o.codigo?.toLowerCase().includes(q))
  }, [obras, buscaObra])

  return (
    <div className="space-y-2">
      {/* Controles: filtro + barra superior */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className={`flex items-center gap-2 text-[11px] ${txtMuted}`}>
          <AlertTriangle size={12} />
          Arraste um equipamento para outro canteiro para criar uma alocacao.
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] ${txtMuted}`}>
            {visibleColumns.length} / {columns.length} canteiros
          </span>
          <div className="relative">
            <button
              onClick={() => setFiltroOpen(o => !o)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                isDark ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 hover:bg-white/[0.08]' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Filter size={13} /> Filtrar obras
              {obrasSelecionadas.size < columns.length && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[9px] font-bold">
                  {obrasSelecionadas.size}
                </span>
              )}
            </button>
            {filtroOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFiltroOpen(false)} />
                <div className={`absolute right-0 mt-1 w-[280px] max-h-[480px] rounded-xl border shadow-xl z-50 overflow-hidden ${
                  isDark ? 'bg-[#0f172a] border-white/[0.1]' : 'bg-white border-slate-200'
                }`}>
                  <div className={`px-3 py-2 border-b flex items-center justify-between ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                    <p className={`text-xs font-bold ${txtMain}`}>Obras visiveis</p>
                    <div className="flex gap-1">
                      <button onClick={selecionarTodas} className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${isDark ? 'bg-white/[0.08] text-slate-300 hover:bg-white/[0.12]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Todas</button>
                      <button onClick={limparSelecao} className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${isDark ? 'bg-white/[0.08] text-slate-300 hover:bg-white/[0.12]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Nenhuma</button>
                    </div>
                  </div>
                  <div className={`px-3 py-2 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                    <div className="relative">
                      <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={buscaObra}
                        onChange={e => setBuscaObra(e.target.value)}
                        placeholder="Buscar obra..."
                        className={`w-full pl-6 pr-2 py-1.5 rounded-lg text-xs outline-none focus:ring-2 focus:ring-orange-500/30 ${
                          isDark ? 'bg-white/[0.04] border border-white/[0.06] text-slate-200' : 'bg-slate-50 border border-slate-200'
                        }`}
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-[320px]">
                    <label className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'}`}>
                      <input type="checkbox" checked={obrasSelecionadas.has('pool')} onChange={() => toggleObra('pool')} className="accent-orange-500" />
                      <span className={`text-xs font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>Disponiveis</span>
                      <span className={`ml-auto text-[10px] ${txtMuted}`}>{columns[0]?.veiculos.length || 0}</span>
                    </label>
                    {obrasFiltradas.map(o => {
                      const col = columns.find(c => c.id === o.id)
                      return (
                        <label key={o.id} className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={obrasSelecionadas.has(o.id)} onChange={() => toggleObra(o.id)} className="accent-orange-500" />
                          <span className={`text-xs truncate ${txtMain}`} title={o.nome}>{o.nome}</span>
                          <span className={`ml-auto text-[10px] ${txtMuted}`}>{col?.veiculos.length || 0}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Barra de rolagem superior - sincronizada */}
      <div ref={topScrollRef} className="overflow-x-auto overflow-y-hidden h-[14px] styled-scrollbar">
        <div style={{ width: `${contentWidth}px`, height: 1 }} />
      </div>

      <div ref={mainScrollRef} className="flex gap-3 overflow-x-auto pb-3 styled-scrollbar">
        {visibleColumns.map(col => (
          <div
            key={col.id}
            onDragOver={e => { e.preventDefault() }}
            onDrop={() => onDropToObra(col.id)}
            className={`shrink-0 w-[280px] rounded-2xl border p-3 ${
              dragId ? (isDark ? 'bg-orange-500/5 border-orange-500/30' : 'bg-orange-50/40 border-orange-300') :
              isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className={`text-[12px] font-extrabold uppercase tracking-wider truncate ${txtMain}`}>{col.name}</p>
              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                col.id === 'pool'
                  ? isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-600'
                  : isDark ? 'bg-orange-500/15 text-orange-300' : 'bg-orange-50 text-orange-600'
              }`}>{col.veiculos.length}</span>
            </div>

            <div className="space-y-2 min-h-[60px]">
              {col.veiculos.length === 0 ? (
                <div className={`text-center py-6 text-[10px] rounded-lg border border-dashed ${isDark ? 'border-white/10 text-slate-600' : 'border-slate-300 text-slate-400'}`}>
                  Solte aqui
                </div>
              ) : col.veiculos.map(v => {
                const aloc = alocAtivaByVeic.get(v.id)
                return (
                  <VeiculoKanbanCard
                    key={v.id}
                    veiculo={v}
                    aloc={aloc}
                    isDark={isDark}
                    isDragging={dragId === v.id}
                    onDragStart={() => onDragStart(v.id)}
                    onDragEnd={onDragEnd}
                  />
                )
              })}
            </div>
          </div>
        ))}

        {/* Add new column placeholder */}
        <button
          onClick={onNewObra}
          className={`shrink-0 w-[200px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 text-xs font-semibold py-16 transition-colors ${
            isDark ? 'border-white/10 text-slate-500 hover:border-orange-400/50 hover:text-orange-300' : 'border-slate-300 text-slate-400 hover:border-orange-400 hover:text-orange-600'
          }`}
        >
          <Plus size={16} />
          Nova alocacao
        </button>
      </div>
    </div>
  )
}

function VeiculoKanbanCard({ veiculo: v, aloc, isDark, isDragging, onDragStart, onDragEnd }: {
  veiculo: FroVeiculo
  aloc?: FroAlocacao
  isDark: boolean
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const stCfg = STATUS_LABEL[v.status]
  const cardCls = isDark
    ? 'bg-[#111827] border-white/[0.08] hover:border-white/[0.14]'
    : 'bg-white border-slate-200 hover:shadow-md'

  // Progress %
  const today = new Date()
  let progress = 0
  let diasRest: number | null = null
  if (aloc?.data_saida && aloc.data_retorno_prev) {
    const start = new Date(aloc.data_saida)
    const end = new Date(aloc.data_retorno_prev)
    const total = Math.max(1, daysBetween(start, end))
    const past = Math.max(0, Math.min(total, daysBetween(start, today)))
    progress = (past / total) * 100
    diasRest = daysBetween(today, end)
  }
  const atrasado = diasRest !== null && diasRest < 0
  const proxFim = diasRest !== null && diasRest >= 0 && diasRest <= 7

  const txtMain  = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-500' : 'text-slate-400'

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`rounded-xl border p-2.5 cursor-grab active:cursor-grabbing transition-all ${cardCls} ${isDragging ? 'opacity-40 scale-95' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>{CATEGORIA_LABEL[v.categoria]}</span>
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
          isDark ? `${stCfg.bgDark} ${stCfg.color}` : `${stCfg.bg} ${stCfg.color}`
        }`}>
          <span className={`w-1 h-1 rounded-full ${stCfg.color.replace('text-', 'bg-')}`} />
          {stCfg.label}
        </span>
      </div>

      <p className={`text-xs font-extrabold ${txtMain} truncate`}>{v.marca} {v.modelo}</p>
      <p className={`text-[10px] font-mono mt-0.5 ${txtMuted}`}>{v.placa || v.numero_serie || '—'}</p>

      {aloc?.data_saida && (
        <div className="mt-2 space-y-1">
          <div className={`flex items-center justify-between text-[10px] ${txtMuted}`}>
            <span className="inline-flex items-center gap-1"><Calendar size={9} /> {fmtDate(aloc.data_saida)}</span>
            <span className="inline-flex items-center gap-1">→ {fmtDate(aloc.data_retorno_prev)}</span>
          </div>

          {aloc.data_retorno_prev && (
            <div className={`h-1 w-full rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
              <div
                className={`h-full ${atrasado ? 'bg-red-500' : proxFim ? 'bg-amber-500' : 'bg-emerald-500'} transition-all`}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          )}

          {diasRest !== null && (
            <p className={`text-[9px] font-semibold ${atrasado ? 'text-red-500' : proxFim ? 'text-amber-600' : txtMuted}`}>
              {atrasado
                ? <><AlertTriangle size={8} className="inline mr-0.5" />{Math.abs(diasRest)}d atrasado</>
                : proxFim
                  ? <><Clock size={8} className="inline mr-0.5" />{diasRest}d restantes</>
                  : <>{diasRest}d restantes</>
              }
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// NOVA ALOCAÇÃO MODAL
// ══════════════════════════════════════════════════════════════════════════════

function NovaAlocacaoModal({ isDark, obras, veiculos, preset, onClose }: {
  isDark: boolean
  obras: { id: string; nome: string; codigo: string }[]
  veiculos: FroVeiculo[]
  preset: { veiculoId?: string; obraId?: string } | null
  onClose: () => void
}) {
  const { perfil } = useAuth()
  const criar = useCriarAlocacao()
  const salvarVeiculo = useSalvarVeiculo()

  const [veiculoId, setVeiculoId]       = useState(preset?.veiculoId || '')
  const [obraId, setObraId]             = useState(preset?.obraId || '')
  const [dataSaida, setDataSaida]       = useState(new Date().toISOString().split('T')[0])
  const [dataRetornoPrev, setDataRetornoPrev] = useState('')
  const [observacoes, setObservacoes]   = useState('')

  const disponiveis = useMemo(() =>
    veiculos.filter(v => v.status === 'disponivel' || v.id === veiculoId),
    [veiculos, veiculoId])

  const inputCls = `w-full rounded-xl border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-orange-500/30 ${
    isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'bg-white border-slate-200'
  }`
  const labelCls = `text-[10px] font-bold uppercase tracking-wider block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`

  const busy = criar.isPending || salvarVeiculo.isPending

  const handleSave = async () => {
    if (!veiculoId || !obraId || !dataSaida) {
      alert('Selecione equipamento, obra e data de saida')
      return
    }
    try {
      // 1. Cria a alocacao em fro_alocacoes (status: ativa)
      await criar.mutateAsync({
        veiculo_id: veiculoId,
        obra_id: obraId,
        data_saida: dataSaida,
        data_retorno_prev: dataRetornoPrev || undefined,
        responsavel_id: perfil?.auth_id,
        responsavel_nome: perfil?.nome,
        status: 'ativa',
        observacoes: observacoes || undefined,
      } as never)

      // 2. Muda status do veiculo para 'aguardando_saida' → gera
      //    pendencia na aba "Checklist Saida" do modulo Frotas
      await salvarVeiculo.mutateAsync({
        id: veiculoId,
        status: 'aguardando_saida',
      })

      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      alert('Erro ao criar alocacao: ' + msg)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className={`relative w-full max-w-lg rounded-2xl border overflow-hidden shadow-2xl ${
          isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'
        }`}
      >
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-orange-500/15' : 'bg-orange-50'}`}>
              <Package size={15} className="text-orange-500" />
            </div>
            <div>
              <p className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Nova Alocacao</p>
              <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Sera criada no modulo Frotas</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className={labelCls}>Equipamento *</label>
            <select value={veiculoId} onChange={e => setVeiculoId(e.target.value)} className={inputCls}>
              <option value="">Selecione...</option>
              {disponiveis.map(v => (
                <option key={v.id} value={v.id}>
                  {CATEGORIA_LABEL[v.categoria]} — {v.placa || v.numero_serie || ''} · {v.marca} {v.modelo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Obra (canteiro) *</label>
            <select value={obraId} onChange={e => setObraId(e.target.value)} className={inputCls}>
              <option value="">Selecione...</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data saida *</label>
              <input type="date" value={dataSaida} onChange={e => setDataSaida(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Retorno previsto</label>
              <input type="date" value={dataRetornoPrev} onChange={e => setDataRetornoPrev(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Observacoes</label>
            <textarea rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} className={inputCls} placeholder="Notas sobre a alocacao..." />
          </div>

          <div className={`rounded-lg p-2.5 text-[10px] ${isDark ? 'bg-orange-500/10 text-orange-300' : 'bg-orange-50 text-orange-700'}`}>
            <MapPin size={10} className="inline mr-1" />
            Um <strong>checklist de saida pendente</strong> sera gerado em <strong>Frotas &gt; Frota &gt; Checklist Saida</strong>. O equipamento so fica "em uso" apos o checklist ser preenchido.
          </div>
        </div>

        <div className={`flex justify-end gap-2 px-5 py-3 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <button onClick={onClose} className={`px-3 py-2 rounded-xl text-xs font-semibold ${isDark ? 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {busy ? 'Salvando...' : (<><Send size={12} /> Criar alocacao</>)}
          </button>
        </div>
      </div>
    </div>
  )
}
