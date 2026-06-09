// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHAdmissao.tsx — Fluxo de Admissão (7 etapas)
// Rail de abas no padrão do Financeiro (CPPipeline · PipelineRail).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  UserPlus, ClipboardList, ShieldCheck, FileText, Stethoscope, Truck,
  HeartHandshake, CheckCircle2, ChevronLeft, ChevronRight, Plus, Construction, Receipt,
  ChevronRight as ChevR, Paperclip, AlertTriangle, XCircle, HelpCircle, Loader2,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAdmissoesFluxo } from '../../hooks/useRHAdmissaoFluxo'
import RHAdmissaoForm from '../../components/rh/RHAdmissaoForm'
import RHAdmissaoModal from '../../components/rh/RHAdmissaoModal'
import type { RHAdmissao, EtapaAdmissaoFluxo } from '../../types/rh'

type EtapaAdmissao = EtapaAdmissaoFluxo

const ETAPAS: { key: EtapaAdmissao; num: number; label: string; descricao: string; icon: typeof Receipt }[] = [
  { key: 'requisicao',          num: 1, label: 'Requisição',              descricao: 'Gestor solicita a admissão (após aceite da vaga).',              icon: ClipboardList },
  { key: 'aprovacao',           num: 2, label: 'Aprovação',               descricao: 'Diretoria autoriza a admissão solicitada.',                      icon: ShieldCheck },
  { key: 'documentacao',        num: 3, label: 'Documentação',            descricao: 'Envio e conferência da documentação do colaborador.',            icon: FileText },
  { key: 'exames_treinamentos', num: 4, label: 'Exames e Treinamentos',   descricao: 'Exame admissional (NR-7) + treinamentos obrigatórios (NRs e matriz).', icon: Stethoscope },
  { key: 'mobilizacao',         num: 5, label: 'Mobilização',             descricao: 'Logística de deslocamento e chegada à obra.',                    icon: Truck },
  { key: 'integracao',          num: 6, label: 'Integração',              descricao: 'Onboarding com RH e Gestor.',                                    icon: HeartHandshake },
  { key: 'liberado',            num: 7, label: 'Liberado para Atividades', descricao: 'Colaborador apto, ativo e liberado para iniciar as atividades.', icon: CheckCircle2 },
]

const ETAPA_ICON: Record<EtapaAdmissao, typeof Receipt> = Object.fromEntries(
  ETAPAS.map(e => [e.key, e.icon]),
) as Record<EtapaAdmissao, typeof Receipt>

const ACCENT: Record<EtapaAdmissao, { bg: string; bgActive: string; text: string; textActive: string; border: string; badge: string; icon: string }> = {
  requisicao:          { bg: 'hover:bg-blue-50',    bgActive: 'bg-blue-50',    text: 'text-blue-600',    textActive: 'text-blue-800',    border: 'border-blue-500',    badge: 'bg-blue-100 text-blue-700',       icon: 'text-blue-500' },
  aprovacao:           { bg: 'hover:bg-amber-50',   bgActive: 'bg-amber-50',   text: 'text-amber-600',   textActive: 'text-amber-800',   border: 'border-amber-500',   badge: 'bg-amber-100 text-amber-700',     icon: 'text-amber-500' },
  documentacao:        { bg: 'hover:bg-violet-50',  bgActive: 'bg-violet-50',  text: 'text-violet-600',  textActive: 'text-violet-800',  border: 'border-violet-500',  badge: 'bg-violet-100 text-violet-700',   icon: 'text-violet-500' },
  exames_treinamentos: { bg: 'hover:bg-sky-50',     bgActive: 'bg-sky-50',     text: 'text-sky-600',     textActive: 'text-sky-800',     border: 'border-sky-500',     badge: 'bg-sky-100 text-sky-700',         icon: 'text-sky-500' },
  mobilizacao:         { bg: 'hover:bg-orange-50',  bgActive: 'bg-orange-50',  text: 'text-orange-600',  textActive: 'text-orange-800',  border: 'border-orange-500',  badge: 'bg-orange-100 text-orange-700',   icon: 'text-orange-500' },
  integracao:          { bg: 'hover:bg-teal-50',    bgActive: 'bg-teal-50',    text: 'text-teal-600',    textActive: 'text-teal-800',    border: 'border-teal-500',    badge: 'bg-teal-100 text-teal-700',       icon: 'text-teal-500' },
  liberado:            { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50', text: 'text-emerald-600', textActive: 'text-emerald-800', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-700', icon: 'text-emerald-500' },
}

