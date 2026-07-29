// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHDesligamento.tsx — Fluxo de Desligamento (6 etapas)
// Rail de abas no padrão do Financeiro (CPPipeline · PipelineRail).
// O conteúdo de cada etapa será montado nas próximas iterações.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  UserMinus, ClipboardList, ShieldCheck, ClipboardCheck, FileCheck, DollarSign,
  CheckCircle2, ChevronLeft, ChevronRight, Plus, Construction, Receipt,
  Search, PackageCheck, Loader2, Wallet, X, CheckCircle, XCircle, ArrowRight, AlertTriangle,
  LayoutList, LayoutGrid, ChevronUp, ChevronDown,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import {
  useColaboradoresTreino, useNadaConsta, useDefinirValorCautela, useBaixarNadaConsta,
  useDesligamentos, useCriarDesligamento, useAtualizarDesligamento, ORDEM_ETAPAS,
  type Desligamento,
} from '../../hooks/useQsma'

// ── Etapas do fluxo ───────────────────────────────────────────────────────────
export type EtapaDesligamento =
  | 'requisicao'
  | 'aprovacao'
  | 'preparo'
  | 'nada_consta'
  | 'rescisao'
  | 'encerrados'

const ETAPAS: { key: EtapaDesligamento; num: number; label: string; descricao: string; icon: typeof Receipt }[] = [
  { key: 'requisicao',  num: 1, label: 'Requisição',  descricao: 'Gestor solicita o desligamento do colaborador.',                  icon: ClipboardList },
  { key: 'aprovacao',   num: 2, label: 'Aprovação',   descricao: 'Diretoria autoriza o desligamento solicitado.',                   icon: ShieldCheck },
  { key: 'preparo',     num: 3, label: 'Preparo',     descricao: 'Comunicação, aviso prévio e organização do processo.',            icon: ClipboardCheck },
  { key: 'nada_consta', num: 4, label: 'Nada Consta', descricao: 'Devolução de equipamentos/EPIs e quitação de pendências.',        icon: FileCheck },
  { key: 'rescisao',    num: 5, label: 'Rescisão',    descricao: 'Cálculo, homologação e pagamento das verbas rescisórias.',        icon: DollarSign },
  { key: 'encerrados',  num: 6, label: 'Encerrados',  descricao: 'Desligamento concluído e arquivado.',                            icon: CheckCircle2 },
]

const ETAPA_ICON: Record<EtapaDesligamento, typeof Receipt> = Object.fromEntries(
  ETAPAS.map(e => [e.key, e.icon]),
) as Record<EtapaDesligamento, typeof Receipt>

// Acentos por etapa — mesma estrutura do STATUS_ACCENT do Financeiro
const ACCENT: Record<EtapaDesligamento, { bg: string; bgActive: string; text: string; textActive: string; border: string; badge: string; icon: string }> = {
  requisicao:  { bg: 'hover:bg-blue-50',    bgActive: 'bg-blue-50',    text: 'text-blue-600',    textActive: 'text-blue-800',    border: 'border-blue-500',    badge: 'bg-blue-100 text-blue-700',       icon: 'text-blue-500' },
  aprovacao:   { bg: 'hover:bg-amber-50',   bgActive: 'bg-amber-50',   text: 'text-amber-600',   textActive: 'text-amber-800',   border: 'border-amber-500',   badge: 'bg-amber-100 text-amber-700',     icon: 'text-amber-500' },
  preparo:     { bg: 'hover:bg-violet-50',  bgActive: 'bg-violet-50',  text: 'text-violet-600',  textActive: 'text-violet-800',  border: 'border-violet-500',  badge: 'bg-violet-100 text-violet-700',   icon: 'text-violet-500' },
  nada_consta: { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50', text: 'text-emerald-600', textActive: 'text-emerald-800', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-700', icon: 'text-emerald-500' },
  rescisao:    { bg: 'hover:bg-orange-50',  bgActive: 'bg-orange-50',  text: 'text-orange-600',  textActive: 'text-orange-800',  border: 'border-orange-500',  badge: 'bg-orange-100 text-orange-700',   icon: 'text-orange-500' },
  encerrados:  { bg: 'hover:bg-slate-100',  bgActive: 'bg-slate-100',  text: 'text-slate-600',   textActive: 'text-slate-800',   border: 'border-slate-500',   badge: 'bg-slate-200 text-slate-700',     icon: 'text-slate-500' },
}

