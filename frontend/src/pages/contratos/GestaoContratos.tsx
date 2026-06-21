import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Briefcase, Search, FileText, FileSignature, TrendingUp, CalendarClock,
  TrendingDown, Calendar, ChevronDown, ChevronUp,
  CalendarDays, CheckCircle2, XCircle, AlertTriangle, ArrowUpRight,
  ArrowDownRight, Clock, Banknote, CreditCard,
  Pause, RotateCcw, Lock, AlertOctagon, Loader2, Play,
  LayoutList, LayoutGrid, Eye, Receipt, Send, Plus, X,
} from 'lucide-react'
import { useContratos, useAditivos, useAtualizarAditivo, useAtualizarContrato, useReajustes, useParcelas, useMedicoes, useFaturarMedicao, useCriarMedicao } from '../../hooks/useContratos'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import type { Contrato, ContratoMedicao } from '../../types/contratos'
import type { StatusAditivo, TipoAditivo } from '../../types/contratos'
import type { StatusContrato, GrupoContrato } from '../../types/contratos'
import { GRUPO_CONTRATO_OPTIONS, GRUPO_CONTRATO_LABEL } from '../../constants/contratos'
import { UpperInput, UpperTextarea } from '../../components/UpperInput'

// ── Formatters ──────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtFull = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const fmtPct = (v: number) =>
  `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`

// ── Tabs ────────────────────────────────────────────────────────────────────
type Tab = 'contratos' | 'medicoes' | 'aditivos' | 'reajustes' | 'vencimentos' | 'recebiveis' | 'provisionado'

const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: 'contratos',    label: 'Contratos',    icon: FileText },
  { key: 'medicoes',     label: 'Medições',     icon: Receipt },
  { key: 'recebiveis',   label: 'Recebíveis',   icon: Banknote },
  { key: 'provisionado', label: 'Provisionado', icon: CreditCard },
  { key: 'aditivos',     label: 'Aditivos',     icon: FileSignature },
  { key: 'reajustes',    label: 'Reajustes',    icon: TrendingUp },
  { key: 'vencimentos',  label: 'Vencimentos',  icon: CalendarClock },
]

type AccentSet = { bg: string; bgActive: string; text: string; textActive: string; dot: string; badge: string; border: string }

const TAB_ACCENT: Record<Tab, AccentSet> = {
  contratos:    { bg:'bg-indigo-50',  bgActive:'bg-indigo-100',  text:'text-indigo-500',  textActive:'text-indigo-800',  dot:'bg-indigo-500',  badge:'bg-indigo-200/80 text-indigo-700',  border:'border-indigo-200' },
  medicoes:     { bg:'bg-fuchsia-50', bgActive:'bg-fuchsia-100', text:'text-fuchsia-500', textActive:'text-fuchsia-800', dot:'bg-fuchsia-500', badge:'bg-fuchsia-200/80 text-fuchsia-700', border:'border-fuchsia-200' },
  recebiveis:   { bg:'bg-emerald-50', bgActive:'bg-emerald-100', text:'text-emerald-500', textActive:'text-emerald-800', dot:'bg-emerald-500', badge:'bg-emerald-200/80 text-emerald-700', border:'border-emerald-200' },
  provisionado: { bg:'bg-amber-50',   bgActive:'bg-amber-100',   text:'text-amber-500',   textActive:'text-amber-800',   dot:'bg-amber-500',   badge:'bg-amber-200/80 text-amber-700',   border:'border-amber-200' },
  aditivos:     { bg:'bg-violet-50',  bgActive:'bg-violet-100',  text:'text-violet-500',  textActive:'text-violet-800',  dot:'bg-violet-500',  badge:'bg-violet-200/80 text-violet-700',  border:'border-violet-200' },
  reajustes:    { bg:'bg-cyan-50',    bgActive:'bg-cyan-100',    text:'text-cyan-500',    textActive:'text-cyan-800',    dot:'bg-cyan-500',    badge:'bg-cyan-200/80 text-cyan-700',    border:'border-cyan-200' },
  vencimentos:  { bg:'bg-red-50',     bgActive:'bg-red-100',     text:'text-red-500',     textActive:'text-red-800',     dot:'bg-red-500',     badge:'bg-red-200/80 text-red-700',     border:'border-red-200' },
}

const TAB_ACCENT_DARK: Record<Tab, AccentSet> = {
  contratos:    { bg:'bg-indigo-500/5',  bgActive:'bg-indigo-500/15',  text:'text-indigo-400',  textActive:'text-indigo-200',  dot:'bg-indigo-400',  badge:'bg-indigo-500/15 text-indigo-300',  border:'border-indigo-500/20' },
  medicoes:     { bg:'bg-fuchsia-500/5', bgActive:'bg-fuchsia-500/15', text:'text-fuchsia-400', textActive:'text-fuchsia-200', dot:'bg-fuchsia-400', badge:'bg-fuchsia-500/15 text-fuchsia-300', border:'border-fuchsia-500/20' },
  recebiveis:   { bg:'bg-emerald-500/5', bgActive:'bg-emerald-500/15', text:'text-emerald-400', textActive:'text-emerald-200', dot:'bg-emerald-400', badge:'bg-emerald-500/15 text-emerald-300', border:'border-emerald-500/20' },
  provisionado: { bg:'bg-amber-500/5',   bgActive:'bg-amber-500/15',   text:'text-amber-400',   textActive:'text-amber-200',   dot:'bg-amber-400',   badge:'bg-amber-500/15 text-amber-300',   border:'border-amber-500/20' },
  aditivos:     { bg:'bg-violet-500/5',  bgActive:'bg-violet-500/15',  text:'text-violet-400',  textActive:'text-violet-200',  dot:'bg-violet-400',  badge:'bg-violet-500/15 text-violet-300',  border:'border-violet-500/20' },
  reajustes:    { bg:'bg-cyan-500/5',    bgActive:'bg-cyan-500/15',    text:'text-cyan-400',    textActive:'text-cyan-200',    dot:'bg-cyan-400',    badge:'bg-cyan-500/15 text-cyan-300',    border:'border-cyan-500/20' },
  vencimentos:  { bg:'bg-red-500/5',     bgActive:'bg-red-500/15',     text:'text-red-400',     textActive:'text-red-200',     dot:'bg-red-400',     badge:'bg-red-500/15 text-red-300',     border:'border-red-500/20' },
}

