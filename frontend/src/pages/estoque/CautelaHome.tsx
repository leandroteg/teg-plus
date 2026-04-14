import { useState, useMemo, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Search, X, HandHelping, ArrowUp, ArrowDown, LayoutList, LayoutGrid,
  Clock, ClipboardCheck, CheckCircle2, PackageOpen, Archive,
  User, Calendar, MapPin, Building2, Plus,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useCautelas, useAtualizarCautela } from '../../hooks/useCautelas'
import type { Cautela, StatusCautela } from '../../types/cautela'
import { CAUTELA_PIPELINE_STAGES } from '../../types/cautela'

// ── Accent maps ──────────────────────────────────────────────────────────────
type AccentSet = { bg: string; bgActive: string; text: string; textActive: string; dot: string; badge: string; border: string }
const STATUS_ACCENT: Record<StatusCautela, AccentSet> = {
  pendente:      { bg:'bg-amber-50',   bgActive:'bg-amber-100',  text:'text-amber-500',  textActive:'text-amber-800',  dot:'bg-amber-500', badge:'bg-amber-200/80 text-amber-700', border:'border-amber-200' },
  aprovada:      { bg:'bg-blue-50',    bgActive:'bg-blue-100',   text:'text-blue-500',   textActive:'text-blue-800',   dot:'bg-blue-500',  badge:'bg-blue-200/80 text-blue-700',   border:'border-blue-200' },
  em_aberto:     { bg:'bg-teal-50',    bgActive:'bg-teal-100',   text:'text-teal-500',   textActive:'text-teal-800',   dot:'bg-teal-500',  badge:'bg-teal-200/80 text-teal-700',   border:'border-teal-200' },
  em_devolucao:  { bg:'bg-violet-50',  bgActive:'bg-violet-100', text:'text-violet-500', textActive:'text-violet-800', dot:'bg-violet-500',badge:'bg-violet-200/80 text-violet-700',border:'border-violet-200' },
  encerrada:     { bg:'bg-slate-50',   bgActive:'bg-slate-100',  text:'text-slate-500',  textActive:'text-slate-800',  dot:'bg-slate-400', badge:'bg-slate-200/80 text-slate-600', border:'border-slate-200' },
}
const STATUS_ACCENT_DARK: Record<StatusCautela, AccentSet> = {
  pendente:      { bg:'bg-amber-500/5',  bgActive:'bg-amber-500/15',  text:'text-amber-400',  textActive:'text-amber-200',  dot:'bg-amber-400', badge:'bg-amber-500/15 text-amber-300', border:'border-amber-500/20' },
  aprovada:      { bg:'bg-blue-500/5',   bgActive:'bg-blue-500/15',   text:'text-blue-400',   textActive:'text-blue-200',   dot:'bg-blue-400',  badge:'bg-blue-500/15 text-blue-300',   border:'border-blue-500/20' },
  em_aberto:     { bg:'bg-teal-500/5',   bgActive:'bg-teal-500/15',   text:'text-teal-400',   textActive:'text-teal-200',   dot:'bg-teal-400',  badge:'bg-teal-500/15 text-teal-300',   border:'border-teal-500/20' },
  em_devolucao:  { bg:'bg-violet-500/5', bgActive:'bg-violet-500/15', text:'text-violet-400', textActive:'text-violet-200', dot:'bg-violet-400',badge:'bg-violet-500/15 text-violet-300',border:'border-violet-500/20' },
  encerrada:     { bg:'bg-white/[0.02]', bgActive:'bg-white/[0.06]',  text:'text-slate-500',  textActive:'text-slate-200',  dot:'bg-slate-500', badge:'bg-white/[0.06] text-slate-400', border:'border-white/[0.08]' },
}
const STATUS_ICONS: Record<StatusCautela, typeof HandHelping> = {
  pendente: Clock, aprovada: ClipboardCheck, em_aberto: PackageOpen, em_devolucao: Archive, encerrada: CheckCircle2,
}

type SortField = 'data' | 'solicitante' | 'obra'
type SortDir = 'asc' | 'desc'
type ViewMode = 'cards' | 'list'
const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'data', label: 'Data' }, { field: 'solicitante', label: 'Solicitante' }, { field: 'obra', label: 'Obra' },
]
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'

