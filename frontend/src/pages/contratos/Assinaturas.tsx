import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileSignature, Search, Eye, LayoutList, LayoutGrid, Download,
  ArrowUp, ArrowDown, Clock, Send, CheckCircle2, Archive, Unlock,
  Building2, User, XCircle, AlertTriangle,
} from 'lucide-react'
import { useSolicitacoes, useSolicitacoesDashboard, useAssinaturasAll } from '../../hooks/useSolicitacoes'
import type { EtapaSolicitacao, Solicitacao, Assinatura } from '../../types/contratos'

// ── Pipeline stages ─────────────────────────────────────────────────────────

type StageKey = 'pendente' | 'enviado' | 'assinado' | 'arquivado' | 'liberado'

type PipelineStage = {
  key: StageKey
  label: string
  icon: typeof Clock
  dot: string
  bg: string
  text: string
  border: string
  badge: string
  etapas: EtapaSolicitacao[]  // which etapa_atual values map here
}

const STAGES: PipelineStage[] = [
  { key: 'pendente',  label: 'Pendente',     icon: Clock,        dot: 'bg-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-l-amber-500',   badge: 'bg-amber-100 text-amber-700', etapas: ['enviar_assinatura'] },
  { key: 'enviado',   label: 'Enviado',      icon: Send,         dot: 'bg-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-l-blue-500',    badge: 'bg-blue-100 text-blue-700', etapas: [] },
  { key: 'assinado',  label: 'Assinado',     icon: CheckCircle2, dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-l-emerald-500', badge: 'bg-emerald-100 text-emerald-700', etapas: [] },
  { key: 'arquivado', label: 'Arquivado',    icon: Archive,      dot: 'bg-cyan-500',    bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-l-cyan-500',    badge: 'bg-cyan-100 text-cyan-700', etapas: ['arquivar'] },
  { key: 'liberado',  label: 'Liberado',     icon: Unlock,       dot: 'bg-green-500',   bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-l-green-500',   badge: 'bg-green-100 text-green-700', etapas: ['liberar_execucao'] },
]

// ── Formatters ──────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

// ── Sort ────────────────────────────────────────────────────────────────────

type SortField = 'data' | 'contraparte' | 'valor'
type SortDir = 'asc' | 'desc'
type ViewMode = 'list' | 'cards'

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'data',        label: 'Data' },
  { field: 'contraparte', label: 'Contraparte' },
  { field: 'valor',       label: 'Valor' },
]

// ── Export CSV ───────────────────────────────────────────────────────────────

function exportCSV(items: DisplayItem[], stageName: string) {
  const headers = ['Número', 'Contraparte', 'Objeto', 'Status', 'Valor', 'Data']
  const rows = items.map(s => [
    s.numero, s.contraparte, s.objeto, s.stageKey,
    s.valor ?? '', fmtData(s.data),
  ])
  const bom = '\uFEFF'
  const csv = bom + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `assinaturas-${stageName}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Unified item type ───────────────────────────────────────────────────────

type DisplayItem = {
  id: string
  numero: string
  contraparte: string
  objeto: string
  valor?: number
  data: string
  stageKey: StageKey
  assinatura: Assinatura | null
  solicitacao: Solicitacao
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function AssinaturaPipeline() {
  const nav = useNavigate()
  const [activeStage, setActiveStage] = useState<StageKey>('pendente')
  const [busca, setBusca] = useState('')
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  const { data: dashboard = {}, isLoading: loadingDash } = useSolicitacoesDashboard()
  const { data: assinaturas = [] } = useAssinaturasAll()

  // Fetch solicitacoes for the etapas relevant to signature pipeline
  const { data: pendentes = [], isLoading: l1 } = useSolicitacoes({ etapa_atual: 'enviar_assinatura' })
  const { data: arquivadas = [], isLoading: l2 } = useSolicitacoes({ etapa_atual: 'arquivar' })
  const { data: liberadas = [], isLoading: l3 } = useSolicitacoes({ etapa_atual: 'liberar_execucao' })
  const isLoading = l1 || l2 || l3

  // Build unified items list
  const allItems = useMemo(() => {
    const assMap = new Map<string, Assinatura>()
    assinaturas.forEach(a => { if (a.solicitacao_id) assMap.set(a.solicitacao_id, a) })

    const toItem = (s: Solicitacao, stageKey: StageKey): DisplayItem => ({
      id: s.id,
      numero: s.numero,
      contraparte: s.contraparte_nome,
      objeto: s.objeto,
      valor: s.valor_estimado ?? undefined,
      data: s.updated_at || s.created_at,
      stageKey,
      assinatura: assMap.get(s.id) ?? null,
      solicitacao: s,
    })

    const items: DisplayItem[] = []

    // Pendentes: etapa=enviar_assinatura AND (no assinatura OR status=pendente)
    pendentes.forEach(s => {
      const ass = assMap.get(s.id)
      if (!ass || ass.status === 'pendente') {
        items.push(toItem(s, 'pendente'))
      } else if (ass.status === 'enviado' || ass.status === 'parcialmente_assinado') {
        items.push(toItem(s, 'enviado'))
      } else if (ass.status === 'assinado') {
        items.push(toItem(s, 'assinado'))
      }
    })

    // Arquivadas
    arquivadas.forEach(s => items.push(toItem(s, 'arquivado')))

    // Liberadas
    liberadas.forEach(s => items.push(toItem(s, 'liberado')))

    return items
  }, [pendentes, arquivadas, liberadas, assinaturas])

  // Filter by active stage
  const stageItems = useMemo(() => allItems.filter(i => i.stageKey === activeStage), [allItems, activeStage])

  // Counts per stage
  const counts = useMemo(() => {
    const c: Record<StageKey, number> = { pendente: 0, enviado: 0, assinado: 0, arquivado: 0, liberado: 0 }
    allItems.forEach(i => c[i.stageKey]++)
    return c
  }, [allItems])

  // Search + Sort
  const filtered = useMemo(() => {
    let items = stageItems
    if (busca.trim()) {
      const q = busca.toLowerCase()
      items = items.filter(i =>
        i.numero?.toLowerCase().includes(q) ||
        i.objeto?.toLowerCase().includes(q) ||
        i.contraparte?.toLowerCase().includes(q)
      )
    }
    items = [...items].sort((a, b) => {
      let cmp = 0
      if (sortField === 'data') cmp = new Date(a.data).getTime() - new Date(b.data).getTime()
      else if (sortField === 'contraparte') cmp = (a.contraparte || '').localeCompare(b.contraparte || '')
      else if (sortField === 'valor') cmp = (a.valor ?? 0) - (b.valor ?? 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return items
  }, [stageItems, busca, sortField, sortDir])

  const stage = STAGES.find(s => s.key === activeStage)!

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <FileSignature size={20} className="text-indigo-500" />
          Assinatura
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">Pipeline de assinatura — do envio à liberação para execução</p>
      </div>

      {/* Stage tabs */}
      <div className="flex gap-1 p-1 rounded-2xl border overflow-x-auto hide-scrollbar bg-slate-50 border-slate-200">
        {STAGES.map(s => {
          const Icon = s.icon
          const count = counts[s.key]
          const active = activeStage === s.key
          return (
            <button
              key={s.key}
              onClick={() => setActiveStage(s.key)}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                active
                  ? `${s.bg} ${s.text} font-bold shadow-sm ${s.border.replace('border-l-', 'border-')}`
                  : 'text-slate-500 font-medium border-transparent hover:bg-white hover:shadow-sm'
              }`}
            >
              <Icon size={15} className="shrink-0" />
              {s.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 flex items-center justify-center ${
                  active ? s.badge : 'bg-slate-100 text-slate-500'
                }`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar número, objeto ou contraparte..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
        </div>
        <div className="flex items-center gap-2">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.field}
              onClick={() => {
                if (sortField === opt.field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                else { setSortField(opt.field); setSortDir('asc') }
              }}
              className={`px-2.5 py-2 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                sortField === opt.field ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {opt.label}
              {sortField === opt.field && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
            </button>
          ))}
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-slate-400 hover:text-slate-600'}`}>
              <LayoutList size={14} />
            </button>
            <button onClick={() => setViewMode('cards')} className={`p-2 ${viewMode === 'cards' ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-slate-400 hover:text-slate-600'}`}>
              <LayoutGrid size={14} />
            </button>
          </div>
          <button
            onClick={() => exportCSV(filtered, stage.label)}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all"
            title="Exportar CSV"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <FileSignature size={28} className="text-indigo-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhum item nesta etapa</p>
          <p className="text-xs text-slate-400 mt-1">
            {busca ? 'Tente ajustar a busca' : 'Contratos aparecerão aqui conforme avançam no fluxo de assinatura'}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        /* Table view */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Número</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contraparte</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden lg:table-cell">Objeto</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Signatários</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">Valor</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:table-cell">Data</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(item => (
                  <tr key={item.id} onClick={() => nav(`/contratos/solicitacoes/${item.id}`)} className="hover:bg-slate-50/80 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 rounded-md px-2 py-0.5">{item.numero || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-700 truncate max-w-[180px]">{item.contraparte}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="text-xs text-slate-500 truncate max-w-[240px]">{item.objeto}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.assinatura && item.assinatura.signatarios?.length > 0 ? (
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {item.assinatura.signatarios.map((sig, idx) => (
                            <span key={idx} className={`inline-flex items-center gap-0.5 text-[9px] font-semibold rounded-full px-1.5 py-0.5 border ${
                              sig.status === 'assinado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              sig.status === 'recusado' ? 'bg-red-50 text-red-600 border-red-200' :
                              'bg-slate-50 text-slate-600 border-slate-200'
                            }`}>
                              <User size={8} />
                              {sig.nome.split(' ')[0]}
                              {sig.status === 'assinado' && <CheckCircle2 size={8} className="text-emerald-500" />}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className="text-xs font-bold text-slate-700">{item.valor ? fmt(item.valor) : '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <span className="text-[11px] text-slate-400">{fmtData(item.data)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={e => { e.stopPropagation(); nav(`/contratos/solicitacoes/${item.id}`) }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all"
                      >
                        <Eye size={11} /> Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card view */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(item => (
            <div
              key={item.id}
              onClick={() => nav(`/contratos/solicitacoes/${item.id}`)}
              className={`bg-white rounded-2xl border-l-[3px] border border-slate-200 shadow-sm p-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer ${stage.border}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5">{item.numero || '-'}</span>
                <span className="text-[10px] text-slate-400 shrink-0">{fmtData(item.data)}</span>
              </div>

              <p className="text-sm font-bold text-slate-800 mt-2 truncate">{item.objeto}</p>

              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-500">
                <Building2 size={11} className="text-slate-400" />
                <span className="truncate max-w-[180px]">{item.contraparte}</span>
              </div>

              {/* Signatarios */}
              {item.assinatura && item.assinatura.signatarios?.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {item.assinatura.signatarios.map((sig, idx) => (
                    <span key={idx} className={`inline-flex items-center gap-0.5 text-[9px] font-semibold rounded-full px-1.5 py-0.5 border ${
                      sig.status === 'assinado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      sig.status === 'recusado' ? 'bg-red-50 text-red-600 border-red-200' :
                      'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      <User size={8} />
                      {sig.nome.split(' ')[0]}
                      {sig.status === 'assinado' && <CheckCircle2 size={8} className="text-emerald-500" />}
                      {sig.status === 'recusado' && <XCircle size={8} className="text-red-400" />}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${stage.bg} ${stage.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
                  {stage.label}
                </span>
                {item.valor != null && (
                  <span className="text-xs font-bold text-indigo-600">{fmt(item.valor)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
