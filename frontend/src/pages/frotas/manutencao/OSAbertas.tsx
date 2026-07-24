import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Wrench, X, Clock, Building2,
  Search, LayoutList, LayoutGrid, Columns3, ArrowUp, ArrowDown, CheckCircle2,
  ClipboardCheck, ShieldCheck, Cog, FileSearch, CalendarClock,
} from 'lucide-react'
import { UpperTextarea } from '../../../components/UpperInput'
import { useOrdensServico, useCriarOS, useVeiculos, useAlocacoes } from '../../../hooks/useFrotas'
import { useTheme } from '../../../contexts/ThemeContext'
import { formatCodigoCategoria } from '../../../components/frotas/veiculoObs'
import VeiculoDetalhesModal from '../../../components/frotas/VeiculoDetalhesModal'
import OSModal from '../../../components/frotas/os/OSModal'
import { OSCard, OSRow, PRIOR, TIPO_LABEL, BRL, diasEmAberto } from '../../../components/frotas/os/OSCards'
import type { FroOrdemServico, PrioridadeOS, TipoOS, StatusOS, FroVeiculo, FroAlocacao } from '../../../types/frotas'

// ── Pipeline stages ──────────────────────────────────────────────────────────
type StageKey = StatusOS

interface Stage {
  key: StageKey
  label: string
  icon: React.ElementType
}

const STAGES: Stage[] = [
  { key: 'pendente',             label: 'Pendente',     icon: ClipboardCheck },
  { key: 'em_cotacao',           label: 'Cotação',      icon: FileSearch },
  { key: 'aguardando_aprovacao', label: 'Aprovação',    icon: ShieldCheck },
  { key: 'aprovada',             label: 'Programação',  icon: CalendarClock },
  { key: 'em_execucao',          label: 'Execução',     icon: Cog },
  { key: 'concluida',            label: 'Liberado',     icon: CheckCircle2 },
]

type AccentSet = { bg: string; bgActive: string; text: string; textActive: string; dot: string; badge: string; border: string }

const STAGE_ACCENT: Record<StageKey, AccentSet> = {
  pendente:             { bg:'bg-slate-50',   bgActive:'bg-slate-100',   text:'text-slate-500',   textActive:'text-slate-800',   dot:'bg-slate-400',   badge:'bg-slate-200/80 text-slate-600',   border:'border-slate-200' },
  aberta:               { bg:'bg-slate-50',   bgActive:'bg-slate-100',   text:'text-slate-500',   textActive:'text-slate-800',   dot:'bg-slate-400',   badge:'bg-slate-200/80 text-slate-600',   border:'border-slate-200' },
  em_cotacao:           { bg:'bg-sky-50',     bgActive:'bg-sky-100',     text:'text-sky-500',     textActive:'text-sky-800',     dot:'bg-sky-500',     badge:'bg-sky-200/80 text-sky-700',       border:'border-sky-200' },
  aguardando_aprovacao: { bg:'bg-amber-50',   bgActive:'bg-amber-100',   text:'text-amber-500',   textActive:'text-amber-800',   dot:'bg-amber-500',   badge:'bg-amber-200/80 text-amber-700',   border:'border-amber-200' },
  aprovada:             { bg:'bg-teal-50',    bgActive:'bg-teal-100',    text:'text-teal-500',    textActive:'text-teal-800',    dot:'bg-teal-500',    badge:'bg-teal-200/80 text-teal-700',     border:'border-teal-200' },
  em_execucao:          { bg:'bg-violet-50',  bgActive:'bg-violet-100',  text:'text-violet-500',  textActive:'text-violet-800',  dot:'bg-violet-500',  badge:'bg-violet-200/80 text-violet-700', border:'border-violet-200' },
  concluida:            { bg:'bg-emerald-50', bgActive:'bg-emerald-100', text:'text-emerald-500', textActive:'text-emerald-800', dot:'bg-emerald-500', badge:'bg-emerald-200/80 text-emerald-700',border:'border-emerald-200' },
  rejeitada:            { bg:'bg-red-50',     bgActive:'bg-red-100',     text:'text-red-500',     textActive:'text-red-800',     dot:'bg-red-500',     badge:'bg-red-200/80 text-red-700',       border:'border-red-200' },
  cancelada:            { bg:'bg-slate-50',   bgActive:'bg-slate-100',   text:'text-slate-400',   textActive:'text-slate-600',   dot:'bg-slate-400',   badge:'bg-slate-200/80 text-slate-500',   border:'border-slate-200' },
}

