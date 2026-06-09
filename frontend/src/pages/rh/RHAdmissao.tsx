// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHAdmissao.tsx — Fluxo de Admissão (7 etapas)
// Estrutura/esqueleto: rail de sub-abas no padrão visual do Financeiro.
// O conteúdo de cada etapa será montado nas próximas iterações.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import {
  UserPlus, ClipboardList, ShieldCheck, FileText, Stethoscope, Truck,
  HeartHandshake, CheckCircle2, ChevronLeft, ChevronRight, Plus, Construction,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

// ── Etapas do fluxo ───────────────────────────────────────────────────────────
export type EtapaAdmissao =
  | 'requisicao'
  | 'aprovacao'
  | 'documentacao'
  | 'exames_treinamentos'
  | 'mobilizacao'
  | 'integracao'
  | 'liberado'

interface EtapaMeta {
  key: EtapaAdmissao
  num: number
  label: string
  descricao: string
  icon: typeof UserPlus
  iconColor: string
  // Estados ativos do rail (light / dark)
  bgActive: string
  bgActiveDark: string
  textActive: string
  textActiveDark: string
  border: string
  borderDark: string
  circle: string      // bolinha numerada quando ativa (light)
  circleDark: string  // bolinha numerada quando ativa (dark)
}

const ETAPAS: EtapaMeta[] = [
  {
    key: 'requisicao', num: 1, label: 'Requisição',
    descricao: 'Gestor solicita a admissão (após aceite da vaga).',
    icon: ClipboardList, iconColor: 'text-blue-500',
    bgActive: 'bg-blue-50', bgActiveDark: 'bg-blue-500/10',
    textActive: 'text-blue-700', textActiveDark: 'text-blue-300',
    border: 'border-blue-300', borderDark: 'border-blue-500/40',
    circle: 'bg-blue-600 text-white', circleDark: 'bg-blue-500/30 text-blue-200',
  },
  {
    key: 'aprovacao', num: 2, label: 'Aprovação',
    descricao: 'Diretoria autoriza a admissão solicitada.',
    icon: ShieldCheck, iconColor: 'text-indigo-500',
    bgActive: 'bg-indigo-50', bgActiveDark: 'bg-indigo-500/10',
    textActive: 'text-indigo-700', textActiveDark: 'text-indigo-300',
    border: 'border-indigo-300', borderDark: 'border-indigo-500/40',
    circle: 'bg-indigo-600 text-white', circleDark: 'bg-indigo-500/30 text-indigo-200',
  },
  {
    key: 'documentacao', num: 3, label: 'Documentação',
    descricao: 'Envio e conferência da documentação do colaborador.',
    icon: FileText, iconColor: 'text-violet-500',
    bgActive: 'bg-violet-50', bgActiveDark: 'bg-violet-500/10',
    textActive: 'text-violet-700', textActiveDark: 'text-violet-300',
    border: 'border-violet-300', borderDark: 'border-violet-500/40',
    circle: 'bg-violet-600 text-white', circleDark: 'bg-violet-500/30 text-violet-200',
  },
  {
    key: 'exames_treinamentos', num: 4, label: 'Exames e Treinamentos',
    descricao: 'Exame admissional (NR-7) + treinamentos obrigatórios (NRs e matriz).',
    icon: Stethoscope, iconColor: 'text-amber-500',
    bgActive: 'bg-amber-50', bgActiveDark: 'bg-amber-500/10',
    textActive: 'text-amber-700', textActiveDark: 'text-amber-300',
    border: 'border-amber-300', borderDark: 'border-amber-500/40',
    circle: 'bg-amber-500 text-white', circleDark: 'bg-amber-500/30 text-amber-200',
  },
  {
    key: 'mobilizacao', num: 5, label: 'Mobilização',
    descricao: 'Logística de deslocamento e chegada à obra.',
    icon: Truck, iconColor: 'text-orange-500',
    bgActive: 'bg-orange-50', bgActiveDark: 'bg-orange-500/10',
    textActive: 'text-orange-700', textActiveDark: 'text-orange-300',
    border: 'border-orange-300', borderDark: 'border-orange-500/40',
    circle: 'bg-orange-500 text-white', circleDark: 'bg-orange-500/30 text-orange-200',
  },
  {
    key: 'integracao', num: 6, label: 'Integração',
    descricao: 'Onboarding com RH e Gestor.',
    icon: HeartHandshake, iconColor: 'text-teal-500',
    bgActive: 'bg-teal-50', bgActiveDark: 'bg-teal-500/10',
    textActive: 'text-teal-700', textActiveDark: 'text-teal-300',
    border: 'border-teal-300', borderDark: 'border-teal-500/40',
    circle: 'bg-teal-600 text-white', circleDark: 'bg-teal-500/30 text-teal-200',
  },
  {
    key: 'liberado', num: 7, label: 'Liberado para Atividades',
    descricao: 'Colaborador apto, ativo e liberado para iniciar as atividades.',
    icon: CheckCircle2, iconColor: 'text-emerald-500',
    bgActive: 'bg-emerald-50', bgActiveDark: 'bg-emerald-500/10',
    textActive: 'text-emerald-700', textActiveDark: 'text-emerald-300',
    border: 'border-emerald-300', borderDark: 'border-emerald-500/40',
    circle: 'bg-emerald-600 text-white', circleDark: 'bg-emerald-500/30 text-emerald-200',
  },
]

