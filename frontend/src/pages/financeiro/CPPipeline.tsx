import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  Receipt, Search, Calendar, AlertTriangle, CheckCircle2, Clock,
  FileText, ChevronDown, ChevronUp, Banknote, X, ShieldCheck,
  Building2, Tag, Briefcase, Hash, Layers, Truck, Package,
  Paperclip, ExternalLink, Download, ArrowUpDown, LayoutList,
  LayoutGrid, Filter, SortAsc, SortDesc, ArrowDown, ArrowUp, Send, MessageSquare, XCircle,
  ChevronLeft, ChevronRight, ArrowRight,
  Plus, Save, Loader2, RefreshCw,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useContasPagar,
  useAprovarPagamento,
  useMarcarCPPago,
  useConciliarCPBatch,
  useCancelarCPBatch,
  useFornecedorById,
  useCriarSolicitacaoExtraordinariaCP,
  useCriarPrevisaoPagamentoCP,
} from '../../hooks/useFinanceiro'
import {
  useLotesPagamento,
  useLoteById,
  useCriarLote,
  useEnviarLoteAprovacao,
  useRegistrarPagamentoBatch,
  useEnviarRemessaPagamentoBatch,
  useSincronizarRemessasPagamento,
} from '../../hooks/useLotesPagamento'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useDecisaoGenerica } from '../../hooks/useAprovacoes'
import { useLookupCentrosCusto, useLookupClassesFinanceiras } from '../../hooks/useLookups'
import { useAnexosPedido, useUploadAnexo, TIPO_LABEL } from '../../hooks/useAnexos'
import type { PedidoAnexo } from '../../hooks/useAnexos'
import type { ContaPagar, LotePagamento, StatusCP } from '../../types/financeiro'
import { CP_PIPELINE_STAGES } from '../../types/financeiro'

// ══ Formatters ══════════════════════════════════════════════════

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtFull = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const fmtDataFull = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

const fmtDateTime = (value?: string) =>
  value ? new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''

function getRemessaHint(cp: ContaPagar) {
  if (cp.status === 'aprovado_pgto' && cp.remessa_status === 'erro' && cp.remessa_erro) {
    return `Falha na remessa: ${cp.remessa_erro}`
  }
  if (cp.status !== 'em_pagamento') return null
  if (cp.remessa_status === 'erro') {
    return cp.remessa_erro ? `Erro na remessa: ${cp.remessa_erro}` : 'Erro no retorno da remessa'
  }
  if (cp.remessa_id && cp.remessa_enviada_em) {
    return `Remessa ${cp.remessa_id} enviada em ${fmtDateTime(cp.remessa_enviada_em)}`
  }
  if (cp.remessa_id) return `Remessa ${cp.remessa_id} em processamento`
  return 'Aguardando retorno da remessa'
}

function isUrgentExtraordinary(cp: ContaPagar) {
  return cp.origem === 'manual' && cp.natureza === 'extraordinario'
}

type NovaSolicitacaoExtraForm = {
  descricao: string
  justificativa: string
  centro_custo: string
  classe_financeira: string
  valor: string
  favorecido: string
  banco_nome: string
  agencia: string
  conta: string
  pix_tipo: string
  pix_chave: string
}

type NovaSolicitacaoKind = 'extraordinario' | 'previsao'

type NovaPrevisaoPagamentoForm = {
  nome: string
  valor: string
  centro_custo: string
  classe_financeira: string
  recorrente: boolean
  periodicidade: 'semanal' | 'quinzenal' | 'mensal'
  recorrenciaFim: string
  dataVencimento: string
}

const EMPTY_EXTRA_FORM: NovaSolicitacaoExtraForm = {
  descricao: '',
  justificativa: '',
  centro_custo: '',
  classe_financeira: '',
  valor: '',
  favorecido: '',
  banco_nome: '',
  agencia: '',
  conta: '',
  pix_tipo: '',
  pix_chave: '',
}

const EMPTY_PREVISAO_FORM: NovaPrevisaoPagamentoForm = {
  nome: '',
  valor: '',
  centro_custo: '',
  classe_financeira: '',
  recorrente: false,
  periodicidade: 'mensal',
  recorrenciaFim: '',
  dataVencimento: new Date().toISOString().split('T')[0],
}

function summarizeNames(values: string[], fallback: string) {
  const unique = Array.from(new Set(values.map(v => v.trim()).filter(Boolean)))
  if (unique.length === 0) return fallback
  if (unique.length === 1) return unique[0]
  if (unique.length === 2) return `${unique[0]} + ${unique[1]}`
  return `${unique[0]} + ${unique.length - 1}`
}

function getLoteProgress(activeTab: PipelineStageId, loteStatus?: string) {
  switch (activeTab) {
    case 'em_lote':
      return { progress: 28, progressLabel: 'Montagem do lote' }
    case 'em_aprovacao':
      return { progress: 52, progressLabel: 'Em aprovação' }
    case 'aprovado_pgto':
      return { progress: 74, progressLabel: 'Pronto para pagamento' }
    case 'em_pagamento':
      return { progress: 90, progressLabel: 'Remessa em processamento' }
    default:
      if (loteStatus === 'pago') return { progress: 100, progressLabel: 'Lote pago' }
      if (loteStatus === 'cancelado') return { progress: 100, progressLabel: 'Lote cancelado' }
      return { progress: 40, progressLabel: 'Em andamento' }
  }
}

// ══ Sort types ══════════════════════════════════════════════════

type SortField = 'vencimento' | 'valor' | 'fornecedor' | 'emissao'
type SortDir = 'asc' | 'desc'
type ViewMode = 'list' | 'cards'
type PipelineStageId = StatusCP | 'em_aprovacao'
type QuickFilterId = 'all' | 'overdue' | 'today' | 'week' | 'this_month' | 'next_month' | 'future' | 'custom' | 'same_supplier' | 'same_work' | 'same_lote'
type StatusHintTone = 'amber' | 'rose' | 'sky'
type StatusHint = { text: string; tone: StatusHintTone }
const CP_TABLE_GRID = 'grid grid-cols-[20px_2px_minmax(0,1.8fr)_minmax(0,1.45fr)_minmax(0,1fr)_70px_110px_72px_96px] items-center gap-x-3'
const LOTE_TABLE_GRID = 'grid grid-cols-[20px_2px_150px_minmax(0,1.8fr)_80px_100px_120px_190px] items-center gap-x-3'
const LOTE_STAGE_TABS: PipelineStageId[] = ['em_lote', 'em_aprovacao', 'aprovado_pgto', 'em_pagamento']

type LoteStageSummary = {
  lote: LotePagamento
  cpIds: string[]
  currentItems: ContaPagar[]
  allItems: ContaPagar[]
  totalItems: number
  approvedItems: number
  excludedItems: number
  totalValue: number
  visibleValue: number
  supplierLabel: string
  workLabel: string
  headerLabel: string
  progress: number
  progressLabel: string
}

const CP_PIPELINE_VIEW_STAGES: Array<{ status: PipelineStageId; label: string; color: string; borderColor: string }> = [
  ...CP_PIPELINE_STAGES.slice(0, 3),
  { status: 'em_aprovacao', label: 'Em Aprovação', color: 'amber', borderColor: 'border-t-amber-500' },
  { status: 'aprovado_pgto', label: 'Painel de Pagamento', color: 'emerald', borderColor: 'border-t-emerald-500' },
  { status: 'em_pagamento', label: 'Em Processamento', color: 'sky', borderColor: 'border-t-sky-500' },
  ...CP_PIPELINE_STAGES.filter(stage => ['pago', 'conciliado', 'cancelado'].includes(stage.status)),
]

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'vencimento', label: 'Vencimento' },
  { field: 'valor',      label: 'Valor' },
  { field: 'fornecedor', label: 'Fornecedor' },
  { field: 'emissao',    label: 'Emissão' },
]

// ══ Urgency helper ══════════════════════════════════════════════

function getUrgency(cp: ContaPagar): 'overdue' | 'today' | 'week' | 'normal' {
  if (['pago', 'conciliado', 'cancelado'].includes(cp.status)) return 'normal'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const venc = new Date(cp.data_vencimento + 'T00:00:00')
  const diffDays = Math.floor((venc.getTime() - today.getTime()) / 86_400_000)
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 7) return 'week'
  return 'normal'
}

// ══ Status icon map ═════════════════════════════════════════════

const STATUS_ICONS: Record<string, typeof Receipt> = {
  previsto:      Calendar,
  confirmado:    CheckCircle2,
  em_lote:       Layers,
  em_aprovacao:  Send,
  aprovado_pgto: ShieldCheck,
  em_pagamento:  Clock,
  pago:          Banknote,
  conciliado:    CheckCircle2,
  cancelado:     X,
}

