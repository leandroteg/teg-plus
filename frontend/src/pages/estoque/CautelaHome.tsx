import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search, X, HandHelping, Package2, AlertTriangle, Clock,
  LayoutList, LayoutGrid, ArrowUp, ArrowDown, Plus, Users, History,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useCautelas, useMinhasCautelas, useCautelaKPIs } from '../../hooks/useCautelas'
import CautelaCard from '../../components/cautela/CautelaCard'
import type { Cautela, StatusCautela } from '../../types/cautela'

type Tab = 'minhas' | 'equipe' | 'historico'
type SortField = 'data' | 'status' | 'obra'
type SortDir = 'asc' | 'desc'
type ViewMode = 'cards' | 'list'

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'data', label: 'Data' }, { field: 'status', label: 'Status' }, { field: 'obra', label: 'Obra' },
]

const TAB_CONFIG: { key: Tab; label: string; icon: typeof HandHelping }[] = [
  { key: 'minhas', label: 'Minhas', icon: Package2 },
  { key: 'equipe', label: 'Equipe', icon: Users },
  { key: 'historico', label: 'Histórico', icon: History },
]

type AccentSet = { bg: string; bgActive: string; text: string; textActive: string; dot: string; badge: string; border: string }
const TAB_ACCENT: Record<Tab, AccentSet> = {
  minhas:    { bg:'bg-teal-50',    bgActive:'bg-teal-100',    text:'text-teal-500',    textActive:'text-teal-800',    dot:'bg-teal-500',    badge:'bg-teal-200/80 text-teal-700',    border:'border-teal-200' },
  equipe:    { bg:'bg-blue-50',    bgActive:'bg-blue-100',    text:'text-blue-500',    textActive:'text-blue-800',    dot:'bg-blue-500',    badge:'bg-blue-200/80 text-blue-700',    border:'border-blue-200' },
  historico: { bg:'bg-slate-50',   bgActive:'bg-slate-100',   text:'text-slate-500',   textActive:'text-slate-800',   dot:'bg-slate-400',   badge:'bg-slate-200/80 text-slate-600',   border:'border-slate-200' },
}
const TAB_ACCENT_DARK: Record<Tab, AccentSet> = {
  minhas:    { bg:'bg-teal-500/5',  bgActive:'bg-teal-500/15',  text:'text-teal-400',  textActive:'text-teal-200',  dot:'bg-teal-400',  badge:'bg-teal-500/15 text-teal-300',  border:'border-teal-500/20' },
  equipe:    { bg:'bg-blue-500/5',  bgActive:'bg-blue-500/15',  text:'text-blue-400',  textActive:'text-blue-200',  dot:'bg-blue-400',  badge:'bg-blue-500/15 text-blue-300',  border:'border-blue-500/20' },
  historico: { bg:'bg-white/[0.02]',bgActive:'bg-white/[0.06]', text:'text-slate-500',  textActive:'text-slate-200', dot:'bg-slate-500', badge:'bg-white/[0.06] text-slate-400', border:'border-white/[0.08]' },
}

const ACTIVE_STATUSES: StatusCautela[] = ['rascunho', 'pendente_aprovacao', 'aprovada', 'em_separacao', 'retirada', 'parcial_devolvida']
const HISTORY_STATUSES: StatusCautela[] = ['devolvida', 'vencida', 'cancelada']

export default function CautelaHome() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { perfil } = useAuth()
  const userId = perfil?.id
  const [searchParams, setSearchParams] = useSearchParams()

  const [tab, setTab] = useState<Tab>(() => (searchParams.get('tab') as Tab) || 'minhas')
  const [busca, setBusca] = useState('')
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  const { data: minhas = [], isLoading: loadMinhas } = useMinhasCautelas(userId)
  const { data: todas = [], isLoading: loadTodas } = useCautelas()
  const { data: kpis } = useCautelaKPIs(userId)

  const equipe = useMemo(() => todas.filter(c => ACTIVE_STATUSES.includes(c.status)), [todas])
  const historico = useMemo(() => todas.filter(c => HISTORY_STATUSES.includes(c.status)), [todas])
  const counts: Record<Tab, number> = { minhas: minhas.length, equipe: equipe.length, historico: historico.length }

  const currentList = tab === 'minhas' ? minhas : tab === 'equipe' ? equipe : historico
  const isLoading = tab === 'minhas' ? loadMinhas : loadTodas

  const switchTab = (t: Tab) => {
    setTab(t); setBusca('')
    setSearchParams(p => { p.set('tab', t); return p }, { replace: true })
  }
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    let list = [...currentList]
    if (busca) { const q = busca.toLowerCase(); list = list.filter(c => [c.numero, c.obra_nome, c.solicitante_nome].some(v => v?.toLowerCase().includes(q))) }
    list.sort((a, b) => {
      let c = 0
      if (sortField === 'data') c = (a.criado_em ?? '').localeCompare(b.criado_em ?? '')
      else if (sortField === 'status') c = (a.status ?? '').localeCompare(b.status ?? '')
      else c = (a.obra_nome ?? '').localeCompare(b.obra_nome ?? '')
      return sortDir === 'desc' ? -c : c
    })
    return list
  }, [currentList, busca, sortField, sortDir])

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Cautelas</h1>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Retirada e devolução de materiais</p>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 p-1 pb-2 border-b overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        {TAB_CONFIG.map(t => {
          const count = counts[t.key]
          const isActive = tab === t.key
          const Icon = t.icon
          const a = isDark ? TAB_ACCENT_DARK[t.key] : TAB_ACCENT[t.key]
          return (
            <button key={t.key} onClick={() => switchTab(t.key)} className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${isActive ? `${a.bgActive} ${a.textActive} ${a.border} font-bold shadow-sm` : `${a.bg} ${a.text} font-medium border-transparent ${isDark ? '' : 'hover:bg-white hover:shadow-sm'}`}`}>
              <Icon size={15} className="shrink-0" /> {t.label}
              {count > 0 && <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 ${isActive ? a.badge : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'}`}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className={`px-4 py-2.5 border-b flex flex-wrap items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cautela..."
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`} />
          {busca && <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>}
        </div>
        <div className="flex items-center gap-0.5">
          {SORT_OPTIONS.map(opt => { const isA = sortField === opt.field; return (
            <button key={opt.field} onClick={() => toggleSort(opt.field)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${isA ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-800' : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
              {opt.label} {isA && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
            </button>
          )})}
        </div>
        <div className={`flex items-center rounded-lg border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <button onClick={() => setViewMode('list')} className={`p-1.5 ${viewMode === 'list' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutList size={14} /></button>
          <button onClick={() => setViewMode('cards')} className={`p-1.5 ${viewMode === 'cards' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutGrid size={14} /></button>
        </div>
        <span className={`ml-auto text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{filtered.length} {filtered.length === 1 ? 'cautela' : 'cautelas'}</span>
      </div>

      {/* Content */}
      <div className="min-h-[200px]">
        {filtered.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
            <HandHelping size={40} className="mb-3" />
            <p className="text-sm font-medium">{busca ? 'Nenhuma cautela encontrada' : tab === 'minhas' ? 'Nenhum item sob sua custódia' : 'Sem cautelas'}</p>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {filtered.map(c => <CautelaCard key={c.id} cautela={c} isDark={isDark} />)}
          </div>
        )}
      </div>
    </div>
  )
}