const ACCENT_DARK: Record<EtapaDesligamento, { bg: string; bgActive: string; text: string; textActive: string; border: string; badge: string; icon: string }> = {
  requisicao:  { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-blue-500/10',    text: 'text-blue-400',    textActive: 'text-blue-300',    border: 'border-blue-400/40',    badge: 'bg-blue-500/15 text-blue-200',       icon: 'text-blue-400' },
  aprovacao:   { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-amber-500/10',   text: 'text-amber-400',   textActive: 'text-amber-300',   border: 'border-amber-400/40',   badge: 'bg-amber-500/15 text-amber-200',     icon: 'text-amber-400' },
  preparo:     { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-violet-500/10',  text: 'text-violet-400',  textActive: 'text-violet-300',  border: 'border-violet-400/40',  badge: 'bg-violet-500/15 text-violet-200',   icon: 'text-violet-400' },
  nada_consta: { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-emerald-500/10', text: 'text-emerald-400', textActive: 'text-emerald-300', border: 'border-emerald-400/40', badge: 'bg-emerald-500/15 text-emerald-200', icon: 'text-emerald-400' },
  rescisao:    { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-orange-500/10',  text: 'text-orange-400',  textActive: 'text-orange-300',  border: 'border-orange-400/40',  badge: 'bg-orange-500/15 text-orange-200',   icon: 'text-orange-400' },
  encerrados:  { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-slate-500/15',   text: 'text-slate-400',   textActive: 'text-slate-200',   border: 'border-slate-400/40',   badge: 'bg-slate-500/20 text-slate-200',     icon: 'text-slate-400' },
}

// ── Tela principal ────────────────────────────────────────────────────────────
export default function RHDesligamento() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const [etapa, setEtapa] = useState<EtapaDesligamento>('requisicao')
  const [searchParams, setSearchParams] = useSearchParams()
  const [novo, setNovo] = useState(false)
  const { data: lista = [] } = useDesligamentos()

  const ativa = ETAPAS.find(e => e.key === etapa) ?? ETAPAS[0]

  const counts: Record<EtapaDesligamento, number> = {
    requisicao: 0, aprovacao: 0, preparo: 0, nada_consta: 0, rescisao: 0, encerrados: 0,
  }
  lista.forEach(d => { if (d.status in counts) counts[d.status as EtapaDesligamento]++ })

  // Abertura via ?nova=1 (menu Nova Solicitação → Desligamento)
  useEffect(() => {
    if (searchParams.get('nova') === '1') {
      setNovo(true)
      searchParams.delete('nova')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <UserMinus size={20} className="text-rose-400" />
          Desligamento
        </h1>
        <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Fluxo de desligamento — da requisição ao encerramento
        </p>
      </div>

      <EtapaRail isDark={isDark} etapa={etapa} setEtapa={setEtapa} counts={counts} />

      <EtapaPanel etapa={ativa} isDark={isDark} lista={lista.filter(d => d.status === etapa)} />

      {novo && <RequisicaoModal isDark={isDark} onClose={() => setNovo(false)} />}
    </div>
  )
}

// ── Rail de etapas (cópia fiel do PipelineRail do Financeiro) ──────────────────
function EtapaRail({
  isDark,
  etapa,
  setEtapa,
  counts,
}: {
  isDark: boolean
  etapa: EtapaDesligamento
  setEtapa: (e: EtapaDesligamento) => void
  counts: Record<EtapaDesligamento, number>
}) {
  const railRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ active: boolean; startX: number; startScrollLeft: number }>({
    active: false, startX: 0, startScrollLeft: 0,
  })
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const updateScrollState = () => {
      const maxScroll = rail.scrollWidth - rail.clientWidth
      setCanScrollLeft(rail.scrollLeft > 8)
      setCanScrollRight(maxScroll - rail.scrollLeft > 8)
    }
    updateScrollState()
    rail.addEventListener('scroll', updateScrollState, { passive: true })
    const resizeObserver = new ResizeObserver(updateScrollState)
    resizeObserver.observe(rail)
    Array.from(rail.children).forEach(child => resizeObserver.observe(child))
    return () => {
      rail.removeEventListener('scroll', updateScrollState)
      resizeObserver.disconnect()
    }
  }, [etapa])

  const scrollByOffset = (direction: 'left' | 'right') => {
    const rail = railRef.current
    if (!rail) return
    const offset = Math.max(rail.clientWidth * 0.72, 220)
    rail.scrollBy({ left: direction === 'left' ? -offset : offset, behavior: 'smooth' })
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    const rail = railRef.current
    if (!rail) return
    dragRef.current = { active: true, startX: event.clientX, startScrollLeft: rail.scrollLeft }
    rail.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    const rail = railRef.current
    if (!rail) return
    const delta = event.clientX - dragRef.current.startX
    rail.scrollLeft = dragRef.current.startScrollLeft - delta
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const rail = railRef.current
    if (!rail) return
    dragRef.current.active = false
    if (rail.hasPointerCapture(event.pointerId)) {
      rail.releasePointerCapture(event.pointerId)
    }
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const rail = railRef.current
    if (!rail) return
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    event.preventDefault()
    rail.scrollLeft += event.deltaY
  }

  const arrowBaseClass = isDark
    ? 'border-white/[0.08] bg-slate-950/80 text-slate-200 hover:bg-slate-900'
    : 'border-slate-200 bg-white/95 text-slate-600 hover:bg-slate-50'

  return (
    <div className={`relative min-w-0 rounded-2xl border p-1.5 ${
      isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200 bg-white'
    }`}>
      {canScrollLeft && (
        <>
          <div className={`pointer-events-none absolute inset-y-1 left-1 z-10 w-16 rounded-l-[calc(1rem-2px)] ${
            isDark ? 'bg-gradient-to-r from-[#0f172a] via-[#0f172a]/80 to-transparent' : 'bg-gradient-to-r from-white via-white/85 to-transparent'
          }`} />
          <button
            type="button"
            aria-label="Rolar etapas para a esquerda"
            onClick={() => scrollByOffset('left')}
            className={`absolute left-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-all ${arrowBaseClass}`}
          >
            <ChevronLeft size={16} />
          </button>
        </>
      )}

      {canScrollRight && (
        <>
          <div className={`pointer-events-none absolute inset-y-1 right-1 z-10 w-16 rounded-r-[calc(1rem-2px)] ${
            isDark ? 'bg-gradient-to-l from-[#0f172a] via-[#0f172a]/80 to-transparent' : 'bg-gradient-to-l from-white via-white/85 to-transparent'
          }`} />
          <button
            type="button"
            aria-label="Rolar etapas para a direita"
            onClick={() => scrollByOffset('right')}
            className={`absolute right-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-all ${arrowBaseClass}`}
          >
            <ChevronRight size={16} />
          </button>
        </>
      )}

      <div
        ref={railRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className="min-w-0 overflow-x-auto hide-scrollbar cursor-grab active:cursor-grabbing"
      >
        <div className="flex min-w-max items-stretch gap-1.5 pr-10 md:w-full">
          {ETAPAS.map(e => {
            const count = counts[e.key] || 0
            const isActive = etapa === e.key
            const Icon = e.icon
            const accent = isDark ? ACCENT_DARK[e.key] : ACCENT[e.key]
            return (
              <button
                key={e.key}
                onClick={() => setEtapa(e.key)}
                className={`flex min-h-[56px] min-w-fit items-center justify-center gap-2.5 rounded-xl px-4 py-2.5 text-sm whitespace-nowrap transition-all shrink-0 md:flex-1 ${
                  isActive
                    ? `${accent.bgActive} ${accent.textActive} border font-bold shadow-sm ${accent.border}`
                    : `${accent.bg} ${accent.text} font-medium`
                }`}
              >
                <Icon size={15} className="shrink-0" />
                {e.label}
                {count > 0 && (
                  <span className={`rounded-full min-w-[24px] h-[24px] px-1.5 flex items-center justify-center text-[10px] font-bold ${
                    isActive
                      ? accent.badge
                      : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Painel da etapa (apenas o conteúdo; a aba ativa já indica a etapa) ──────────
type SortKey = 'colaborador_nome' | 'cargo' | 'base_nome' | 'tipo' | 'data_desligamento'

function EtapaPanel({ etapa, isDark, lista }: { etapa: typeof ETAPAS[number]; isDark: boolean; lista: Desligamento[] }) {
  const [aberto, setAberto] = useState<Desligamento | null>(null)
  const [vista, setVista] = useState<'lista' | 'cards'>('lista')
  const [busca, setBusca] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'colaborador_nome', dir: 1 })

  const card = isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white border-slate-200'
  const txtMain = isDark ? 'text-slate-100' : 'text-slate-800'
  const txtMut = isDark ? 'text-slate-400' : 'text-slate-500'

  const tipos = [...new Set(lista.map(d => d.tipo).filter(Boolean))] as string[]
  const q = busca.trim().toLowerCase()
  const filt = lista
    .filter(d => !q || (d.colaborador_nome ?? '').toLowerCase().includes(q) || (d.cargo ?? '').toLowerCase().includes(q))
    .filter(d => !fTipo || d.tipo === fTipo)
    .sort((a, b) => {
      const va = String((a as any)[sort.k] ?? '').toLowerCase()
      const vb = String((b as any)[sort.k] ?? '').toLowerCase()
      return va < vb ? -sort.dir : va > vb ? sort.dir : 0
    })

  const toggleSort = (k: SortKey) => setSort(p => p.k === k ? { k, dir: (p.dir === 1 ? -1 : 1) } : { k, dir: 1 })
  const Seta = ({ k }: { k: SortKey }) => sort.k !== k ? null : (sort.dir === 1 ? <ChevronUp size={12} className="inline" /> : <ChevronDown size={12} className="inline" />)

  const selCls = `text-xs rounded-lg px-2.5 py-1.5 border ${isDark ? 'bg-white/[0.05] border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${card}`}>
      {/* Filtros em UMA linha + toggle Lista/Cards */}
      <div className={`rounded-xl border p-2 flex items-center gap-2 flex-nowrap overflow-x-auto mb-3 ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50/60 border-slate-200'}`}>
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs w-[190px] shrink-0 ${isDark ? 'bg-white/[0.05] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={14} className={txtMut} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar colaborador…" className={`bg-transparent outline-none w-full ${txtMain}`} />
        </div>
        <select value={fTipo} onChange={e => setFTipo(e.target.value)} className={`${selCls} shrink-0`}>
          <option value="">Todos os tipos</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className={`text-xs shrink-0 ${txtMut}`}>{filt.length} registro(s)</span>
        <div className={`inline-flex rounded-xl border overflow-hidden shrink-0 ml-auto ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
          {([['lista', LayoutList], ['cards', LayoutGrid]] as const).map(([v, Ic]) => (
            <button key={v} onClick={() => setVista(v)}
              className={`px-2.5 py-2 ${vista === v ? (isDark ? 'bg-rose-500/20 text-rose-300' : 'bg-rose-50 text-rose-700') : (isDark ? 'text-slate-400 hover:bg-white/[0.05]' : 'bg-white text-slate-500 hover:bg-slate-50')}`}>
              <Ic size={14} />
            </button>
          ))}
        </div>
      </div>

      {filt.length === 0 ? (
        <div className={`rounded-xl border border-dashed flex flex-col items-center justify-center text-center py-14 px-6 ${isDark ? 'border-white/[0.10]' : 'border-slate-300 bg-slate-50/60'}`}>
          <Construction size={30} className={isDark ? 'text-slate-600 mb-2' : 'text-slate-300 mb-2'} />
          <p className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Nada em “{etapa.label}”</p>
          <p className={`text-xs mt-1 ${txtMut}`}>
            {etapa.key === 'requisicao' ? 'Abra um desligamento pelo menu Nova Solicitação → Desligamento.' : 'Nenhum desligamento nesta etapa.'}
          </p>
        </div>
      ) : vista === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filt.map(d => <DesligamentoCard key={d.id} d={d} isDark={isDark} onClick={() => setAberto(d)} />)}
        </div>
      ) : (
        <div className={`rounded-xl border overflow-x-auto ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={isDark ? 'bg-white/[0.02] text-slate-400' : 'bg-slate-50 text-slate-500'}>
                {([['colaborador_nome', 'Colaborador'], ['cargo', 'Cargo'], ['base_nome', 'Base'], ['tipo', 'Tipo'], ['data_desligamento', 'Desligamento']] as [SortKey, string][]).map(([k, lb]) => (
                  <th key={k} onClick={() => toggleSort(k)}
                    className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap">
                    {lb} <Seta k={k} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={isDark ? 'divide-y divide-white/5' : 'divide-y divide-slate-100'}>
              {filt.map(d => (
                <tr key={d.id} onClick={() => setAberto(d)}
                  className={`cursor-pointer ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                  <td className={`px-3 py-2.5 font-medium ${txtMain}`}>{d.colaborador_nome ?? '—'}</td>
                  <td className={`px-3 py-2.5 ${txtMut}`}>{d.cargo ?? '—'}</td>
                  <td className={`px-3 py-2.5 ${txtMut}`}>{d.base_nome ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-700'}`}>{d.tipo ?? '—'}</span>
                  </td>
                  <td className={`px-3 py-2.5 ${txtMut} whitespace-nowrap`}>{fmtD(d.data_desligamento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aberto && <DesligamentoDetalhe d={aberto} isDark={isDark} onClose={() => setAberto(null)} />}
    </div>
  )
}


// ── Nada Consta — conta a pagar do colaborador (cautelas + repasses) ──────────
function moeda(v: number) {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function dataBR(d?: string | null) {
  if (!d) return '—'
  const s = String(d).slice(0, 10)
  const [y, m, dd] = s.split('-')
  return dd ? `${dd}/${m}/${y}` : s
}

function NadaConstaPanel({ isDark, fixo }: { isDark: boolean; fixo?: { id: string; nome: string } }) {
  const { perfil } = useAuth()
  const { data: colabs = [] } = useColaboradoresTreino()
  const [busca, setBusca] = useState('')
  const [selInterno, setSelInterno] = useState<{ id: string; nome: string } | null>(null)
  const sel = fixo ?? selInterno
  const setSel = setSelInterno
  const { data: linhas = [], isLoading } = useNadaConsta(sel?.id, sel?.nome)
  const definirValor = useDefinirValorCautela()
  const baixar = useBaixarNadaConsta()
  const [selDev, setSelDev] = useState<Set<string>>(new Set())

  const card = isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white border-slate-200'
  const txtMain = isDark ? 'text-slate-100' : 'text-slate-800'
  const txtMut = isDark ? 'text-slate-400' : 'text-slate-500'

  const q = busca.trim().toLowerCase()
  const achados = q.length > 1
    ? colabs.filter(c => c.nome.toLowerCase().includes(q) || (c.cargo ?? '').toLowerCase().includes(q)).slice(0, 8)
    : []

  const pend = linhas.filter(l => l.status === 'em_uso' || l.status === 'em_aberto')
  const total = pend.reduce((a, l) => a + Number(l.valor ?? 0), 0)

  async function editarValor(item: string, atual: number) {
    const txt = window.prompt('Valor de reposição a cobrar (R$):', String(atual || ''))
    if (txt == null) return
    const v = Number(txt.replace(/\./g, '').replace(',', '.'))
    if (isNaN(v)) { alert('Valor inválido'); return }
    try { await definirValor.mutateAsync({ item, valor: v, quem: perfil?.nome }) }
    catch (e: any) { alert(`Erro: ${e?.message ?? 'desconhecido'}`) }
  }
  async function confirmarDevolucao(refs: string[]) {
    if (!refs.length) return
    const msg = refs.length === 1 ? 'Confirmar a devolução deste item? Ele volta ao estoque e sai da conta.'
      : `Confirmar a devolução de ${refs.length} itens? Voltam ao estoque e saem da conta.`
    if (!window.confirm(msg)) return
    try {
      for (const item of refs) await baixar.mutateAsync({ item, tipo: 'devolucao', quemId: perfil?.id, quemNome: perfil?.nome })
      setSelDev(new Set())
    } catch (e: any) { alert(`Erro: ${e?.message ?? 'desconhecido'}`) }
  }
  const toggleSel = (ref: string) => setSelDev(p => { const n = new Set(p); n.has(ref) ? n.delete(ref) : n.add(ref); return n })

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${card}`}>
      {!fixo && <div className="flex items-center gap-2 mb-4">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border flex-1 ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
          <Search size={15} className={txtMut} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar colaborador…"
            className={`bg-transparent outline-none w-full text-sm ${txtMain}`} />
        </div>
        {sel && <button onClick={() => { setSel(null); setBusca('') }} className={`text-xs px-3 py-2 rounded-lg border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Trocar</button>}
      </div>}
      {!sel && achados.length > 0 && (
        <div className={`rounded-xl border mb-4 divide-y ${isDark ? 'border-white/10 divide-white/5' : 'border-slate-200 divide-slate-100'}`}>
          {achados.map(c => (
            <button key={c.id} onClick={() => { setSel({ id: c.id, nome: c.nome }); setBusca(c.nome) }}
              className={`w-full text-left px-3 py-2 text-sm ${isDark ? 'hover:bg-white/[0.04] text-slate-200' : 'hover:bg-slate-50 text-slate-700'}`}>
              {c.nome} <span className={txtMut}>· {c.cargo ?? '—'}{c.base ? ` · ${c.base}` : ''}</span>
            </button>
          ))}
        </div>
      )}

      {!sel && <p className={`text-sm text-center py-10 ${txtMut}`}>Busque um colaborador para ver as pendências.</p>}

      {sel && (
        <>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className={`text-base font-bold ${txtMain}`}>{sel.nome}</p>
              <p className={`text-xs ${txtMut}`}>{pend.length} pendência(s) em aberto</p>
            </div>
            <div className={`text-right px-4 py-2 rounded-xl ${total > 0 ? (isDark ? 'bg-red-500/15' : 'bg-red-50') : (isDark ? 'bg-emerald-500/15' : 'bg-emerald-50')}`}>
              <p className={`text-[10px] uppercase tracking-wide ${txtMut}`}>A descontar na rescisão</p>
              <p className={`text-lg font-bold ${total > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{moeda(total)}</p>
            </div>
          </div>

          {pend.some(l => l.origem === 'cautela') && (
            <div className="flex items-center gap-2 mb-2">
              <label className={`flex items-center gap-1.5 text-xs ${txtMut}`}>
                <input type="checkbox"
                  checked={selDev.size > 0 && selDev.size === pend.filter(l => l.origem === 'cautela').length}
                  onChange={e => setSelDev(e.target.checked ? new Set(pend.filter(l => l.origem === 'cautela').map(l => l.ref_id)) : new Set())} />
                Selecionar todos
              </label>
              <button onClick={() => confirmarDevolucao([...selDev])} disabled={!selDev.size || baixar.isPending}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
                {baixar.isPending ? <Loader2 size={13} className="animate-spin" /> : <PackageCheck size={13} />}
                Confirmar devolução{selDev.size ? ` (${selDev.size})` : ''}
              </button>
            </div>
          )}

          {isLoading && <p className={`text-sm ${txtMut} flex items-center gap-2`}><Loader2 size={14} className="animate-spin" /> carregando…</p>}

          {!isLoading && pend.length === 0 && (
            <div className={`flex flex-col items-center text-center py-10 rounded-xl border border-dashed ${isDark ? 'border-emerald-400/30' : 'border-emerald-300'}`}>
              <PackageCheck size={30} className="text-emerald-500 mb-2" />
              <p className={`text-sm font-semibold ${txtMain}`}>Nada consta</p>
              <p className={`text-xs ${txtMut}`}>Sem cautelas ou repasses em aberto.</p>
            </div>
          )}

          {!isLoading && pend.length > 0 && (
            <div className={`rounded-xl border divide-y ${isDark ? 'border-white/10 divide-white/5' : 'border-slate-200 divide-slate-100'}`}>
              {pend.map(l => (
                <div key={l.ref_id} className="flex items-center gap-3 px-3 py-2.5">
                  {l.origem === 'cautela'
                    ? <input type="checkbox" className="shrink-0" checked={selDev.has(l.ref_id)} onChange={() => toggleSel(l.ref_id)} />
                    : <span className="w-[13px] shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${l.origem === 'repasse'
                        ? (isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700')
                        : (isDark ? 'bg-sky-500/15 text-sky-300' : 'bg-sky-50 text-sky-700')}`}>
                        {l.origem === 'repasse' ? 'REPASSE' : 'CAUTELA'}
                      </span>
                      <span className={`text-sm font-semibold truncate ${txtMain}`}>{l.descricao}</span>
                      {Number(l.quantidade) > 1 && <span className={`text-xs shrink-0 ${txtMut}`}>×{Number(l.quantidade)}</span>}
                    </div>
                    <p className={`text-[11px] truncate ${txtMut}`}>
                      {l.local !== '—' ? `${l.local} · ` : ''}{dataBR(l.data_ini)} → vence {dataBR(l.data_lim)}
                    </p>
                  </div>

                  <button onClick={() => l.origem === 'cautela' && editarValor(l.ref_id, Number(l.valor))}
                    className={`text-sm font-bold shrink-0 w-[92px] text-right ${l.origem === 'cautela' ? 'hover:underline cursor-pointer' : 'cursor-default'} ${Number(l.valor) > 0 ? txtMain : 'text-amber-500'}`}
                    title={l.origem === 'cautela' ? 'Definir valor de reposição' : ''}>
                    {Number(l.valor) > 0 ? moeda(Number(l.valor)) : 'definir R$'}
                  </button>

                </div>
              ))}
            </div>
          )}

          <p className={`text-[11px] mt-3 ${txtMut}`}>
            <Wallet size={11} className="inline mb-0.5 mr-1" />
            Confirme a devolução do que voltar (sai da conta). O que ficar em aberto é descontado na rescisão. EPI de consumo depreciado já sai sozinho.
          </p>
        </>
      )}
    </div>
  )
}


// ── Requisição — modal aberto pelo menu Nova Solicitação → Desligamento ───────
const TIPOS_DESLIG = [
  'Sem justa causa', 'Pedido de demissão', 'Justa causa',
  'Término de contrato/experiência', 'Rescisão indireta', 'Acordo (art. 484-A)',
]

function RequisicaoModal({ isDark, onClose }: { isDark: boolean; onClose: () => void }) {
  const { perfil } = useAuth()
  const { data: colabs = [] } = useColaboradoresTreino()
  const criar = useCriarDesligamento()
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<{ id: string; nome: string; cargo: string | null } | null>(null)
  const [tipo, setTipo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [dataAviso, setDataAviso] = useState('')
  const [dataDeslig, setDataDeslig] = useState('')
  const [cumpre, setCumpre] = useState<boolean | null>(null)
  const [obs, setObs] = useState('')

  const inCls = isDark ? 'bg-white/[0.04] border-white/10 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
  const lbl = `text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`
  const q = busca.trim().toLowerCase()
  const achados = !sel && q.length > 1 ? colabs.filter(c => c.nome.toLowerCase().includes(q)).slice(0, 8) : []

  const erros: string[] = []
  if (!sel) erros.push('selecione o colaborador')
  if (!tipo) erros.push('escolha o tipo')
  if (cumpre === null) erros.push('informe se vai cumprir aviso')

  async function salvar() {
    if (erros.length) return
    try {
      await criar.mutateAsync({
        colaborador_id: sel!.id, tipo, motivo: motivo || undefined,
        data_aviso: dataAviso || undefined, data_desligamento: dataDeslig || undefined,
        cumpriu_aviso: cumpre ?? undefined, observacoes: obs || undefined, criadoPor: perfil?.nome,
      })
      onClose()
    } catch (e: any) { alert(`Erro: ${e?.message ?? 'desconhecido'}`) }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full max-w-lg rounded-2xl border shadow-2xl max-h-[90vh] overflow-y-auto ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
        <div className={`flex items-center justify-between px-5 py-3 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Novo desligamento</p>
          <button onClick={onClose} className={isDark ? 'text-slate-400' : 'text-slate-500'}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className={lbl}>Colaborador *</label>
            {sel ? (
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${inCls}`}>
                <span className="text-sm">{sel.nome} <span className="opacity-60">· {sel.cargo ?? '—'}</span></span>
                <button onClick={() => { setSel(null); setBusca('') }} className="text-xs opacity-70 hover:opacity-100">trocar</button>
              </div>
            ) : (
              <>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar colaborador…"
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${inCls}`} />
                {achados.length > 0 && (
                  <div className={`mt-1 rounded-lg border divide-y ${isDark ? 'border-white/10 divide-white/5' : 'border-slate-200 divide-slate-100'}`}>
                    {achados.map(c => (
                      <button key={c.id} onClick={() => setSel({ id: c.id, nome: c.nome, cargo: c.cargo })}
                        className={`w-full text-left px-3 py-2 text-sm ${isDark ? 'hover:bg-white/[0.04] text-slate-200' : 'hover:bg-slate-50 text-slate-700'}`}>
                        {c.nome} <span className="opacity-60">· {c.cargo ?? '—'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className={lbl}>Tipo *</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-sm ${inCls}`}>
              <option value="">Selecione…</option>
              {TIPOS_DESLIG.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className={lbl}>Vai cumprir aviso prévio? *</label>
            <div className="flex gap-2 mt-1">
              {[['Sim', true], ['Não (indenizado)', false]].map(([txt, val]) => (
                <button key={String(val)} onClick={() => setCumpre(val as boolean)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-semibold ${cumpre === val
                    ? (isDark ? 'bg-rose-500/20 border-rose-400/40 text-rose-200' : 'bg-rose-50 border-rose-300 text-rose-700')
                    : inCls}`}>{txt as string}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>Data do aviso</label>
              <input type="date" value={dataAviso} onChange={e => setDataAviso(e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-sm ${inCls}`} />
            </div>
            <div>
              <label className={lbl}>Data do desligamento</label>
              <input type="date" value={dataDeslig} onChange={e => setDataDeslig(e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-sm ${inCls}`} />
            </div>
          </div>

          <div>
            <label className={lbl}>Motivo / observações</label>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} className={`w-full px-3 py-2 rounded-lg border text-sm ${inCls}`} />
          </div>
        </div>
        <div className={`flex items-center justify-between gap-2 px-5 py-3 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <span className="text-[11px] text-amber-500">{erros[0] ?? ''}</span>
          <button onClick={salvar} disabled={!!erros.length || criar.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50">
            {criar.isPending ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />} Abrir desligamento
          </button>
        </div>
      </div>
    </div>
  )
}

function fmtD(d?: string | null) {
  if (!d) return '—'
  const p = String(d).slice(0, 10).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(d)
}

function DesligamentoCard({ d, isDark, onClick }: { d: Desligamento; isDark: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`text-left rounded-xl border p-3 ${isDark ? 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04]' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
      <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{d.colaborador_nome ?? '—'}</p>
      <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{d.cargo ?? '—'}{d.base_nome ? ` · ${d.base_nome}` : ''}</p>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-700'}`}>{d.tipo ?? 'sem tipo'}</span>
        {d.data_desligamento && <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>deslig. {fmtD(d.data_desligamento)}</span>}
      </div>
    </button>
  )
}

// ── Detalhe + avanço de etapa (aprovação gated diretoria/admin) ───────────────
function DesligamentoDetalhe({ d, isDark, onClose }: { d: Desligamento; isDark: boolean; onClose: () => void }) {
  const { perfil, isAdmin, papelGlobal } = useAuth() as any
  const atualizar = useAtualizarDesligamento()
  const { data: pend = [] } = useNadaConsta(d.colaborador_id, d.colaborador_nome ?? undefined)
  const podeAprovar = isAdmin || papelGlobal === 'diretor' || papelGlobal === 'ceo'
  const totalAberto = pend.filter((l: any) => l.status === 'em_uso' || l.status === 'em_aberto').reduce((a: number, l: any) => a + Number(l.valor ?? 0), 0)

  const idx = ORDEM_ETAPAS.indexOf(d.status)
  const proxima = ORDEM_ETAPAS[idx + 1]

  const inCls = isDark ? 'bg-white/[0.04] border-white/10 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
  const lbl = `text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`
  const [motivoRej, setMotivoRej] = useState('')
  const [rejeitando, setRejeitando] = useState(false)
  const [checklist, setChecklist] = useState<{ label: string; done: boolean }[]>(
    (d.checklist && d.checklist.length ? d.checklist : [
      { label: 'Comunicar o colaborador', done: false },
      { label: 'Desativar acessos (sistemas, crachá)', done: false },
      { label: 'Recolher equipamentos e uniformes', done: false },
      { label: 'Agendar exame demissional', done: false },
    ]))

  async function avancar(status: string, extra: Partial<Desligamento> = {}) {
    try { await atualizar.mutateAsync({ id: d.id, patch: { status: status as any, ...extra } }); onClose() }
    catch (e: any) { alert(`Erro: ${e?.message ?? 'desconhecido'}`) }
  }
  async function encerrar() {
    if (!window.confirm('Encerrar o desligamento? O colaborador será INATIVADO no headcount.')) return
    try {
      await atualizar.mutateAsync({ id: d.id, patch: { status: 'encerrados' as any } })
      const { supabase } = await import('../../services/supabase')
      await supabase.from('rh_colaboradores').update({ ativo: false }).eq('id', d.colaborador_id)
      onClose()
    } catch (e: any) { alert(`Erro: ${e?.message ?? 'desconhecido'}`) }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full max-w-3xl rounded-2xl border shadow-2xl max-h-[90vh] overflow-y-auto ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
        <div className={`flex items-center justify-between px-5 py-3 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <div>
            <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{d.colaborador_nome}</p>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{d.cargo ?? '—'} · {d.tipo ?? '—'} · admissão {fmtD(d.data_admissao)}</p>
          </div>
          <button onClick={onClose} className={isDark ? 'text-slate-400' : 'text-slate-500'}><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className={lbl}>Data do aviso</span><p className={isDark ? 'text-slate-200' : 'text-slate-700'}>{fmtD(d.data_aviso)}</p></div>
            <div><span className={lbl}>Data do desligamento</span><p className={isDark ? 'text-slate-200' : 'text-slate-700'}>{fmtD(d.data_desligamento)}</p></div>
            <div><span className={lbl}>Cumpre aviso</span><p className={isDark ? 'text-slate-200' : 'text-slate-700'}>{d.cumpriu_aviso == null ? '—' : d.cumpriu_aviso ? 'Sim' : 'Não (indenizado)'}</p></div>
            <div><span className={lbl}>Solicitado por</span><p className={isDark ? 'text-slate-200' : 'text-slate-700'}>{d.created_by_nome ?? '—'}</p></div>
          </div>
          {d.motivo && <div><span className={lbl}>Motivo</span><p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{d.motivo}</p></div>}

          {d.status === 'preparo' && (
            <div>
              <span className={lbl}>Checklist de preparo</span>
              <div className="mt-1 space-y-1">
                {checklist.map((c, i) => (
                  <label key={i} className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    <input type="checkbox" checked={c.done} onChange={e => setChecklist(prev => prev.map((x, j) => j === i ? { ...x, done: e.target.checked } : x))} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {d.status === 'nada_consta' && (
            <div>
              <span className={lbl}>Nada consta — conta a pagar</span>
              <div className="mt-2"><NadaConstaPanel isDark={isDark} fixo={{ id: d.colaborador_id, nome: d.colaborador_nome ?? '' }} /></div>
            </div>
          )}

          {rejeitando && (
            <div>
              <label className={lbl}>Motivo da rejeição</label>
              <textarea value={motivoRej} onChange={e => setMotivoRej(e.target.value)} rows={2} className={`w-full px-3 py-2 rounded-lg border text-sm ${inCls}`} />
            </div>
          )}
        </div>

        <div className={`flex items-center justify-end gap-2 px-5 py-3 border-t flex-wrap ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          {d.status === 'requisicao' && (
            <button onClick={() => avancar('aprovacao')} disabled={atualizar.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              <ArrowRight size={14} /> Enviar para aprovação
            </button>
          )}

          {d.status === 'aprovacao' && (
            podeAprovar ? (
              rejeitando ? (
                <button onClick={() => avancar('requisicao', { observacoes: `Rejeitado: ${motivoRej}` })} disabled={!motivoRej.trim() || atualizar.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                  <XCircle size={14} /> Confirmar rejeição
                </button>
              ) : (
                <>
                  <button onClick={() => setRejeitando(true)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold ${isDark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    <XCircle size={14} /> Rejeitar
                  </button>
                  <button onClick={() => avancar('preparo')} disabled={atualizar.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                    <CheckCircle size={14} /> Aprovar
                  </button>
                </>
              )
            ) : (
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Somente diretoria/admin aprovam.</span>
            )
          )}

          {d.status === 'preparo' && (
            <button onClick={() => avancar('nada_consta', { checklist })} disabled={atualizar.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              <ArrowRight size={14} /> Ir para Nada Consta
            </button>
          )}

          {d.status === 'nada_consta' && (
            <div className="flex items-center gap-2 flex-wrap">
              {totalAberto > 0 && (
                <span className="text-xs text-amber-500 inline-flex items-center gap-1">
                  <AlertTriangle size={13} /> R$ {totalAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} serão descontados na rescisão
                </span>
              )}
              <button onClick={() => avancar('rescisao')} disabled={atualizar.isPending}
                className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                <ArrowRight size={14} /> Ir para Rescisão
              </button>
            </div>
          )}

          {d.status === 'rescisao' && (
            <button onClick={encerrar} disabled={atualizar.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50">
              <CheckCircle size={14} /> Encerrar e inativar
            </button>
          )}

          {d.status === 'encerrados' && (
            <span className={`text-xs inline-flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}><CheckCircle size={13} className="text-emerald-500" /> Desligamento encerrado</span>
          )}
        </div>
      </div>
    </div>
  )
}