// ── Tela principal ────────────────────────────────────────────────────────────
export default function RHAdmissao() {
  const { isLightSidebar: isLight } = useTheme()
  const [etapa, setEtapa] = useState<EtapaAdmissao>('requisicao')

  const ativa = ETAPAS.find(e => e.key === etapa) ?? ETAPAS[0]

  // Contagens por etapa (serão ligadas aos dados nas próximas iterações)
  const counts: Record<EtapaAdmissao, number> = {
    requisicao: 0, aprovacao: 0, documentacao: 0, exames_treinamentos: 0,
    mobilizacao: 0, integracao: 0, liberado: 0,
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
          onClick={() => setEtapa('requisicao')}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shrink-0"
        >
          <Plus size={15} /> Nova Requisição
        </button>
      </div>

      {/* Rail de sub-abas (etapas do fluxo) */}
      <EtapaRail isLight={isLight} etapa={etapa} setEtapa={setEtapa} counts={counts} />

      {/* Conteúdo da etapa ativa (placeholder por enquanto) */}
      <EtapaPanel etapa={ativa} isLight={isLight} />
    </div>
  )
}

// ── Rail de etapas (padrão visual do Financeiro: scrollável + drag + chevrons) ─
function EtapaRail({
  isLight,
  etapa,
  setEtapa,
  counts,
}: {
  isLight: boolean
  etapa: EtapaAdmissao
  setEtapa: (e: EtapaAdmissao) => void
  counts: Record<EtapaAdmissao, number>
}) {
  const isDark = !isLight
  const railRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ active: boolean; startX: number; startScrollLeft: number; moved: boolean }>({
    active: false, startX: 0, startScrollLeft: 0, moved: false,
  })
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = () => {
    const el = railRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 8)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
  }

  useEffect(() => {
    updateScrollState()
    const el = railRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const resizeObserver = new ResizeObserver(() => updateScrollState())
    resizeObserver.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      resizeObserver.disconnect()
    }
  }, [])

  const scrollByAmount = (direction: -1 | 1) => {
    railRef.current?.scrollBy({ left: direction * 240, behavior: 'smooth' })
  }

  return (
    <div className="relative min-w-0">
      {canScrollLeft && (
        <>
          <div className={`pointer-events-none absolute inset-y-1 left-1 z-10 w-10 rounded-l-2xl bg-gradient-to-r ${isDark ? 'from-[#0f172a]' : 'from-slate-50'} to-transparent`} />
          <button
            type="button"
            onClick={() => scrollByAmount(-1)}
            className={`absolute left-2 top-1/2 z-20 -translate-y-1/2 h-8 w-8 rounded-full border backdrop-blur-sm transition-all ${
              isDark
                ? 'border-white/[0.10] bg-slate-900/85 text-slate-200 hover:bg-slate-800'
                : 'border-slate-200 bg-white/95 text-slate-600 hover:bg-slate-50 shadow-sm'
            }`}
            aria-label="Rolar etapas para a esquerda"
          >
            <ChevronLeft size={14} className="mx-auto" />
          </button>
        </>
      )}
      {canScrollRight && (
        <>
          <div className={`pointer-events-none absolute inset-y-1 right-1 z-10 w-10 rounded-r-2xl bg-gradient-to-l ${isDark ? 'from-[#0f172a]' : 'from-slate-50'} to-transparent`} />
          <button
            type="button"
            onClick={() => scrollByAmount(1)}
            className={`absolute right-2 top-1/2 z-20 -translate-y-1/2 h-8 w-8 rounded-full border backdrop-blur-sm transition-all ${
              isDark
                ? 'border-white/[0.10] bg-slate-900/85 text-slate-200 hover:bg-slate-800'
                : 'border-slate-200 bg-white/95 text-slate-600 hover:bg-slate-50 shadow-sm'
            }`}
            aria-label="Rolar etapas para a direita"
          >
            <ChevronRight size={14} className="mx-auto" />
          </button>
        </>
      )}

      <div
        ref={railRef}
        onMouseDown={e => {
          dragRef.current = {
            active: true, startX: e.clientX,
            startScrollLeft: railRef.current?.scrollLeft ?? 0, moved: false,
          }
        }}
        onMouseMove={e => {
          if (!dragRef.current.active || !railRef.current) return
          const delta = e.clientX - dragRef.current.startX
          if (Math.abs(delta) > 4) dragRef.current.moved = true
          railRef.current.scrollLeft = dragRef.current.startScrollLeft - delta
        }}
        onMouseUp={() => { window.setTimeout(() => { dragRef.current.active = false }, 0) }}
        onMouseLeave={() => { dragRef.current.active = false }}
        onClickCapture={e => {
          if (dragRef.current.moved) {
            e.preventDefault()
            e.stopPropagation()
            dragRef.current.moved = false
          }
        }}
        onWheel={e => {
          const el = railRef.current
          if (!el) return
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.preventDefault()
            el.scrollLeft += e.deltaY
          }
        }}
        className={`flex gap-1 p-1 rounded-2xl border overflow-x-auto hide-scrollbar pr-12 ${canScrollLeft ? 'pl-12' : ''} ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'} cursor-grab active:cursor-grabbing`}
      >
        {ETAPAS.map(e => {
          const Icon = e.icon
          const isActive = etapa === e.key
          const count = counts[e.key]
          return (
            <button
              key={e.key}
              onClick={() => setEtapa(e.key)}
              className={`min-w-fit flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border ${
                isActive
                  ? isDark
                    ? `${e.bgActiveDark} ${e.textActiveDark} ${e.borderDark} shadow-sm`
                    : `${e.bgActive} ${e.textActive} ${e.border} shadow-sm`
                  : isDark
                    ? 'text-slate-400 border-transparent hover:bg-white/[0.04]'
                    : 'text-slate-500 border-transparent hover:bg-white hover:shadow-sm'
              }`}
            >
              {/* Bolinha numerada (passo do fluxo) */}
              <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                isActive
                  ? isDark ? e.circleDark : e.circle
                  : isDark ? 'bg-white/[0.08] text-slate-400' : 'bg-slate-200 text-slate-500'
              }`}>
                {e.num}
              </span>
              <Icon size={15} className="shrink-0" />
              {e.label}
              {count > 0 && (
                <span className={`ml-1 min-w-[22px] px-1.5 py-0.5 rounded-full text-[10px] font-bold text-center ${
                  isActive
                    ? isDark ? 'bg-white/[0.12] text-slate-100' : 'bg-white text-slate-700'
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
  )
}

// ── Painel da etapa (placeholder — conteúdo será montado depois) ───────────────
function EtapaPanel({ etapa, isLight }: { etapa: EtapaMeta; isLight: boolean }) {
  const Icon = etapa.icon
  return (
    <div className={`rounded-2xl border ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'}`}>
      {/* Cabeçalho da etapa */}
      <div className={`flex items-center gap-3 px-5 py-4 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isLight ? 'bg-slate-100' : 'bg-white/[0.05]'}`}>
          <Icon size={20} className={etapa.iconColor} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-wide ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              Etapa {etapa.num} de {ETAPAS.length}
            </span>
          </div>
          <h2 className={`text-base font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{etapa.label}</h2>
          <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{etapa.descricao}</p>
        </div>
      </div>

      {/* Corpo — placeholder */}
      <div className="p-5">
        <div className={`rounded-xl border border-dashed flex flex-col items-center justify-center text-center py-14 px-6 ${
          isLight ? 'border-slate-300 bg-slate-50/60' : 'border-white/[0.10] bg-white/[0.02]'
        }`}>
          <Construction size={34} className={isLight ? 'text-slate-300 mb-3' : 'text-slate-600 mb-3'} />
          <p className={`text-sm font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Conteúdo da etapa “{etapa.label}” em construção
          </p>
          <p className={`text-xs mt-1 max-w-md ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            A estrutura do fluxo está pronta. Os campos e ações desta etapa serão montados em seguida.
          </p>
        </div>
      </div>
    </div>
  )
}
