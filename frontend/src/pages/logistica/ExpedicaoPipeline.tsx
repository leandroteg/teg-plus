import { useState, useMemo } from 'react'
import {
  Package2, Search, X, CheckCircle2, AlertTriangle,
  Calendar, ArrowUp, ArrowDown, LayoutList, LayoutGrid, Download,
  MapPin, FileText, Building2, Briefcase, Truck, ScrollText,
  ClipboardList,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useSolicitacoes, useEmitirRomaneio, useSolicitarNFFiscal, useIniciarTransporte,
} from '../../hooks/useLogistica'
import type { LogSolicitacao, StatusExpedicaoPipeline } from '../../types/logistica'
import { EXPEDICAO_PIPELINE_STAGES } from '../../types/logistica'

// ── Formatters ───────────────────────────────────────────────────────────────

const fmtData = (d?: string) =>
  d ? new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

const fmtDataFull = (d?: string) =>
  d ? new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

// ── Sort types ───────────────────────────────────────────────────────────────

type SortField = 'data' | 'origem' | 'destino' | 'tipo'
type SortDir = 'asc' | 'desc'
type ViewMode = 'list' | 'cards'

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'data',    label: 'Data' },
  { field: 'origem',  label: 'Origem' },
  { field: 'destino', label: 'Destino' },
  { field: 'tipo',    label: 'Tipo' },
]

const TIPO_LABEL: Record<string, string> = {
  viagem: 'Viagem', mobilizacao: 'Mobilização',
  transferencia_material: 'Transf. Material', transferencia_maquina: 'Transf. Máquina',
}

// ── Status accents ───────────────────────────────────────────────────────────

const STATUS_ICONS: Record<string, typeof Package2> = {
  aprovado:          ClipboardList,
  romaneio_emitido:  ScrollText,
  nfe_emitida:       FileText,
}

const STATUS_ACCENT: Record<string, { bg: string; bgActive: string; text: string; textActive: string; dot: string; border: string; badge: string }> = {
  aprovado:         { bg: 'hover:bg-slate-50',   bgActive: 'bg-slate-100',  text: 'text-slate-600',  textActive: 'text-slate-800',  dot: 'bg-slate-400',  border: 'border-slate-400',  badge: 'bg-slate-200 text-slate-700' },
  romaneio_emitido: { bg: 'hover:bg-blue-50',    bgActive: 'bg-blue-50',    text: 'text-blue-600',   textActive: 'text-blue-800',   dot: 'bg-blue-500',   border: 'border-blue-500',   badge: 'bg-blue-100 text-blue-700' },
  nfe_emitida:      { bg: 'hover:bg-violet-50',  bgActive: 'bg-violet-50',  text: 'text-violet-600', textActive: 'text-violet-800', dot: 'bg-violet-500', border: 'border-violet-500', badge: 'bg-violet-100 text-violet-700' },
}