// ── Status configs ──────────────────────────────────────────────────────────
const STATUS_CONTRATO: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  em_negociacao: { label: 'Em Negociacao', dot: 'bg-yellow-400',  bg: 'bg-yellow-50',  text: 'text-yellow-700' },
  assinado:      { label: 'Assinado',      dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700' },
  vigente:       { label: 'Vigente',        dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  suspenso:      { label: 'Suspenso',       dot: 'bg-orange-400',  bg: 'bg-orange-50',   text: 'text-orange-700' },
  encerrado:     { label: 'Encerrado',      dot: 'bg-slate-400',   bg: 'bg-slate-100',   text: 'text-slate-600' },
  rescindido:    { label: 'Rescindido',     dot: 'bg-red-400',     bg: 'bg-red-50',      text: 'text-red-600' },
}

const STATUS_ADITIVO: Record<StatusAditivo, { label: string; dot: string; bg: string; text: string }> = {
  rascunho:     { label: 'Rascunho',      dot: 'bg-gray-400',    bg: 'bg-gray-100',   text: 'text-gray-600' },
  em_aprovacao: { label: 'Em Aprovação',   dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  aprovado:     { label: 'Aprovado',       dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  rejeitado:    { label: 'Rejeitado',      dot: 'bg-red-400',     bg: 'bg-red-50',     text: 'text-red-600' },
}

const TIPO_ADITIVO: Record<TipoAditivo, { label: string; bg: string; text: string }> = {
  escopo: { label: 'Escopo', bg: 'bg-violet-50', text: 'text-violet-700' },
  prazo:  { label: 'Prazo',  bg: 'bg-blue-50',   text: 'text-blue-700' },
  valor:  { label: 'Valor',  bg: 'bg-emerald-50', text: 'text-emerald-700' },
  misto:  { label: 'Misto',  bg: 'bg-amber-50',  text: 'text-amber-700' },
}

// ── Action configs ──────────────────────────────────────────────────────────
type ContratoAction = {
  key: string
  label: string
  toStatus: StatusContrato
  icon: typeof Play
  bg: string
  border: string
  text: string
  hoverBg: string
  confirmBg: string
  confirmHover: string
  needsMotivo: boolean
  minRole?: 'comprador' | 'gerente'
  requireContratoSupervisor?: boolean
}

const ACTIONS: Record<string, ContratoAction[]> = {
  em_negociacao: [
    { key: 'assinar', label: 'Assinar', toStatus: 'assinado', icon: FileSignature, bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', hoverBg: 'hover:bg-emerald-100', confirmBg: 'bg-emerald-600', confirmHover: 'hover:bg-emerald-700', needsMotivo: false, minRole: 'comprador' },
  ],
  assinado: [
    { key: 'liberar', label: 'Liberar Pagamentos', toStatus: 'vigente', icon: Banknote, bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', hoverBg: 'hover:bg-emerald-100', confirmBg: 'bg-emerald-600', confirmHover: 'hover:bg-emerald-700', needsMotivo: false, minRole: 'comprador' },
  ],
  vigente: [
    { key: 'suspender', label: 'Suspender', toStatus: 'suspenso', icon: Pause, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', hoverBg: 'hover:bg-amber-100', confirmBg: 'bg-amber-500', confirmHover: 'hover:bg-amber-600', needsMotivo: true, requireContratoSupervisor: true },
    { key: 'encerrar', label: 'Encerrar', toStatus: 'encerrado', icon: Lock, bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', hoverBg: 'hover:bg-slate-100', confirmBg: 'bg-slate-600', confirmHover: 'hover:bg-slate-700', needsMotivo: true, minRole: 'gerente' },
    { key: 'rescindir', label: 'Rescindir', toStatus: 'rescindido', icon: AlertOctagon, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', hoverBg: 'hover:bg-red-100', confirmBg: 'bg-red-600', confirmHover: 'hover:bg-red-700', needsMotivo: true, minRole: 'gerente' },
  ],
  suspenso: [
    { key: 'reativar', label: 'Reativar', toStatus: 'vigente', icon: RotateCcw, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', hoverBg: 'hover:bg-blue-100', confirmBg: 'bg-blue-600', confirmHover: 'hover:bg-blue-700', needsMotivo: false, requireContratoSupervisor: true },
    { key: 'encerrar', label: 'Encerrar', toStatus: 'encerrado', icon: Lock, bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', hoverBg: 'hover:bg-slate-100', confirmBg: 'bg-slate-600', confirmHover: 'hover:bg-slate-700', needsMotivo: true, minRole: 'gerente' },
    { key: 'rescindir', label: 'Rescindir', toStatus: 'rescindido', icon: AlertOctagon, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', hoverBg: 'hover:bg-red-100', confirmBg: 'bg-red-600', confirmHover: 'hover:bg-red-700', needsMotivo: true, minRole: 'gerente' },
  ],
}

// ── Contrato Card ───────────────────────────────────────────────────────────
function ContratoCard({ contrato, onToast }: { contrato: Contrato; onToast: (type: 'success' | 'error', msg: string) => void }) {
  const nav = useNavigate()
  const { atLeast, hasSetorPapel } = useAuth()
  const atualizarContrato = useAtualizarContrato()
  const [expanded, setExpanded] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ContratoAction | null>(null)
  const [motivo, setMotivo] = useState('')

  const cfg = STATUS_CONTRATO[contrato.status]
  const isDespesa = contrato.tipo_contrato === 'despesa'
  const contraparte = isDespesa
    ? contrato.fornecedor?.razao_social
      ?? contrato.fornecedor?.nome_fantasia
      ?? contrato.solicitacao?.contraparte_nome
      ?? contrato.contraparte_nome
    : contrato.cliente?.nome
      ?? contrato.solicitacao?.contraparte_nome
      ?? contrato.contraparte_nome
  const linhaContexto = [contraparte, contrato.numero, contrato.centro_custo]
    .filter(Boolean)
    .join(' • ')
  const tituloContrato = contrato.objeto?.trim() || 'Contrato sem titulo'
  const diasRestantes = Math.ceil(
    (new Date(contrato.data_fim_previsto).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  const canManageContrato = hasSetorPapel('contratos', ['supervisor', 'diretor', 'ceo'])
  const actions = (ACTIONS[contrato.status] ?? []).filter(action => {
    if (action.requireContratoSupervisor) return canManageContrato
    if (action.minRole) return atLeast(action.minRole) || canManageContrato
    return false
  })
  const isFinal = contrato.status === 'encerrado' || contrato.status === 'rescindido'

  const handleConfirm = () => {
    if (!confirmAction) return
    if (confirmAction.needsMotivo && !motivo.trim()) return

    const today = new Date().toISOString().slice(0, 10)
    const updates: Record<string, unknown> = {
      id: contrato.id,
      status: confirmAction.toStatus,
    }
    if (confirmAction.toStatus === 'encerrado' || confirmAction.toStatus === 'rescindido') {
      updates.data_fim_real = today
    }

    atualizarContrato.mutate(updates as any, {
      onSuccess: () => {
        onToast('success', `Contrato ${confirmAction.label.toLowerCase()} com sucesso`)
        setConfirmAction(null)
        setMotivo('')
      },
      onError: () => {
        onToast('error', `Erro ao ${confirmAction.label.toLowerCase()} contrato`)
      },
    })
  }

  const confirmBorder = confirmAction
    ? confirmAction.border
    : contrato.status === 'vigente' ? 'border-emerald-200' : 'border-slate-200'

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md ${confirmBorder}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isDespesa ? 'bg-amber-50' : 'bg-emerald-50'
          }`}>
            {isDespesa
              ? <TrendingDown size={16} className="text-amber-600" />
              : <TrendingUp size={16} className="text-emerald-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{tituloContrato}</p>
                <p className="text-[11px] font-semibold text-slate-500 truncate mt-0.5">
                  {linhaContexto || 'Contrato sem referencia'}
                </p>
              </div>
              <p className={`text-sm font-extrabold shrink-0 ${isDespesa ? 'text-amber-600' : 'text-emerald-600'}`}>
                {fmt(contrato.valor_total + contrato.valor_aditivos)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className={`inline-flex items-center gap-1 rounded-full font-semibold px-2 py-0.5 ${cfg?.bg} ${cfg?.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot}`} />
                {cfg?.label ?? contrato.status}
              </span>
              <span className="bg-slate-100 text-slate-600 font-mono font-semibold rounded-full px-2 py-0.5">
                {contrato.numero}
              </span>
              <span className={`font-semibold rounded-full px-2 py-0.5 ${
                isDespesa ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
                {isDespesa ? 'A Pagar' : 'A Receber'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {fmtData(contrato.data_inicio)} — {fmtData(contrato.data_fim_previsto)}
              </span>
              {contrato.centro_custo && (
                <span className="flex items-center gap-1 text-slate-500">
                  <Briefcase size={9} /> {contrato.centro_custo}
                </span>
              )}
              {contrato.status === 'vigente' && diasRestantes > 0 && (
                <span className={`font-medium ${diasRestantes < 30 ? 'text-red-500' : diasRestantes < 90 ? 'text-amber-500' : 'text-slate-500'}`}>
                  {diasRestantes} dias restantes
                </span>
              )}
            </div>
          </div>
          <button onClick={() => setExpanded(v => !v)} className="text-slate-400 hover:text-slate-600 shrink-0">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={() => nav(`/contratos/detalhe/${contrato.id}`)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
              bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-600
              hover:bg-indigo-100 transition-all"
          >
            <CalendarDays size={11} />
            Ver detalhes
          </button>
          {actions.map(action => {
            const Icon = action.icon
            return (
              <button
                key={action.key}
                onClick={() => { setConfirmAction(action); setMotivo('') }}
                disabled={atualizarContrato.isPending}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                  ${action.bg} border ${action.border} text-[11px] font-semibold ${action.text}
                  ${action.hoverBg} transition-all disabled:opacity-50`}
              >
                <Icon size={11} />
                {action.label}
              </button>
            )
          })}
          {isFinal && (
            <span className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-slate-400 italic">
              <Lock size={11} />
              Contrato finalizado
            </span>
          )}
        </div>

        {/* Confirmation panel */}
        {confirmAction && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 animate-[fadeIn_0.2s_ease]">
            <div className="flex items-center gap-2 mb-2">
              <confirmAction.icon size={14} className={confirmAction.text} />
              <p className="text-xs font-bold text-slate-700">
                Confirmar: {confirmAction.label}
              </p>
            </div>
            {confirmAction.needsMotivo && (
              <UpperTextarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Motivo (obrigatorio)..."
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700
                  placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 mb-2 resize-none"
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={atualizarContrato.isPending || (confirmAction.needsMotivo && !motivo.trim())}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold text-white
                  ${confirmAction.confirmBg} ${confirmAction.confirmHover} shadow-sm
                  transition-all disabled:opacity-50`}
              >
                {atualizarContrato.isPending
                  ? <Loader2 size={12} className="animate-spin" />
                  : <CheckCircle2 size={12} />}
                Confirmar
              </button>
              <button
                onClick={() => { setConfirmAction(null); setMotivo('') }}
                disabled={atualizarContrato.isPending}
                className="px-4 py-2 rounded-xl text-[11px] font-semibold text-slate-500
                  border border-slate-200 hover:bg-slate-100 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detalhes</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <div><span className="text-slate-400">Valor:</span> <span className="font-semibold text-slate-700">{fmt(contrato.valor_total)}</span></div>
              {contrato.valor_aditivos > 0 && (
                <div><span className="text-slate-400">Aditivos:</span> <span className="font-semibold text-blue-600">{fmt(contrato.valor_aditivos)}</span></div>
              )}
              {contrato.valor_medido > 0 && (
                <div><span className="text-slate-400">Medido:</span> <span className="font-semibold text-emerald-600">{fmt(contrato.valor_medido)}</span></div>
              )}
              {contrato.centro_custo && (
                <div><span className="text-slate-400">CC:</span> <span className="font-semibold text-slate-700">{contrato.centro_custo}</span></div>
              )}
              {contrato.indice_reajuste && (
                <div><span className="text-slate-400">Reajuste:</span> <span className="font-semibold text-slate-700">{contrato.indice_reajuste}</span></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Contratos ──────────────────────────────────────────────────────────
function TabContratos() {
  const nav = useNavigate()
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table')
  const [statusFilter, setStatusFilter] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const { data: contratos = [], isLoading } = useContratos(
    (statusFilter || tipoFilter) ? {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(tipoFilter ? { tipo_contrato: tipoFilter } : {}),
    } : undefined
  )

  let filtered = contratos.filter(c =>
    !busca
    || c.numero.toLowerCase().includes(busca.toLowerCase())
    || c.objeto?.toLowerCase().includes(busca.toLowerCase())
    || c.cliente?.nome.toLowerCase().includes(busca.toLowerCase())
    || c.fornecedor?.razao_social?.toLowerCase().includes(busca.toLowerCase())
  )
  if (filtroGrupo) {
    filtered = filtered.filter(c => c.grupo_contrato === filtroGrupo)
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <UpperInput value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar numero, objeto, contraparte..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white
              text-sm text-slate-700 placeholder-slate-400 focus:outline-none
              focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        >
          <option value="">Todos os Status</option>
          <option value="em_negociacao">Em Negociacao</option>
          <option value="assinado">Assinado</option>
          <option value="vigente">Vigente</option>
          <option value="suspenso">Suspenso</option>
          <option value="encerrado">Encerrado</option>
          <option value="rescindido">Rescindido</option>
        </select>

        <select
          value={tipoFilter}
          onChange={e => setTipoFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        >
          <option value="">Todos os Tipos</option>
          <option value="receita">Receita</option>
          <option value="despesa">Despesa</option>
        </select>

        <select
          value={filtroGrupo}
          onChange={e => setFiltroGrupo(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 min-w-[180px]"
        >
          <option value="">Todos os Grupos</option>
          {GRUPO_CONTRATO_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <div className="flex border rounded-lg border-slate-200">
          <button onClick={() => setViewMode('table')}
            className={`p-1.5 transition-all ${viewMode === 'table' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:bg-slate-50'}`}>
            <LayoutList size={14} />
          </button>
          <button onClick={() => setViewMode('cards')}
            className={`p-1.5 transition-all ${viewMode === 'cards' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:bg-slate-50'}`}>
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
            <FileText size={24} className="text-indigo-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhum contrato encontrado</p>
          <button onClick={() => nav('/contratos/solicitacoes')}
            className="mt-3 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all">
            Nova Solicitação
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="space-y-2">
          {filtered.map(c => <ContratoCard key={c.id} contrato={c} onToast={showToast} />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Número</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contraparte</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">Grupo</th>
                  <th className="text-center px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:table-cell">Tipo</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor</th>
                  <th className="text-center px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">Status</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden lg:table-cell">Vencimento</th>
                  <th className="text-center px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(c => {
                  const sc = STATUS_CONTRATO[c.status] ?? STATUS_CONTRATO.em_negociacao
                  const isReceita = c.tipo_contrato === 'receita'
                  const grupoLabel = GRUPO_CONTRATO_LABEL?.[c.grupo_contrato as any] ?? c.grupo_contrato ?? '—'
                  const contraparte = c.fornecedor?.razao_social || c.fornecedor?.nome_fantasia || c.cliente?.nome || (c as any).solicitacao?.contraparte_nome || (c as any).contraparte_nome || '—'
                  return (
                    <tr key={c.id} onClick={() => nav(`/contratos/detalhe/${c.id}`)} className="hover:bg-slate-50/80 transition-colors cursor-pointer">
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-mono font-semibold text-indigo-600 bg-indigo-50 rounded-md px-1.5 py-0.5 whitespace-nowrap">{c.numero}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-xs font-semibold text-slate-700 truncate max-w-[200px]">{contraparte}</p>
                        {c.obra?.nome && <p className="text-[10px] text-slate-400 truncate">{c.obra.nome}</p>}
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 whitespace-nowrap">{grupoLabel}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center hidden md:table-cell">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isReceita ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {isReceita ? 'Receita' : 'Despesa'}
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 text-right ${isReceita ? 'text-emerald-600' : 'text-amber-600'}`}>
                        <span className="text-xs font-bold">{fmt(c.valor_total + (c.valor_aditivos || 0))}</span>
                        {(c as any).valor_mensal && (
                          <p className="text-[9px] text-indigo-500 font-semibold">{fmt((c as any).valor_mensal)}/mês</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                        <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${sc.bg} ${sc.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right hidden lg:table-cell">
                        <span className="text-[11px] text-slate-400">{c.data_fim_previsto ? fmtData(c.data_fim_previsto) : '—'}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={e => { e.stopPropagation(); nav(`/contratos/detalhe/${c.id}`) }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all">
                          <Eye size={11} /> Detalhes
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-400">Nenhum contrato encontrado</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab: Aditivos ───────────────────────────────────────────────────────────
function TabAditivos() {
  const { perfil } = useAuth()
  const [statusFilter, setStatusFilter] = useState('')
  const [busca, setBusca] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const { data: aditivos = [], isLoading } = useAditivos()
  const atualizarAditivo = useAtualizarAditivo()

  const filtered = aditivos.filter(a => {
    if (statusFilter && a.status !== statusFilter) return false
    if (busca) {
      const q = busca.toLowerCase()
      return (
        a.numero_aditivo.toLowerCase().includes(q) ||
        a.descricao.toLowerCase().includes(q) ||
        a.contrato?.numero?.toLowerCase().includes(q) ||
        a.contrato?.objeto?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const handleStatusChange = (id: string, status: StatusAditivo) => {
    const label = status === 'aprovado' ? 'aprovar' : status === 'rejeitado' ? 'rejeitar' : status
    if (!confirm(`Deseja ${label} este aditivo?`)) return
    atualizarAditivo.mutate(
      {
        id, status,
        ...(status === 'aprovado' ? { aprovado_por: perfil?.nome ?? 'Sistema', aprovado_em: new Date().toISOString() } : {}),
      },
      {
        onSuccess: () => { setToast({ type: 'success', msg: `Aditivo ${status === 'aprovado' ? 'aprovado' : 'rejeitado'} com sucesso` }); setTimeout(() => setToast(null), 4000) },
        onError: () => { setToast({ type: 'error', msg: 'Erro ao atualizar aditivo' }); setTimeout(() => setToast(null), 5000) },
      }
    )
  }

  const FILTROS = [
    { label: 'Todos', value: '' }, { label: 'Rascunho', value: 'rascunho' },
    { label: 'Em Aprovação', value: 'em_aprovacao' }, { label: 'Aprovados', value: 'aprovado' },
    { label: 'Rejeitados', value: 'rejeitado' },
  ]

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <UpperInput value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar aditivo, contrato..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
            placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
      </div>

      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
        {FILTROS.map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all
              ${statusFilter === f.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-500 border border-slate-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
            <FileSignature size={24} className="text-indigo-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhum aditivo encontrado</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="px-4 py-3">Contrato</th>
                  <th className="px-4 py-3">Aditivo</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Descricao</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const sc = STATUS_ADITIVO[a.status]
                  const tc = TIPO_ADITIVO[a.tipo]
                  return (
                    <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-slate-800">{a.contrato?.numero ?? '-'}</p>
                        <p className="text-[10px] truncate max-w-[160px] text-slate-400">{a.contrato?.objeto}</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono font-semibold text-slate-700">{a.numero_aditivo}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 ${tc.bg} ${tc.text}`}>
                          {tc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[220px] truncate text-slate-600">{a.descricao}</td>
                      <td className={`px-4 py-3 text-xs font-bold text-right ${a.valor_acrescimo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {fmtFull(a.valor_acrescimo)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${sc.bg} ${sc.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {a.status === 'em_aprovacao' && (
                            <>
                              <button onClick={() => handleStatusChange(a.id, 'aprovado')} disabled={atualizarAditivo.isPending}
                                title="Aprovar" className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-all disabled:opacity-50">
                                <CheckCircle2 size={13} />
                              </button>
                              <button onClick={() => handleStatusChange(a.id, 'rejeitado')} disabled={atualizarAditivo.isPending}
                                title="Rejeitar" className="w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-all disabled:opacity-50">
                                <XCircle size={13} />
                              </button>
                            </>
                          )}
                          {a.status === 'rascunho' && (
                            <button onClick={() => handleStatusChange(a.id, 'em_aprovacao')} disabled={atualizarAditivo.isPending}
                              className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all disabled:opacity-50">
                              Enviar
                            </button>
                          )}
                          {(a.status === 'aprovado' || a.status === 'rejeitado') && (
                            <span className="text-[10px] text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Reajustes ──────────────────────────────────────────────────────────
function TabReajustes() {
  const [busca, setBusca] = useState('')
  const { data: reajustes = [], isLoading } = useReajustes()

  const filtered = reajustes.filter(r => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return (
      r.indice_nome.toLowerCase().includes(q) ||
      r.observacoes?.toLowerCase().includes(q) ||
      r.contrato?.numero?.toLowerCase().includes(q) ||
      r.contrato?.objeto?.toLowerCase().includes(q)
    )
  })

  const totalDelta = filtered.reduce((s, r) => s + (r.valor_depois - r.valor_antes), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Total</p>
          <p className="text-lg font-extrabold text-slate-800 mt-1">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest">Impacto</p>
          <p className={`text-lg font-extrabold mt-1 ${totalDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {fmtFull(totalDelta)}
          </p>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <UpperInput value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar índice, contrato..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
            placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
            <TrendingUp size={24} className="text-indigo-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhum reajuste encontrado</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="px-4 py-3">Contrato</th>
                  <th className="px-4 py-3">Data Base</th>
                  <th className="px-4 py-3">Indice</th>
                  <th className="px-4 py-3 text-right">Percentual</th>
                  <th className="px-4 py-3 text-right">Antes</th>
                  <th className="px-4 py-3 text-right">Depois</th>
                  <th className="px-4 py-3 text-right">Diferenca</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const delta = r.valor_depois - r.valor_antes
                  const isPositive = r.percentual_aplicado >= 0
                  return (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-slate-800">{r.contrato?.numero ?? '-'}</p>
                        <p className="text-[10px] truncate max-w-[140px] text-slate-400">{r.contrato?.objeto}</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">{fmtData(r.data_base)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700">
                          {r.indice_nome}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          {fmtPct(r.percentual_aplicado)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-right text-slate-500">{fmtFull(r.valor_antes)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-right text-slate-800">{fmtFull(r.valor_depois)}</td>
                      <td className={`px-4 py-3 text-xs font-bold text-right ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {fmtFull(delta)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Vencimentos ────────────────────────────────────────────────────────
function TabVencimentos() {
  const [faixa, setFaixa] = useState<'' | '30' | '60' | '90' | 'vencido'>('')
  const { data: contratos = [], isLoading } = useContratos({ status: 'vigente' })

  const hoje = Date.now()

  const items = contratos.map(c => {
    const fim = new Date(c.data_fim_previsto).getTime()
    const dias = Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24))
    const contraparte = c.tipo_contrato === 'despesa'
      ? c.fornecedor?.razao_social ?? c.fornecedor?.nome_fantasia ?? (c as any).solicitacao?.contraparte_nome ?? (c as any).contraparte_nome ?? '—'
      : c.cliente?.nome ?? (c as any).solicitacao?.contraparte_nome ?? (c as any).contraparte_nome ?? '—'
    return { ...c, dias, contraparte }
  }).sort((a, b) => a.dias - b.dias)

  const filtered = items.filter(i => {
    if (faixa === 'vencido') return i.dias < 0
    if (faixa === '30') return i.dias >= 0 && i.dias <= 30
    if (faixa === '60') return i.dias >= 0 && i.dias <= 60
    if (faixa === '90') return i.dias >= 0 && i.dias <= 90
    return true
  })

  const vencidos = items.filter(i => i.dias < 0).length
  const ate30 = items.filter(i => i.dias >= 0 && i.dias <= 30).length
  const ate60 = items.filter(i => i.dias > 30 && i.dias <= 60).length
  const ate90 = items.filter(i => i.dias > 60 && i.dias <= 90).length

  const FAIXAS = [
    { label: 'Todos', value: '' as const },
    { label: `Vencidos (${vencidos})`, value: 'vencido' as const },
    { label: `Ate 30d (${ate30})`, value: '30' as const },
    { label: `Ate 60d (${ate60 + ate30})`, value: '60' as const },
    { label: `Ate 90d (${ate90 + ate60 + ate30})`, value: '90' as const },
  ]

  const diasColor = (d: number) =>
    d < 0 ? 'text-red-600 bg-red-50' : d <= 30 ? 'text-amber-700 bg-amber-50' : d <= 60 ? 'text-orange-600 bg-orange-50' : 'text-slate-600 bg-slate-100'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-red-50 rounded-2xl border border-red-200 p-3 text-center">
          <p className="text-[10px] font-bold text-red-500 uppercase">Vencidos</p>
          <p className="text-xl font-extrabold text-red-600 mt-1">{vencidos}</p>
        </div>
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-3 text-center">
          <p className="text-[10px] font-bold text-amber-500 uppercase">30 dias</p>
          <p className="text-xl font-extrabold text-amber-700 mt-1">{ate30}</p>
        </div>
        <div className="bg-orange-50 rounded-2xl border border-orange-200 p-3 text-center">
          <p className="text-[10px] font-bold text-orange-500 uppercase">31-60 dias</p>
          <p className="text-xl font-extrabold text-orange-600 mt-1">{ate60}</p>
        </div>
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase">61-90 dias</p>
          <p className="text-xl font-extrabold text-slate-700 mt-1">{ate90}</p>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
        {FAIXAS.map(f => (
          <button key={f.value} onClick={() => setFaixa(f.value)}
            className={`px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all
              ${faixa === f.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-500 border border-slate-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
            <CalendarClock size={24} className="text-indigo-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhum contrato nessa faixa</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${diasColor(c.dias)}`}>
                  {c.dias < 0 ? <AlertTriangle size={16} /> : <Clock size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800 truncate">{c.contraparte}</p>
                    <span className={`text-xs font-extrabold shrink-0 rounded-full px-2.5 py-0.5 ${diasColor(c.dias)}`}>
                      {c.dias < 0 ? `${Math.abs(c.dias)}d vencido` : `${c.dias}d restantes`}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                    <span className="bg-slate-100 text-slate-600 font-mono font-semibold rounded-full px-2 py-0.5">{c.numero}</span>
                    <span className="text-slate-400">Vence: {fmtData(c.data_fim_previsto)}</span>
                    {c.objeto && <span className="text-slate-400 truncate max-w-[200px]">{c.objeto}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab: Recebiveis (A Receber) ──────────────────────────────────────────────
function TabRecebiveis() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data: parcelas = [], isLoading } = useParcelas()

  // Only receita parcels
  const recebiveis = parcelas.filter(p => p.contrato?.tipo_contrato === 'receita')

  const filtered = recebiveis.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false
    return true
  })

  const totalEmAberto = recebiveis
    .filter(p => p.status !== 'pago' && p.status !== 'cancelado')
    .reduce((s, p) => s + p.valor, 0)
  const totalRecebido = recebiveis
    .filter(p => p.status === 'pago')
    .reduce((s, p) => s + p.valor, 0)
  const pendentes = recebiveis.filter(p => p.status === 'pendente' || p.status === 'liberado').length
  const atrasadas = recebiveis.filter(p =>
    p.status !== 'pago' && p.status !== 'cancelado' &&
    new Date(p.data_vencimento).getTime() < Date.now()
  ).length

  const STATUS_PARCELA: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    previsto:  { label: 'Previsto',  dot: 'bg-slate-400',   bg: 'bg-slate-100',   text: 'text-slate-600' },
    pendente:  { label: 'Pendente',  dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700' },
    liberado:  { label: 'Liberado',  dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700' },
    pago:      { label: 'Recebido',  dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
    cancelado: { label: 'Cancelado', dot: 'bg-red-400',     bg: 'bg-red-50',      text: 'text-red-600' },
  }

  const FILTROS = [
    { label: 'Todos', value: '' },
    { label: 'Previsto', value: 'previsto' },
    { label: 'Pendente', value: 'pendente' },
    { label: 'Liberado', value: 'liberado' },
    { label: 'Recebido', value: 'pago' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-3 text-center">
          <p className="text-[10px] font-bold text-emerald-600 uppercase">Em Aberto</p>
          <p className="text-lg font-extrabold text-emerald-700 mt-1">{fmt(totalEmAberto)}</p>
        </div>
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-3 text-center">
          <p className="text-[10px] font-bold text-blue-600 uppercase">Recebido</p>
          <p className="text-lg font-extrabold text-blue-700 mt-1">{fmt(totalRecebido)}</p>
        </div>
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-3 text-center">
          <p className="text-[10px] font-bold text-amber-600 uppercase">Pendentes</p>
          <p className="text-xl font-extrabold text-amber-700 mt-1">{pendentes}</p>
        </div>
        <div className="bg-red-50 rounded-2xl border border-red-200 p-3 text-center">
          <p className="text-[10px] font-bold text-red-500 uppercase">Atrasadas</p>
          <p className="text-xl font-extrabold text-red-600 mt-1">{atrasadas}</p>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
        {FILTROS.map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all
              ${statusFilter === f.value
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-500 border border-slate-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
            <Banknote size={24} className="text-emerald-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhum recebivel encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const sc = STATUS_PARCELA[p.status] ?? STATUS_PARCELA.previsto
            const vencido = p.status !== 'pago' && p.status !== 'cancelado' && new Date(p.data_vencimento).getTime() < Date.now()
            return (
              <div key={p.id} className={`bg-white rounded-2xl border shadow-sm p-4 hover:shadow-md transition-all ${vencido ? 'border-red-200' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${vencido ? 'bg-red-50' : 'bg-emerald-50'}`}>
                    {vencido ? <AlertTriangle size={16} className="text-red-500" /> : <TrendingUp size={16} className="text-emerald-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate">{p.contrato?.objeto ?? 'Parcela'}</p>
                      <p className="text-sm font-extrabold text-emerald-600 shrink-0">{fmtFull(p.valor)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                      <span className={`inline-flex items-center gap-1 rounded-full font-semibold px-2 py-0.5 ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                      </span>
                      <span className="bg-slate-100 text-slate-600 font-mono font-semibold rounded-full px-2 py-0.5">
                        {p.contrato?.numero} — #{p.numero}
                      </span>
                      <span className="text-slate-400">Vence: {fmtData(p.data_vencimento)}</span>
                      {vencido && <span className="text-red-500 font-bold">VENCIDO</span>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab: Provisionado (A Pagar) ──────────────────────────────────────────────
function TabProvisionado() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data: parcelas = [], isLoading } = useParcelas()

  // Only despesa parcels
  const compromissos = parcelas.filter(p => p.contrato?.tipo_contrato === 'despesa')

  const filtered = compromissos.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false
    return true
  })

  const totalEmAberto = compromissos
    .filter(p => p.status !== 'pago' && p.status !== 'cancelado')
    .reduce((s, p) => s + p.valor, 0)
  const totalPago = compromissos
    .filter(p => p.status === 'pago')
    .reduce((s, p) => s + p.valor, 0)
  const pendentes = compromissos.filter(p => p.status === 'pendente' || p.status === 'liberado').length
  const atrasadas = compromissos.filter(p =>
    p.status !== 'pago' && p.status !== 'cancelado' &&
    new Date(p.data_vencimento).getTime() < Date.now()
  ).length

  const STATUS_PARCELA: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    previsto:  { label: 'Previsto',  dot: 'bg-slate-400',   bg: 'bg-slate-100',   text: 'text-slate-600' },
    pendente:  { label: 'Pendente',  dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700' },
    liberado:  { label: 'Liberado',  dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700' },
    pago:      { label: 'Pago',      dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
    cancelado: { label: 'Cancelado', dot: 'bg-red-400',     bg: 'bg-red-50',      text: 'text-red-600' },
  }

  const FILTROS = [
    { label: 'Todos', value: '' },
    { label: 'Previsto', value: 'previsto' },
    { label: 'Pendente', value: 'pendente' },
    { label: 'Liberado', value: 'liberado' },
    { label: 'Pago', value: 'pago' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-3 text-center">
          <p className="text-[10px] font-bold text-amber-600 uppercase">Compromissado</p>
          <p className="text-lg font-extrabold text-amber-700 mt-1">{fmt(totalEmAberto)}</p>
        </div>
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-3 text-center">
          <p className="text-[10px] font-bold text-emerald-600 uppercase">Pago</p>
          <p className="text-lg font-extrabold text-emerald-700 mt-1">{fmt(totalPago)}</p>
        </div>
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-3 text-center">
          <p className="text-[10px] font-bold text-blue-600 uppercase">Pendentes</p>
          <p className="text-xl font-extrabold text-blue-700 mt-1">{pendentes}</p>
        </div>
        <div className="bg-red-50 rounded-2xl border border-red-200 p-3 text-center">
          <p className="text-[10px] font-bold text-red-500 uppercase">Atrasados</p>
          <p className="text-xl font-extrabold text-red-600 mt-1">{atrasadas}</p>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
        {FILTROS.map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all
              ${statusFilter === f.value
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white text-slate-500 border border-slate-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
            <CreditCard size={24} className="text-amber-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhum compromisso encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const sc = STATUS_PARCELA[p.status] ?? STATUS_PARCELA.previsto
            const vencido = p.status !== 'pago' && p.status !== 'cancelado' && new Date(p.data_vencimento).getTime() < Date.now()
            return (
              <div key={p.id} className={`bg-white rounded-2xl border shadow-sm p-4 hover:shadow-md transition-all ${vencido ? 'border-red-200' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${vencido ? 'bg-red-50' : 'bg-amber-50'}`}>
                    {vencido ? <AlertTriangle size={16} className="text-red-500" /> : <TrendingDown size={16} className="text-amber-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate">{p.contrato?.objeto ?? 'Parcela'}</p>
                      <p className="text-sm font-extrabold text-amber-600 shrink-0">{fmtFull(p.valor)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                      <span className={`inline-flex items-center gap-1 rounded-full font-semibold px-2 py-0.5 ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                      </span>
                      <span className="bg-slate-100 text-slate-600 font-mono font-semibold rounded-full px-2 py-0.5">
                        {p.contrato?.numero} — #{p.numero}
                      </span>
                      <span className="text-slate-400">Vence: {fmtData(p.data_vencimento)}</span>
                      {vencido && <span className="text-red-500 font-bold">VENCIDO</span>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab: Medições ───────────────────────────────────────────────────────────
const STATUS_MEDICAO: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  rascunho:     { label: 'Rascunho',      dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-600' },
  em_aprovacao: { label: 'Em Aprovação',  dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700' },
  aprovado:     { label: 'Aprovado',      dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  rejeitado:    { label: 'Rejeitado',     dot: 'bg-red-400',     bg: 'bg-red-50',      text: 'text-red-600' },
  faturado:     { label: 'No Financeiro', dot: 'bg-blue-500',    bg: 'bg-blue-50',     text: 'text-blue-700' },
}

// ── Nova Medição modal ──────────────────────────────────────────────────────
function NovaMedicaoModal({
  open, onClose, contratos, medicoes, onToast,
}: {
  open: boolean
  onClose: () => void
  contratos: Contrato[]
  medicoes: ContratoMedicao[]
  onToast: (type: 'success' | 'error', msg: string) => void
}) {
  const criar = useCriarMedicao()
  const today = new Date().toISOString().slice(0, 10)
  const [contratoId, setContratoId] = useState('')
  const [numeroBm, setNumeroBm] = useState('')
  const [bmTouched, setBmTouched] = useState(false)
  const [periodoInicio, setPeriodoInicio] = useState(today)
  const [periodoFim, setPeriodoFim] = useState(today)
  const [valorMedido, setValorMedido] = useState('')
  const [valorRetencao, setValorRetencao] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const contratosElegiveis = useMemo(
    () => contratos.filter(c => c.status === 'vigente' || c.status === 'assinado'),
    [contratos]
  )

  // Sugere próximo BM (BM-00X) quando o contrato é escolhido e o usuário ainda não digitou.
  const sugerirProximoBm = (cid: string) => {
    if (!cid) return ''
    const n = medicoes.filter(m => m.contrato_id === cid).length + 1
    return `BM-${String(n).padStart(3, '0')}`
  }

  const handleContratoChange = (cid: string) => {
    setContratoId(cid)
    if (!bmTouched) setNumeroBm(sugerirProximoBm(cid))
  }

  const medido = parseFloat(valorMedido.replace(',', '.')) || 0
  const retencao = parseFloat(valorRetencao.replace(',', '.')) || 0
  const liquido = Math.max(medido - retencao, 0)

  const reset = () => {
    setContratoId(''); setNumeroBm(''); setBmTouched(false)
    setPeriodoInicio(today); setPeriodoFim(today)
    setValorMedido(''); setValorRetencao(''); setObservacoes('')
  }

  const handleSave = () => {
    if (!contratoId) { onToast('error', 'Selecione o contrato'); return }
    if (!numeroBm.trim()) { onToast('error', 'Informe o número do BM'); return }
    if (!periodoInicio || !periodoFim) { onToast('error', 'Informe o período (início e fim)'); return }
    if (periodoFim < periodoInicio) { onToast('error', 'O fim do período não pode ser antes do início'); return }
    if (medido <= 0) { onToast('error', 'Valor medido deve ser maior que zero'); return }
    if (retencao > medido) { onToast('error', 'Retenção não pode ser maior que o valor medido'); return }

    criar.mutate(
      {
        contrato_id: contratoId,
        numero_bm: numeroBm.trim().toUpperCase(),
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        valor_medido: medido,
        valor_retencao: retencao,
        valor_liquido: liquido,
        status: 'rascunho',
        observacoes: observacoes.trim() || undefined,
      } as any,
      {
        onSuccess: () => {
          onToast('success', 'Medição criada com sucesso')
          reset(); onClose()
        },
        onError: (err: any) => onToast('error', `Erro ao criar medição: ${err?.message ?? 'desconhecido'}`),
      }
    )
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Receipt size={16} className="text-fuchsia-600" />
            <h2 className="text-sm font-bold text-slate-800">Nova Medição de Contrato</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contrato</label>
            <select
              value={contratoId}
              onChange={e => handleContratoChange(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
            >
              <option value="">Selecione um contrato vigente</option>
              {contratosElegiveis.map(c => {
                const cp = c.fornecedor?.razao_social || c.fornecedor?.nome_fantasia || c.cliente?.nome || '—'
                return (
                  <option key={c.id} value={c.id}>{c.numero} — {cp}</option>
                )
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Número BM</label>
              <UpperInput
                value={numeroBm}
                onChange={e => { setNumeroBm(e.target.value); setBmTouched(true) }}
                placeholder="BM-001"
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Início</label>
                <input
                  type="date"
                  value={periodoInicio}
                  onChange={e => setPeriodoInicio(e.target.value)}
                  className="mt-1 w-full px-2 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fim</label>
                <input
                  type="date"
                  value={periodoFim}
                  onChange={e => setPeriodoFim(e.target.value)}
                  className="mt-1 w-full px-2 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Valor Medido</label>
              <input
                inputMode="decimal"
                value={valorMedido}
                onChange={e => setValorMedido(e.target.value)}
                placeholder="0,00"
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Retenção</label>
              <input
                inputMode="decimal"
                value={valorRetencao}
                onChange={e => setValorRetencao(e.target.value)}
                placeholder="0,00"
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Líquido</label>
              <div className="mt-1 px-3 py-2 rounded-xl border border-fuchsia-200 bg-fuchsia-50 text-sm font-bold text-fuchsia-700">
                {fmtFull(liquido)}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Observações</label>
            <UpperTextarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Detalhes da medição..."
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            disabled={criar.isPending}
            className="px-4 py-2 rounded-xl text-[11px] font-semibold text-slate-600 border border-slate-200 hover:bg-white transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={criar.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold text-white bg-fuchsia-600 hover:bg-fuchsia-700 shadow-sm transition-all disabled:opacity-50"
          >
            {criar.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Criar Medição
          </button>
        </div>
      </div>
    </div>
  )
}

function TabMedicoes() {
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [novaMedicaoOpen, setNovaMedicaoOpen] = useState(false)

  const { data: medicoes = [], isLoading } = useMedicoes()
  const { data: contratos = [] } = useContratos()
  const faturar = useFaturarMedicao()

  const contratoMap = new Map(contratos.map(c => [c.id, c]))

  const filtered = medicoes.filter(m => {
    if (statusFilter && m.status !== statusFilter) return false
    if (busca) {
      const q = busca.toLowerCase()
      return (
        m.numero_bm.toLowerCase().includes(q) ||
        m.contrato?.numero?.toLowerCase().includes(q) ||
        m.contrato?.objeto?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const aprovadas       = medicoes.filter(m => m.status === 'aprovado').length
  const faturadas       = medicoes.filter(m => m.status === 'faturado').length
  const totalAFaturar   = medicoes.filter(m => m.status === 'aprovado').reduce((s, m) => s + m.valor_liquido, 0)
  const totalFaturado   = medicoes.filter(m => m.status === 'faturado').reduce((s, m) => s + m.valor_liquido, 0)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const handleEnviar = (medicaoId: string) => {
    if (!confirm('Enviar esta medição ao Financeiro?\n\nIsso cria automaticamente uma conta a pagar/receber a partir do valor líquido e do prazo do contrato.')) return
    faturar.mutate(medicaoId, {
      onSuccess: (res) => {
        if (res.ok) {
          const destino = res.tipo_contrato === 'receita' ? 'Contas a Receber' : 'Contas a Pagar'
          showToast('success', `Enviada ao ${destino} • Vence ${fmtData(res.data_vencimento!)}`)
        } else {
          showToast('error', `Não enviada: ${res.motivo ?? 'desconhecido'}`)
        }
      },
      onError: () => showToast('error', 'Erro ao enviar medição'),
    })
  }

  const FILTROS = [
    { label: 'Todas',         value: '' },
    { label: 'Em Aprovação',  value: 'em_aprovacao' },
    { label: 'Aprovadas',     value: 'aprovado' },
    { label: 'No Financeiro', value: 'faturado' },
    { label: 'Rejeitadas',    value: 'rejeitado' },
    { label: 'Rascunho',      value: 'rascunho' },
  ]

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-3 text-center">
          <p className="text-[10px] font-bold text-emerald-600 uppercase">Aprovadas</p>
          <p className="text-xl font-extrabold text-emerald-700 mt-1">{aprovadas}</p>
        </div>
        <div className="bg-fuchsia-50 rounded-2xl border border-fuchsia-200 p-3 text-center">
          <p className="text-[10px] font-bold text-fuchsia-600 uppercase">A Faturar</p>
          <p className="text-lg font-extrabold text-fuchsia-700 mt-1">{fmt(totalAFaturar)}</p>
        </div>
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-3 text-center">
          <p className="text-[10px] font-bold text-blue-600 uppercase">No Financeiro</p>
          <p className="text-xl font-extrabold text-blue-700 mt-1">{faturadas}</p>
        </div>
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3 text-center">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Total Enviado</p>
          <p className="text-lg font-extrabold text-slate-700 mt-1">{fmt(totalFaturado)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <UpperInput value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar BM, contrato..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
              placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30" />
        </div>
        <button
          onClick={() => setNovaMedicaoOpen(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-fuchsia-600 text-white
            text-xs font-bold hover:bg-fuchsia-700 transition-all shadow-sm whitespace-nowrap"
        >
          <Plus size={14} />
          Nova Medição de Contrato
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
        {FILTROS.map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all
              ${statusFilter === f.value
                ? 'bg-fuchsia-600 text-white shadow-sm'
                : 'bg-white text-slate-500 border border-slate-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <NovaMedicaoModal
        open={novaMedicaoOpen}
        onClose={() => setNovaMedicaoOpen(false)}
        contratos={contratos}
        medicoes={medicoes}
        onToast={showToast}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-fuchsia-50 flex items-center justify-center mx-auto mb-3">
            <Receipt size={24} className="text-fuchsia-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhuma medição encontrada</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="px-4 py-3">Contrato</th>
                  <th className="px-4 py-3">BM</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3 text-center">Tipo</th>
                  <th className="px-4 py-3 text-right">Valor Líquido</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const sc = STATUS_MEDICAO[m.status] ?? STATUS_MEDICAO.rascunho
                  const c  = contratoMap.get(m.contrato_id)
                  const isReceita = c?.tipo_contrato === 'receita'
                  const podeEnviar = m.status === 'aprovado'
                  const jaEnviada  = m.status === 'faturado'
                  return (
                    <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-slate-800">{m.contrato?.numero ?? '-'}</p>
                        <p className="text-[10px] truncate max-w-[180px] text-slate-400">{m.contrato?.objeto}</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono font-semibold text-slate-700">{m.numero_bm}</td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">
                        {fmtData(m.periodo_inicio)} — {fmtData(m.periodo_fim)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c ? (
                          <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            isReceita ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {isReceita ? 'Receita' : 'Despesa'}
                          </span>
                        ) : <span className="text-[10px] text-slate-400">—</span>}
                      </td>
                      <td className={`px-4 py-3 text-xs font-bold text-right ${isReceita ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {fmtFull(m.valor_liquido)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${sc.bg} ${sc.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {podeEnviar && (
                          <button
                            onClick={() => handleEnviar(m.id)}
                            disabled={faturar.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                              bg-fuchsia-50 border border-fuchsia-200 text-[10px] font-bold text-fuchsia-700
                              hover:bg-fuchsia-100 transition-all disabled:opacity-50"
                            title="Cria CP/CR previsto a partir desta medição"
                          >
                            {faturar.isPending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                            Enviar ao Financeiro
                          </button>
                        )}
                        {jaEnviada && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700">
                            <CheckCircle2 size={11} /> Enviada
                          </span>
                        )}
                        {!podeEnviar && !jaEnviada && (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function GestaoContratos() {
  const { isDark } = useTheme()
  const [tab, setTab] = useState<Tab>('contratos')
  const { data: contratos = [] } = useContratos()
  const { data: aditivos = [] } = useAditivos()
  const { data: reajustes = [] } = useReajustes()
  const { data: medicoes = [] } = useMedicoes()
  const { data: parcelas = [] } = useParcelas()

  const counts: Record<Tab, number> = useMemo(() => ({
    contratos: contratos.length,
    medicoes: medicoes.length,
    recebiveis: parcelas.filter(p => p.contrato?.tipo_contrato === 'receita').length,
    provisionado: parcelas.filter(p => p.contrato?.tipo_contrato === 'despesa').length,
    aditivos: aditivos.length,
    reajustes: reajustes.length,
    vencimentos: contratos.filter(c => c.status === 'vigente').length,
  }), [contratos, medicoes, parcelas, aditivos, reajustes])

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className={`text-lg font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <Briefcase size={18} className="text-indigo-500" /> Gestão de Contratos
        </h1>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Contratos ativos, aditivos, reajustes e vencimentos
        </p>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 p-1 pb-2 border-b overflow-x-auto hide-scrollbar ${
        isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'
      }`}>
        {TABS.map(t => {
          const count = counts[t.key] ?? 0
          const isActive = tab === t.key
          const Icon = t.icon
          const a = isDark ? TAB_ACCENT_DARK[t.key] : TAB_ACCENT[t.key]
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                isActive
                  ? `${a.bgActive} ${a.textActive} ${a.border} font-bold shadow-sm`
                  : `${a.bg} ${a.text} font-medium border-transparent ${isDark ? '' : 'hover:bg-white hover:shadow-sm'}`
              }`}>
              <Icon size={15} className="shrink-0" /> {t.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 ${
                  isActive ? a.badge : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'
                }`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="p-4 min-h-[300px]">
        {tab === 'contratos' && <TabContratos />}
        {tab === 'medicoes' && <TabMedicoes />}
        {tab === 'recebiveis' && <TabRecebiveis />}
        {tab === 'provisionado' && <TabProvisionado />}
        {tab === 'aditivos' && <TabAditivos />}
        {tab === 'reajustes' && <TabReajustes />}
        {tab === 'vencimentos' && <TabVencimentos />}
      </div>
    </div>
  )
}