const STAGE_ACCENT_DARK: Record<StageKey, AccentSet> = {
  pendente:             { bg:'bg-white/[0.02]', bgActive:'bg-white/[0.06]', text:'text-slate-500',   textActive:'text-slate-200',   dot:'bg-slate-500',   badge:'bg-white/[0.06] text-slate-400',     border:'border-white/[0.08]' },
  aberta:               { bg:'bg-white/[0.02]', bgActive:'bg-white/[0.06]', text:'text-slate-500',   textActive:'text-slate-200',   dot:'bg-slate-500',   badge:'bg-white/[0.06] text-slate-400',     border:'border-white/[0.08]' },
  em_cotacao:           { bg:'bg-sky-500/5',     bgActive:'bg-sky-500/15',   text:'text-sky-400',     textActive:'text-sky-200',     dot:'bg-sky-400',     badge:'bg-sky-500/15 text-sky-300',         border:'border-sky-500/20' },
  aguardando_aprovacao: { bg:'bg-amber-500/5',   bgActive:'bg-amber-500/15', text:'text-amber-400',   textActive:'text-amber-200',   dot:'bg-amber-400',   badge:'bg-amber-500/15 text-amber-300',     border:'border-amber-500/20' },
  aprovada:             { bg:'bg-teal-500/5',    bgActive:'bg-teal-500/15',  text:'text-teal-400',    textActive:'text-teal-200',    dot:'bg-teal-400',    badge:'bg-teal-500/15 text-teal-300',       border:'border-teal-500/20' },
  em_execucao:          { bg:'bg-violet-500/5',  bgActive:'bg-violet-500/15',text:'text-violet-400',  textActive:'text-violet-200',  dot:'bg-violet-400',  badge:'bg-violet-500/15 text-violet-300',   border:'border-violet-500/20' },
  concluida:            { bg:'bg-emerald-500/5', bgActive:'bg-emerald-500/15',text:'text-emerald-400',textActive:'text-emerald-200',dot:'bg-emerald-400', badge:'bg-emerald-500/15 text-emerald-300', border:'border-emerald-500/20' },
  rejeitada:            { bg:'bg-red-500/5',     bgActive:'bg-red-500/15',   text:'text-red-400',     textActive:'text-red-200',     dot:'bg-red-400',     badge:'bg-red-500/15 text-red-300',         border:'border-red-500/20' },
  cancelada:            { bg:'bg-white/[0.02]',  bgActive:'bg-white/[0.06]', text:'text-slate-500',   textActive:'text-slate-400',   dot:'bg-slate-500',   badge:'bg-white/[0.06] text-slate-500',     border:'border-white/[0.08]' },
}