const STATUS_ACCENT_DARK: Record<string, { bg: string; bgActive: string; text: string; textActive: string; badge: string; border: string }> = {
  aprovado:         { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-slate-500/10',  text: 'text-slate-400',  textActive: 'text-slate-200',  badge: 'bg-slate-500/20 text-slate-300',  border: 'border-slate-500/40' },
  romaneio_emitido: { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-blue-500/10',   text: 'text-blue-400',   textActive: 'text-blue-300',   badge: 'bg-blue-500/20 text-blue-300',   border: 'border-blue-500/40' },
  nfe_emitida:      { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-violet-500/10', text: 'text-violet-400', textActive: 'text-violet-300', badge: 'bg-violet-500/20 text-violet-300', border: 'border-violet-500/40' },
}

// ── Export CSV ────────────────────────────────────────────────────────────────

function exportCSV(items: LogSolicitacao[], stageName: string) {
  const headers = ['Número', 'Tipo', 'Origem', 'Destino', 'Obra', 'Doc Fiscal', 'Motorista', 'Placa', 'Status']
  const rows = items.map(s => [
    s.numero, TIPO_LABEL[s.tipo] || s.tipo, s.origem, s.destino,
    s.obra_nome || '', s.doc_fiscal_tipo || '', s.motorista_nome || '',
    s.veiculo_placa || '', s.status,
  ])
  const bom = '\uFEFF'
  const csv = bom + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `expedicao-${stageName.replace(/\s/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ sol, onClose, onAction, isDark }: {
  sol: LogSolicitacao; onClose: () => void
  onAction: (action: string, sol: LogSolicitacao) => void; isDark: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <Package2 size={18} className="text-orange-600 shrink-0" />
            <h3 className={`text-base font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>Expedição #{sol.numero}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isDark ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-50 text-orange-700'}`}>
              {TIPO_LABEL[sol.tipo] || sol.tipo}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold px-3 py-1 text-xs ${STATUS_ACCENT[sol.status]?.bgActive || 'bg-slate-100'} ${STATUS_ACCENT[sol.status]?.textActive || 'text-slate-700'}`}>
              <span className={`w-2 h-2 rounded-full ${STATUS_ACCENT[sol.status]?.dot || 'bg-slate-400'}`} />
              {EXPEDICAO_PIPELINE_STAGES.find(s => s.status === sol.status)?.label ?? sol.status}
            </span>
          </div>

          <div className={`rounded-xl p-4 space-y-2 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><span className="text-slate-400">Origem:</span> <span className="font-semibold">{sol.origem}</span></div>
              <div><span className="text-slate-400">Destino:</span> <span className="font-semibold">{sol.destino}</span></div>
              {sol.obra_nome && <div><span className="text-slate-400">Obra:</span> <span className="font-semibold">{sol.obra_nome}</span></div>}
              {sol.centro_custo && <div><span className="text-slate-400">Centro Custo:</span> <span className="font-semibold">{sol.centro_custo}</span></div>}
              {sol.motorista_nome && <div><span className="text-slate-400">Motorista:</span> <span className="font-semibold">{sol.motorista_nome}</span></div>}
              {sol.veiculo_placa && <div><span className="text-slate-400">Placa:</span> <span className="font-mono font-semibold">{sol.veiculo_placa}</span></div>}
              {sol.modal && <div><span className="text-slate-400">Modal:</span> <span className="font-semibold capitalize">{sol.modal.replace(/_/g, ' ')}</span></div>}
              {sol.doc_fiscal_tipo && <div><span className="text-slate-400">Doc. Fiscal:</span> <span className="font-semibold capitalize">{sol.doc_fiscal_tipo}</span></div>}
              {sol.peso_total_kg != null && <div><span className="text-slate-400">Peso:</span> <span className="font-semibold">{sol.peso_total_kg} kg</span></div>}
              {sol.volumes_total != null && <div><span className="text-slate-400">Volumes:</span> <span className="font-semibold">{sol.volumes_total}</span></div>}
            </div>
            {sol.descricao && <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">{sol.descricao}</p>}
          </div>

          {/* Progress */}
          <div className={`rounded-xl p-3 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Progresso</p>
            <div className="flex items-center gap-0.5">
              {EXPEDICAO_PIPELINE_STAGES.map((s, i) => {
                const currentIdx = EXPEDICAO_PIPELINE_STAGES.findIndex(st => st.status === sol.status)
                const isPast = i <= currentIdx
                const accent = STATUS_ACCENT[s.status]
                return <div key={s.status} className="flex-1"><div className={`h-1.5 rounded-full transition-all ${isPast ? accent?.dot || 'bg-slate-400' : isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`} /></div>
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${isDark ? 'border-white/[0.06] text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              Fechar
            </button>
            {sol.status === 'aprovado' && (
              <button onClick={() => onAction('emitirRomaneio', sol)} className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                <ScrollText size={15} /> Emitir Romaneio
              </button>
            )}
            {sol.status === 'romaneio_emitido' && sol.doc_fiscal_tipo !== 'nf' && (
              <button onClick={() => onAction('solicitarNF', sol)} className="flex-1 py-3 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-all flex items-center justify-center gap-2">
                <FileText size={15} /> Solicitar NF
              </button>
            )}
            {(sol.status === 'romaneio_emitido' || sol.status === 'nfe_emitida') && (
              <button onClick={() => onAction('despachar', sol)} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                <Truck size={15} /> Despachar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Row (compact table) ──────────────────────────────────────────────────────

function ExpRow({ sol, onClick, isDark, isSelected, onSelect }: {
  sol: LogSolicitacao; onClick: () => void; isDark: boolean; isSelected: boolean; onSelect: (id: string) => void
}) {
  return (
    <div onClick={onClick} className={`flex items-center gap-2 px-3 py-1.5 border-b cursor-pointer transition-all ${
      isDark ? `border-white/[0.04] hover:bg-white/[0.03] ${isSelected ? 'bg-orange-500/10' : ''}` : `border-slate-100 hover:bg-slate-50 ${isSelected ? 'bg-orange-50' : ''}`
    }`}>
      <input type="checkbox" checked={isSelected} onChange={e => { e.stopPropagation(); onSelect(sol.id) }} onClick={e => e.stopPropagation()}
        className="w-3 h-3 rounded border-slate-300 text-orange-600 focus:ring-orange-500 shrink-0" />

      <span className={`text-[11px] font-mono font-bold w-[60px] shrink-0 ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>
        {sol.numero}
      </span>

      <span className={`text-xs truncate w-[130px] shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>{sol.origem}</span>
      <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-300'} shrink-0`}>→</span>
      <span className={`text-xs truncate w-[130px] shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>{sol.destino}</span>

      <span className={`text-[11px] truncate w-[90px] shrink-0 flex items-center gap-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {sol.obra_nome ? <><Building2 size={9} className="shrink-0" /> {sol.obra_nome}</> : '—'}
      </span>

      <span className={`text-[10px] truncate w-[70px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {sol.motorista_nome || '—'}
      </span>

      <span className={`text-[11px] font-mono truncate w-[70px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {sol.veiculo_placa || '—'}
      </span>

      <span className={`text-[10px] truncate w-[60px] shrink-0 capitalize text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {sol.doc_fiscal_tipo || '—'}
      </span>

      <span className={`text-[11px] text-right w-[52px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {fmtData(sol.updated_at)}
      </span>
    </div>
  )
}

// ── Card (full-width, 1 per line) ────────────────────────────────────────────

function ExpCard({ sol, onClick, isDark, isSelected, onSelect }: {
  sol: LogSolicitacao; onClick: () => void; isDark: boolean; isSelected: boolean; onSelect: (id: string) => void
}) {
  return (
    <div onClick={onClick} className={`rounded-2xl border p-4 cursor-pointer transition-all group ${
      isDark
        ? `border-white/[0.06] hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5 ${isSelected ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/[0.02]'}`
        : `border-slate-200 hover:border-orange-300 hover:shadow-md ${isSelected ? 'bg-orange-50 border-orange-300' : 'bg-white'}`
    }`}>
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={isSelected} onChange={e => { e.stopPropagation(); onSelect(sol.id) }} onClick={e => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500 shrink-0" />

        <span className={`text-xs font-mono font-bold shrink-0 ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>#{sol.numero}</span>

        <div className="flex items-center gap-1.5 min-w-0 flex-1 text-sm">
          <MapPin size={12} className={`shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <span className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{sol.origem}</span>
          <span className={`${isDark ? 'text-slate-600' : 'text-slate-300'} shrink-0`}>→</span>
          <span className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{sol.destino}</span>
        </div>

        {sol.doc_fiscal_tipo && sol.doc_fiscal_tipo !== 'nenhum' && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold shrink-0 capitalize ${
            sol.doc_fiscal_tipo === 'nf' ? isDark ? 'bg-violet-500/10 text-violet-400' : 'bg-violet-50 text-violet-700'
            : isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700'
          }`}>
            {sol.doc_fiscal_tipo === 'nf' ? 'NF-e' : 'Romaneio'}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 ml-10">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {sol.obra_nome && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <Building2 size={9} /> {sol.obra_nome}
            </span>
          )}
          {sol.motorista_nome && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <Truck size={9} /> {sol.motorista_nome}
            </span>
          )}
          {sol.veiculo_placa && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              {sol.veiculo_placa}
            </span>
          )}
          {sol.peso_total_kg != null && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              {sol.peso_total_kg} kg
            </span>
          )}
        </div>
        <span className={`text-[11px] flex items-center gap-1 shrink-0 ml-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          <Calendar size={10} /> {fmtData(sol.updated_at)}
        </span>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ExpedicaoPipeline() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<StatusExpedicaoPipeline>('aprovado')
  const [busca, setBusca] = useState('')
  const [detail, setDetail] = useState<LogSolicitacao | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [nfModal, setNfModal] = useState<LogSolicitacao | null>(null)

  const { data: solicitacoes = [], isLoading } = useSolicitacoes()
  const emitirRomaneio = useEmitirRomaneio()
  const solicitarNF = useSolicitarNFFiscal()

  // Group by status
  const grouped = useMemo(() => {
    const map = new Map<StatusExpedicaoPipeline, LogSolicitacao[]>()
    for (const s of EXPEDICAO_PIPELINE_STAGES) map.set(s.status, [])
    for (const sol of solicitacoes) {
      const arr = map.get(sol.status as StatusExpedicaoPipeline)
      if (arr) arr.push(sol)
    }
    return map
  }, [solicitacoes])

  const activeItems = useMemo(() => {
    let items = [...(grouped.get(activeTab) || [])]
    if (busca) {
      const q = busca.toLowerCase()
      items = items.filter(s =>
        s.numero.toLowerCase().includes(q) || s.origem.toLowerCase().includes(q) ||
        s.destino.toLowerCase().includes(q) || s.obra_nome?.toLowerCase().includes(q) ||
        s.motorista_nome?.toLowerCase().includes(q) || s.veiculo_placa?.toLowerCase().includes(q) ||
        s.descricao?.toLowerCase().includes(q)
      )
    }
    items.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'data':    cmp = (a.updated_at || '').localeCompare(b.updated_at || ''); break
        case 'origem':  cmp = a.origem.localeCompare(b.origem); break
        case 'destino': cmp = a.destino.localeCompare(b.destino); break
        case 'tipo':    cmp = a.tipo.localeCompare(b.tipo); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return items
  }, [grouped, activeTab, busca, sortField, sortDir])

  const showToast = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000) }
  const toggleSelect = (id: string) => { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  const selectAll = () => { const ids = activeItems.map(s => s.id); setSelectedIds(ids.every(id => selectedIds.has(id)) ? new Set() : new Set(ids)) }
  const toggleSort = (field: SortField) => { if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortDir('asc') } }
  const switchTab = (status: StatusExpedicaoPipeline) => { setActiveTab(status); setSelectedIds(new Set()); setBusca('') }

  // Actions
  const handleEmitirRomaneio = async (ids: string[]) => {
    try {
      for (const id of ids) await emitirRomaneio.mutateAsync({ solicitacao_id: id, romaneio_url: '' })
      showToast('success', `${ids.length} romaneio(s) emitido(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao emitir romaneio') }
  }

  const handleBulkAction = () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (activeTab === 'aprovado') handleEmitirRomaneio(ids)
  }

  const handleSolicitarNF = async (sol: LogSolicitacao) => {
    try {
      await solicitarNF.mutateAsync({
        solicitacao_id: sol.id,
        fornecedor_nome: sol.origem,
        valor_total: 0,
        descricao: `NF ref. expedição #${sol.numero} — ${sol.origem} → ${sol.destino}`,
      })
      showToast('success', 'NF solicitada ao fiscal com sucesso')
      setNfModal(null)
      setDetail(null)
    } catch { showToast('error', 'Erro ao solicitar NF') }
  }

  const handleDetailAction = (action: string, sol: LogSolicitacao) => {
    setDetail(null)
    if (action === 'emitirRomaneio') handleEmitirRomaneio([sol.id])
    if (action === 'solicitarNF') setNfModal(sol)
  }

  const handleExport = () => {
    const stage = EXPEDICAO_PIPELINE_STAGES.find(s => s.status === activeTab)
    const toExport = selectedIds.size > 0 ? activeItems.filter(s => selectedIds.has(s.id)) : activeItems
    exportCSV(toExport, stage?.label || activeTab)
    showToast('success', `${toExport.length} registro(s) exportado(s)`)
  }

  const BULK_ACTIONS: Partial<Record<StatusExpedicaoPipeline, { label: string; icon: typeof CheckCircle2; className: string }>> = {
    aprovado: { label: 'Emitir Romaneio', icon: ScrollText, className: 'bg-blue-600 hover:bg-blue-700 text-white' },
  }
  const bulk = BULK_ACTIONS[activeTab]
  const selectedInTab = activeItems.filter(s => selectedIds.has(s.id))

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />} {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Package2 size={20} className="text-orange-600" /> Expedição
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {solicitacoes.filter(s => ['aprovado','romaneio_emitido','nfe_emitida'].includes(s.status)).length} solicitações na expedição
          </p>
        </div>
      </div>

      {/* Horizontal Tabs */}
      <div className={`flex gap-1 p-1 rounded-2xl border overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        {EXPEDICAO_PIPELINE_STAGES.map(stage => {
          const count = grouped.get(stage.status)?.length || 0
          const isActive = activeTab === stage.status
          const Icon = STATUS_ICONS[stage.status] || Package2
          const accent = isDark ? STATUS_ACCENT_DARK[stage.status] : STATUS_ACCENT[stage.status]
          return (
            <button key={stage.status} onClick={() => switchTab(stage.status)}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                isActive
                  ? isDark
                    ? `${accent?.bgActive} ${accent?.textActive} ${STATUS_ACCENT_DARK[stage.status]?.border} font-bold shadow-sm`
                    : `${accent?.bgActive} ${accent?.textActive} ${STATUS_ACCENT[stage.status]?.border} font-bold shadow-sm`
                  : isDark
                    ? `${accent?.bg} ${accent?.text} font-medium border-transparent`
                    : `${accent?.bg} ${accent?.text} font-medium border-transparent hover:bg-white hover:shadow-sm`
              }`}>
              <Icon size={15} className="shrink-0" />
              {stage.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 flex items-center justify-center ${
                  isActive ? isDark ? `${STATUS_ACCENT_DARK[stage.status]?.badge}` : `${STATUS_ACCENT[stage.status]?.badge}` : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'
                }`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content panel */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>

        {/* Toolbar */}
        <div className={`px-4 py-2.5 border-b flex flex-wrap items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar número, origem, destino, motorista..."
              className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 ${
                isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'
              }`} />
            {busca && <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>}
          </div>

          <div className="flex items-center gap-0.5">
            {SORT_OPTIONS.map(opt => (
              <button key={opt.field} onClick={() => toggleSort(opt.field)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  sortField === opt.field ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-800'
                  : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}>
                {opt.label} {sortField === opt.field && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
              </button>
            ))}
          </div>

          <div className={`flex items-center rounded-lg border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            <button onClick={() => setViewMode('list')} className={`p-1.5 transition-all ${viewMode === 'list' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`} title="Lista"><LayoutList size={14} /></button>
            <button onClick={() => setViewMode('cards')} className={`p-1.5 transition-all ${viewMode === 'cards' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`} title="Cards"><LayoutGrid size={14} /></button>
          </div>

          <button onClick={handleExport} disabled={activeItems.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30'
            }`} title="Exportar CSV"><Download size={13} /> CSV</button>

          <div className={`ml-auto flex items-center gap-3 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <span>{activeItems.length} item(ns)</span>
          </div>
        </div>

        {/* Bulk actions */}
        {activeItems.length > 0 && bulk && (
          <div className={`px-4 py-2 border-b flex items-center gap-3 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/50'}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={activeItems.length > 0 && activeItems.every(s => selectedIds.has(s.id))} onChange={selectAll}
                className="w-3.5 h-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
              <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Todos</span>
            </label>
            {selectedInTab.length > 0 && (
              <button onClick={handleBulkAction} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${bulk.className}`}>
                <bulk.icon size={12} /> {bulk.label} ({selectedInTab.length})
              </button>
            )}
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                <Package2 size={24} className="text-slate-300" />
              </div>
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma carga nesta etapa</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{busca ? 'Tente outra busca' : 'As cargas aparecerão aqui quando avançarem'}</p>
            </div>
          ) : viewMode === 'list' ? (
            <>
              <div className={`flex items-center gap-2 px-3 py-1 border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'}`}>
                <span className="w-3 shrink-0" />
                <span className="w-[60px] shrink-0">Nº</span>
                <span className="w-[130px] shrink-0">Origem</span>
                <span className="w-3 shrink-0" />
                <span className="w-[130px] shrink-0">Destino</span>
                <span className="w-[90px] shrink-0">Obra</span>
                <span className="w-[70px] shrink-0">Motorista</span>
                <span className="w-[70px] shrink-0">Placa</span>
                <span className="w-[60px] shrink-0 text-center">Doc</span>
                <span className="w-[52px] shrink-0 text-right">Data</span>
              </div>
              {activeItems.map(sol => <ExpRow key={sol.id} sol={sol} onClick={() => setDetail(sol)} isDark={isDark} isSelected={selectedIds.has(sol.id)} onSelect={toggleSelect} />)}
            </>
          ) : (
            <div className="space-y-2 p-4">
              {activeItems.map(sol => <ExpCard key={sol.id} sol={sol} onClick={() => setDetail(sol)} isDark={isDark} isSelected={selectedIds.has(sol.id)} onSelect={toggleSelect} />)}
            </div>
          )}
        </div>
      </div>

      {detail && <DetailModal sol={detail} onClose={() => setDetail(null)} onAction={handleDetailAction} isDark={isDark} />}

      {/* Solicitar NF Modal */}
      {nfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setNfModal(null)}>
          <div className={`rounded-2xl shadow-2xl w-full max-w-md ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Solicitar NF ao Fiscal</h3>
              <button onClick={() => setNfModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Confirma a solicitação de Nota Fiscal para a expedição abaixo?
              </p>
              <div className={`rounded-xl p-4 space-y-2 text-xs ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
                <div><span className="text-slate-400">Expedição:</span> <span className="font-semibold">#{nfModal.numero}</span></div>
                <div><span className="text-slate-400">Origem:</span> <span className="font-semibold">{nfModal.origem}</span></div>
                <div><span className="text-slate-400">Destino:</span> <span className="font-semibold">{nfModal.destino}</span></div>
                {nfModal.obra_nome && <div><span className="text-slate-400">Obra:</span> <span className="font-semibold">{nfModal.obra_nome}</span></div>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setNfModal(null)} className={`flex-1 py-3 rounded-xl border text-sm font-semibold ${isDark ? 'border-white/[0.06] text-slate-300' : 'border-slate-200 text-slate-600'}`}>
                  Cancelar
                </button>
                <button onClick={() => handleSolicitarNF(nfModal)} disabled={solicitarNF.isPending}
                  className="flex-1 py-3 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {solicitarNF.isPending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FileText size={15} />}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
