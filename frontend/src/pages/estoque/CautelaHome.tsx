import { useState, useMemo } from 'react'
import {
  Search, X, HandHelping, Package2, AlertTriangle, Clock,
  LayoutList, LayoutGrid, ArrowUp, ArrowDown, Plus,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useCautelas, useMinhasCautelas, useCautelaKPIs } from '../../hooks/useCautelas'
import CautelaCard from '../../components/cautela/CautelaCard'
import type { Cautela, StatusCautela } from '../../types/cautela'

type Tab = 'minhas' | 'equipe' | 'historico'
type SortField = 'data' | 'status' | 'obra'
type SortDir = 'asc' | 'desc'
type ViewMode = 'list' | 'cards'

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'data',   label: 'Data' },
  { field: 'status', label: 'Status' },
  { field: 'obra',   label: 'Obra' },
]

const ACTIVE_STATUSES: StatusCautela[] = [
  'rascunho', 'pendente_aprovacao', 'aprovada', 'em_separacao', 'retirada', 'parcial_devolvida',
]
const HISTORY_STATUSES: StatusCautela[] = ['devolvida', 'vencida', 'cancelada']

export default function CautelaHome() {
  const { isLight } = useTheme()
  const isDark = !isLight
  const { perfil } = useAuth()
  const userId = perfil?.id

  const [tab, setTab] = useState<Tab>('minhas')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  // Data fetching
  const { data: minhas = [], isLoading: loadMinhas } = useMinhasCautelas(userId)
  const { data: todas = [], isLoading: loadTodas } = useCautelas()
  const { data: kpis } = useCautelaKPIs(userId)

  // Derived lists
  const equipe = useMemo(() =>
    todas.filter(c => ACTIVE_STATUSES.includes(c.status)),
    [todas]
  )
  const historico = useMemo(() =>
    todas.filter(c => HISTORY_STATUSES.includes(c.status)),
    [todas]
  )

  const currentList = tab === 'minhas' ? minhas : tab === 'equipe' ? equipe : historico
  const isLoading = tab === 'minhas' ? loadMinhas : loadTodas

  // Search + sort
  const filtered = useMemo(() => {
    let list = [...currentList]
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(c =>
        (c.numero ?? '').toLowerCase().includes(s) ||
        (c.obra_nome ?? '').toLowerCase().includes(s) ||
        (c.solicitante_nome ?? '').toLowerCase().includes(s) ||
        c.itens?.some(i =>
          (i.item?.descricao ?? '').toLowerCase().includes(s) ||
          (i.descricao_livre ?? '').toLowerCase().includes(s)
        )
      )
    }
    list.sort((a, b) => {
      let cmp = 0
      if (sortField === 'data') cmp = (a.criado_em ?? '').localeCompare(b.criado_em ?? '')
      if (sortField === 'status') cmp = (a.status ?? '').localeCompare(b.status ?? '')
      if (sortField === 'obra') cmp = (a.obra_nome ?? '').localeCompare(b.obra_nome ?? '')
      return sortDir === 'desc' ? -cmp : cmp
    })
    return list
  }, [currentList, search, sortField, sortDir])

  // Styles
  const bg = isDark ? 'bg-[#0f172a]' : 'bg-slate-50'
  const cardBg = isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-white border-slate-200'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputBg = isDark ? 'bg-white/[0.06] text-white placeholder:text-slate-500 border-white/[0.08]' : 'bg-white text-slate-800 placeholder:text-slate-400 border-slate-200'

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  return (
    <div className={`min-h-screen ${bg} pb-24`}>
      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-4">

        {/* ── KPI Cards ── */}
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          <KPICard
            label="Itens comigo"
            value={kpis?.itens_comigo ?? 0}
            color="teal"
            icon={Package2}
            isDark={isDark}
          />
          <KPICard
            label="Vencidas"
            value={kpis?.vencidas ?? 0}
            color="red"
            icon={AlertTriangle}
            isDark={isDark}
            pulse={!!kpis?.vencidas && kpis.vencidas > 0}
          />
          <KPICard
            label="Devolver hoje"
            value={kpis?.devolver_hoje ?? 0}
            color="amber"
            icon={Clock}
            isDark={isDark}
          />
        </div>

        {/* ── Tabs ── */}
        <div className={`flex rounded-xl border p-1 ${isDark ? 'border-white/[0.08] bg-white/[0.03]' : 'border-slate-200 bg-slate-100'}`}>
          {([
            { key: 'minhas' as Tab, label: 'Minhas', count: minhas.length },
            { key: 'equipe' as Tab, label: 'Equipe', count: equipe.length },
            { key: 'historico' as Tab, label: 'Historico', count: historico.length },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 text-center py-2 rounded-lg text-xs font-semibold transition-all ${
                tab === t.key
                  ? isDark
                    ? 'bg-teal-500/20 text-teal-300'
                    : 'bg-white text-teal-700 shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-300'
                    : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                  tab === t.key
                    ? isDark ? 'bg-teal-500/30 text-teal-200' : 'bg-teal-100 text-teal-700'
                    : isDark ? 'bg-white/[0.08] text-slate-400' : 'bg-slate-200 text-slate-600'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Search + Sort + View ── */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${txtMuted}`} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar cautela..."
              className={`w-full pl-9 pr-8 py-2 rounded-lg border text-xs ${inputBg}`}
            />
            {search && (
              <button onClick={() => setSearch('')} className={`absolute right-2 top-1/2 -translate-y-1/2 ${txtMuted}`}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.field}
                onClick={() => toggleSort(opt.field)}
                className={`text-[10px] font-medium px-2 py-1.5 rounded-lg flex items-center gap-0.5 transition-all ${
                  sortField === opt.field
                    ? isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-50 text-teal-700'
                    : isDark ? 'text-slate-400 hover:bg-white/[0.04]' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {opt.label}
                {sortField === opt.field && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <button
            onClick={() => setViewMode(v => v === 'cards' ? 'list' : 'cards')}
            className={`p-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/[0.04]' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            {viewMode === 'cards' ? <LayoutList size={14} /> : <LayoutGrid size={14} />}
          </button>
        </div>

        {/* ── List ── */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className={`rounded-xl border p-4 animate-pulse ${cardBg}`}>
                <div className={`h-4 rounded w-1/3 mb-3 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`} />
                <div className={`h-3 rounded w-2/3 mb-2 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`} />
                <div className={`h-2 rounded w-1/2 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-100'}`} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <HandHelping size={40} className={isDark ? 'text-slate-600' : 'text-slate-300'} />
            <p className={`text-sm font-medium ${txtMuted}`}>
              {search ? 'Nenhuma cautela encontrada' : tab === 'minhas' ? 'Nenhum item sob sua custodia' : 'Sem cautelas'}
            </p>
          </div>
        ) : (
          <div className={viewMode === 'cards' ? 'space-y-3' : 'space-y-2'}>
            {filtered.map(c => (
              <CautelaCard
                key={c.id}
                cautela={c}
                isDark={isDark}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── FAB: Retirar Material ── */}
      <div className="fixed bottom-20 left-0 right-0 px-4 max-w-3xl mx-auto z-30">
        <button className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 transition-all">
          <Plus size={16} />
          Retirar Material
        </button>
      </div>
    </div>
  )
}

// ── KPI Card ────────────────────────────────────────────────────────────────

function KPICard({ label, value, color, icon: Icon, isDark, pulse }: {
  label: string
  value: number
  color: string
  icon: typeof Package2
  isDark: boolean
  pulse?: boolean
}) {
  const colorMap: Record<string, { bg: string; bgDark: string; text: string; textDark: string; icon: string }> = {
    teal:  { bg: 'bg-teal-50',  bgDark: 'bg-teal-500/10',  text: 'text-teal-700',  textDark: 'text-teal-300',  icon: 'text-teal-500' },
    red:   { bg: 'bg-red-50',   bgDark: 'bg-red-500/10',   text: 'text-red-700',   textDark: 'text-red-300',   icon: 'text-red-500' },
    amber: { bg: 'bg-amber-50', bgDark: 'bg-amber-500/10', text: 'text-amber-700', textDark: 'text-amber-300', icon: 'text-amber-500' },
  }
  const c = colorMap[color] ?? colorMap.teal

  return (
    <div className={`shrink-0 rounded-xl border p-3 min-w-[120px] ${isDark ? `${c.bgDark} border-white/[0.06]` : `${c.bg} border-slate-200`} ${pulse ? 'animate-pulse' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={c.icon} />
        <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
      </div>
      <p className={`text-xl font-bold ${isDark ? c.textDark : c.text}`}>{value}</p>
    </div>
  )
}