// ── Modal Nova OS ────────────────────────────────────────────────────────────
// Mantido sem gatilho na tela: o botão "Nova OS" saiu do cabeçalho a pedido.
// Hoje nenhum outro ponto do sistema abre uma OS direto (o menu lateral cria
// Solicitação, que é outra coisa), então isto fica pronto para ser religado.
function NovaOSModal({ onClose, isDark }: { onClose: () => void; isDark: boolean }) {
  const criar = useCriarOS()
  const { data: veiculos = [] } = useVeiculos()
  const [form, setForm] = useState({
    veiculo_id: '', tipo: 'corretiva' as TipoOS,
    prioridade: 'media' as PrioridadeOS,
    descricao_problema: '', data_previsao: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await criar.mutateAsync({
      veiculo_id: form.veiculo_id, tipo: form.tipo,
      prioridade: form.prioridade,
      descricao_problema: form.descricao_problema,
      data_previsao: form.data_previsao || undefined,
    })
    onClose()
  }

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const inp = `w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors ${
    isDark
      ? 'bg-white/[0.06] border border-white/[0.12] text-white placeholder-slate-500 focus:border-rose-500'
      : 'bg-white border border-slate-200 shadow-sm text-slate-800 placeholder-slate-400 focus:border-rose-400'
  }`
  const lbl = `block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()}
        className={`rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border ${isDark ? 'border-white/[0.06]' : 'border-slate-200'} ${bg}`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <h2 className={`text-base font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Wrench size={16} className="text-rose-500" /> Nova Ordem de Servico
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={lbl}>Veiculo / Maquina *</label>
            <select className={inp} value={form.veiculo_id}
              onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} required>
              <option value="">Selecione...</option>
              {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Tipo</label>
              <select className={inp} value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoOS }))}>
                {(Object.entries(TIPO_LABEL) as [TipoOS, typeof TIPO_LABEL[TipoOS]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Prioridade</label>
              <select className={inp} value={form.prioridade}
                onChange={e => setForm(f => ({ ...f, prioridade: e.target.value as PrioridadeOS }))}>
                {(Object.entries(PRIOR) as [PrioridadeOS, typeof PRIOR[PrioridadeOS]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Descricao do Problema *</label>
            <UpperTextarea className={`${inp} resize-none`} rows={3} required
              placeholder="Descreva o problema identificado..."
              value={form.descricao_problema}
              onChange={e => setForm(f => ({ ...f, descricao_problema: e.target.value }))} />
          </div>
          <div>
            <label className={lbl}>Previsao de Conclusao</label>
            <input type="date" className={inp} value={form.data_previsao}
              onChange={e => setForm(f => ({ ...f, data_previsao: e.target.value }))} />
          </div>
        </div>
        <div className={`px-5 py-4 border-t flex gap-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <button type="button" onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
            Cancelar
          </button>
          <button type="submit" disabled={criar.isPending}
            className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-sm text-white font-bold transition-colors disabled:opacity-50">
            {criar.isPending ? 'Criando...' : 'Criar OS'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
type SortField = 'data' | 'placa' | 'prioridade'
type ViewMode = 'cards' | 'list' | 'quadro'

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'data', label: 'Data' }, { field: 'placa', label: 'Placa' }, { field: 'prioridade', label: 'Prioridade' },
]

const PRIOR_ORDER: Record<PrioridadeOS, number> = { critica: 0, alta: 1, media: 2, baixa: 3 }

export default function OSAbertas() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<StageKey>('pendente')
  const [detail, setDetail] = useState<FroOrdemServico | null>(null)
  const [busca, setBusca] = useState('')

  // Deep link do Portal (?veiculo=<id>): restringe o pipeline àquele ativo.
  const [searchParams] = useSearchParams()
  const veiculoLink = searchParams.get('veiculo')
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('quadro')

  const { data: ordens = [], isLoading } = useOrdensServico()
  const { data: veiculosAll = [] } = useVeiculos()
  const { data: alocacoes = [] } = useAlocacoes({ status: 'ativa' })
  const veicMap = useMemo(() => new Map(veiculosAll.map(v => [v.id, v])), [veiculosAll])
  const alocByVeic = useMemo(() => new Map(alocacoes.map(a => [a.veiculo_id, a])), [alocacoes])
  const [detalheVeic, setDetalheVeic] = useState<{ v: FroVeiculo; a?: FroAlocacao } | null>(null)
  const openVeicDetalhe = (veiculo_id: string) => {
    const v = veicMap.get(veiculo_id)
    if (!v) return
    setDetalheVeic({ v, a: alocByVeic.get(veiculo_id) })
  }

  // Altura do quadro medida em runtime: ocupa o que sobra da janela a partir de
  // onde o board realmente começa. Número fixo não serve — a barra de etapas muda
  // de altura conforme a largura, e cada monitor/zoom deixa um espaço diferente.
  const boardRef = useRef<HTMLDivElement>(null)
  const [boardH, setBoardH] = useState<number>()
  useEffect(() => {
    if (viewMode !== 'quadro') return
    const medir = () => {
      const el = boardRef.current
      if (!el) return
      const topo = el.getBoundingClientRect().top
      setBoardH(Math.max(360, Math.round(window.innerHeight - topo - 16)))
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
    // isLoading nas deps: enquanto carrega a tela mostra o spinner e o board nem
    // existe no DOM — sem isso a medição rodaria uma vez, com o ref vazio, e parava.
  }, [viewMode, isLoading])

  const grouped = useMemo(() => {
    const map = new Map<StageKey, FroOrdemServico[]>()
    STAGES.forEach(s => map.set(s.key, []))
    // "Liberado" é vitrine do que saiu há pouco — o acervo completo fica na aba Histórico.
    const corteLiberado = Date.now() - 30 * 86_400_000
    ordens.forEach(o => {
      if (veiculoLink && o.veiculo_id !== veiculoLink) return
      // Tratar 'aberta' como 'pendente' (ambos são estágio inicial)
      const key = (o.status === 'aberta' ? 'pendente' : o.status) as StageKey
      if (key === 'concluida') {
        const ref = o.data_conclusao ?? o.data_abertura
        if (ref && new Date(ref).getTime() < corteLiberado) return
      }
      map.get(key)?.push(o)
    })
    return map
  }, [ordens, veiculoLink])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const activeItems = useMemo(() => {
    let items = [...(grouped.get(activeTab) || [])]
    if (busca) {
      const q = busca.toLowerCase()
      items = items.filter(o =>
        [o.veiculo?.placa, o.veiculo?.modelo, o.numero_os, o.descricao_problema, o.fornecedor?.razao_social]
          .some(v => v?.toLowerCase().includes(q))
      )
    }
    items.sort((a, b) => {
      let c = 0
      if (sortField === 'data') c = (a.data_abertura || '').localeCompare(b.data_abertura || '')
      else if (sortField === 'placa') c = (a.veiculo?.placa || '').localeCompare(b.veiculo?.placa || '')
      else c = PRIOR_ORDER[a.prioridade] - PRIOR_ORDER[b.prioridade]
      return sortDir === 'asc' ? c : -c
    })
    return items
  }, [grouped, activeTab, busca, sortField, sortDir])

  // Quadro (kanban): todas as etapas como colunas, com busca + ordenação aplicadas
  const quadroGrouped = useMemo(() => {
    const q = busca.toLowerCase()
    const out = new Map<StageKey, FroOrdemServico[]>()
    STAGES.forEach(s => {
      let items = [...(grouped.get(s.key) || [])]
      if (busca) items = items.filter(o =>
        [o.veiculo?.placa, o.veiculo?.modelo, o.numero_os, o.descricao_problema, o.fornecedor?.razao_social]
          .some(v => v?.toLowerCase().includes(q)))
      items.sort((a, b) => {
        let c = 0
        if (sortField === 'data') c = (a.data_abertura || '').localeCompare(b.data_abertura || '')
        else if (sortField === 'placa') c = (a.veiculo?.placa || '').localeCompare(b.veiculo?.placa || '')
        else c = PRIOR_ORDER[a.prioridade] - PRIOR_ORDER[b.prioridade]
        return sortDir === 'asc' ? c : -c
      })
      out.set(s.key, items)
    })
    return out
  }, [grouped, busca, sortField, sortDir])

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      {/* Sem cabeçalho: a aba do hub já identifica a tela — a grade começa no topo. */}

      {/* Pipeline tabs */}
      <div className={`flex gap-1 p-1 pb-2 rounded-t-2xl border-b overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
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
                <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 ${isActive ? a.badge : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className={`px-4 py-2.5 border-b flex flex-wrap items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar placa, OS, problema..."
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 ${
              isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'
            }`} />
          {busca && <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>}
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
          <button onClick={() => setViewMode('list')} className={`p-1.5 ${viewMode === 'list' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutList size={14} /></button>
          <button onClick={() => setViewMode('cards')} className={`p-1.5 ${viewMode === 'cards' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutGrid size={14} /></button>
          <button onClick={() => setViewMode('quadro')} title="Quadro" className={`p-1.5 ${viewMode === 'quadro' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><Columns3 size={14} /></button>
        </div>
        {/* No quadro o contador é do board inteiro; nas outras visões, da aba ativa. */}
        <span className={`ml-auto text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {viewMode === 'quadro'
            ? [...quadroGrouped.values()].reduce((s, l) => s + l.length, 0)
            : activeItems.length} item(s)
        </span>
      </div>

      {/* Content */}
      <div className="min-h-[200px]">
        {viewMode === 'quadro' ? (
          // Colunas com altura de tela: o quadro não "encolhe" quando uma etapa
          // está vazia, e cada coluna rola por dentro em vez de esticar a página.
          <div
            ref={boardRef}
            style={boardH ? { height: boardH } : undefined}
            className="flex gap-3 p-4 overflow-x-auto min-h-[360px]"
          >
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
                    {items.map(os => <OSCard key={os.id} os={os} veicFull={veicMap.get(os.veiculo_id)} isDark={isDark} onClick={() => setDetail(os)} onVeicClick={() => openVeicDetalhe(os.veiculo_id)} />)}
                    {items.length === 0 && (
                      <div className={`h-full flex items-center justify-center text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
                        Nenhuma OS
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : activeItems.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
            <Wrench size={40} className="mb-3" /><p className="text-sm font-medium">Nenhuma OS nesta etapa</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="space-y-2 p-4">{activeItems.map(os => <OSCard key={os.id} os={os} veicFull={veicMap.get(os.veiculo_id)} isDark={isDark} onClick={() => setDetail(os)} onVeicClick={() => openVeicDetalhe(os.veiculo_id)} />)}</div>
        ) : (
          <div>
            <div className={`flex items-center gap-2 px-3 py-1 border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'}`}>
              <span className="w-[3px]" /><span className="w-2" /><span className="flex-1">Veiculo</span><span className="w-[60px]">Tipo</span><span className="w-[60px]">Prior.</span><span className="w-[50px] text-right">Dias</span><span className="w-[70px] text-right">Valor</span>
            </div>
            {activeItems.map(os => <OSRow key={os.id} os={os} veicFull={veicMap.get(os.veiculo_id)} isDark={isDark} onClick={() => setDetail(os)} onVeicClick={() => openVeicDetalhe(os.veiculo_id)} />)}
          </div>
        )}
      </div>

      {detail && (
        <OSModal
          os={detail}
          veiculo={veicMap.get(detail.veiculo_id)}
          isDark={isDark}
          onClose={() => setDetail(null)}
          onVeiculoClick={() => { setDetail(null); openVeicDetalhe(detail.veiculo_id) }}
        />
      )}
      {detalheVeic && (
        <VeiculoDetalhesModal
          veiculo={detalheVeic.v}
          isLight={!isDark}
          onClose={() => setDetalheVeic(null)}
          alocacaoInfo={detalheVeic.a ? {
            id: detalheVeic.a.id,
            obraId: detalheVeic.a.obra_id,
            obra: detalheVeic.a.obra?.nome,
            responsavel: detalheVeic.a.responsavel_nome ?? undefined,
            dataSaida: detalheVeic.a.data_saida,
            dataRetornoPrev: detalheVeic.a.data_retorno_prev,
            observacoes: detalheVeic.a.observacoes ?? undefined,
          } : undefined}
        />
      )}
    </div>
  )
}
