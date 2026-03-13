import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileSignature, Search, Plus, Eye, LayoutList, LayoutGrid, Download,
  ArrowUp, ArrowDown, ClipboardList, FileEdit, ShieldCheck,
  Building2, Calendar, Tag,
} from 'lucide-react'
import { useSolicitacoes, useSolicitacoesDashboard } from '../../hooks/useSolicitacoes'
import type { EtapaSolicitacao, Solicitacao } from '../../types/contratos'

// ── Pipeline stages ─────────────────────────────────────────────────────────

type PipelineStage = {
  key: EtapaSolicitacao
  label: string
  icon: typeof ClipboardList
  dot: string
  bg: string
  text: string
  border: string
  pill: string
  pillText: string
}

const STAGES: PipelineStage[] = [
  { key: 'solicitacao',         label: 'Pendente',       icon: ClipboardList, dot: 'bg-blue-500',   bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-l-blue-500',   pill: 'bg-blue-50',   pillText: 'text-blue-700' },
  { key: 'preparar_minuta',     label: 'Minuta',         icon: FileEdit,      dot: 'bg-amber-500',  bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-l-amber-500',  pill: 'bg-amber-50',  pillText: 'text-amber-700' },
  { key: 'aprovacao_diretoria', label: 'Em Aprovação',   icon: ShieldCheck,   dot: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-l-orange-500', pill: 'bg-orange-50', pillText: 'text-orange-700' },
]

// ── Formatters ──────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const URGENCIA_CFG: Record<string, { dot: string; label: string }> = {
  critica: { dot: 'bg-red-500',    label: 'Crítica' },
  alta:    { dot: 'bg-orange-500', label: 'Alta' },
  normal:  { dot: 'bg-slate-400',  label: 'Normal' },
  baixa:   { dot: 'bg-green-500',  label: 'Baixa' },
}

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

function exportCSV(items: Solicitacao[], stageName: string) {
  const headers = ['Número', 'Contraparte', 'Objeto', 'Urgência', 'Valor', 'Data']
  const rows = items.map(s => [
    s.numero, s.contraparte_nome, s.objeto, s.urgencia || 'normal',
    s.valor_estimado ?? '', fmtData(s.created_at),
  ])
  const bom = '\uFEFF'
  const csv = bom + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `solicitacoes-${stageName}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function SolicitacoesLista() {
  const nav = useNavigate()
  const [activeStage, setActiveStage] = useState<EtapaSolicitacao>('solicitacao')
  const [busca, setBusca] = useState('')
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  const { data: dashboard = {}, isLoading: loadingDash } = useSolicitacoesDashboard()

  // Fetch items for active stage (resumo_executivo folds into preparar_minuta)
  const { data: stageItems = [], isLoading } = useSolicitacoes({ etapa_atual: activeStage })
  const { data: resumoItems = [] } = useSolicitacoes({ etapa_atual: 'resumo_executivo' })

  // Merge resumo_executivo into minuta tab
  const rawItems = useMemo(() => {
    if (activeStage === 'preparar_minuta') return [...stageItems, ...resumoItems]
    return stageItems
  }, [activeStage, stageItems, resumoItems])

  // Search + Sort
  const filtered = useMemo(() => {
    let items = rawItems
    if (busca.trim()) {
      const q = busca.toLowerCase()
      items = items.filter(s =>
        s.numero?.toLowerCase().includes(q) ||
        s.objeto?.toLowerCase().includes(q) ||
        s.contraparte_nome?.toLowerCase().includes(q)
      )
    }
    items.sort((a, b) => {
      let cmp = 0
      if (sortField === 'data') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      else if (sortField === 'contraparte') cmp = (a.contraparte_nome || '').localeCompare(b.contraparte_nome || '')
      else if (sortField === 'valor') cmp = (a.valor_estimado ?? 0) - (b.valor_estimado ?? 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return items
  }, [rawItems, busca, sortField, sortDir])

  const stage = STAGES.find(s => s.key === activeStage)!

  // Dashboard counts (merge resumo_executivo into minuta)
  const getCount = (key: EtapaSolicitacao) => {
    if (key === 'preparar_minuta') return (dashboard['preparar_minuta'] ?? 0) + (dashboard['resumo_executivo'] ?? 0)
    return dashboard[key] ?? 0
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <FileSignature size={20} className="text-indigo-600" />
            Solicitações de Contrato
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Pipeline de solicitações — da abertura à aprovação</p>
        </div>
        <button
          onClick={() => nav('/contratos/solicitacoes/nova')}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200"
        >
          <Plus size={14} /> Nova Solicitação
        </button>
      </div>

      {/* Stage tabs */}
      <div className="flex gap-1 p-1 rounded-2xl border overflow-x-auto hide-scrollbar bg-slate-50 border-slate-200">
        {STAGES.map(s => {
          const Icon = s.icon
          const count = getCount(s.key)
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
                  active ? `${s.pill} ${s.pillText}` : 'bg-slate-100 text-slate-500'
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
          <p className="text-sm font-semibold text-slate-500">Nenhuma solicitação nesta etapa</p>
          <p className="text-xs text-slate-400 mt-1">
            {busca ? 'Tente ajustar a busca' : 'Itens aparecerão aqui conforme avançam no fluxo'}
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
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Urgência</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">Valor</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:table-cell">Data</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(s => {
                  const urg = URGENCIA_CFG[s.urgencia] ?? URGENCIA_CFG.normal
                  return (
                    <tr key={s.id} onClick={() => nav(`/contratos/solicitacoes/${s.id}`)} className="hover:bg-slate-50/80 transition-colors cursor-pointer">
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 rounded-md px-2 py-0.5">{s.numero || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-700 truncate max-w-[180px]">{s.contraparte_nome}</p>
                        {s.obra?.nome && <p className="text-[10px] text-slate-400 truncate">{s.obra.nome}</p>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <p className="text-xs text-slate-500 truncate max-w-[240px]">{s.objeto}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${urg.dot}`} />
                          <span className="text-[10px] font-medium text-slate-500">{urg.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span className="text-xs font-bold text-slate-700">{s.valor_estimado ? fmt(s.valor_estimado) : '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <span className="text-[11px] text-slate-400">{fmtData(s.created_at)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={e => { e.stopPropagation(); nav(`/contratos/solicitacoes/${s.id}`) }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all"
                        >
                          <Eye size={11} /> Ver
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card view */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(s => {
            const urg = URGENCIA_CFG[s.urgencia] ?? URGENCIA_CFG.normal
            const etapaReal = s.etapa_atual
            const etapaCfg = STAGES.find(st => st.key === etapaReal) || STAGES.find(st => st.key === 'preparar_minuta')!
            return (
              <div
                key={s.id}
                onClick={() => nav(`/contratos/solicitacoes/${s.id}`)}
                className={`bg-white rounded-2xl border-l-[3px] border border-slate-200 shadow-sm p-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer ${etapaCfg.border}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5">{s.numero || '-'}</span>
                    {etapaReal === 'resumo_executivo' && (
                      <span className="text-[9px] font-semibold bg-purple-50 text-purple-600 rounded-full px-2 py-0.5">Resumo Exec.</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{fmtData(s.created_at)}</span>
                </div>

                <p className="text-sm font-bold text-slate-800 mt-2 truncate">{s.objeto}</p>

                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Building2 size={11} className="text-slate-400" />
                    <span className="truncate max-w-[140px]">{s.contraparte_nome}</span>
                  </div>
                  {s.obra?.nome && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Tag size={9} />
                      <span className="truncate max-w-[100px]">{s.obra.nome}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${urg.dot}`} />
                    <span className="text-[10px] font-medium text-slate-500">{urg.label}</span>
                  </div>
                  {s.valor_estimado != null && (
                    <span className="text-xs font-bold text-indigo-600">{fmt(s.valor_estimado)}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
