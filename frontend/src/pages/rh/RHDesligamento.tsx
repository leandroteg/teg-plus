// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHDesligamento.tsx — Fluxo de Desligamento (6 etapas)
// Rail de abas no padrão do Financeiro (CPPipeline · PipelineRail).
// O conteúdo de cada etapa será montado nas próximas iterações.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import {
  UserMinus, ClipboardList, ShieldCheck, ClipboardCheck, FileCheck, DollarSign,
  CheckCircle2, ChevronLeft, ChevronRight, Plus, Construction, Receipt,
  Search, PackageCheck, Loader2, Wallet,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import {
  useColaboradoresTreino, useNadaConsta, useDefinirValorCautela, useBaixarNadaConsta,
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

  const ativa = ETAPAS.find(e => e.key === etapa) ?? ETAPAS[0]

  // Contagens por etapa (serão ligadas aos dados nas próximas iterações)
  const counts: Record<EtapaDesligamento, number> = {
    requisicao: 0, aprovacao: 0, preparo: 0, nada_consta: 0, rescisao: 0, encerrados: 0,
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <UserMinus size={20} className="text-rose-400" />
          Desligamento
        </h1>
        <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Fluxo de desligamento — da requisição ao encerramento
        </p>
      </div>

      {/* Rail de abas (etapas do fluxo) — padrão Financeiro */}
      <EtapaRail isDark={isDark} etapa={etapa} setEtapa={setEtapa} counts={counts} />

      {/* Conteúdo da etapa ativa (placeholder por enquanto) */}
      <EtapaPanel etapa={ativa} isDark={isDark} />
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
function EtapaPanel({ etapa, isDark }: { etapa: typeof ETAPAS[number]; isDark: boolean }) {
  if (etapa.key === 'nada_consta') return <NadaConstaPanel isDark={isDark} />
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
      <div className={`rounded-xl border border-dashed flex flex-col items-center justify-center text-center py-14 px-6 ${
        isDark ? 'border-white/[0.10] bg-white/[0.02]' : 'border-slate-300 bg-slate-50/60'
      }`}>
        <Construction size={34} className={isDark ? 'text-slate-600 mb-3' : 'text-slate-300 mb-3'} />
        <p className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Conteúdo da etapa “{etapa.label}” em construção
        </p>
        <p className={`text-xs mt-1 max-w-md ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          A estrutura do fluxo está pronta. Os campos e ações desta etapa serão montados em seguida.
        </p>
      </div>
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

function NadaConstaPanel({ isDark }: { isDark: boolean }) {
  const { perfil } = useAuth()
  const { data: colabs = [] } = useColaboradoresTreino()
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<{ id: string; nome: string } | null>(null)
  const { data: linhas = [], isLoading } = useNadaConsta(sel?.id, sel?.nome)
  const definirValor = useDefinirValorCautela()
  const baixar = useBaixarNadaConsta()

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
  async function darBaixa(item: string, tipo: 'devolucao' | 'perda', desc: string) {
    const msg = tipo === 'devolucao' ? `Confirmar devolução de "${desc}"? Retorna ao estoque.`
      : `Baixar "${desc}" como PERDA? Encerra a pendência sem retorno ao estoque.`
    if (!window.confirm(msg)) return
    try { await baixar.mutateAsync({ item, tipo, quemId: perfil?.id, quemNome: perfil?.nome }) }
    catch (e: any) { alert(`Erro: ${e?.message ?? 'desconhecido'}`) }
  }

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${card}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border flex-1 ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
          <Search size={15} className={txtMut} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar colaborador…"
            className={`bg-transparent outline-none w-full text-sm ${txtMain}`} />
        </div>
        {sel && <button onClick={() => { setSel(null); setBusca('') }} className={`text-xs px-3 py-2 rounded-lg border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Trocar</button>}
      </div>
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
              <p className={`text-[10px] uppercase tracking-wide ${txtMut}`}>Total em aberto</p>
              <p className={`text-lg font-bold ${total > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{moeda(total)}</p>
            </div>
          </div>

          {isLoading && <p className={`text-sm ${txtMut} flex items-center gap-2`}><Loader2 size={14} className="animate-spin" /> carregando…</p>}

          {!isLoading && pend.length === 0 && (
            <div className={`flex flex-col items-center text-center py-10 rounded-xl border border-dashed ${isDark ? 'border-emerald-400/30' : 'border-emerald-300'}`}>
              <PackageCheck size={30} className="text-emerald-500 mb-2" />
              <p className={`text-sm font-semibold ${txtMain}`}>Nada consta</p>
              <p className={`text-xs ${txtMut}`}>Sem cautelas ou repasses em aberto.</p>
            </div>
          )}

          {!isLoading && pend.length > 0 && (
            <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={isDark ? 'bg-white/[0.03] text-slate-400' : 'bg-slate-50 text-slate-500'}>
                    {['Origem', 'Item', 'Qtd', 'Local', 'Retirada → limite', 'Valor', ''].map((h, i) => (
                      <th key={i} className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide ${i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={isDark ? 'divide-y divide-white/5' : 'divide-y divide-slate-100'}>
                  {pend.map(l => (
                    <tr key={l.ref_id}>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${l.origem === 'repasse'
                          ? (isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700')
                          : (isDark ? 'bg-sky-500/15 text-sky-300' : 'bg-sky-50 text-sky-700')}`}>
                          {l.origem === 'repasse' ? 'Repasse' : 'Cautela'}
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 ${txtMain}`}>{l.descricao}</td>
                      <td className={`px-3 py-2.5 ${txtMut}`}>{Number(l.quantidade)}</td>
                      <td className={`px-3 py-2.5 ${txtMut}`}>{l.local}</td>
                      <td className={`px-3 py-2.5 ${txtMut} whitespace-nowrap`}>{dataBR(l.data_ini)} → {dataBR(l.data_lim)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => l.origem === 'cautela' && editarValor(l.ref_id, Number(l.valor))}
                          className={`font-semibold ${l.origem === 'cautela' ? 'hover:underline cursor-pointer' : 'cursor-default'} ${Number(l.valor) > 0 ? txtMain : 'text-amber-500'}`}
                          title={l.origem === 'cautela' ? 'Clique para definir o valor de reposição' : ''}>
                          {Number(l.valor) > 0 ? moeda(Number(l.valor)) : 'definir'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {l.origem === 'cautela' && (
                          <span className="inline-flex gap-1">
                            <button onClick={() => darBaixa(l.ref_id, 'devolucao', l.descricao)} disabled={baixar.isPending}
                              className={`text-[11px] px-2 py-1 rounded-lg font-semibold ${isDark ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>Devolver</button>
                            <button onClick={() => darBaixa(l.ref_id, 'perda', l.descricao)} disabled={baixar.isPending}
                              className={`text-[11px] px-2 py-1 rounded-lg font-semibold ${isDark ? 'bg-red-500/10 text-red-300 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>Perda</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className={`text-[11px] mt-3 ${txtMut}`}>
            <Wallet size={11} className="inline mb-0.5 mr-1" />
            EPI de consumo depreciado sai sozinho da lista; item devolvível fica até voltar. Repasse é casado pelo nome do favorecido.
          </p>
        </>
      )}
    </div>
  )
}