// ── Card ─────────────────────────────────────────────────────────────────────
function CautelaCardItem({ cautela, onClick, isDark }: { cautela: Cautela; onClick: () => void; isDark: boolean }) {
  const accent = isDark ? STATUS_ACCENT_DARK[cautela.status] : STATUS_ACCENT[cautela.status]
  const stage = CAUTELA_PIPELINE_STAGES.find(s => s.status === cautela.status)
  return (
    <button type="button" onClick={onClick} className={`w-full text-left rounded-xl border p-3 transition-all ${isDark ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white border-slate-200 hover:shadow-md hover:border-slate-300'}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div>
          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{cautela.numero || 'Nova Cautela'}</p>
          {cautela.solicitante_nome && <p className={`text-xs flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}><User size={11} /> {cautela.solicitante_nome}</p>}
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${accent.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} /> {stage?.label}
        </span>
      </div>
      {cautela.obra_nome && <p className={`text-xs flex items-center gap-1 mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><Building2 size={11} /> {cautela.obra_nome}</p>}
      <div className="flex items-center justify-between mt-1">
        <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><Calendar size={10} className="inline mr-1" />{fmtDate(cautela.criado_em)}</span>
        {cautela.data_devolucao_prevista && <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Devolução: {fmtDate(cautela.data_devolucao_prevista)}</span>}
      </div>
    </button>
  )
}

// ── Row ──────────────────────────────────────────────────────────────────────
function CautelaRow({ cautela, onClick, isDark }: { cautela: Cautela; onClick: () => void; isDark: boolean }) {
  const accent = isDark ? STATUS_ACCENT_DARK[cautela.status] : STATUS_ACCENT[cautela.status]
  return (
    <button type="button" onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b transition-all ${isDark ? 'border-white/[0.04] hover:bg-white/[0.04]' : 'border-slate-100 hover:bg-slate-50'}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${accent.dot}`} />
      <span className={`w-[90px] text-xs font-mono shrink-0 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{cautela.numero || '—'}</span>
      <span className={`flex-1 text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{cautela.solicitante_nome || '—'}</span>
      <span className={`w-[120px] text-xs truncate shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{cautela.obra_nome || '—'}</span>
      <span className={`w-[70px] text-xs text-right shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtDate(cautela.criado_em)}</span>
    </button>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function CautelaHome() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const { data: cautelas = [], isLoading } = useCautelas()

  const [activeTab, setActiveTab] = useState<StatusCautela>(() => (searchParams.get('tab') as StatusCautela) || 'pendente')
  const [busca, setBusca] = useState('')
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  const grouped = useMemo(() => {
    const map = new Map<StatusCautela, Cautela[]>()
    CAUTELA_PIPELINE_STAGES.forEach(s => map.set(s.status, []))
    cautelas.forEach(c => map.get(c.status)?.push(c))
    return map
  }, [cautelas])

  const switchTab = (status: StatusCautela) => {
    setActiveTab(status); setBusca('')
    setSearchParams(p => { p.set('tab', status); return p }, { replace: true })
  }
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const activeItems = useMemo(() => {
    let items = [...(grouped.get(activeTab) || [])]
    if (busca) { const q = busca.toLowerCase(); items = items.filter(c => [c.numero, c.solicitante_nome, c.obra_nome].some(v => v?.toLowerCase().includes(q))) }
    items.sort((a, b) => {
      let c = 0
      if (sortField === 'data') c = (a.criado_em ?? '').localeCompare(b.criado_em ?? '')
      else if (sortField === 'solicitante') c = (a.solicitante_nome ?? '').localeCompare(b.solicitante_nome ?? '')
      else c = (a.obra_nome ?? '').localeCompare(b.obra_nome ?? '')
      return sortDir === 'asc' ? c : -c
    })
    return items
  }, [grouped, activeTab, busca, sortField, sortDir])

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h1 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Cautelas</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Pipeline de retirada e devolução de materiais</p>
        </div>
        <button
          onClick={() => navigate('/estoque/cautelas/nova')}
          className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} /> Nova Cautela
        </button>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 p-1 pb-2 border-b overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        {CAUTELA_PIPELINE_STAGES.map(stage => {
          const count = grouped.get(stage.status)?.length || 0
          const isActive = activeTab === stage.status
          const Icon = STATUS_ICONS[stage.status]
          const a = isDark ? STATUS_ACCENT_DARK[stage.status] : STATUS_ACCENT[stage.status]
          return (
            <button key={stage.status} onClick={() => switchTab(stage.status)} className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${isActive ? `${a.bgActive} ${a.textActive} ${a.border} font-bold shadow-sm` : `${a.bg} ${a.text} font-medium border-transparent ${isDark ? '' : 'hover:bg-white hover:shadow-sm'}`}`}>
              <Icon size={15} className="shrink-0" /> {stage.label}
              {count > 0 && <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 ${isActive ? a.badge : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'}`}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className={`px-4 py-2.5 border-b flex flex-wrap items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar número, solicitante, obra..."
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
        <span className={`ml-auto text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{activeItems.length} {activeItems.length === 1 ? 'cautela' : 'cautelas'}</span>
      </div>

      {/* Content */}
      <div className="min-h-[200px]">
        {activeItems.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
            <HandHelping size={40} className="mb-3" /><p className="text-sm font-medium">Nenhuma cautela nesta etapa</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="space-y-2 p-4">{activeItems.map(c => <CautelaCardItem key={c.id} cautela={c} onClick={() => {}} isDark={isDark} />)}</div>
        ) : (
          <div>
            <div className={`flex items-center gap-2 px-3 py-1 border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'}`}>
              <span className="w-2 shrink-0" /><span className="w-[90px] shrink-0">Nº</span><span className="flex-1">Solicitante</span><span className="w-[120px] shrink-0">Obra</span><span className="w-[70px] shrink-0 text-right">Data</span>
            </div>
            {activeItems.map(c => <CautelaRow key={c.id} cautela={c} onClick={() => {}} isDark={isDark} />)}
          </div>
        )}
      </div>
    </div>
  )
}