const STATUS_ACCENT: Record<string, { bg: string; bgActive: string; text: string; textActive: string; dot: string; border: string; badge: string }> = {
  previsto:      { bg: 'hover:bg-slate-50',   bgActive: 'bg-slate-100',   text: 'text-slate-600',   textActive: 'text-slate-800',   dot: 'bg-slate-400',   border: 'border-slate-400',   badge: 'bg-slate-200 text-slate-600' },
  confirmado:    { bg: 'hover:bg-blue-50',    bgActive: 'bg-blue-50',     text: 'text-blue-600',    textActive: 'text-blue-800',    dot: 'bg-blue-500',    border: 'border-blue-500',    badge: 'bg-blue-100 text-blue-700' },
  em_lote:       { bg: 'hover:bg-violet-50',  bgActive: 'bg-violet-50',   text: 'text-violet-600',  textActive: 'text-violet-800',  dot: 'bg-violet-500',  border: 'border-violet-500',  badge: 'bg-violet-100 text-violet-700' },
  em_aprovacao:  { bg: 'hover:bg-amber-50',   bgActive: 'bg-amber-50',    text: 'text-amber-600',   textActive: 'text-amber-800',   dot: 'bg-amber-500',   border: 'border-amber-500',   badge: 'bg-amber-100 text-amber-700' },
  aprovado_pgto: { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50',  text: 'text-emerald-600', textActive: 'text-emerald-800', dot: 'bg-emerald-500', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  em_pagamento:  { bg: 'hover:bg-sky-50',     bgActive: 'bg-sky-50',      text: 'text-sky-600',     textActive: 'text-sky-800',     dot: 'bg-sky-500',     border: 'border-sky-500',     badge: 'bg-sky-100 text-sky-700' },
  pago:          { bg: 'hover:bg-teal-50',    bgActive: 'bg-teal-50',     text: 'text-teal-600',    textActive: 'text-teal-800',    dot: 'bg-teal-500',    border: 'border-teal-500',    badge: 'bg-teal-100 text-teal-700' },
  conciliado:    { bg: 'hover:bg-green-50',   bgActive: 'bg-green-50',    text: 'text-green-600',   textActive: 'text-green-800',   dot: 'bg-green-500',   border: 'border-green-500',   badge: 'bg-green-100 text-green-700' },
  cancelado:     { bg: 'hover:bg-rose-50',    bgActive: 'bg-rose-50',     text: 'text-rose-600',    textActive: 'text-rose-800',    dot: 'bg-rose-500',    border: 'border-rose-500',    badge: 'bg-rose-100 text-rose-700' },
}

const STATUS_ACCENT_DARK: Record<string, { bg: string; bgActive: string; text: string; textActive: string; border: string; badge: string }> = {
  previsto:      { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-slate-500/10',   text: 'text-slate-400',   textActive: 'text-slate-200',   border: 'border-slate-400/40',   badge: 'bg-slate-500/15 text-slate-200' },
  confirmado:    { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-blue-500/10',    text: 'text-blue-400',    textActive: 'text-blue-300',    border: 'border-blue-400/40',    badge: 'bg-blue-500/15 text-blue-200' },
  em_lote:       { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-violet-500/10',  text: 'text-violet-400',  textActive: 'text-violet-300',  border: 'border-violet-400/40',  badge: 'bg-violet-500/15 text-violet-200' },
  em_aprovacao:  { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-amber-500/10',   text: 'text-amber-400',   textActive: 'text-amber-300',   border: 'border-amber-400/40',   badge: 'bg-amber-500/15 text-amber-200' },
  aprovado_pgto: { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-emerald-500/10', text: 'text-emerald-400', textActive: 'text-emerald-300', border: 'border-emerald-400/40', badge: 'bg-emerald-500/15 text-emerald-200' },
  em_pagamento:  { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-sky-500/10',     text: 'text-sky-400',     textActive: 'text-sky-300',     border: 'border-sky-400/40',     badge: 'bg-sky-500/15 text-sky-200' },
  pago:          { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-teal-500/10',    text: 'text-teal-400',    textActive: 'text-teal-300',    border: 'border-teal-400/40',    badge: 'bg-teal-500/15 text-teal-200' },
  conciliado:    { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-green-500/10',   text: 'text-green-400',   textActive: 'text-green-300',   border: 'border-green-400/40',   badge: 'bg-green-500/15 text-green-200' },
  cancelado:     { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-rose-500/10',    text: 'text-rose-400',    textActive: 'text-rose-300',    border: 'border-rose-400/40',    badge: 'bg-rose-500/15 text-rose-200' },
}

function PipelineRail({
  isDark,
  activeTab,
  switchTab,
  grouped,
}: {
  isDark: boolean
  activeTab: PipelineStageId
  switchTab: (tab: PipelineStageId) => void
  grouped: Map<PipelineStageId, ContaPagar[]>
}) {
  const railRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ active: boolean; startX: number; startScrollLeft: number }>({
    active: false,
    startX: 0,
    startScrollLeft: 0,
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
  }, [grouped, activeTab])

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
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: rail.scrollLeft,
    }
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
            aria-label="Rolar abas para a esquerda"
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
            aria-label="Rolar abas para a direita"
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
          {CP_PIPELINE_VIEW_STAGES.map(stage => {
            const count = grouped.get(stage.status)?.length || 0
            const isActive = activeTab === stage.status
            const Icon = STATUS_ICONS[stage.status] || Receipt
            const accent = isDark ? STATUS_ACCENT_DARK[stage.status] : STATUS_ACCENT[stage.status]

            return (
              <button
                key={stage.status}
                onClick={() => switchTab(stage.status)}
                className={`flex min-h-[56px] min-w-fit items-center justify-center gap-2.5 rounded-xl px-4 py-2.5 text-sm whitespace-nowrap transition-all shrink-0 md:flex-1 ${
                  isActive
                    ? `${accent?.bgActive} ${accent?.textActive} border font-bold shadow-sm ${accent?.border}`
                    : `${accent?.bg} ${accent?.text} font-medium`
                }`}
              >
                <Icon size={15} className="shrink-0" />
                {stage.label}
                {count > 0 && (
                  <span className={`rounded-full min-w-[24px] h-[24px] px-1.5 flex items-center justify-center text-[10px] font-bold ${
                    isActive
                      ? accent?.badge
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

// ══ Export CSV ══════════════════════════════════════════════════

function exportCSV(cps: ContaPagar[], stageName: string) {
  const headers = ['Fornecedor', 'Valor', 'Vencimento', 'Emissao', 'Documento', 'Centro Custo', 'Classe Financeira', 'Obra', 'Pedido', 'Descricao', 'Status']
  const rows = cps.map(cp => [
    cp.fornecedor_nome,
    cp.valor_original.toFixed(2).replace('.', ','),
    fmtDataFull(cp.data_vencimento),
    fmtDataFull(cp.data_emissao),
    cp.numero_documento || '',
    cp.centro_custo || '',
    cp.classe_financeira || '',
    cp.requisicao?.obra_nome || '',
    cp.pedido?.numero_pedido || '',
    cp.descricao || '',
    cp.status,
  ])

  const bom = '\uFEFF'
  const csv = bom + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `contas-a-pagar-${stageName.replace(/\s/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ══ FornecedorBankInfo ══════════════════════════════════════════

function FornecedorBankInfo({ fornecedorId, isDark }: { fornecedorId: string; isDark: boolean }) {
  const { data: forn } = useFornecedorById(fornecedorId)
  if (!forn) return null
  const hasBankData = forn.banco_nome || forn.agencia || forn.conta || forn.pix_chave
  if (!hasBankData) return null

  return (
    <div className={`rounded-xl p-2.5 space-y-1 ${isDark ? 'bg-white/[0.04]' : 'bg-blue-50/60'}`}>
      <p className="text-[9px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1">
        <Banknote size={9} /> Dados Banc\u00E1rios
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
        {forn.banco_nome && <div><span className="text-slate-400">Banco:</span> <span className="font-semibold text-slate-700">{forn.banco_nome}</span></div>}
        {forn.agencia && <div><span className="text-slate-400">Ag:</span> <span className="font-mono text-slate-700">{forn.agencia}</span></div>}
        {forn.conta && <div><span className="text-slate-400">CC:</span> <span className="font-mono text-slate-700">{forn.conta}</span></div>}
        {forn.pix_chave && <div className="col-span-2"><span className="text-slate-400">PIX:</span> <span className="font-mono text-blue-700 font-semibold">{forn.pix_chave}</span></div>}
      </div>
    </div>
  )
}

// ══ AnexosList ══════════════════════════════════════════════════

function AnexosList({
  pedidoId,
  isDark = false,
  canUpload = false,
}: {
  pedidoId: string
  isDark?: boolean
  canUpload?: boolean
}) {
  const { data: anexos, isLoading } = useAnexosPedido(pedidoId)
  const anexosList = anexos ?? []
  const uploadAnexoMut = useUploadAnexo()
  const [tipo, setTipo] = useState<PedidoAnexo['tipo']>('outro')
  const [erroUpload, setErroUpload] = useState('')

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setErroUpload('')
    try {
      for (const file of Array.from(files)) {
        await uploadAnexoMut.mutateAsync({
          pedidoId,
          file,
          tipo,
          origem: 'financeiro',
        })
      }
    } catch (error) {
      setErroUpload(error instanceof Error ? error.message : 'Erro ao enviar anexo')
    }
  }

  return (
    <div className="space-y-1">
      {canUpload && (
        <div className={`rounded-xl border p-3 mb-2 ${isDark ? 'border-white/[0.08] bg-white/[0.03]' : 'border-slate-200 bg-slate-50/70'}`}>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value as PedidoAnexo['tipo'])}
              className={`rounded-lg border px-2.5 py-2 text-[11px] outline-none ${isDark ? 'border-white/[0.08] bg-white/[0.05] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
            >
              {Object.entries(TIPO_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <label className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold cursor-pointer transition-colors ${
              uploadAnexoMut.isPending
                ? 'bg-emerald-300 text-white cursor-wait'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}>
              <Paperclip size={12} />
              {uploadAnexoMut.isPending ? 'Enviando...' : 'Adicionar anexo'}
              <input
                type="file"
                multiple
                className="hidden"
                onChange={async e => {
                  await handleUpload(e.target.files)
                  e.target.value = ''
                }}
                disabled={uploadAnexoMut.isPending}
              />
            </label>
          </div>
          {erroUpload && <p className="mt-2 text-[10px] text-rose-500">{erroUpload}</p>}
        </div>
      )}
      {isLoading && <div className="flex justify-center py-2"><div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>}
      {!isLoading && !anexosList.length && <p className="text-[10px] text-slate-400 italic py-1">Sem anexos</p>}
      {anexosList.slice(0, 3).map((a: PedidoAnexo) => (
        <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 hover:border-slate-300 text-[10px] group">
          <Paperclip size={9} className="text-slate-400 shrink-0" />
          <span className="truncate text-slate-600 font-medium">{a.nome_arquivo}</span>
          <ExternalLink size={8} className="text-slate-300 group-hover:text-slate-500 shrink-0 ml-auto" />
        </a>
      ))}
      {anexosList.length > 3 && <p className="text-[9px] text-slate-400">+{anexosList.length - 3} mais</p>}
    </div>
  )
}

// ══ CPDetailModal ═══════════════════════════════════════════════

function NovaSolicitacaoExtraordinariaModal({
  isDark,
  onClose,
  onSuccess,
}: {
  isDark: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const { perfil } = useAuth()
  const centrosCusto = useLookupCentrosCusto()
  const classesFinanceiras = useLookupClassesFinanceiras()
  const criarSolicitacaoMut = useCriarSolicitacaoExtraordinariaCP()
  const [form, setForm] = useState<NovaSolicitacaoExtraForm>(EMPTY_EXTRA_FORM)
  const [arquivos, setArquivos] = useState<File[]>([])
  const [erro, setErro] = useState('')
  const [ccBusca, setCcBusca] = useState('')
  const [classeBusca, setClasseBusca] = useState('')
  const [ccOpen, setCcOpen] = useState(false)
  const [classeOpen, setClasseOpen] = useState(false)

  const canSubmit = form.descricao.trim().length > 0
    && form.justificativa.trim().length > 0
    && form.centro_custo.length > 0
    && form.classe_financeira.length > 0
    && Number(form.valor) > 0

  const inputCls = `w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors ${
    isDark
      ? 'bg-white/[0.06] border border-white/[0.08] text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/50'
      : 'bg-slate-50 border border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-emerald-500'
  }`
  const labelCls = `block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`

  const setField = (field: keyof NovaSolicitacaoExtraForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const centrosFiltrados = centrosCusto
    .filter(cc => `${cc.codigo} ${cc.descricao}`.toLowerCase().includes(ccBusca.toLowerCase()))
    .slice(0, 8)

  const classesFiltradas = classesFinanceiras
    .filter(classe => `${classe.codigo} ${classe.descricao}`.toLowerCase().includes(classeBusca.toLowerCase()))
    .slice(0, 8)

  const getLookupValue = (codigo?: string | null, descricao?: string | null) =>
    codigo?.trim() || descricao?.trim() || ''

  const getLookupLabel = (codigo?: string | null, descricao?: string | null) => {
    const code = codigo?.trim() || ''
    const desc = descricao?.trim() || ''
    if (code && desc) return `${code} - ${desc}`
    return code || desc
  }

  const centroSelecionado = centrosCusto.find(cc => getLookupValue(cc.codigo, cc.descricao) === form.centro_custo)
  const classeSelecionada = classesFinanceiras.find(classe => getLookupValue(classe.codigo, classe.descricao) === form.classe_financeira)

  async function handleCriar() {
    if (!canSubmit) return
    setErro('')
    try {
      await criarSolicitacaoMut.mutateAsync({
        descricao: form.descricao,
        justificativa: form.justificativa,
        centro_custo: form.centro_custo,
        classe_financeira: form.classe_financeira,
        valor: Number(form.valor),
        solicitanteNome: perfil?.nome,
        dadosBancarios: {
          favorecido: form.favorecido || undefined,
          banco_nome: form.banco_nome || undefined,
          agencia: form.agencia || undefined,
          conta: form.conta || undefined,
          pix_tipo: form.pix_tipo || undefined,
          pix_chave: form.pix_chave || undefined,
        },
        arquivos,
      })
      onSuccess()
      onClose()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao criar solicitação')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-6 py-4 sticky top-0 z-10 ${isDark ? 'border-b border-white/[0.06] bg-[#1e293b]' : 'border-b border-slate-100 bg-white'}`}>
          <div>
            <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Nova Solicitação</h2>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pagamento extraordinário com entrada direta em Confirmados</p>
          </div>
          <button onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X size={16} />
        </button>
      </div>

        <div className="p-6 space-y-4">
          <div className={`rounded-xl border px-4 py-3 ${isDark ? 'border-rose-500/20 bg-rose-500/10' : 'border-rose-200 bg-rose-50'}`}>
            <p className={`text-xs font-bold ${isDark ? 'text-rose-200' : 'text-rose-700'}`}>Urgente</p>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>A solicitação será criada como pagamento extraordinário manual e ficará visível com destaque urgente.</p>
          </div>

          <div>
            <label className={labelCls}>Descrição *</label>
            <textarea value={form.descricao} onChange={e => setField('descricao', e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Descreva o pagamento extraordinário" />
          </div>

          <div>
            <label className={labelCls}>Justificativa *</label>
            <textarea value={form.justificativa} onChange={e => setField('justificativa', e.target.value)} rows={4} className={`${inputCls} resize-none`} placeholder="Explique por que este pagamento foge ao fluxo natural" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <label className={labelCls}>Centro de Custo *</label>
              <button
                type="button"
                onClick={() => {
                  setCcOpen(prev => !prev)
                  setClasseOpen(false)
                }}
                className={`${inputCls} flex items-center justify-between text-left ${ccOpen ? (isDark ? 'ring-1 ring-emerald-500/40' : 'ring-1 ring-emerald-500/30') : ''}`}
              >
                <span className={form.centro_custo ? '' : isDark ? 'text-slate-500' : 'text-slate-400'}>
                  {centroSelecionado ? getLookupLabel(centroSelecionado.codigo, centroSelecionado.descricao) : form.centro_custo || 'Selecione...'}
                </span>
                <ChevronDown size={16} className={`transition-transform ${ccOpen ? 'rotate-180' : ''} ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              </button>
              {ccOpen && (
                <div className={`absolute z-30 mt-2 w-full rounded-2xl border shadow-xl overflow-hidden ${isDark ? 'border-white/[0.08] bg-slate-950' : 'border-slate-200 bg-white'}`}>
                  <div className="p-2 border-b border-inherit">
                    <input
                      value={ccBusca}
                      onChange={e => setCcBusca(e.target.value)}
                      className={inputCls}
                      placeholder="Buscar centro de custo..."
                      autoFocus
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {centrosFiltrados.map(cc => {
                      const value = getLookupValue(cc.codigo, cc.descricao)
                      const label = getLookupLabel(cc.codigo, cc.descricao)
                      return (
                        <button
                          key={cc.id}
                          type="button"
                          onClick={() => {
                            setField('centro_custo', value)
                            setCcBusca(label)
                            setCcOpen(false)
                          }}
                          className={`w-full px-3 py-2 text-left text-sm transition-colors ${isDark ? 'text-slate-200 hover:bg-white/[0.06]' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                          <div className="font-medium">{cc.codigo || cc.descricao}</div>
                          {!!cc.codigo && <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{cc.descricao}</div>}
                        </button>
                      )
                    })}
                    {centrosFiltrados.length === 0 && (
                      <div className={`px-3 py-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nenhum centro encontrado.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <label className={labelCls}>Classe Financeira *</label>
              <button
                type="button"
                onClick={() => {
                  setClasseOpen(prev => !prev)
                  setCcOpen(false)
                }}
                className={`${inputCls} flex items-center justify-between text-left ${classeOpen ? (isDark ? 'ring-1 ring-emerald-500/40' : 'ring-1 ring-emerald-500/30') : ''}`}
              >
                <span className={form.classe_financeira ? '' : isDark ? 'text-slate-500' : 'text-slate-400'}>
                  {classeSelecionada ? getLookupLabel(classeSelecionada.codigo, classeSelecionada.descricao) : form.classe_financeira || 'Selecione...'}
                </span>
                <ChevronDown size={16} className={`transition-transform ${classeOpen ? 'rotate-180' : ''} ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              </button>
              {classeOpen && (
                <div className={`absolute z-30 mt-2 w-full rounded-2xl border shadow-xl overflow-hidden ${isDark ? 'border-white/[0.08] bg-slate-950' : 'border-slate-200 bg-white'}`}>
                  <div className="p-2 border-b border-inherit">
                    <input
                      value={classeBusca}
                      onChange={e => setClasseBusca(e.target.value)}
                      className={inputCls}
                      placeholder="Buscar classe financeira..."
                      autoFocus
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {classesFiltradas.map(classe => {
                      const value = getLookupValue(classe.codigo, classe.descricao)
                      const label = getLookupLabel(classe.codigo, classe.descricao)
                      return (
                        <button
                          key={classe.id}
                          type="button"
                          onClick={() => {
                            setField('classe_financeira', value)
                            setClasseBusca(label)
                            setClasseOpen(false)
                          }}
                          className={`w-full px-3 py-2 text-left text-sm transition-colors ${isDark ? 'text-slate-200 hover:bg-white/[0.06]' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                          <div className="font-medium">{classe.codigo || classe.descricao}</div>
                          {!!classe.codigo && <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{classe.descricao}</div>}
                        </button>
                      )
                    })}
                    {classesFiltradas.length === 0 && (
                      <div className={`px-3 py-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nenhuma classe encontrada.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Valor *</label>
            <input type="number" min="0" step="0.01" value={form.valor} onChange={e => setField('valor', e.target.value)} className={inputCls} placeholder="0,00" />
          </div>

          <div className={`rounded-xl border p-4 space-y-3 ${isDark ? 'border-white/[0.08] bg-white/[0.03]' : 'border-slate-200 bg-slate-50/70'}`}>
            <div>
              <p className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Dados bancários</p>
              <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Preencha quando o pagamento extraordinário exigir dados de depósito, transferência ou PIX.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Favorecido</label>
                <input value={form.favorecido} onChange={e => setField('favorecido', e.target.value)} className={inputCls} placeholder="Nome do favorecido" />
              </div>
              <div>
                <label className={labelCls}>Banco</label>
                <input value={form.banco_nome} onChange={e => setField('banco_nome', e.target.value)} className={inputCls} placeholder="Nome do banco" />
              </div>
              <div>
                <label className={labelCls}>Agência</label>
                <input value={form.agencia} onChange={e => setField('agencia', e.target.value)} className={inputCls} placeholder="0001" />
              </div>
              <div>
                <label className={labelCls}>Conta</label>
                <input value={form.conta} onChange={e => setField('conta', e.target.value)} className={inputCls} placeholder="12345-6" />
              </div>
              <div>
                <label className={labelCls}>Tipo PIX</label>
                <select value={form.pix_tipo} onChange={e => setField('pix_tipo', e.target.value)} className={inputCls}>
                  <option value="">Selecione...</option>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="aleatoria">Chave aleatória</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Chave PIX</label>
                <input value={form.pix_chave} onChange={e => setField('pix_chave', e.target.value)} className={inputCls} placeholder="Informe a chave PIX" />
              </div>
            </div>
          </div>

          <div className={`rounded-xl border p-4 space-y-3 ${isDark ? 'border-white/[0.08] bg-white/[0.03]' : 'border-slate-200 bg-slate-50/70'}`}>
            <div>
              <p className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Anexos</p>
              <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Envie comprovantes, boletos, ordens de pagamento ou outros arquivos de suporte.</p>
            </div>
            <input
              type="file"
              multiple
              onChange={e => setArquivos(Array.from(e.target.files ?? []))}
              className={`block w-full text-xs ${isDark ? 'text-slate-300 file:bg-white/[0.08] file:text-slate-200' : 'text-slate-600 file:bg-white file:text-slate-700'} file:mr-3 file:rounded-xl file:border-0 file:px-3 file:py-2`}
            />
            {arquivos.length > 0 && (
              <div className="space-y-1">
                {arquivos.map(file => (
                  <div key={`${file.name}-${file.size}`} className={`rounded-lg px-3 py-2 text-[11px] ${isDark ? 'bg-white/[0.04] text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}>
                    {file.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {!canSubmit && (
            <p className={`text-[11px] ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
              Preencha descrição, justificativa, centro de custo, classe financeira e valor para liberar a criação.
            </p>
          )}
          {erro && (
            <p className={`text-[11px] ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>{erro}</p>
          )}
        </div>

        <div className={`px-6 py-4 flex justify-end gap-2 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
          <button onClick={onClose} className={`px-4 py-2 rounded-xl text-sm font-semibold ${isDark ? 'border border-white/[0.06] text-slate-400 hover:bg-white/5' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            Cancelar
          </button>
          <button onClick={handleCriar} disabled={criarSolicitacaoMut.isPending || !canSubmit} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm">
            {criarSolicitacaoMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Criar Solicitação
          </button>
        </div>
      </div>
    </div>
  )
}

function NovaPrevisaoPagamentoModal({
  isDark,
  onClose,
  onSuccess,
}: {
  isDark: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const { perfil } = useAuth()
  const centrosCusto = useLookupCentrosCusto()
  const classesFinanceiras = useLookupClassesFinanceiras()
  const criarPrevisaoMut = useCriarPrevisaoPagamentoCP()
  const [form, setForm] = useState<NovaPrevisaoPagamentoForm>(EMPTY_PREVISAO_FORM)
  const [erro, setErro] = useState('')
  const [ccBusca, setCcBusca] = useState('')
  const [classeBusca, setClasseBusca] = useState('')
  const [ccOpen, setCcOpen] = useState(false)
  const [classeOpen, setClasseOpen] = useState(false)

  const inputCls = `w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors ${
    isDark
      ? 'bg-white/[0.06] border border-white/[0.08] text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/50'
      : 'bg-slate-50 border border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-emerald-500'
  }`
  const labelCls = `block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`

  const setField = <K extends keyof NovaPrevisaoPagamentoForm>(field: K, value: NovaPrevisaoPagamentoForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const centrosFiltrados = centrosCusto
    .filter(cc => `${cc.codigo} ${cc.descricao}`.toLowerCase().includes(ccBusca.toLowerCase()))
    .slice(0, 8)

  const classesFiltradas = classesFinanceiras
    .filter(classe => `${classe.codigo} ${classe.descricao}`.toLowerCase().includes(classeBusca.toLowerCase()))
    .slice(0, 8)

  const getLookupValue = (codigo?: string | null, descricao?: string | null) =>
    codigo?.trim() || descricao?.trim() || ''

  const getLookupLabel = (codigo?: string | null, descricao?: string | null) => {
    const code = codigo?.trim() || ''
    const desc = descricao?.trim() || ''
    if (code && desc) return `${code} - ${desc}`
    return code || desc
  }

  const centroSelecionado = centrosCusto.find(cc => getLookupValue(cc.codigo, cc.descricao) === form.centro_custo)
  const classeSelecionada = classesFinanceiras.find(classe => getLookupValue(classe.codigo, classe.descricao) === form.classe_financeira)

  const canSubmit = form.nome.trim().length > 0
    && form.centro_custo.length > 0
    && form.classe_financeira.length > 0
    && Number(form.valor) > 0
    && form.dataVencimento.length > 0
    && (!form.recorrente || form.recorrenciaFim.length > 0)

  async function handleCriar() {
    if (!canSubmit) return
    if (form.recorrente && form.recorrenciaFim < form.dataVencimento) {
      setErro('A recorrência deve terminar na mesma data ou depois do primeiro vencimento.')
      return
    }
    setErro('')
    try {
      await criarPrevisaoMut.mutateAsync({
        nome: form.nome,
        valor: Number(form.valor),
        centro_custo: form.centro_custo,
        classe_financeira: form.classe_financeira,
        recorrente: form.recorrente,
        periodicidade: form.recorrente ? form.periodicidade : undefined,
        recorrenciaFim: form.recorrente ? form.recorrenciaFim : undefined,
        dataVencimento: form.dataVencimento,
        solicitanteNome: perfil?.nome,
      })
      onSuccess()
      onClose()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao criar previsão de pagamento')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-6 py-4 sticky top-0 z-10 ${isDark ? 'border-b border-white/[0.06] bg-[#1e293b]' : 'border-b border-slate-100 bg-white'}`}>
          <div>
            <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Nova Previsão de Pagamento</h2>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>A previsão será criada em Previstos para acompanhamento financeiro</p>
          </div>
          <button onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className={`rounded-xl border px-4 py-3 ${isDark ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50'}`}>
            <p className={`text-xs font-bold ${isDark ? 'text-emerald-200' : 'text-emerald-700'}`}>Planejamento</p>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Use esta tela para antecipar despesas esperadas e montar o pipeline financeiro com antecedência.</p>
          </div>

          <div>
            <label className={labelCls}>Nome *</label>
            <input value={form.nome} onChange={e => setField('nome', e.target.value)} className={inputCls} placeholder="Ex.: Aluguel, licença, consultoria, condomínio" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Valor *</label>
              <input type="number" min="0" step="0.01" value={form.valor} onChange={e => setField('valor', e.target.value)} className={inputCls} placeholder="0,00" />
            </div>
            <div>
              <label className={labelCls}>Primeiro vencimento *</label>
              <input type="date" value={form.dataVencimento} onChange={e => setField('dataVencimento', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <label className={labelCls}>Centro de Custo *</label>
              <button
                type="button"
                onClick={() => {
                  setCcOpen(prev => !prev)
                  setClasseOpen(false)
                }}
                className={`${inputCls} flex items-center justify-between text-left ${ccOpen ? (isDark ? 'ring-1 ring-emerald-500/40' : 'ring-1 ring-emerald-500/30') : ''}`}
              >
                <span className={form.centro_custo ? '' : isDark ? 'text-slate-500' : 'text-slate-400'}>
                  {centroSelecionado ? getLookupLabel(centroSelecionado.codigo, centroSelecionado.descricao) : form.centro_custo || 'Selecione...'}
                </span>
                <ChevronDown size={16} className={`transition-transform ${ccOpen ? 'rotate-180' : ''} ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              </button>
              {ccOpen && (
                <div className={`absolute z-30 mt-2 w-full rounded-2xl border shadow-xl overflow-hidden ${isDark ? 'border-white/[0.08] bg-slate-950' : 'border-slate-200 bg-white'}`}>
                  <div className="p-2 border-b border-inherit">
                    <input value={ccBusca} onChange={e => setCcBusca(e.target.value)} className={inputCls} placeholder="Buscar centro de custo..." autoFocus />
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {centrosFiltrados.map(cc => {
                      const value = getLookupValue(cc.codigo, cc.descricao)
                      const label = getLookupLabel(cc.codigo, cc.descricao)
                      return (
                        <button
                          key={cc.id}
                          type="button"
                          onClick={() => {
                            setField('centro_custo', value)
                            setCcBusca(label)
                            setCcOpen(false)
                          }}
                          className={`w-full px-3 py-2 text-left text-sm transition-colors ${isDark ? 'text-slate-200 hover:bg-white/[0.06]' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                          <div className="font-medium">{cc.codigo || cc.descricao}</div>
                          {!!cc.codigo && <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{cc.descricao}</div>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <label className={labelCls}>Classe Financeira *</label>
              <button
                type="button"
                onClick={() => {
                  setClasseOpen(prev => !prev)
                  setCcOpen(false)
                }}
                className={`${inputCls} flex items-center justify-between text-left ${classeOpen ? (isDark ? 'ring-1 ring-emerald-500/40' : 'ring-1 ring-emerald-500/30') : ''}`}
              >
                <span className={form.classe_financeira ? '' : isDark ? 'text-slate-500' : 'text-slate-400'}>
                  {classeSelecionada ? getLookupLabel(classeSelecionada.codigo, classeSelecionada.descricao) : form.classe_financeira || 'Selecione...'}
                </span>
                <ChevronDown size={16} className={`transition-transform ${classeOpen ? 'rotate-180' : ''} ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              </button>
              {classeOpen && (
                <div className={`absolute z-30 mt-2 w-full rounded-2xl border shadow-xl overflow-hidden ${isDark ? 'border-white/[0.08] bg-slate-950' : 'border-slate-200 bg-white'}`}>
                  <div className="p-2 border-b border-inherit">
                    <input value={classeBusca} onChange={e => setClasseBusca(e.target.value)} className={inputCls} placeholder="Buscar classe financeira..." autoFocus />
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {classesFiltradas.map(classe => {
                      const value = getLookupValue(classe.codigo, classe.descricao)
                      const label = getLookupLabel(classe.codigo, classe.descricao)
                      return (
                        <button
                          key={classe.id}
                          type="button"
                          onClick={() => {
                            setField('classe_financeira', value)
                            setClasseBusca(label)
                            setClasseOpen(false)
                          }}
                          className={`w-full px-3 py-2 text-left text-sm transition-colors ${isDark ? 'text-slate-200 hover:bg-white/[0.06]' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                          <div className="font-medium">{classe.codigo || classe.descricao}</div>
                          {!!classe.codigo && <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{classe.descricao}</div>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={`rounded-xl border p-4 space-y-3 ${isDark ? 'border-white/[0.08] bg-white/[0.03]' : 'border-slate-200 bg-slate-50/70'}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Recorrência</p>
                <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Defina se essa previsão se repete ao longo do período.</p>
              </div>
              <button
                type="button"
                onClick={() => setField('recorrente', !form.recorrente)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  form.recorrente ? 'bg-emerald-500' : isDark ? 'bg-white/[0.12]' : 'bg-slate-200'
                }`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${form.recorrente ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {form.recorrente && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Periodicidade</label>
                  <select value={form.periodicidade} onChange={e => setField('periodicidade', e.target.value as NovaPrevisaoPagamentoForm['periodicidade'])} className={inputCls}>
                    <option value="semanal">Semanal</option>
                    <option value="quinzenal">Quinzenal</option>
                    <option value="mensal">Mensal</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Até quando termina *</label>
                  <input type="date" value={form.recorrenciaFim} onChange={e => setField('recorrenciaFim', e.target.value)} className={inputCls} />
                </div>
              </div>
            )}
          </div>

          {erro && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${isDark ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {erro}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isDark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-slate-600 hover:bg-slate-100'}`}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canSubmit || criarPrevisaoMut.isPending}
              onClick={handleCriar}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold transition-all hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {criarPrevisaoMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Criar previsão
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CPDetailModal({ cp, stageStatus, onClose, onAction, isDark }: {
  cp: ContaPagar
  stageStatus: PipelineStageId
  onClose: () => void
  onAction: (action: string, cp: ContaPagar) => void
  isDark: boolean
}) {
  const nav = useNavigate()
  const { perfil, canApprove } = useAuth()
  const decisaoGenericaMut = useDecisaoGenerica()
  const aprovarPagamentoMut = useAprovarPagamento()
  const urgency = getUrgency(cp)
  const manualRequest = cp.remessa_payload && typeof cp.remessa_payload === 'object'
    ? (cp.remessa_payload as Record<string, any>).manual_request as Record<string, any> | undefined
    : undefined
  const manualAttachments = Array.isArray(manualRequest?.anexos) ? manualRequest?.anexos as Array<{ nome: string; url: string }> : []
  const bankInfo = manualRequest?.dados_bancarios as Record<string, string | undefined> | undefined
  const [approval, setApproval] = useState<null | {
    id: string
    entidade_id: string
    entidade_numero?: string
    modulo: string
    nivel: number
  }>(null)
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [approvalExpanded, setApprovalExpanded] = useState(false)
  const [approvalNote, setApprovalNote] = useState('')
  const approvalLoteId = approval && cp.lote_id && approval.entidade_id === cp.lote_id ? approval.entidade_id : undefined
  const { data: approvalLote } = useLoteById(approvalLoteId)
  const approvalItems = useMemo(
    () => (approvalLote?.itens ?? []).filter(item => item.decisao !== 'rejeitado'),
    [approvalLote]
  )
  const [selectedApprovalItemIds, setSelectedApprovalItemIds] = useState<string[]>([])

  useEffect(() => {
    let active = true
    if (stageStatus !== 'em_aprovacao') {
      setApproval(null)
      return
    }

    setApprovalLoading(true)
    supabase
      .from('apr_aprovacoes')
      .select('id, entidade_id, entidade_numero, modulo, nivel')
      .in('entidade_id', cp.lote_id ? [cp.lote_id, cp.id] : [cp.id])
      .eq('tipo_aprovacao', 'autorizacao_pagamento')
      .eq('status', 'pendente')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (!active) return
        const pending = data ?? []
        const loteApproval = cp.lote_id ? pending.find(item => item.entidade_id === cp.lote_id) : null
        const unitApproval = pending.find(item => item.entidade_id === cp.id)
        setApproval(loteApproval ?? unitApproval ?? null)
      })
      .finally(() => {
        if (active) setApprovalLoading(false)
      })

    return () => {
      active = false
    }
  }, [cp.id, cp.lote_id, stageStatus])

  useEffect(() => {
    setSelectedApprovalItemIds(approvalItems.map(item => item.cp_id))
  }, [approval?.id, approvalItems])

  const isApprovalStage = stageStatus === 'em_aprovacao'
  const canDirectApproveCurrent = isApprovalStage && perfil?.role === 'admin' && !approval
  const canApproveCurrent = isApprovalStage && (perfil?.role === 'admin' || (!!approval && canApprove(approval.nivel)) || canDirectApproveCurrent)
  const stage = CP_PIPELINE_VIEW_STAGES.find(s => s.status === stageStatus)
  const isLoteApproval = !!approvalLoteId && approvalItems.length > 0
  const canUploadPedidoAnexo = !!cp.pedido_id && (stageStatus === 'previsto' || stageStatus === 'confirmado')

  const toggleApprovalItem = (cpId: string) => {
    setSelectedApprovalItemIds(prev =>
      prev.includes(cpId) ? prev.filter(id => id !== cpId) : [...prev, cpId]
    )
  }

  const handleApprovalDecision = async (decisao: 'aprovada' | 'rejeitada' | 'esclarecimento') => {
    if (!perfil) return
    if (!approval && !canDirectApproveCurrent) return
    if (decisao === 'esclarecimento' && !approvalNote.trim()) {
      setApprovalExpanded(true)
      return
    }
    if (decisao === 'aprovada' && isLoteApproval && selectedApprovalItemIds.length === 0) {
      return
    }

    try {
      if (!approval && canDirectApproveCurrent) {
        if (decisao !== 'aprovada') return
        await aprovarPagamentoMut.mutateAsync({
          cpId: cp.id,
          aprovadorNome: perfil.nome,
        })
        onClose()
        return
      }

      await decisaoGenericaMut.mutateAsync({
        aprovacaoId: approval.id,
        entidadeId: approval.entidade_id,
        entidadeNumero: approval.entidade_numero,
        tipoAprovacao: 'autorizacao_pagamento',
        modulo: approval.modulo,
        nivel: approval.nivel,
        decisao,
        observacao: approvalNote.trim() || undefined,
        aprovadorNome: perfil.nome,
        aprovadorEmail: perfil.email || '',
        selectedItemIds: decisao === 'aprovada' && isLoteApproval ? selectedApprovalItemIds : undefined,
      })
      onClose()
    } catch {
      // handled by mutation state
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <Receipt size={18} className="text-emerald-600 shrink-0" />
            <h3 className={`text-base font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{cp.fornecedor_nome}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className={`text-2xl font-extrabold ${urgency === 'overdue' ? 'text-red-600' : 'text-emerald-600'}`}>
              {fmtFull(cp.valor_original)}
            </p>
            <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold px-3 py-1 text-xs ${STATUS_ACCENT[stageStatus]?.bgActive || 'bg-slate-100'} ${STATUS_ACCENT[stageStatus]?.textActive || 'text-slate-700'}`}>
              <span className={`w-2 h-2 rounded-full ${STATUS_ACCENT[stageStatus]?.dot}`} />
              {stage?.label ?? cp.status}
            </span>
          </div>

          {/* Origem badge */}
          {cp.origem === 'logistica' && (
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2">
              <Truck size={14} className="text-purple-500 shrink-0" />
              <p className="text-xs text-purple-700 font-semibold">Origem: Log\u00EDstica</p>
            </div>
          )}
          {cp.origem === 'compras' && (
            <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
              <Package size={14} className="text-sky-500 shrink-0" />
              <p className="text-xs text-sky-700 font-semibold">Origem: Compras</p>
            </div>
          )}
          {cp.origem === 'manual' && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              <Receipt size={14} className="text-emerald-500 shrink-0" />
              <p className="text-xs text-emerald-700 font-semibold">Origem: Solicitação Financeira</p>
            </div>
          )}
          {isUrgentExtraordinary(cp) && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="text-rose-500 shrink-0" />
              <p className="text-xs text-rose-700 font-semibold">Pagamento extraordinário urgente</p>
            </div>
          )}

          {urgency === 'overdue' && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-700 font-semibold">Vencido em {fmtData(cp.data_vencimento)}</p>
            </div>
          )}

          {/* Alerta de diverg\u00EAncia */}
          {cp.observacoes && cp.observacoes.includes('Diverg\u00EAncia') && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 font-semibold">{cp.observacoes}</p>
            </div>
          )}

          <div className={`rounded-xl p-4 space-y-2 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><span className="text-slate-400">Vencimento:</span> <span className="font-semibold">{fmtData(cp.data_vencimento)}</span></div>
              <div><span className="text-slate-400">Emiss\u00E3o:</span> <span className="font-semibold">{fmtData(cp.data_emissao)}</span></div>
              {cp.numero_documento && <div><span className="text-slate-400">Documento:</span> <span className="font-mono">{cp.numero_documento}</span></div>}
              {cp.natureza && <div><span className="text-slate-400">Natureza:</span> <span>{cp.natureza}</span></div>}
              {cp.forma_pagamento && <div><span className="text-slate-400">Forma Pgto:</span> <span>{cp.forma_pagamento}</span></div>}
              {cp.centro_custo && <div><span className="text-slate-400">Centro Custo:</span> <span className="font-semibold">{cp.centro_custo}</span></div>}
              {cp.classe_financeira && <div><span className="text-slate-400">Classe Fin:</span> <span className="text-violet-600 font-semibold">{cp.classe_financeira}</span></div>}
              {cp.requisicao?.obra_nome && <div><span className="text-slate-400">Obra:</span> <span className="font-semibold">{cp.requisicao.obra_nome}</span></div>}
              {cp.pedido?.numero_pedido && (
                <div>
                  <span className="text-slate-400">Pedido:</span>{' '}
                  <button onClick={() => nav(`/pedidos?pedido=${cp.pedido_id}`)} className="font-semibold text-teal-700 underline hover:text-teal-800">{cp.pedido.numero_pedido}</button>
                </div>
              )}
              {cp.requisicao?.numero && <div><span className="text-slate-400">RC:</span> <span className="font-semibold text-indigo-600">{cp.requisicao.numero}</span></div>}
              {cp.data_pagamento && <div><span className="text-slate-400">Pago em:</span> <span className="text-emerald-600 font-semibold">{fmtData(cp.data_pagamento)}</span></div>}
              {cp.aprovado_por && <div><span className="text-slate-400">Aprovado por:</span> <span className="font-semibold">{cp.aprovado_por}</span></div>}
              {cp.remessa_id && <div><span className="text-slate-400">Remessa:</span> <span className="font-mono text-sky-600">{cp.remessa_id}</span></div>}
              {cp.remessa_enviada_em && <div><span className="text-slate-400">Enviada em:</span> <span>{fmtDateTime(cp.remessa_enviada_em)}</span></div>}
            </div>
            {cp.descricao && <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">{cp.descricao}</p>}
            {cp.observacoes && !cp.observacoes.includes('Diverg\u00EAncia') && (
              <p className="text-xs text-slate-400 mt-1 italic">{cp.observacoes}</p>
            )}
            {cp.remessa_erro && (
              <p className="text-xs text-red-500 mt-1">{cp.remessa_erro}</p>
            )}
            {/* Descrição da requisição de compra */}
            {cp.requisicao?.justificativa && (
              <div className={`mt-3 pt-3 border-t rounded-xl px-3.5 py-2.5 ${isDark ? 'border-white/10 bg-teal-500/10' : 'border-slate-200 bg-teal-50'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>Descrição da RC</p>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-teal-200' : 'text-teal-800'}`}>{cp.requisicao.justificativa}</p>
              </div>
            )}
          </div>

          {cp.fornecedor_id && <FornecedorBankInfo fornecedorId={cp.fornecedor_id} isDark={isDark} />}

          {bankInfo && Object.values(bankInfo).some(Boolean) && (
            <div className={`rounded-xl p-3 space-y-2 ${isDark ? 'bg-white/[0.04]' : 'bg-emerald-50/70'}`}>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                <Banknote size={10} /> Dados bancários informados
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {bankInfo.favorecido && <div><span className="text-slate-400">Favorecido:</span> <span className="font-semibold">{bankInfo.favorecido}</span></div>}
                {bankInfo.banco_nome && <div><span className="text-slate-400">Banco:</span> <span className="font-semibold">{bankInfo.banco_nome}</span></div>}
                {bankInfo.agencia && <div><span className="text-slate-400">Agência:</span> <span className="font-semibold">{bankInfo.agencia}</span></div>}
                {bankInfo.conta && <div><span className="text-slate-400">Conta:</span> <span className="font-semibold">{bankInfo.conta}</span></div>}
                {bankInfo.pix_tipo && <div><span className="text-slate-400">Tipo PIX:</span> <span className="font-semibold capitalize">{bankInfo.pix_tipo}</span></div>}
                {bankInfo.pix_chave && <div className="col-span-2"><span className="text-slate-400">Chave PIX:</span> <span className="font-semibold">{bankInfo.pix_chave}</span></div>}
              </div>
            </div>
          )}

          {cp.pedido_id && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Paperclip size={10} /> Anexos</p>
              <AnexosList pedidoId={cp.pedido_id} isDark={isDark} canUpload={canUploadPedidoAnexo} />
            </div>
          )}
          {!cp.pedido_id && manualAttachments.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Paperclip size={10} /> Anexos</p>
              <div className="space-y-1">
                {manualAttachments.map(arquivo => (
                  <a
                    key={`${arquivo.nome}-${arquivo.url}`}
                    href={arquivo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 hover:border-slate-300 text-[10px] group"
                  >
                    <Paperclip size={9} className="text-slate-400 shrink-0" />
                    <span className="truncate text-slate-600 font-medium">{arquivo.nome}</span>
                    <ExternalLink size={8} className="text-slate-300 group-hover:text-slate-500 shrink-0 ml-auto" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Pipeline progress */}
          <div className={`rounded-xl p-3 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Progresso</p>
            <div className="flex items-center gap-0.5">
              {CP_PIPELINE_STAGES.map((s, i) => {
                const currentIdx = CP_PIPELINE_STAGES.findIndex(st => st.status === (stageStatus === 'em_aprovacao' ? 'em_lote' : stageStatus))
                const isPast = i <= currentIdx
                const accent = STATUS_ACCENT[s.status]
                return (
                  <div key={s.status} className="flex-1">
                    <div className={`h-1.5 rounded-full transition-all ${isPast ? accent?.dot || 'bg-slate-400' : isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`} />
                  </div>
                )
              })}
            </div>
          </div>

          {isApprovalStage && (
            <div className={`rounded-xl border ${isDark ? 'border-white/[0.08] bg-white/[0.03]' : 'border-amber-200 bg-amber-50/70'}`}>
              <div className="px-4 py-3 border-b border-inherit">
                <p className={`text-xs font-bold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>Aprovação de Pagamento</p>
                <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {approvalLoading
                    ? 'Carregando aprovação pendente...'
                    : canApproveCurrent
                      ? 'Você tem alçada para decidir esta aprovação.'
                      : 'Aguardando aprovação'}
                </p>
              </div>

              {canApproveCurrent ? (
                <>
                  <div className="p-4">
                    {isLoteApproval && (
                      <div className={`rounded-xl border mb-4 overflow-hidden ${isDark ? 'border-white/[0.08] bg-slate-950/30' : 'border-slate-200 bg-white'}`}>
                        <div className={`grid grid-cols-[28px_minmax(0,1.8fr)_110px_90px_110px_100px] gap-x-3 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500 border-b border-white/[0.08]' : 'text-slate-400 border-b border-slate-200 bg-slate-50'}`}>
                          <span />
                          <span>Item</span>
                          <span>Documento</span>
                          <span>Venc.</span>
                          <span className="text-right">Valor</span>
                          <span>Decisao</span>
                        </div>
                        <div className="divide-y divide-inherit">
                          {approvalItems.map(item => (
                            <div key={item.id} className={`grid grid-cols-[28px_minmax(0,1.8fr)_110px_90px_110px_100px] gap-x-3 px-3 py-2.5 text-xs items-center ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50/70'}`}>
                              <label className="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                  checked={selectedApprovalItemIds.includes(item.cp_id)}
                                  onChange={() => toggleApprovalItem(item.cp_id)}
                                />
                              </label>
                              <div className="min-w-0">
                                <p className={`truncate font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.cp?.fornecedor_nome || 'Item sem fornecedor'}</p>
                                <p className={`truncate text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.cp?.descricao || 'â€”'}</p>
                              </div>
                              <span className={`truncate text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.cp?.numero_documento || 'â€”'}</span>
                              <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.cp ? fmtData(item.cp.data_vencimento) : 'â€”'}</span>
                              <span className="text-right text-[11px] font-semibold text-emerald-600">{item.cp ? fmt(item.cp.valor_original) : 'â€”'}</span>
                              <span className={`inline-flex h-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                selectedApprovalItemIds.includes(item.cp_id)
                                  ? isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                                  : isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'
                              }`}>
                                {selectedApprovalItemIds.includes(item.cp_id) ? 'Aprovar' : 'Retornar'}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className={`px-3 py-2 text-[11px] ${isDark ? 'border-t border-white/[0.08] text-slate-300' : 'border-t border-slate-200 text-slate-600 bg-slate-50/70'}`}>
                          {selectedApprovalItemIds.length === approvalItems.length
                            ? `Todos os ${approvalItems.length} itens serao aprovados neste lote.`
                            : `${selectedApprovalItemIds.length} de ${approvalItems.length} itens serao aprovados. Os demais retornarao para Lote de Pagamento.`}
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setApprovalExpanded(v => !v)}
                      className={`text-[11px] font-semibold ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}
                    >
                      {approvalExpanded ? 'Ocultar observação' : 'Adicionar observação'}
                    </button>
                    {approvalExpanded && (
                      <textarea
                        rows={3}
                        className={`w-full mt-3 rounded-xl border px-3 py-2 text-sm outline-none ${isDark ? 'border-white/[0.08] bg-slate-950/40 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                        placeholder="Descreva o esclarecimento ou justifique sua decisão..."
                        value={approvalNote}
                        onChange={e => setApprovalNote(e.target.value)}
                      />
                    )}
                  </div>
                  <div className={`grid grid-cols-3 border-t ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
                    <button
                      type="button"
                      disabled={decisaoGenericaMut.isPending}
                      onClick={() => handleApprovalDecision('rejeitada')}
                      className="flex items-center justify-center gap-1.5 py-3.5 text-xs font-bold text-red-500 hover:bg-red-50 transition disabled:opacity-50"
                    >
                      <XCircle size={16} />
                      Rejeitar
                    </button>
                    <button
                      type="button"
                      disabled={decisaoGenericaMut.isPending}
                      onClick={() => handleApprovalDecision('esclarecimento')}
                      className="flex items-center justify-center gap-1.5 py-3.5 text-xs font-bold text-indigo-500 hover:bg-indigo-50 transition border-x border-inherit disabled:opacity-50"
                    >
                      <MessageSquare size={16} />
                      Esclarecer
                    </button>
                    <button
                      type="button"
                      disabled={decisaoGenericaMut.isPending || (isLoteApproval && selectedApprovalItemIds.length === 0)}
                      onClick={() => handleApprovalDecision('aprovada')}
                      className="flex items-center justify-center gap-1.5 py-3.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition disabled:opacity-50"
                    >
                      <CheckCircle2 size={16} />
                      Aprovar
                    </button>
                  </div>
                </>
              ) : (
                <div className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${isDark ? 'bg-white/[0.06] text-slate-200' : 'bg-white text-amber-700 border border-amber-200'}`}>
                    Aguardando aprovação
                  </span>
                </div>
              )}

              {decisaoGenericaMut.isError && (
                <p className="px-4 py-2 text-xs text-red-500 border-t border-red-200">
                  Erro ao processar aprovação. Tente novamente.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${isDark ? 'border-white/[0.06] text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              Fechar
            </button>
            {cp.status === 'previsto' && (
              <>
                <button onClick={() => onAction('excluir', cp)} className="flex-1 py-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-sm font-bold hover:bg-rose-100 transition-all flex items-center justify-center gap-2">
                  <XCircle size={15} /> Excluir
                </button>
                <button onClick={() => onAction('confirmar', cp)} className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                  <CheckCircle2 size={15} /> Confirmar
                </button>
              </>
            )}
            {cp.status === 'confirmado' && (
              <button onClick={() => onAction('addLote', cp)} className="flex-1 py-3 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-all flex items-center justify-center gap-2">
                <Layers size={15} /> Adicionar ao Lote
              </button>
            )}
            {cp.status === 'em_lote' && !isApprovalStage && (
              <button onClick={() => onAction('sendLote', cp)} className="flex-1 py-3 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-all flex items-center justify-center gap-2">
                <Send size={15} /> Enviar p/ Aprovação
              </button>
            )}
            {cp.status === 'aprovado_pgto' && (
              <>
                <button onClick={() => onAction('enviarRemessa', cp)} className="flex-1 py-3 rounded-xl bg-sky-600 text-white text-sm font-bold hover:bg-sky-700 transition-all flex items-center justify-center gap-2">
                  <Send size={15} /> Enviar Remessa
                </button>
                <button onClick={() => onAction('pagar', cp)} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                  <Banknote size={15} /> Registrar Pgto
                </button>
              </>
            )}
            {cp.status === 'em_pagamento' && (
              <>
                {cp.omie_cp_id ? (
                  <>
                    <button
                      onClick={() => window.open('https://app.omie.com.br', '_blank')}
                      className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={15} /> Pagar no Omie
                    </button>
                    <button onClick={() => onAction('sincronizar', cp)} className="flex-1 py-3 rounded-xl bg-sky-600 text-white text-sm font-bold hover:bg-sky-700 transition-all flex items-center justify-center gap-2">
                      <RefreshCw size={15} /> Sincronizar
                    </button>
                  </>
                ) : (
                  <button onClick={() => onAction('pagar', cp)} className="flex-1 py-3 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-all flex items-center justify-center gap-2">
                    <Banknote size={15} /> Registrar Pgto
                  </button>
                )}
              </>
            )}
            {cp.status === 'pago' && (
              <button onClick={() => onAction('conciliar', cp)} className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                <CheckCircle2 size={15} /> Conciliar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ══ CPRow (compact table row) ═══════════════════════════════════

function CPRow({ cp, onClick, isDark, isSelected, onSelect, approvalHint }: {
  cp: ContaPagar
  onClick: () => void
  isDark: boolean
  isSelected: boolean
  onSelect: (id: string) => void
  approvalHint?: StatusHint | null
}) {
  const urgency = getUrgency(cp)
  const isUrgentRequest = isUrgentExtraordinary(cp)
  const obraNome = cp.requisicao?.obra_nome
  const pedidoNum = cp.pedido?.numero_pedido

  return (
    <div
      onClick={onClick}
      className={`${CP_TABLE_GRID} px-3 py-2 border-b cursor-pointer transition-all ${
        isDark
          ? `border-white/[0.04] hover:bg-white/[0.03] ${isSelected ? 'bg-emerald-500/10' : ''}`
          : `border-slate-100 hover:bg-slate-50 ${isSelected ? 'bg-emerald-50' : ''}`
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => { e.stopPropagation(); onSelect(cp.id) }}
        onClick={e => e.stopPropagation()}
        className="w-3 h-3 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
      />

      <div className={`w-0.5 h-4 rounded-full shrink-0 ${
        urgency === 'overdue' ? 'bg-red-500' : urgency === 'today' ? 'bg-amber-500' : urgency === 'week' ? 'bg-yellow-400' : 'bg-transparent'
      }`} />

      <div className="min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {cp.fornecedor_nome}
          </span>
          {cp.origem === 'logistica' && (
            <span className="inline-flex items-center gap-0.5 bg-purple-50 text-purple-600 text-[9px] font-semibold rounded-full px-1.5 py-0.5 shrink-0">
              <Truck size={8} /> Log
            </span>
          )}
      {cp.origem === 'compras' && pedidoNum && (
        <span className="inline-flex items-center gap-0.5 bg-sky-50 text-sky-600 text-[9px] font-semibold rounded-full px-1.5 py-0.5 shrink-0">
          <Package size={8} /> Cmp
        </span>
      )}
      {isUrgentRequest && (
        <span className="inline-flex items-center gap-0.5 bg-rose-50 text-rose-600 text-[9px] font-semibold rounded-full px-1.5 py-0.5 shrink-0">
          <AlertTriangle size={8} /> Urg
        </span>
      )}
        </div>
      </div>

      <div className="min-w-0">
        <span className={`block truncate text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {cp.descricao || '\u2014'}
        </span>
        {approvalHint && (
          <span className={`block truncate text-[10px] font-medium ${
            approvalHint.tone === 'rose'
              ? isDark ? 'text-rose-300' : 'text-rose-700'
              : approvalHint.tone === 'sky'
                ? isDark ? 'text-sky-300' : 'text-sky-700'
                : isDark ? 'text-amber-300' : 'text-amber-700'
          }`}>
            {approvalHint.text}
          </span>
        )}
      </div>

      <span className={`text-[11px] truncate min-w-0 flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {obraNome ? <><Building2 size={9} className="shrink-0" /> {obraNome}</> : '\u2014'}
      </span>

      <span className={`text-[11px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {cp.centro_custo || '\u2014'}
      </span>

      {pedidoNum ? (
        <span className="text-[10px] font-semibold text-teal-600 truncate flex items-center gap-0.5">
          <FileText size={9} className="shrink-0" /> {pedidoNum}
        </span>
      ) : (
        <span className="truncate text-[10px] text-slate-300">\u2014</span>
      )}

      <span className={`text-[11px] text-right ${
        urgency === 'overdue' ? 'text-red-500 font-bold' : urgency === 'today' ? 'text-amber-600 font-semibold' : isDark ? 'text-slate-500' : 'text-slate-400'
      }`}>
        {fmtData(cp.data_vencimento)}
      </span>

      <span className={`text-xs font-bold text-right ${
        urgency === 'overdue' ? 'text-red-600' : 'text-emerald-600'
      }`}>
        {fmt(cp.valor_original)}
      </span>
    </div>
  )
}

// ══ CPCard (block/card view) ════════════════════════════════════

function CPCard({ cp, onClick, isDark, isSelected, onSelect, approvalHint }: {
  cp: ContaPagar
  onClick: () => void
  isDark: boolean
  isSelected: boolean
  onSelect: (id: string) => void
  approvalHint?: StatusHint | null
}) {
  const urgency = getUrgency(cp)
  const isUrgentRequest = isUrgentExtraordinary(cp)
  const obraNome = cp.requisicao?.obra_nome
  const pedidoNum = cp.pedido?.numero_pedido

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border p-4 cursor-pointer transition-all group ${
        isDark
          ? `border-white/[0.06] hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 ${isSelected ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.02]'}`
          : `border-slate-200 hover:border-teal-300 hover:shadow-md ${isSelected ? 'bg-emerald-50 border-emerald-300' : 'bg-white'}`
      }`}
    >
      {/* Linha 1: checkbox + fornecedor + urgency + valor */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => { e.stopPropagation(); onSelect(cp.id) }}
          onClick={e => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
        />
        <div className={`w-1 h-6 rounded-full shrink-0 ${
          urgency === 'overdue' ? 'bg-red-500' : urgency === 'today' ? 'bg-amber-500' : urgency === 'week' ? 'bg-yellow-400' : 'bg-transparent'
        }`} />
        <p className={`text-sm font-bold truncate flex-1 min-w-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          {cp.fornecedor_nome}
        </p>
        {urgency === 'overdue' && (
          <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full shrink-0">VENCIDO</span>
        )}
        {isUrgentRequest && (
          <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-full shrink-0">URGENTE</span>
        )}
        <p className={`text-sm font-extrabold shrink-0 ${urgency === 'overdue' ? 'text-red-600' : 'text-emerald-600'}`}>
          {fmt(cp.valor_original)}
        </p>
      </div>

      {/* Linha 2: origem badges */}
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5 ml-10">
        {cp.origem === 'logistica' && (
          <span className="inline-flex items-center gap-0.5 bg-purple-50 text-purple-600 text-[10px] font-semibold rounded-full px-2 py-0.5">
            <Truck size={9} /> Log\u00EDstica
          </span>
        )}
        {cp.origem === 'compras' && pedidoNum && (
          <span className="inline-flex items-center gap-0.5 bg-sky-50 text-sky-600 text-[10px] font-semibold rounded-full px-2 py-0.5">
            <Package size={9} /> Compras
          </span>
        )}
        {cp.origem === 'manual' && (
          <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-semibold rounded-full px-2 py-0.5">
            <Receipt size={9} /> Financeiro
          </span>
        )}
      </div>

      {/* Linha 3: descrição */}
      {cp.descricao && (
        <p className={`text-xs truncate mt-1 ml-10 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{cp.descricao}</p>
      )}
      {approvalHint && (
        <div className={`mt-1 ml-10 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          approvalHint.tone === 'rose'
            ? isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700'
            : approvalHint.tone === 'sky'
              ? isDark ? 'bg-sky-500/10 text-sky-300' : 'bg-sky-50 text-sky-700'
              : isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'
        }`}>
          {approvalHint.text}
        </div>
      )}

      {/* Observações / Alerta de divergência */}
      {cp.observacoes && (
        <div className={`flex items-start gap-1.5 mt-1.5 ml-10 px-2 py-1 rounded-lg text-[10px] ${
          cp.observacoes.includes('Diverg\u00EAncia')
            ? 'bg-amber-50 border border-amber-200 text-amber-700'
            : isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-50 text-slate-500'
        }`}>
          {cp.observacoes.includes('Diverg\u00EAncia') && <AlertTriangle size={11} className="text-amber-500 shrink-0 mt-0.5" />}
          <span className="font-medium">{cp.observacoes}</span>
        </div>
      )}

      {/* Linha 4: tags + data */}
      <div className="flex items-center justify-between mt-2 ml-10">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {obraNome && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <Building2 size={9} /> {obraNome}
            </span>
          )}
          {cp.centro_custo && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <Briefcase size={9} /> {cp.centro_custo}
            </span>
          )}
          {pedidoNum && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 font-semibold shrink-0 ${isDark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-700'}`}>
              <FileText size={9} /> {pedidoNum}
            </span>
          )}
          {cp.numero_documento && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
              <Hash size={9} /> {cp.numero_documento}
            </span>
          )}
        </div>
        <span className={`text-[11px] flex items-center gap-1 shrink-0 ml-3 ${
          urgency === 'overdue' ? 'text-red-500 font-bold' : urgency === 'today' ? 'text-amber-600 font-semibold' : isDark ? 'text-slate-500' : 'text-slate-400'
        }`}>
          <Calendar size={10} /> {fmtData(cp.data_vencimento)}
        </span>
      </div>
    </div>
  )
}

function LoteItemsPanel({
  loteId,
  isDark,
  onOpenCP,
}: {
  loteId: string
  isDark: boolean
  onOpenCP: (cp: ContaPagar) => void
}) {
  const { data, isLoading } = useLoteById(loteId)

  if (isLoading) {
    return (
      <div className={`rounded-2xl border px-4 py-4 text-sm ${isDark ? 'border-white/[0.08] bg-white/[0.03] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
        Carregando itens do lote...
      </div>
    )
  }

  const itens = data?.itens ?? []
  const approvedCount = itens.filter(item => item.decisao === 'aprovado').length
  const rejectedCount = itens.filter(item => item.decisao === 'rejeitado').length

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/[0.08] bg-white/[0.03]' : 'border-slate-200 bg-slate-50/80'}`}>
      <div className={`grid grid-cols-[minmax(0,1.8fr)_110px_90px_110px_120px] gap-x-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500 border-b border-white/[0.08]' : 'text-slate-400 border-b border-slate-200'}`}>
        <span>Item</span>
        <span>Documento</span>
        <span>Venc.</span>
        <span className="text-right">Valor</span>
        <span>Decisão</span>
      </div>
      <div className="divide-y divide-inherit">
        {itens.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => item.cp && onOpenCP(item.cp)}
            className={`grid w-full grid-cols-[minmax(0,1.8fr)_110px_90px_110px_120px] gap-x-3 px-4 py-2.5 text-left transition-all ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-white'}`}
          >
            <div className="min-w-0">
              <p className={`truncate text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.cp?.fornecedor_nome || 'Item sem fornecedor'}</p>
              <p className={`truncate text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.cp?.descricao || '\u2014'}</p>
            </div>
            <span className={`truncate text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.cp?.numero_documento || '\u2014'}</span>
            <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.cp ? fmtData(item.cp.data_vencimento) : '\u2014'}</span>
            <span className="text-right text-[11px] font-semibold text-emerald-600">{item.cp ? fmt(item.cp.valor_original) : '\u2014'}</span>
            <span className={`inline-flex h-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              item.decisao === 'aprovado'
                ? isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                : item.decisao === 'rejeitado'
                  ? isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700'
                  : isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-white text-slate-600 border border-slate-200'
            }`}>
              {item.decisao === 'aprovado' ? 'Aprovado' : item.decisao === 'rejeitado' ? 'Rejeitado' : 'Pendente'}
            </span>
          </button>
        ))}
      </div>
      <div className={`flex flex-wrap items-center gap-2 px-4 py-3 text-[11px] ${isDark ? 'border-t border-white/[0.08] text-slate-400' : 'border-t border-slate-200 text-slate-500'}`}>
        <span>{itens.length} itens</span>
        <span>{approvedCount} aprovados</span>
        <span>{rejectedCount} excluídos</span>
      </div>
    </div>
  )
}

function LoteTableRow({
  summary,
  isDark,
  isSelected,
  expanded,
  onSelectMany,
  onToggleExpand,
  onOpenCP,
  onPrimaryAction,
  onSecondaryAction,
}: {
  summary: LoteStageSummary
  isDark: boolean
  isSelected: boolean
  expanded: boolean
  onSelectMany: (ids: string[]) => void
  onToggleExpand: () => void
  onOpenCP: (cp: ContaPagar) => void
  onPrimaryAction?: { label: string; onClick: () => void; tone: string; icon: typeof Send; loading?: boolean; disabled?: boolean }
  onSecondaryAction?: { label: string; onClick: () => void; tone: string; icon: typeof Banknote; loading?: boolean; disabled?: boolean }
}) {
  const isMultiItemLote = summary.totalItems > 1
  const resumoTitle = isMultiItemLote ? summary.headerLabel : summary.supplierLabel
  const resumoSubtitle = isMultiItemLote ? summary.workLabel : summary.progressLabel

  return (
    <div className={`border-b ${isDark ? 'border-white/[0.04]' : 'border-slate-100'}`}>
      <div
        className={`${LOTE_TABLE_GRID} px-3 py-3 transition-all ${isDark ? `hover:bg-white/[0.03] ${isSelected ? 'bg-emerald-500/10' : ''}` : `hover:bg-slate-50 ${isSelected ? 'bg-emerald-50' : ''}`}`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => { e.stopPropagation(); onSelectMany(summary.cpIds) }}
          onClick={e => e.stopPropagation()}
          className="w-3 h-3 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <div className={`w-0.5 h-10 rounded-full ${isDark ? 'bg-emerald-400/60' : 'bg-emerald-500/70'}`} />
        <button type="button" onClick={onToggleExpand} className="min-w-0 text-left">
          <p className={`truncate text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{summary.headerLabel}</p>
          <p className={`truncate text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{summary.workLabel}</p>
        </button>
        <button type="button" onClick={onToggleExpand} className="min-w-0 text-left">
          <p className={`truncate text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{resumoTitle}</p>
          <p className={`truncate text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{resumoSubtitle}</p>
          <div className={`mt-2 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`}>
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${summary.progress}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
            <span className={`rounded-full px-2 py-0.5 ${isDark ? 'bg-white/[0.06] text-slate-200' : 'bg-white text-slate-600 border border-slate-200'}`}>{summary.totalItems} títulos</span>
            <span className={`rounded-full px-2 py-0.5 ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>{summary.approvedItems} aprovados</span>
            {summary.excludedItems > 0 && (
              <span className={`rounded-full px-2 py-0.5 ${isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700'}`}>{summary.excludedItems} excluídos</span>
            )}
          </div>
        </button>
        <span className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{summary.totalItems}</span>
        <span className={`text-sm font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{summary.approvedItems}</span>
        <span className="text-sm font-extrabold text-emerald-600">{fmt(summary.visibleValue || summary.totalValue)}</span>
        <div className="flex items-center justify-end gap-2">
          {onPrimaryAction && (
            <button type="button" onClick={onPrimaryAction.onClick} disabled={onPrimaryAction.loading || onPrimaryAction.disabled}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed ${onPrimaryAction.tone}`}>
              {onPrimaryAction.loading ? <RefreshCw size={12} className="animate-spin" /> : <onPrimaryAction.icon size={12} />}
              {onPrimaryAction.loading ? 'Enviando...' : onPrimaryAction.label}
            </button>
          )}
          {onSecondaryAction && (
            <button type="button" onClick={onSecondaryAction.onClick} disabled={onSecondaryAction.loading || onSecondaryAction.disabled}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed ${onSecondaryAction.tone}`}>
              {onSecondaryAction.loading ? <RefreshCw size={12} className="animate-spin" /> : <onSecondaryAction.icon size={12} />}
              {onSecondaryAction.loading ? 'Processando...' : onSecondaryAction.label}
            </button>
          )}
          <button type="button" onClick={onToggleExpand} className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-[11px] font-semibold ${isDark ? 'border-white/[0.08] text-slate-200 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-white'}`}>
            {expanded ? 'Ocultar' : 'Itens'}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3">
          <LoteItemsPanel loteId={summary.lote.id} isDark={isDark} onOpenCP={onOpenCP} />
        </div>
      )}
    </div>
  )
}

function LoteCard({
  summary,
  isDark,
  expanded,
  onToggleExpand,
  onOpenCP,
  onPrimaryAction,
  onSecondaryAction,
}: {
  summary: LoteStageSummary
  isDark: boolean
  expanded: boolean
  onToggleExpand: () => void
  onOpenCP: (cp: ContaPagar) => void
  onPrimaryAction?: { label: string; onClick: () => void; tone: string; icon: typeof Send; loading?: boolean; disabled?: boolean }
  onSecondaryAction?: { label: string; onClick: () => void; tone: string; icon: typeof Banknote; loading?: boolean; disabled?: boolean }
}) {
  return (
    <div className={`rounded-2xl border p-4 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`truncate text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{summary.headerLabel}</p>
          <p className={`truncate text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{summary.workLabel}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-extrabold text-emerald-600">{fmt(summary.visibleValue || summary.totalValue)}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
        <span className={`rounded-full px-2.5 py-1 ${isDark ? 'bg-white/[0.06] text-slate-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>{summary.totalItems} títulos</span>
        <span className={`rounded-full px-2.5 py-1 ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>{summary.approvedItems} aprovados</span>
        {summary.excludedItems > 0 && (
          <span className={`rounded-full px-2.5 py-1 ${isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700'}`}>{summary.excludedItems} excluídos</span>
        )}
      </div>
      <div className={`mt-4 h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`}>
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${summary.progress}%` }} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {onPrimaryAction && (
            <button type="button" onClick={onPrimaryAction.onClick} disabled={onPrimaryAction.loading || onPrimaryAction.disabled}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed ${onPrimaryAction.tone}`}>
              {onPrimaryAction.loading ? <RefreshCw size={12} className="animate-spin" /> : <onPrimaryAction.icon size={12} />}
              {onPrimaryAction.loading ? 'Enviando...' : onPrimaryAction.label}
            </button>
          )}
          {onSecondaryAction && (
            <button type="button" onClick={onSecondaryAction.onClick} disabled={onSecondaryAction.loading || onSecondaryAction.disabled}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed ${onSecondaryAction.tone}`}>
              {onSecondaryAction.loading ? <RefreshCw size={12} className="animate-spin" /> : <onSecondaryAction.icon size={12} />}
              {onSecondaryAction.loading ? 'Processando...' : onSecondaryAction.label}
            </button>
          )}
        </div>
        <button type="button" onClick={onToggleExpand} className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-[11px] font-semibold ${isDark ? 'border-white/[0.08] text-slate-200 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          {expanded ? 'Ocultar itens' : 'Ver itens'}
        </button>
      </div>
      {expanded && (
        <div className="mt-4">
          <LoteItemsPanel loteId={summary.lote.id} isDark={isDark} onOpenCP={onOpenCP} />
        </div>
      )}
    </div>
  )
}

// ══ Main Page ═══════════════════════════════════════════════════

export default function CPPipeline() {
  const { isDark } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<PipelineStageId>('previsto')
  const [busca, setBusca] = useState('')
  const [detailCP, setDetailCP] = useState<ContaPagar | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [sortField, setSortField] = useState<SortField>('vencimento')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [quickFilter, setQuickFilter] = useState<QuickFilterId>('all')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [showCustomDate, setShowCustomDate] = useState(false)
  // Per-tab filter memory: preserves busca and quickFilter when switching tabs (#134)
  const tabFiltersRef = useRef<Map<PipelineStageId, { busca: string; quickFilter: QuickFilterId }>>(new Map())
  const [showNovaSolicitacao, setShowNovaSolicitacao] = useState(false)
  const [showNovaMenu, setShowNovaMenu] = useState(false)
  const [novaSolicitacaoKind, setNovaSolicitacaoKind] = useState<NovaSolicitacaoKind | null>(null)
  const [expandedLoteIds, setExpandedLoteIds] = useState<Set<string>>(new Set())
  const novaMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (searchParams.get('nova')) {
      setShowNovaMenu(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!showNovaMenu) return
    const handleClickOutside = (event: MouseEvent) => {
      if (!novaMenuRef.current?.contains(event.target as Node)) {
        setShowNovaMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNovaMenu])

  // Data
  const { data: contas = [], isLoading } = useContasPagar()
  const { data: lotes = [] } = useLotesPagamento()

  // Mutations
  const conciliarMut = useConciliarCPBatch()
  const cancelarCPMut = useCancelarCPBatch()
  const criarLoteMut = useCriarLote()
  const enviarLoteMut = useEnviarLoteAprovacao()
  const registrarBatchMut = useRegistrarPagamentoBatch()
  const enviarRemessaMut = useEnviarRemessaPagamentoBatch()
  const syncRemessasMut = useSincronizarRemessasPagamento()

  const contasById = useMemo(
    () => new Map(contas.map(cp => [cp.id, cp])),
    [contas],
  )

  const lotesById = useMemo(
    () => new Map(lotes.map(lote => [lote.id, lote])),
    [lotes],
  )

  const contasByLoteId = useMemo(() => {
    const map = new Map<string, ContaPagar[]>()
    for (const cp of contas) {
      if (!cp.lote_id) continue
      const list = map.get(cp.lote_id) ?? []
      list.push(cp)
      map.set(cp.lote_id, list)
    }
    return map
  }, [contas])

  const resolvePipelineStage = useCallback((cp: ContaPagar): PipelineStageId => {
    if (cp.status !== 'em_lote') return cp.status

    const lote = cp.lote_id ? lotesById.get(cp.lote_id) : undefined
    if (lote?.status === 'enviado_aprovacao') return 'em_aprovacao'
    return 'em_lote'
  }, [lotesById])

  const getApprovalHint = useCallback((cp: ContaPagar): StatusHint | null => {
    const remessaHint = getRemessaHint(cp)
    if (remessaHint) return { text: remessaHint, tone: 'sky' }
    if (cp.status === 'cancelado') {
      if (cp.lote_id) {
        const lote = lotesById.get(cp.lote_id)
        if (lote?.status === 'cancelado') {
          if (lote.aprovador_nome) return { text: `Reprovado por: ${lote.aprovador_nome}`, tone: 'rose' }
          if (lote.observacao) return { text: lote.observacao, tone: 'rose' }
          return { text: 'Cancelado na aprovação', tone: 'rose' }
        }
      }
      if (cp.observacoes) return { text: cp.observacoes, tone: 'rose' }
      return { text: 'Cancelado', tone: 'rose' }
    }
    if (!cp.lote_id) return null
    const lote = lotesById.get(cp.lote_id)
    if (!lote || lote.status !== 'enviado_aprovacao') return null
    return lote.aprovador_nome
      ? { text: `Aprovador: ${lote.aprovador_nome}`, tone: 'amber' }
      : { text: 'Em aprovação', tone: 'amber' }
  }, [lotesById])

  // Group all CPs by pipeline stage
  const grouped = useMemo(() => {
    const map = new Map<PipelineStageId, ContaPagar[]>()
    for (const stage of CP_PIPELINE_VIEW_STAGES) map.set(stage.status, [])
    for (const cp of contas) {
      const arr = map.get(resolvePipelineStage(cp))
      if (arr) arr.push(cp)
    }
    return map
  }, [contas, resolvePipelineStage])

  // Filter active tab by search, then sort
  const stageCPs = useMemo(() => {
    let cps = [...(grouped.get(activeTab) || [])]

    // Search filter
    if (busca) {
      const q = busca.toLowerCase()
      cps = cps.filter(cp =>
        cp.fornecedor_nome.toLowerCase().includes(q)
        || cp.descricao?.toLowerCase().includes(q)
        || cp.numero_documento?.toLowerCase().includes(q)
        || cp.centro_custo?.toLowerCase().includes(q)
        || cp.classe_financeira?.toLowerCase().includes(q)
        || cp.requisicao?.obra_nome?.toLowerCase().includes(q)
        || cp.pedido?.numero_pedido?.toLowerCase().includes(q)
        || cp.natureza?.toLowerCase().includes(q)
        || cp.observacoes?.toLowerCase().includes(q)
        || cp.origem?.toLowerCase().includes(q)
      )
    }

    // Sort
    cps.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'vencimento': cmp = a.data_vencimento.localeCompare(b.data_vencimento); break
        case 'emissao':    cmp = a.data_emissao.localeCompare(b.data_emissao); break
        case 'valor':      cmp = a.valor_original - b.valor_original; break
        case 'fornecedor': cmp = a.fornecedor_nome.localeCompare(b.fornecedor_nome); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return cps
  }, [grouped, activeTab, busca, sortField, sortDir])

  const selectedInTab = useMemo(
    () => stageCPs.filter(cp => selectedIds.has(cp.id)),
    [stageCPs, selectedIds],
  )

  const anchorCP = selectedInTab[0] ?? null

  const activeCPs = useMemo(() => {
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10)
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().slice(0, 10)

    switch (quickFilter) {
      case 'overdue':
        return stageCPs.filter(cp => getUrgency(cp) === 'overdue')
      case 'today':
        return stageCPs.filter(cp => getUrgency(cp) === 'today')
      case 'week':
        return stageCPs.filter(cp => ['today', 'week'].includes(getUrgency(cp)))
      case 'this_month':
        return stageCPs.filter(cp => cp.data_vencimento >= thisMonthStart && cp.data_vencimento <= thisMonthEnd)
      case 'next_month':
        return stageCPs.filter(cp => cp.data_vencimento >= nextMonthStart && cp.data_vencimento <= nextMonthEnd)
      case 'future':
        return stageCPs.filter(cp => cp.data_vencimento > nextMonthEnd)
      case 'custom':
        return stageCPs.filter(cp => {
          if (customDateFrom && cp.data_vencimento < customDateFrom) return false
          if (customDateTo && cp.data_vencimento > customDateTo) return false
          return true
        })
      case 'same_supplier':
        return anchorCP ? stageCPs.filter(cp => cp.fornecedor_nome === anchorCP.fornecedor_nome) : stageCPs
      case 'same_work':
        return anchorCP?.requisicao?.obra_nome
          ? stageCPs.filter(cp => cp.requisicao?.obra_nome === anchorCP.requisicao?.obra_nome)
          : stageCPs
      case 'same_lote':
        return anchorCP?.lote_id
          ? stageCPs.filter(cp => cp.lote_id === anchorCP.lote_id)
          : stageCPs
      default:
        return stageCPs
    }
  }, [anchorCP, quickFilter, stageCPs, customDateFrom, customDateTo])

  const isLoteStageTab = LOTE_STAGE_TABS.includes(activeTab)

  const activeLotes = useMemo(() => {
    if (!isLoteStageTab) return [] as LoteStageSummary[]

    const byLote = new Map<string, ContaPagar[]>()
    for (const cp of activeCPs) {
      if (!cp.lote_id) continue
      const list = byLote.get(cp.lote_id) ?? []
      list.push(cp)
      byLote.set(cp.lote_id, list)
    }

    return Array.from(byLote.entries()).map(([loteId, currentItems]) => {
      const lote = lotesById.get(loteId)
      const allItems = contasByLoteId.get(loteId) ?? currentItems
      const totalItems = lote?.qtd_itens ?? allItems.length
      const approvedItems = allItems.filter(cp => ['aprovado_pgto', 'em_pagamento', 'pago', 'conciliado'].includes(cp.status)).length
      const excludedItems = allItems.filter(cp => cp.status === 'cancelado').length
      const uniqueSuppliers = Array.from(new Set(allItems.map(cp => cp.fornecedor_nome?.trim()).filter(Boolean))) as string[]
      const uniqueWorks = Array.from(new Set(allItems.map(cp => (cp.requisicao?.obra_nome || cp.centro_custo || '').trim()).filter(Boolean))) as string[]
      const supplierLabel = uniqueSuppliers.length <= 1
        ? (uniqueSuppliers[0] || 'Lote sem fornecedor')
        : `${uniqueSuppliers.length} fornecedores no lote`
      const workLabel = summarizeNames(allItems.map(cp => cp.requisicao?.obra_nome || cp.centro_custo || ''), 'Múltiplas obras e centros')
      const totalValue = lote?.valor_total ?? allItems.reduce((sum, cp) => sum + cp.valor_original, 0)
      const visibleValue = currentItems.reduce((sum, cp) => sum + cp.valor_original, 0)
      const loteDate = new Date((lote?.created_at ?? currentItems[0]?.created_at ?? new Date().toISOString())).toLocaleDateString('pt-BR')
      const loteValue = totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      const headerLabel = `${lote?.numero_lote ?? `Lote ${loteId.slice(0, 8)}`} â€¢ ${loteDate} â€¢ ${loteValue}`
      const { progress, progressLabel } = getLoteProgress(activeTab, lote?.status)

      return {
        lote: lote ?? {
          id: loteId,
          numero_lote: `Lote ${loteId.slice(0, 8)}`,
          criado_por: 'Financeiro',
          valor_total: totalValue,
          qtd_itens: totalItems,
          status: 'montando',
          created_at: currentItems[0]?.created_at || new Date().toISOString(),
          updated_at: currentItems[0]?.created_at || new Date().toISOString(),
        },
        cpIds: currentItems.map(cp => cp.id),
        currentItems,
        allItems,
        totalItems,
        approvedItems,
        excludedItems,
        totalValue,
        visibleValue,
        supplierLabel,
        workLabel,
        headerLabel,
        progress,
        progressLabel,
      } satisfies LoteStageSummary
    })
  }, [activeCPs, activeTab, contasByLoteId, isLoteStageTab, lotesById])

  // Tab totals
  const tabTotal = useMemo(() => activeCPs.reduce((s, cp) => s + cp.valor_original, 0), [activeCPs])

  // Toast helper
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleLoteSelection = (ids: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      const allSelected = ids.every(id => next.has(id))
      for (const id of ids) {
        if (allSelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  const toggleExpandedLote = (loteId: string) => {
    setExpandedLoteIds(prev => {
      const next = new Set(prev)
      if (next.has(loteId)) next.delete(loteId)
      else next.add(loteId)
      return next
    })
  }

  const selectAll = () => {
    const allIds = activeCPs.map(cp => cp.id)
    const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allIds))
    }
  }

  // Sort toggle
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // ══ Actions ═════════════════════════════════════════════════════

  const handleConfirmar = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from('fin_contas_pagar')
        .update({ status: 'confirmado' })
        .in('id', ids)
      if (error) throw error
      showToast('success', `${ids.length} t\u00EDtulo(s) confirmado(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao confirmar') }
  }

  const handleCriarLote = async (ids: string[]) => {
    try {
      await criarLoteMut.mutateAsync({ cpIds: ids, criadoPor: 'Financeiro' })
      showToast('success', `Lote criado com ${ids.length} itens`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao criar lote') }
  }

  const handlePagar = async (ids: string[]) => {
    try {
      await registrarBatchMut.mutateAsync({
        cpIds: ids,
        dataPagamento: new Date().toISOString().split('T')[0],
      })
      showToast('success', `${ids.length} pagamento(s) registrado(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao registrar pagamento') }
  }

  const handleEnviarRemessa = async (ids: string[]) => {
    try {
      const result = await enviarRemessaMut.mutateAsync({ cpIds: ids })
      showToast('success', `Remessa ${result.remessaId} enviada — ${result.incluidos ?? ids.length} CP(s) incluída(s) no Omie`)
      setSelectedIds(new Set())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar remessa'
      showToast('error', message)
    }
  }

  const handleSincronizarOmie = async (ids: string[]) => {
    try {
      const cpsParaSync = ids.map(id => contasById.get(id)).filter((cp): cp is ContaPagar => !!cp)
      const result = await syncRemessasMut.mutateAsync({ cps: cpsParaSync })
      if (result.confirmed > 0) {
        showToast('success', `${result.confirmed} pagamento(s) confirmado(s) pelo Omie`)
      } else if (result.processed > 0) {
        showToast('info', `${result.processed} CP(s) atualizadas`)
      } else {
        showToast('info', 'Nenhuma atualização de status no Omie')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao sincronizar com Omie'
      showToast('error', message)
    }
  }

  const handleEnviarLotesAprovacao = async (ids: string[]) => {
    const loteIds = Array.from(new Set(
      ids
        .map(id => contasById.get(id)?.lote_id)
        .filter((loteId): loteId is string => !!loteId),
    ))

    const lotesMontando = loteIds
      .map(loteId => lotesById.get(loteId))
      .filter((lote): lote is LotePagamento => !!lote && lote.status === 'montando')

    if (lotesMontando.length === 0) {
      showToast('error', 'Nenhum lote montando encontrado na selecao')
      return
    }

    try {
      for (const lote of lotesMontando) {
        await enviarLoteMut.mutateAsync({ loteId: lote.id, lote })
      }
      showToast('success', `${lotesMontando.length} lote(s) enviado(s) para aprovacao`)
      setSelectedIds(new Set())
    } catch {
      showToast('error', 'Erro ao enviar lote para aprovacao')
    }
  }

  const handleConfirmarPagamento = async (ids: string[]) => {
    try {
      await registrarBatchMut.mutateAsync({
        cpIds: ids,
        dataPagamento: new Date().toISOString().split('T')[0],
      })
      showToast('success', `${ids.length} pagamento(s) registrados manualmente`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao confirmar pagamento') }
  }

  const handleConciliar = async (ids: string[]) => {
    try {
      await conciliarMut.mutateAsync({ ids })
      showToast('success', `${ids.length} t\u00EDtulo(s) conciliado(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao conciliar') }
  }

  const handleExcluirPrevistos = async (ids: string[]) => {
    if (ids.length === 0) return
    const confirmMessage = ids.length === 1
      ? 'Excluir este item de Previstos? Ele sair\u00E1 da lista e ficar\u00E1 como cancelado no hist\u00F3rico.'
      : `Excluir ${ids.length} itens de Previstos? Eles sair\u00E3o da lista e ficar\u00E3o como cancelados no hist\u00F3rico.`
    if (!window.confirm(confirmMessage)) return

    try {
      await cancelarCPMut.mutateAsync({ cpIds: ids })
      showToast('success', `${ids.length} item(ns) removido(s) de Previstos`)
      setSelectedIds(new Set())
    } catch {
      showToast('error', 'Erro ao excluir itens de Previstos')
    }
  }

  const handleBulkAction = () => {
    const ids = selectedInTab.map(cp => cp.id)
    if (ids.length === 0) return
    switch (activeTab) {
      case 'previsto': handleConfirmar(ids); break
      case 'confirmado': handleCriarLote(ids); break
      case 'em_lote': handleEnviarLotesAprovacao(ids); break
      case 'aprovado_pgto': handleEnviarRemessa(ids); break
      case 'em_pagamento': {
        const hasOmie = ids.some(id => contasById.get(id)?.omie_cp_id)
        if (hasOmie) window.open('https://app.omie.com.br', '_blank')
        else handleConfirmarPagamento(ids)
        break
      }
      case 'pago': handleConciliar(ids); break
    }
  }

  const handleDetailAction = (action: string, cp: ContaPagar) => {
    setDetailCP(null)
    switch (action) {
      case 'confirmar': handleConfirmar([cp.id]); break
      case 'excluir': handleExcluirPrevistos([cp.id]); break
      case 'addLote': handleCriarLote([cp.id]); break
      case 'sendLote': handleEnviarLotesAprovacao([cp.id]); break
      case 'enviarRemessa': handleEnviarRemessa([cp.id]); break
      case 'pagar': handlePagar([cp.id]); break
      case 'sincronizar': handleSincronizarOmie([cp.id]); break
      case 'conciliar': handleConciliar([cp.id]); break
    }
  }

  const buildLoteActions = (summary: LoteStageSummary) => {
    if (activeTab === 'em_aprovacao') {
      return {
        primary: {
          label: 'Aprovar lote',
          onClick: () => setDetailCP(summary.currentItems[0] ?? summary.allItems[0] ?? null),
          tone: 'bg-emerald-600 hover:bg-emerald-700',
          icon: CheckCircle2,
        },
      }
    }

    switch (activeTab) {
      case 'em_lote':
        return {
          primary: {
            label: 'Enviar aprovação',
            onClick: () => handleEnviarLotesAprovacao(summary.cpIds),
            tone: 'bg-amber-500 hover:bg-amber-600',
            icon: Send,
            loading: enviarLoteMut.isPending,
            disabled: enviarLoteMut.isPending,
          },
        }
      case 'aprovado_pgto':
        return {
          primary: {
            label: 'Enviar remessa',
            onClick: () => handleEnviarRemessa(summary.cpIds),
            tone: 'bg-sky-600 hover:bg-sky-700',
            icon: Send,
            loading: enviarRemessaMut.isPending,
            disabled: enviarRemessaMut.isPending,
          },
          secondary: {
            label: 'Registrar pgto',
            onClick: () => handlePagar(summary.cpIds),
            tone: 'bg-emerald-600 hover:bg-emerald-700',
            icon: Banknote,
          },
        }
      case 'em_pagamento': {
        const hasOmie = summary.cpIds.some(id => contasById.get(id)?.omie_cp_id)
        return hasOmie
          ? {
              primary: {
                label: 'Pagar no Omie',
                onClick: () => window.open('https://app.omie.com.br', '_blank'),
                tone: 'bg-indigo-600 hover:bg-indigo-700',
                icon: ExternalLink,
              },
              secondary: {
                label: 'Sincronizar',
                onClick: () => handleSincronizarOmie(summary.cpIds),
                tone: 'bg-sky-600 hover:bg-sky-700',
                icon: RefreshCw,
              },
            }
          : {
              primary: {
                label: 'Registrar Pgto',
                onClick: () => handleConfirmarPagamento(summary.cpIds),
                tone: 'bg-teal-600 hover:bg-teal-700',
                icon: Banknote,
              },
            }
      }
      default:
        return {}
    }
  }

  // Export
  const handleExport = () => {
    const stage = CP_PIPELINE_VIEW_STAGES.find(s => s.status === activeTab)
    const toExport = selectedIds.size > 0 ? activeCPs.filter(cp => selectedIds.has(cp.id)) : activeCPs
    exportCSV(toExport, stage?.label || activeTab)
    showToast('success', `${toExport.length} registro(s) exportado(s)`)
  }

  // Bulk action config per tab
  const BULK_ACTIONS: Partial<Record<PipelineStageId, { label: string; icon: typeof CheckCircle2; className: string }>> = {
    previsto:      { label: 'Confirmar',     icon: CheckCircle2, className: 'bg-blue-600 hover:bg-blue-700 text-white' },
    confirmado:    { label: 'Criar Lote',    icon: Layers,       className: 'bg-violet-600 hover:bg-violet-700 text-white' },
    em_lote:       { label: 'Enviar p/ Aprov.', icon: Send,      className: 'bg-amber-500 hover:bg-amber-600 text-white' },
    aprovado_pgto: { label: 'Enviar Remessa', icon: Send,        className: 'bg-sky-600 hover:bg-sky-700 text-white' },
    em_pagamento:  { label: 'Registrar Pgto', icon: Banknote,     className: 'bg-teal-600 hover:bg-teal-700 text-white' },
    pago:          { label: 'Conciliar',     icon: CheckCircle2, className: 'bg-green-600 hover:bg-green-700 text-white' },
  }
  const bulk = BULK_ACTIONS[activeTab]

  // Switch tab clears selection
  const switchTab = (status: PipelineStageId) => {
    // Save current tab's filter state before switching (#134)
    tabFiltersRef.current.set(activeTab, { busca, quickFilter })
    // Restore target tab's saved filter state, or reset to defaults
    const saved = tabFiltersRef.current.get(status)
    setBusca(saved?.busca ?? '')
    setQuickFilter(saved?.quickFilter ?? 'all')
    setActiveTab(status)
    setSelectedIds(new Set())
    setExpandedLoteIds(new Set())
  }

  // Summary stats
  const overdueCt = activeCPs.filter(cp => getUrgency(cp) === 'overdue').length
  const overdueTotal = activeCPs.filter(cp => getUrgency(cp) === 'overdue').reduce((s, c) => s + c.valor_original, 0)
  const hasFilteredView = busca.length > 0 || quickFilter !== 'all'
  const quickFilters = [
    { id: 'all' as QuickFilterId, label: 'Tudo', enabled: true, count: stageCPs.length },
    { id: 'overdue' as QuickFilterId, label: 'Vencidos', enabled: true, count: stageCPs.filter(cp => getUrgency(cp) === 'overdue').length },
    { id: 'today' as QuickFilterId, label: 'Hoje', enabled: true, count: stageCPs.filter(cp => getUrgency(cp) === 'today').length },
    { id: 'week' as QuickFilterId, label: '7 dias', enabled: true, count: stageCPs.filter(cp => ['today', 'week'].includes(getUrgency(cp))).length },
    {
      id: 'same_supplier' as QuickFilterId,
      label: anchorCP ? `Fornecedor: ${anchorCP.fornecedor_nome}` : 'Mesmo fornecedor',
      enabled: !!anchorCP,
      count: anchorCP ? stageCPs.filter(cp => cp.fornecedor_nome === anchorCP.fornecedor_nome).length : 0,
    },
    {
      id: 'same_work' as QuickFilterId,
      label: anchorCP?.requisicao?.obra_nome ? `Obra: ${anchorCP.requisicao.obra_nome}` : 'Mesma obra',
      enabled: !!anchorCP?.requisicao?.obra_nome,
      count: anchorCP?.requisicao?.obra_nome
        ? stageCPs.filter(cp => cp.requisicao?.obra_nome === anchorCP.requisicao?.obra_nome).length
        : 0,
    },
    {
      id: 'same_lote' as QuickFilterId,
      label: anchorCP?.lote_id ? 'Mesmo lote' : 'Mesmo lote',
      enabled: !!anchorCP?.lote_id,
      count: anchorCP?.lote_id ? stageCPs.filter(cp => cp.lote_id === anchorCP.lote_id).length : 0,
    },
  ]

  useEffect(() => {
    const pendentes = grouped.get('em_pagamento') || []
    if (pendentes.length === 0) return

    const runSync = () => {
      if (syncRemessasMut.isPending) return
      syncRemessasMut.mutate({ cps: pendentes }, {
        onSuccess: result => {
          if ((result?.confirmed ?? 0) > 0) {
            showToast('success', `${result.confirmed} pagamento(s) confirmado(s) via remessa`)
          }
        },
        onError: () => {
          // Keep silent to avoid noisy polling when the external endpoint is offline.
        },
      })
    }

    runSync()
    const timer = window.setInterval(runSync, 30000)
    return () => window.clearInterval(timer)
  }, [grouped, syncRemessasMut])

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Receipt size={20} className="text-emerald-600" />
            Contas a Pagar
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {contas.length} t\u00EDtulos &middot; {fmt(contas.reduce((s, c) => s + c.valor_original, 0))}
          </p>
        </div>
        <div className="relative">
        <button
          type="button"
          onClick={() => setShowNovaMenu(prev => !prev)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700"
        >
          <Plus size={15} />
          <ChevronDown size={15} className={`transition-transform ${showNovaMenu ? 'rotate-180' : ''}`} />
          Nova Solicitação
        </button>
        {showNovaMenu && (
          <div ref={novaMenuRef} className={`absolute right-0 top-full z-40 mt-2 w-[320px] rounded-3xl border p-2 shadow-2xl ${isDark ? 'border-white/[0.08] bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <button
              type="button"
              onClick={() => {
                setNovaSolicitacaoKind('extraordinario')
                setShowNovaSolicitacao(true)
                setShowNovaMenu(false)
              }}
              className={`flex w-full items-start gap-3 rounded-[20px] px-4 py-3 text-left transition-all ${isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-slate-50'}`}
            >
              <span className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-600'}`}>
                <Receipt size={16} />
              </span>
              <span>
                <span className={`block text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Pagamento Extraordinário</span>
                <span className={`mt-1 block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Solicitação manual urgente com entrada direta em Confirmados.</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setNovaSolicitacaoKind('previsao')
                setShowNovaSolicitacao(true)
                setShowNovaMenu(false)
              }}
              className={`flex w-full items-start gap-3 rounded-[20px] px-4 py-3 text-left transition-all ${isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-slate-50'}`}
            >
              <span className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-600'}`}>
                <Calendar size={16} />
              </span>
              <span>
                <span className={`block text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Previsão de Pagamento</span>
                <span className={`mt-1 block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Planejamento de despesas futuras com recorrência opcional.</span>
              </span>
            </button>
          </div>
        )}
        </div>
      </div>

      {/* ══ Horizontal Tabs ══ */}
      <PipelineRail
        isDark={isDark}
        activeTab={activeTab}
        switchTab={switchTab}
        grouped={grouped}
      />

      {/* ══ Content panel ══ */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>

        {/* ── Camada 1: Hero Stats Bar ── */}
        <div className={`px-4 py-3 border-b flex flex-wrap items-center gap-2 ${
          isDark ? 'border-white/[0.06] bg-gradient-to-r from-emerald-500/[0.03] to-transparent' : 'border-slate-100 bg-gradient-to-r from-emerald-50/50 to-transparent'
        }`}>
          {/* Stat pills — clickable quick filters */}
          {(() => {
            const now = new Date()
            const mStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
            const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
            const nStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10)
            const nEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().slice(0, 10)
            const mesAtualLabel = now.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()
            const proxMesLabel = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()

            const stats: { id: QuickFilterId; label: string; count: number; value: number; icon: typeof Receipt; color: string }[] = [
              { id: 'all', label: 'Total', count: stageCPs.length, value: stageCPs.reduce((s, c) => s + c.valor_original, 0), icon: Receipt, color: 'emerald' },
              { id: 'overdue', label: 'Vencidos', count: stageCPs.filter(cp => getUrgency(cp) === 'overdue').length, value: stageCPs.filter(cp => getUrgency(cp) === 'overdue').reduce((s, c) => s + c.valor_original, 0), icon: AlertTriangle, color: 'red' },
              { id: 'today', label: 'Hoje', count: stageCPs.filter(cp => getUrgency(cp) === 'today').length, value: stageCPs.filter(cp => getUrgency(cp) === 'today').reduce((s, c) => s + c.valor_original, 0), icon: Clock, color: 'amber' },
              { id: 'week', label: '7 dias', count: stageCPs.filter(cp => ['today', 'week'].includes(getUrgency(cp))).length, value: stageCPs.filter(cp => ['today', 'week'].includes(getUrgency(cp))).reduce((s, c) => s + c.valor_original, 0), icon: Calendar, color: 'blue' },
              { id: 'this_month', label: mesAtualLabel, count: stageCPs.filter(cp => cp.data_vencimento >= mStart && cp.data_vencimento <= mEnd).length, value: stageCPs.filter(cp => cp.data_vencimento >= mStart && cp.data_vencimento <= mEnd).reduce((s, c) => s + c.valor_original, 0), icon: Calendar, color: 'violet' },
              { id: 'next_month', label: proxMesLabel, count: stageCPs.filter(cp => cp.data_vencimento >= nStart && cp.data_vencimento <= nEnd).length, value: stageCPs.filter(cp => cp.data_vencimento >= nStart && cp.data_vencimento <= nEnd).reduce((s, c) => s + c.valor_original, 0), icon: Calendar, color: 'indigo' },
              { id: 'future', label: 'Futuros', count: stageCPs.filter(cp => cp.data_vencimento > nEnd).length, value: stageCPs.filter(cp => cp.data_vencimento > nEnd).reduce((s, c) => s + c.valor_original, 0), icon: ArrowRight, color: 'slate' },
            ]

            const colors: Record<string, { activeBg: string; activeBorder: string; activeText: string; countBg: string; idleBg: string; idleBorder: string; idleText: string }> = {
              emerald: { activeBg: isDark ? 'bg-emerald-500/15' : 'bg-emerald-50', activeBorder: isDark ? 'border-emerald-400/30 ring-1 ring-emerald-400/20' : 'border-emerald-200 ring-1 ring-emerald-200/50', activeText: isDark ? 'text-emerald-300' : 'text-emerald-700', countBg: isDark ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-100 text-emerald-700', idleBg: isDark ? 'bg-white/[0.02]' : 'bg-white', idleBorder: isDark ? 'border-white/[0.06]' : 'border-slate-200', idleText: isDark ? 'text-slate-400' : 'text-slate-500' },
              red: { activeBg: isDark ? 'bg-red-500/15' : 'bg-red-50', activeBorder: isDark ? 'border-red-400/30 ring-1 ring-red-400/20' : 'border-red-200 ring-1 ring-red-200/50', activeText: isDark ? 'text-red-300' : 'text-red-700', countBg: isDark ? 'bg-red-500/20 text-red-200' : 'bg-red-100 text-red-700', idleBg: isDark ? 'bg-white/[0.02]' : 'bg-white', idleBorder: isDark ? 'border-white/[0.06]' : 'border-slate-200', idleText: isDark ? 'text-slate-400' : 'text-slate-500' },
              amber: { activeBg: isDark ? 'bg-amber-500/15' : 'bg-amber-50', activeBorder: isDark ? 'border-amber-400/30 ring-1 ring-amber-400/20' : 'border-amber-200 ring-1 ring-amber-200/50', activeText: isDark ? 'text-amber-300' : 'text-amber-700', countBg: isDark ? 'bg-amber-500/20 text-amber-200' : 'bg-amber-100 text-amber-700', idleBg: isDark ? 'bg-white/[0.02]' : 'bg-white', idleBorder: isDark ? 'border-white/[0.06]' : 'border-slate-200', idleText: isDark ? 'text-slate-400' : 'text-slate-500' },
              blue: { activeBg: isDark ? 'bg-blue-500/15' : 'bg-blue-50', activeBorder: isDark ? 'border-blue-400/30 ring-1 ring-blue-400/20' : 'border-blue-200 ring-1 ring-blue-200/50', activeText: isDark ? 'text-blue-300' : 'text-blue-700', countBg: isDark ? 'bg-blue-500/20 text-blue-200' : 'bg-blue-100 text-blue-700', idleBg: isDark ? 'bg-white/[0.02]' : 'bg-white', idleBorder: isDark ? 'border-white/[0.06]' : 'border-slate-200', idleText: isDark ? 'text-slate-400' : 'text-slate-500' },
              violet: { activeBg: isDark ? 'bg-violet-500/15' : 'bg-violet-50', activeBorder: isDark ? 'border-violet-400/30 ring-1 ring-violet-400/20' : 'border-violet-200 ring-1 ring-violet-200/50', activeText: isDark ? 'text-violet-300' : 'text-violet-700', countBg: isDark ? 'bg-violet-500/20 text-violet-200' : 'bg-violet-100 text-violet-700', idleBg: isDark ? 'bg-white/[0.02]' : 'bg-white', idleBorder: isDark ? 'border-white/[0.06]' : 'border-slate-200', idleText: isDark ? 'text-slate-400' : 'text-slate-500' },
              indigo: { activeBg: isDark ? 'bg-indigo-500/15' : 'bg-indigo-50', activeBorder: isDark ? 'border-indigo-400/30 ring-1 ring-indigo-400/20' : 'border-indigo-200 ring-1 ring-indigo-200/50', activeText: isDark ? 'text-indigo-300' : 'text-indigo-700', countBg: isDark ? 'bg-indigo-500/20 text-indigo-200' : 'bg-indigo-100 text-indigo-700', idleBg: isDark ? 'bg-white/[0.02]' : 'bg-white', idleBorder: isDark ? 'border-white/[0.06]' : 'border-slate-200', idleText: isDark ? 'text-slate-400' : 'text-slate-500' },
              slate: { activeBg: isDark ? 'bg-slate-500/15' : 'bg-slate-100', activeBorder: isDark ? 'border-slate-400/30 ring-1 ring-slate-400/20' : 'border-slate-300 ring-1 ring-slate-300/50', activeText: isDark ? 'text-slate-200' : 'text-slate-700', countBg: isDark ? 'bg-slate-500/20 text-slate-200' : 'bg-slate-200 text-slate-700', idleBg: isDark ? 'bg-white/[0.02]' : 'bg-white', idleBorder: isDark ? 'border-white/[0.06]' : 'border-slate-200', idleText: isDark ? 'text-slate-400' : 'text-slate-500' },
            }

            return stats.map(stat => {
              const active = quickFilter === stat.id
              const StatIcon = stat.icon
              const c = colors[stat.color]
              const dimmed = stat.count === 0 && stat.id !== 'all'
              return (
                <button
                  key={stat.id}
                  onClick={() => !dimmed && setQuickFilter(active ? 'all' : stat.id)}
                  className={`group flex items-center gap-2.5 rounded-2xl border px-3.5 py-2 transition-all duration-200 ${
                    dimmed ? `opacity-40 cursor-default ${c.idleBg} ${c.idleBorder} ${c.idleText}` :
                    active ? `${c.activeBg} ${c.activeBorder} ${c.activeText} hover:scale-[1.02]` : `${c.idleBg} ${c.idleBorder} ${c.idleText} hover:shadow-sm hover:scale-[1.02]`
                  }`}
                >
                  <StatIcon size={13} className={`shrink-0 ${active ? '' : 'opacity-50 group-hover:opacity-80'}`} />
                  <div className="text-left">
                    <p className={`text-[10px] font-semibold uppercase tracking-wider leading-none ${active ? '' : 'opacity-70'}`}>{stat.label}</p>
                    <p className={`text-sm font-extrabold tabular-nums leading-tight mt-0.5 ${active ? '' : isDark ? 'text-slate-200' : 'text-slate-700'}`}>{fmt(stat.value)}</p>
                  </div>
                  <span className={`ml-1 text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${active ? c.countBg : isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                    {stat.count}
                  </span>
                </button>
              )
            })
          })()}

          {/* Custom date range */}
          <div className="relative">
            <button
              onClick={() => { setShowCustomDate(v => !v); if (quickFilter !== 'custom') { setQuickFilter('custom'); if (!customDateFrom && !customDateTo) setShowCustomDate(true) } }}
              className={`group flex items-center gap-1.5 rounded-2xl border px-3 py-2 transition-all duration-200 hover:scale-[1.02] text-[11px] font-medium ${
                quickFilter === 'custom'
                  ? isDark ? 'border-teal-400/30 ring-1 ring-teal-400/20 bg-teal-500/15 text-teal-300' : 'border-teal-200 ring-1 ring-teal-200/50 bg-teal-50 text-teal-700'
                  : isDark ? 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:shadow-sm'
              }`}
            >
              <Filter size={12} />
              {quickFilter === 'custom' && customDateFrom ? (
                <span className="tabular-nums">{customDateFrom.split('-').reverse().join('/')} — {customDateTo ? customDateTo.split('-').reverse().join('/') : '...'}</span>
              ) : (
                <span>Personalizado</span>
              )}
            </button>
            {showCustomDate && (
              <div className={`absolute left-0 top-full mt-2 z-40 rounded-2xl border p-4 shadow-xl space-y-3 min-w-[280px] ${isDark ? 'bg-slate-900 border-white/[0.08]' : 'bg-white border-slate-200'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Período personalizado</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className={`text-[10px] font-medium mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>De</label>
                    <input type="date" value={customDateFrom} onChange={e => setCustomDateFrom(e.target.value)}
                      className={`w-full px-2.5 py-1.5 rounded-xl border text-xs ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                    />
                  </div>
                  <div className="flex-1">
                    <label className={`text-[10px] font-medium mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Até</label>
                    <input type="date" value={customDateTo} onChange={e => setCustomDateTo(e.target.value)}
                      className={`w-full px-2.5 py-1.5 rounded-xl border text-xs ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <button onClick={() => { setCustomDateFrom(''); setCustomDateTo(''); setQuickFilter('all'); setShowCustomDate(false) }}
                    className={`text-[11px] font-medium px-3 py-1.5 rounded-xl transition-all ${isDark ? 'text-slate-400 hover:bg-white/[0.04]' : 'text-slate-500 hover:bg-slate-50'}`}>
                    Limpar
                  </button>
                  <button onClick={() => setShowCustomDate(false)}
                    className="text-[11px] font-bold px-4 py-1.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-all">
                    Aplicar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Anchor-based contextual filters */}
          {anchorCP && (
            <div className={`flex items-center gap-1.5 ml-2 pl-2 border-l ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
              {quickFilters.filter(f => ['same_supplier', 'same_work', 'same_lote'].includes(f.id) && f.enabled).map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setQuickFilter(quickFilter === filter.id ? 'all' : filter.id)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all ${
                    quickFilter === filter.id
                      ? isDark ? 'border-violet-400/40 bg-violet-500/10 text-violet-300' : 'border-violet-300 bg-violet-50 text-violet-700'
                      : isDark ? 'border-white/[0.06] text-slate-400 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Camada 2: Search + Sort + View + Export ── */}
        <div className={`px-4 py-2 border-b flex flex-wrap items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${busca ? isDark ? 'text-emerald-400' : 'text-emerald-500' : 'text-slate-400'} transition-colors`} />
            <input
              type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar fornecedor, documento, obra, CC..."
              className={`w-full pl-9 pr-8 py-2 rounded-xl border text-xs placeholder-slate-400 transition-all focus:outline-none focus:ring-2 ${
                isDark
                  ? 'bg-white/[0.04] border-white/[0.06] text-slate-200 focus:ring-emerald-500/30 focus:border-emerald-500/30'
                  : 'border-slate-200 bg-white text-slate-700 focus:ring-emerald-500/20 focus:border-emerald-300'
              }`}
            />
            {busca && (
              <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div className={`flex items-center gap-0.5 rounded-xl border px-1 py-0.5 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/50'}`}>
            {SORT_OPTIONS.map(opt => {
              const isActive = sortField === opt.field
              return (
                <button
                  key={opt.field}
                  onClick={() => toggleSort(opt.field)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    isActive
                      ? isDark ? 'bg-white/[0.1] text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm'
                      : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {opt.label}
                  {isActive && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                </button>
              )
            })}
          </div>

          {/* View toggle */}
          <div className={`flex items-center rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-all ${
                viewMode === 'list'
                  ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700'
                  : isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Lista"
            >
              <LayoutList size={14} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 transition-all ${
                viewMode === 'cards'
                  ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700'
                  : isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Cards"
            >
              <LayoutGrid size={14} />
            </button>
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExport}
            disabled={activeCPs.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30'
            }`}
            title="Exportar CSV"
          >
            <Download size={13} />
            CSV
          </button>

          {/* Select + count */}
          {bulk && activeCPs.length > 0 && (
            <label className="flex items-center gap-2 ml-auto cursor-pointer">
              <input
                type="checkbox"
                checked={activeCPs.length > 0 && activeCPs.every(cp => selectedIds.has(cp.id))}
                onChange={selectAll}
                className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Selecionar {isLoteStageTab ? `${activeLotes.length} lotes` : `${activeCPs.length} t\u00EDtulos`}
              </span>
            </label>
          )}
        </div>

        {/* ── Camada 3: Bulk Actions Bar (s\u00F3 com sele\u00E7\u00E3o) ── */}
        {selectedInTab.length > 0 && bulk && (
          <div className={`px-4 py-2.5 border-b flex items-center gap-3 transition-all ${
            isDark ? 'border-white/[0.06] bg-emerald-500/[0.05]' : 'border-emerald-100 bg-emerald-50/50'
          }`}>
            <div className={`flex items-center gap-2 text-xs font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
              <CheckCircle2 size={14} />
              <span className="tabular-nums">{selectedInTab.length}</span>
              <span className="font-normal opacity-70">selecionado{selectedInTab.length > 1 ? 's' : ''}</span>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold tabular-nums ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                {fmt(selectedInTab.reduce((s, cp) => s + cp.valor_original, 0))}
              </span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleBulkAction}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[11px] font-bold transition-all shadow-sm hover:shadow ${bulk.className}`}
              >
                <bulk.icon size={12} />
                {bulk.label}
              </button>
              {activeTab === 'previsto' && (
                <button
                  onClick={() => handleExcluirPrevistos(selectedInTab.map(cp => cp.id))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                >
                  <XCircle size={12} />
                  Excluir
                </button>
              )}
              {activeTab === 'aprovado_pgto' && (
                <button
                  onClick={() => handlePagar(selectedInTab.map(cp => cp.id))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  <Banknote size={12} />
                  Registrar Pgto
                </button>
              )}
              <button
                onClick={() => setSelectedIds(new Set())}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.04]' : 'text-slate-500 hover:text-slate-700 hover:bg-white'
                }`}
              >
                Limpar
              </button>
            </div>
          </div>
        )}

        {/* CP list / cards */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeCPs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                <Receipt size={24} className="text-slate-300" />
              </div>
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {isLoteStageTab ? 'Nenhum lote nesta etapa' : 'Nenhum t\u00EDtulo nesta etapa'}
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {busca ? 'Tente outra busca' : isLoteStageTab ? 'Os lotes aparecer\u00E3o aqui quando avan\u00E7arem' : 'Os t\u00EDtulos aparecer\u00E3o aqui quando avan\u00E7arem'}
              </p>
            </div>
          ) : isLoteStageTab && viewMode === 'list' ? (
            <>
              <div className={`${LOTE_TABLE_GRID} px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'}`}>
                <span />
                <span />
                <span>Lote</span>
                <span>Resumo</span>
                <span>Qtd</span>
                <span>Aprov.</span>
                <span className="text-right">Valor</span>
                <span className="text-right">Ações</span>
              </div>
              {activeLotes.map(summary => {
                const actions = buildLoteActions(summary)
                const selected = summary.cpIds.every(id => selectedIds.has(id))
                return (
                  <LoteTableRow
                    key={summary.lote.id}
                    summary={summary}
                    isDark={isDark}
                    isSelected={selected}
                    expanded={expandedLoteIds.has(summary.lote.id)}
                    onSelectMany={toggleLoteSelection}
                    onToggleExpand={() => toggleExpandedLote(summary.lote.id)}
                    onOpenCP={cp => setDetailCP(cp)}
                    onPrimaryAction={actions.primary}
                    onSecondaryAction={actions.secondary}
                  />
                )
              })}
            </>
          ) : isLoteStageTab ? (
            <div className="space-y-3 p-4">
              {activeLotes.map(summary => {
                const actions = buildLoteActions(summary)
                return (
                  <LoteCard
                    key={summary.lote.id}
                    summary={summary}
                    isDark={isDark}
                    expanded={expandedLoteIds.has(summary.lote.id)}
                    onToggleExpand={() => toggleExpandedLote(summary.lote.id)}
                    onOpenCP={cp => setDetailCP(cp)}
                    onPrimaryAction={actions.primary}
                    onSecondaryAction={actions.secondary}
                  />
                )
              })}
            </div>
          ) : viewMode === 'list' ? (
            <>
              {/* Table header */}
              <div className={`${CP_TABLE_GRID} px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-wider ${
                isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'
              }`}>
                <span />
                <span />
                <span>Fornecedor</span>
                <span>Descri\u00E7\u00E3o</span>
                <span>Obra</span>
                <span>CC</span>
                <span>Pedido</span>
                <span className="text-right">Venc.</span>
                <span className="text-right">Valor</span>
              </div>
              {activeCPs.map(cp => (
                <CPRow
                  key={cp.id}
                  cp={cp}
                  onClick={() => setDetailCP(cp)}
                  isDark={isDark}
                  isSelected={selectedIds.has(cp.id)}
                  onSelect={toggleSelect}
                  approvalHint={getApprovalHint(cp)}
                />
              ))}
            </>
          ) : (
            <div className="space-y-2 p-4">
              {activeCPs.map(cp => (
                <CPCard
                  key={cp.id}
                  cp={cp}
                  onClick={() => setDetailCP(cp)}
                  isDark={isDark}
                  isSelected={selectedIds.has(cp.id)}
                  onSelect={toggleSelect}
                  approvalHint={getApprovalHint(cp)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showNovaSolicitacao && (
        novaSolicitacaoKind === 'previsao' ? (
          <NovaPrevisaoPagamentoModal
            isDark={isDark}
            onClose={() => {
              setShowNovaSolicitacao(false)
              setNovaSolicitacaoKind(null)
            }}
            onSuccess={() => {
              setActiveTab('previsto')
              showToast('success', 'Previsão de pagamento criada em Previstos')
            }}
          />
        ) : (
          <NovaSolicitacaoExtraordinariaModal
            isDark={isDark}
            onClose={() => {
              setShowNovaSolicitacao(false)
              setNovaSolicitacaoKind(null)
            }}
            onSuccess={() => {
              setActiveTab('confirmado')
              showToast('success', 'Solicitação extraordinária criada em Confirmados')
            }}
          />
        )
      )}

      {/* Detail Modal */}
      {detailCP && (
        <CPDetailModal
          cp={detailCP}
          stageStatus={resolvePipelineStage(detailCP)}
          onClose={() => setDetailCP(null)}
          onAction={handleDetailAction}
          isDark={isDark}
        />
      )}
    </div>
  )
}