const ACCENT_DARK: Record<EtapaAdmissao, { bg: string; bgActive: string; text: string; textActive: string; border: string; badge: string; icon: string }> = {
  requisicao:          { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-blue-500/10',    text: 'text-blue-400',    textActive: 'text-blue-300',    border: 'border-blue-400/40',    badge: 'bg-blue-500/15 text-blue-200',       icon: 'text-blue-400' },
  aprovacao:           { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-amber-500/10',   text: 'text-amber-400',   textActive: 'text-amber-300',   border: 'border-amber-400/40',   badge: 'bg-amber-500/15 text-amber-200',     icon: 'text-amber-400' },
  documentacao:        { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-violet-500/10',  text: 'text-violet-400',  textActive: 'text-violet-300',  border: 'border-violet-400/40',  badge: 'bg-violet-500/15 text-violet-200',   icon: 'text-violet-400' },
  exames_treinamentos: { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-sky-500/10',     text: 'text-sky-400',     textActive: 'text-sky-300',     border: 'border-sky-400/40',     badge: 'bg-sky-500/15 text-sky-200',         icon: 'text-sky-400' },
  mobilizacao:         { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-orange-500/10',  text: 'text-orange-400',  textActive: 'text-orange-300',  border: 'border-orange-400/40',  badge: 'bg-orange-500/15 text-orange-200',   icon: 'text-orange-400' },
  integracao:          { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-teal-500/10',    text: 'text-teal-400',    textActive: 'text-teal-300',    border: 'border-teal-400/40',    badge: 'bg-teal-500/15 text-teal-200',       icon: 'text-teal-400' },
  liberado:            { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-emerald-500/10', text: 'text-emerald-400', textActive: 'text-emerald-300', border: 'border-emerald-400/40', badge: 'bg-emerald-500/15 text-emerald-200', icon: 'text-emerald-400' },
}

// ── Tela principal ────────────────────────────────────────────────────────────
export default function RHAdmissao() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<'fluxo' | 'nova'>('fluxo')
  const [etapa, setEtapa] = useState<EtapaAdmissao>('requisicao')
  const [selecionada, setSelecionada] = useState<RHAdmissao | null>(null)

  const { data: admissoes = [], isLoading } = useAdmissoesFluxo()

  // Abertura via ?nova=1 (menu Nova Solicitação → Admissão)
  useEffect(() => {
    if (searchParams.get('nova') === '1') {
      setView('nova')
      searchParams.delete('nova')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const ativa = ETAPAS.find(e => e.key === etapa) ?? ETAPAS[0]
  const counts = ETAPAS.reduce((acc, e) => {
    acc[e.key] = admissoes.filter(a => (a.etapa ?? 'requisicao') === e.key).length
    return acc
  }, {} as Record<EtapaAdmissao, number>)
  const itensEtapa = admissoes.filter(a => (a.etapa ?? 'requisicao') === etapa)

  if (view === 'nova') {
    return (
      <RHAdmissaoForm
        onBack={() => setView('fluxo')}
        onCreated={() => { setView('fluxo'); setEtapa('requisicao') }}
      />
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <UserPlus size={20} className="text-violet-400" />
            Admissão
          </h1>
          <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Fluxo de admissão — da requisição à liberação para atividades
          </p>
        </div>
        <button
          onClick={() => setView('nova')}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shrink-0"
        >
          <Plus size={15} /> Nova Requisição
        </button>
      </div>

      {/* Rail de abas */}
      <EtapaRail isDark={isDark} etapa={etapa} setEtapa={setEtapa} counts={counts} />

      {/* Conteúdo da etapa ativa */}
      <EtapaPanel etapa={ativa} isDark={isDark}>
        {(etapa === 'requisicao' || etapa === 'aprovacao') ? (
          isLoading ? (
            <div className="flex justify-center py-12"><Loader2 size={26} className="animate-spin text-slate-300" /></div>
          ) : itensEtapa.length === 0 ? (
            <PlaceholderVazio etapa={ativa} isDark={isDark} />
          ) : (
            <div className="space-y-2">
              {itensEtapa.map(a => (
                <AdmissaoCard key={a.id} adm={a} isDark={isDark} onClick={() => setSelecionada(a)} />
              ))}
            </div>
          )
        ) : (
          <PlaceholderConstrucao etapa={ativa} isDark={isDark} />
        )}
      </EtapaPanel>

      {selecionada && <RHAdmissaoModal adm={selecionada} onClose={() => setSelecionada(null)} />}
    </div>
  )
}

// ── Card de admissão na lista ─────────────────────────────────────────────────
function AdmissaoCard({ adm, isDark, onClick }: { adm: RHAdmissao; isDark: boolean; onClick: () => void }) {
  const candidatos = adm.candidatos ?? []
  const nCand = candidatos.length
  const nDocs = candidatos.reduce((s, c) => s + (c.anexos?.length ?? 0), 0)
  const titulo = nCand === 1
    ? (candidatos[0].nome || adm.nome_candidato || 'Candidato')
    : nCand > 1
      ? `${candidatos[0].nome || 'Candidato'} +${nCand - 1}`
      : (adm.nome_candidato || 'Solicitação de admissão')
  return (
    <button onClick={onClick}
      className={`w-full text-left rounded-2xl border p-4 transition-all group flex items-center gap-3 ${
        isDark ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
      }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-white/[0.05]' : 'bg-slate-100'}`}>
        <UserPlus size={18} className="text-violet-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{titulo}</p>
          {nCand > 1 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">{nCand} CANDIDATOS</span>
          )}
          {adm.urgente && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 flex items-center gap-0.5"><AlertTriangle size={9} />URGENTE</span>
          )}
          {adm.status_aprovacao === 'rejeitado' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-0.5"><XCircle size={9} />REJEITADO</span>
          )}
          {adm.status_aprovacao === 'esclarecimento' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-0.5"><HelpCircle size={9} />ESCLARECER</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {adm.base && <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{adm.base}</span>}
          {adm.centro_custo && <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{adm.centro_custo.codigo}</span>}
          <span className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><Paperclip size={9} />{nDocs} doc(s)</span>
        </div>
      </div>
      <ChevR size={14} className={`shrink-0 ${isDark ? 'text-slate-600 group-hover:text-violet-400' : 'text-slate-300 group-hover:text-violet-500'} transition-colors`} />
    </button>
  )
}

function PlaceholderVazio({ etapa, isDark }: { etapa: typeof ETAPAS[number]; isDark: boolean }) {
  return (
    <div className={`rounded-xl border border-dashed flex flex-col items-center justify-center text-center py-12 px-6 ${
      isDark ? 'border-white/[0.10] bg-white/[0.02]' : 'border-slate-300 bg-slate-50/60'
    }`}>
      <UserPlus size={30} className={isDark ? 'text-slate-600 mb-2' : 'text-slate-300 mb-2'} />
      <p className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Nenhuma admissão em “{etapa.label}”</p>
    </div>
  )
}

function PlaceholderConstrucao({ etapa, isDark }: { etapa: typeof ETAPAS[number]; isDark: boolean }) {
  return (
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
  )
}

// ── Painel da etapa (cabeçalho + conteúdo) ─────────────────────────────────────
function EtapaPanel({ etapa, isDark, children }: { etapa: typeof ETAPAS[number]; isDark: boolean; children: React.ReactNode }) {
  const Icon = ETAPA_ICON[etapa.key]
  const accent = isDark ? ACCENT_DARK[etapa.key] : ACCENT[etapa.key]
  return (
    <div className={`rounded-2xl border ${isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
      <div className={`flex items-center gap-3 px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accent.bgActive}`}>
          <Icon size={20} className={accent.icon} />
        </div>
        <div className="min-w-0">
          <span className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Etapa {etapa.num} de {ETAPAS.length}
          </span>
          <h2 className={`text-base font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{etapa.label}</h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{etapa.descricao}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
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
  etapa: EtapaAdmissao
  setEtapa: (e: EtapaAdmissao) => void
  counts: Record<EtapaAdmissao, number>
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
          <button type="button" aria-label="Rolar etapas para a esquerda" onClick={() => scrollByOffset('left')}
            className={`absolute left-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-all ${arrowBaseClass}`}>
            <ChevronLeft size={16} />
          </button>
        </>
      )}

      {canScrollRight && (
        <>
          <div className={`pointer-events-none absolute inset-y-1 right-1 z-10 w-16 rounded-r-[calc(1rem-2px)] ${
            isDark ? 'bg-gradient-to-l from-[#0f172a] via-[#0f172a]/80 to-transparent' : 'bg-gradient-to-l from-white via-white/85 to-transparent'
          }`} />
          <button type="button" aria-label="Rolar etapas para a direita" onClick={() => scrollByOffset('right')}
            className={`absolute right-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-all ${arrowBaseClass}`}>
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
                    isActive ? accent.badge : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-100 text-slate-500'
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
