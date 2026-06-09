// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHDesligamento.tsx — Fluxo de Desligamento (6 etapas)
// Rail de abas no padrão do Financeiro (CPPipeline · PipelineRail).
// O conteúdo de cada etapa será montado nas próximas iterações.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import {
  UserMinus, ClipboardList, ShieldCheck, ClipboardCheck, FileCheck, DollarSign,
  CheckCircle2, ChevronLeft, ChevronRight, Plus, Construction, Receipt,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

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
