// ─────────────────────────────────────────────────────────────────────────────
// SolicitacoesPipeline — as solicitações abertas de Locação no mesmo quadro da
// OS de Frotas: seis etapas, visão lista/cards/quadro (quadro é a padrão).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Wrench, X, Search, LayoutList, LayoutGrid, Columns3, ArrowUp, ArrowDown,
} from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useSolicitacoesLocacao } from '../../../hooks/useLocacao'
import SolicitacaoModal from './SolicitacaoModal'
import { SolicitacaoCard, SolicitacaoRow, URGENCIA_ORDER, imovelLabel } from './SolicitacaoCards'
import {
  STAGES, STAGE_ACCENT, STAGE_ACCENT_DARK, stageDe, ENCERRADOS, type StageKey,
} from './solicitacaoStages'
import type { LocSolicitacao } from '../../../types/locacao'

type ViewMode = 'cards' | 'list' | 'quadro'
type SortField = 'data' | 'imovel' | 'urgencia'

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'data',     label: 'Data' },
  { field: 'imovel',   label: 'Imóvel' },
  { field: 'urgencia', label: 'Urgência' },
]

export default function SolicitacoesPipeline() {
  const { isDark } = useTheme()
  const { data: solicitacoes = [], isLoading } = useSolicitacoesLocacao()

  const [activeTab, setActiveTab] = useState<StageKey>('pendente')
  const [viewMode, setViewMode] = useState<ViewMode>('quadro')
  const [busca, setBusca] = useState('')
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [detail, setDetail] = useState<LocSolicitacao | null>(null)

  // Deep link do Portal ("Fechar OS"): ?imovel=<id> recorta neste imóvel e, se
  // houver uma única solicitação viva, abre o modal dela já na etapa certa.
  const [searchParams] = useSearchParams()
  const imovelLink = searchParams.get('imovel')
  const abriuLink = useRef(false)
  useEffect(() => {
    if (!imovelLink || abriuLink.current || !solicitacoes.length) return
    const vivas = solicitacoes.filter(s => s.imovel_id === imovelLink && !ENCERRADOS.includes(s.status))
    if (!vivas.length) return
    abriuLink.current = true
    // A mais avançada primeiro: é a que está pronta para ser encerrada.
    const ordem: StageKey[] = ['em_execucao', 'aprovada', 'aguardando_aprovacao', 'em_cotacao', 'pendente']
    const alvo = [...vivas].sort((a, b) => ordem.indexOf(stageDe(a.status)) - ordem.indexOf(stageDe(b.status)))[0]
    setActiveTab(stageDe(alvo.status))
    setDetail(alvo)
  }, [imovelLink, solicitacoes])

  // Altura do quadro medida em runtime — mesma solução do board de Frotas.
  const boardRef = useRef<HTMLDivElement>(null)
  const [boardH, setBoardH] = useState<number>()
  useEffect(() => {
    if (viewMode !== 'quadro') return
    const medir = () => {
      const el = boardRef.current
      if (!el) return
      setBoardH(Math.max(360, Math.round(window.innerHeight - el.getBoundingClientRect().top - 16)))
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [viewMode, isLoading])

  const grouped = useMemo(() => {
    const map = new Map<StageKey, LocSolicitacao[]>()
    STAGES.forEach(s => map.set(s.key, []))
    // "Liberado" é vitrine do que saiu há pouco — o acervo fica na aba Histórico.
    const corte = Date.now() - 30 * 86_400_000
    solicitacoes.forEach(s => {
      if (imovelLink && s.imovel_id !== imovelLink) return
      if (s.status === 'cancelada' || s.status === 'rejeitada') return
      const key = stageDe(s.status)
      if (key === 'concluida') {
        const ref = s.data_conclusao ?? s.created_at
        if (ref && new Date(ref).getTime() < corte) return
      }
      map.get(key)?.push(s)
    })
    return map
  }, [solicitacoes, imovelLink])

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(f); setSortDir('asc') }
  }

  const ordenar = (items: LocSolicitacao[]) => {
    const q = busca.toLowerCase()
    let out = items
    if (busca) {
      out = out.filter(s =>
        [s.titulo, s.descricao, imovelLabel(s), s.imovel?.cidade, s.criado_por_nome]
          .some(v => v?.toLowerCase().includes(q)))
    }
    return [...out].sort((a, b) => {
      let c = 0
      if (sortField === 'data') c = (a.created_at || '').localeCompare(b.created_at || '')
      else if (sortField === 'imovel') c = imovelLabel(a).localeCompare(imovelLabel(b))
      else c = URGENCIA_ORDER[a.urgencia] - URGENCIA_ORDER[b.urgencia]
      return sortDir === 'asc' ? c : -c
    })
  }

  const activeItems = useMemo(
    () => ordenar(grouped.get(activeTab) || []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grouped, activeTab, busca, sortField, sortDir],
  )

  const quadroGrouped = useMemo(() => {
    const out = new Map<StageKey, LocSolicitacao[]>()
    STAGES.forEach(s => out.set(s.key, ordenar(grouped.get(s.key) || [])))
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped, busca, sortField, sortDir])

  if (isLoading) {
    return <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  }

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      {/* Etapas — escondidas no quadro, onde as colunas já são as etapas. */}
      {viewMode !== 'quadro' && (
      <div className={`flex gap-1 p-1 pb-2 rounded-t-2xl border-b overflow-x-auto hide-scrollbar ${
        isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'
      }`}>
        {STAGES.map(stage => {
          const count = grouped.get(stage.key)?.length || 0
          const isActive = activeTab === stage.key
          const Icon = stage.icon
          const a = isDark ? STAGE_ACCENT_DARK[stage.key] : STAGE_ACCENT[stage.key]
          return (
            <button key={stage.key} onClick={() => { setActiveTab(stage.key); setBusca('') }}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                isActive
                  ? `${a.bgActive} ${a.textActive} ${a.border} font-bold shadow-sm`
                  : `${a.bg} ${a.text} font-medium border-transparent ${isDark ? '' : 'hover:bg-white hover:shadow-sm'}`
              }`}>
              <Icon size={15} className="shrink-0" /> {stage.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 ${
                  isActive ? a.badge : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'
                }`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>
      )}

      {/* Toolbar */}
      <div className={`px-4 py-2.5 border-b flex flex-wrap items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar imóvel, problema, solicitante..."
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
              isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'
            }`} />
          {busca && (
            <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {SORT_OPTIONS.map(opt => (
            <button key={opt.field} onClick={() => toggleSort(opt.field)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                sortField === opt.field
                  ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-800'
                  : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
              }`}>
              {opt.label} {sortField === opt.field && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
            </button>
          ))}
        </div>
        <div className={`flex items-center rounded-lg border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <button onClick={() => setViewMode('list')} title="Lista"
            className={`p-1.5 ${viewMode === 'list' ? (isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}><LayoutList size={14} /></button>
          <button onClick={() => setViewMode('cards')} title="Cards"
            className={`p-1.5 ${viewMode === 'cards' ? (isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}><LayoutGrid size={14} /></button>
          <button onClick={() => setViewMode('quadro')} title="Quadro"
            className={`p-1.5 ${viewMode === 'quadro' ? (isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}><Columns3 size={14} /></button>
        </div>
        <span className={`ml-auto text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {viewMode === 'quadro'
            ? [...quadroGrouped.values()].reduce((s, l) => s + l.length, 0)
            : activeItems.length} item(s)
        </span>
      </div>

      {/* Conteúdo */}
      <div className="min-h-[200px]">
        {viewMode === 'quadro' ? (
          <div ref={boardRef} style={boardH ? { height: boardH } : undefined}
            className="flex gap-3 p-4 overflow-x-auto min-h-[360px]">
            {STAGES.map(stage => {
              const items = quadroGrouped.get(stage.key) || []
              const a = isDark ? STAGE_ACCENT_DARK[stage.key] : STAGE_ACCENT[stage.key]
              const Icon = stage.icon
              return (
                <div key={stage.key} className="min-w-[264px] w-[264px] shrink-0 flex flex-col h-full">
                  <div className={`flex items-center gap-2 px-2.5 py-2 rounded-xl mb-2 text-xs font-bold border shrink-0 ${a.bgActive} ${a.textActive} ${a.border}`}>
                    <Icon size={14} className="shrink-0" /> {stage.label}
                    <span className={`ml-auto text-[10px] font-bold rounded-full min-w-[20px] px-1.5 py-0.5 ${a.badge}`}>{items.length}</span>
                  </div>
                  <div className={`flex-1 min-h-0 overflow-y-auto hide-scrollbar rounded-xl border border-dashed p-2 space-y-2 ${
                    isDark ? 'border-white/[0.06] bg-white/[0.015]' : 'border-slate-200 bg-slate-50/50'
                  }`}>
                    {items.map(s => (
                      <SolicitacaoCard key={s.id} sol={s} isDark={isDark} onClick={() => setDetail(s)} />
                    ))}
                    {items.length === 0 && (
                      <div className={`h-full flex items-center justify-center text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
                        Nenhuma solicitação
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : activeItems.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
            <Wrench size={40} className="mb-3" />
            <p className="text-sm font-medium">Nenhuma solicitação nesta etapa</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="space-y-2 p-4">
            {activeItems.map(s => <SolicitacaoCard key={s.id} sol={s} isDark={isDark} onClick={() => setDetail(s)} />)}
          </div>
        ) : (
          <div>
            <div className={`flex items-center gap-2 px-3 py-1 border-b text-[10px] font-semibold uppercase tracking-wider ${
              isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'
            }`}>
              <span className="w-[3px]" /><span className="w-[13px]" />
              <span className="flex-1">Solicitação</span>
              <span className="w-[76px]">Tipo</span><span className="w-[62px] text-center">Urgência</span>
              <span className="w-[50px] text-right">Dias</span><span className="w-[80px] text-right">Valor</span>
            </div>
            {activeItems.map(s => <SolicitacaoRow key={s.id} sol={s} isDark={isDark} onClick={() => setDetail(s)} />)}
          </div>
        )}
      </div>

      {detail && <SolicitacaoModal sol={detail} isDark={isDark} onClose={() => setDetail(null)} />}
    </div>
  )
}
