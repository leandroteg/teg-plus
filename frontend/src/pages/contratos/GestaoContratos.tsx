import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Briefcase, Search, FileText, FileSignature, TrendingUp,
  TrendingDown, Calendar, ChevronDown, ChevronUp,
  CalendarDays, CheckCircle2, XCircle, AlertTriangle, ArrowUpRight,
  ArrowDownRight, Clock, Banknote, CreditCard,
  Pause, RotateCcw, Lock, AlertOctagon, Loader2, Play, Users,
  LayoutList, LayoutGrid, Eye, Receipt, Send, Plus, X,
  Paperclip, ExternalLink, Upload,
} from 'lucide-react'
import { useContratos, useAditivos, useAtualizarAditivo, useAtualizarContrato, useReajustes, useParcelas, useMedicoes, useFaturarMedicao, useCriarMedicao, useAtualizarMedicao, useUploadMedicaoArquivo } from '../../hooks/useContratos'
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

// ── Seletor de período (mês/ano) — mesmo visual dos painéis ──────────────────
function ymHoje() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function ymMais(meses: number) { const d = new Date(); d.setMonth(d.getMonth() + meses); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function diffMeses(a: string, b: string) { const [ay, am] = a.split('-').map(Number), [by, bm] = b.split('-').map(Number); return (by - ay) * 12 + (bm - am) }

// Contrato agregado "Equipe PJ": os valores individuais são SIGILOSOS.
// O bloco aparece na lista (total), mas o detalhe só abre para admin/supervisão de Contratos.
const isEquipePJ = (c: { grupo_contrato?: string | null }) => (c?.grupo_contrato ?? '') === 'equipe_pj'
const MESES_OPT: Array<[string, string]> = [
  ['01', 'Jan'], ['02', 'Fev'], ['03', 'Mar'], ['04', 'Abr'], ['05', 'Mai'], ['06', 'Jun'],
  ['07', 'Jul'], ['08', 'Ago'], ['09', 'Set'], ['10', 'Out'], ['11', 'Nov'], ['12', 'Dez'],
]
function PeriodoSelect({ value, onChange, isDark }: { value: string; onChange: (v: string) => void; isDark: boolean }) {
  const [y, m] = value.split('-')
  const anoAtual = new Date().getFullYear()
  const anos: number[] = []; for (let a = 2021; a <= anoAtual + 4; a++) anos.push(a)
  const cls = `appearance-none rounded-lg pl-2 pr-2 py-1 border text-xs font-semibold cursor-pointer ${isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`
  return (
    <span className="inline-flex items-center gap-1">
      <select value={m} onChange={e => onChange(`${y}-${e.target.value}`)} className={cls} aria-label="Mês">{MESES_OPT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <select value={y} onChange={e => onChange(`${e.target.value}-${m}`)} className={cls} aria-label="Ano">{anos.map(a => <option key={a} value={a}>{a}</option>)}</select>
    </span>
  )
}

// ── Tabs ────────────────────────────────────────────────────────────────────
type Tab = 'contratos' | 'medicoes' | 'aditivos' | 'recebiveis' | 'provisionado'

const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: 'contratos',    label: 'Contratos',    icon: FileText },
  { key: 'medicoes',     label: 'Medições',     icon: Receipt },
  { key: 'recebiveis',   label: 'Recebíveis',   icon: Banknote },
  { key: 'provisionado', label: 'Provisionado', icon: CreditCard },
  { key: 'aditivos',     label: 'Aditivos e Reajustes', icon: FileSignature },
]

type AccentSet = { bg: string; bgActive: string; text: string; textActive: string; dot: string; badge: string; border: string }

const TAB_ACCENT: Record<Tab, AccentSet> = {
  contratos:    { bg:'bg-indigo-50',  bgActive:'bg-indigo-100',  text:'text-indigo-500',  textActive:'text-indigo-800',  dot:'bg-indigo-500',  badge:'bg-indigo-200/80 text-indigo-700',  border:'border-indigo-200' },
  medicoes:     { bg:'bg-fuchsia-50', bgActive:'bg-fuchsia-100', text:'text-fuchsia-500', textActive:'text-fuchsia-800', dot:'bg-fuchsia-500', badge:'bg-fuchsia-200/80 text-fuchsia-700', border:'border-fuchsia-200' },
  recebiveis:   { bg:'bg-emerald-50', bgActive:'bg-emerald-100', text:'text-emerald-500', textActive:'text-emerald-800', dot:'bg-emerald-500', badge:'bg-emerald-200/80 text-emerald-700', border:'border-emerald-200' },
  provisionado: { bg:'bg-amber-50',   bgActive:'bg-amber-100',   text:'text-amber-500',   textActive:'text-amber-800',   dot:'bg-amber-500',   badge:'bg-amber-200/80 text-amber-700',   border:'border-amber-200' },
  aditivos:     { bg:'bg-violet-50',  bgActive:'bg-violet-100',  text:'text-violet-500',  textActive:'text-violet-800',  dot:'bg-violet-500',  badge:'bg-violet-200/80 text-violet-700',  border:'border-violet-200' },
}

const TAB_ACCENT_DARK: Record<Tab, AccentSet> = {
  contratos:    { bg:'bg-indigo-500/5',  bgActive:'bg-indigo-500/15',  text:'text-indigo-400',  textActive:'text-indigo-200',  dot:'bg-indigo-400',  badge:'bg-indigo-500/15 text-indigo-300',  border:'border-indigo-500/20' },
  medicoes:     { bg:'bg-fuchsia-500/5', bgActive:'bg-fuchsia-500/15', text:'text-fuchsia-400', textActive:'text-fuchsia-200', dot:'bg-fuchsia-400', badge:'bg-fuchsia-500/15 text-fuchsia-300', border:'border-fuchsia-500/20' },
  recebiveis:   { bg:'bg-emerald-500/5', bgActive:'bg-emerald-500/15', text:'text-emerald-400', textActive:'text-emerald-200', dot:'bg-emerald-400', badge:'bg-emerald-500/15 text-emerald-300', border:'border-emerald-500/20' },
  provisionado: { bg:'bg-amber-500/5',   bgActive:'bg-amber-500/15',   text:'text-amber-400',   textActive:'text-amber-200',   dot:'bg-amber-400',   badge:'bg-amber-500/15 text-amber-300',   border:'border-amber-500/20' },
  aditivos:     { bg:'bg-violet-500/5',  bgActive:'bg-violet-500/15',  text:'text-violet-400',  textActive:'text-violet-200',  dot:'bg-violet-400',  badge:'bg-violet-500/15 text-violet-300',  border:'border-violet-500/20' },
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
  const { atLeast, hasSetorPapel, perfil } = useAuth()
  const canPJ = perfil?.role === 'administrador' || hasSetorPapel('contratos', ['supervisor', 'diretor', 'ceo'])
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
          {isEquipePJ(contrato) && !canPJ ? (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-400">
              <Lock size={11} /> Sigiloso
            </span>
          ) : (
            <button
              onClick={() => nav(isEquipePJ(contrato) ? '/contratos/equipe-pj' : `/contratos/detalhe/${contrato.id}`)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-600
                hover:bg-indigo-100 transition-all"
            >
              <CalendarDays size={11} />
              Ver detalhes
            </button>
          )}
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
  const { hasSetorPapel, perfil } = useAuth()
  const canPJ = perfil?.role === 'administrador' || hasSetorPapel('contratos', ['supervisor', 'diretor', 'ceo'])
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table')
  const [statusFilter, setStatusFilter] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState<string>('')
  const [vencFilter, setVencFilter] = useState('')   // absorve a antiga aba Vencimentos
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
  if (vencFilter) {
    const hoje = Date.now()
    const dias = (c: Contrato) => Math.ceil((new Date(c.data_fim_previsto).getTime() - hoje) / 86400000)
    filtered = filtered
      .filter(c => c.status === 'vigente')
      .filter(c => vencFilter === 'vencido' ? dias(c) < 0 : dias(c) >= 0 && dias(c) <= Number(vencFilter))
      .sort((a, b) => dias(a) - dias(b))
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

        <select
          value={vencFilter}
          onChange={e => setVencFilter(e.target.value)}
          className={`px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
            vencFilter ? 'border-red-200 bg-red-50 text-red-700 font-semibold' : 'border-slate-200 bg-white text-slate-600'}`}
        >
          <option value="">Vencimento</option>
          <option value="vencido">Vencidos</option>
          <option value="30">Vence em até 30d</option>
          <option value="60">Vence em até 60d</option>
          <option value="90">Vence em até 90d</option>
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
                    <tr key={c.id}
                      onClick={() => { if (isEquipePJ(c) && !canPJ) return; nav(isEquipePJ(c) ? '/contratos/equipe-pj' : `/contratos/detalhe/${c.id}`) }}
                      className={`hover:bg-slate-50/80 transition-colors ${isEquipePJ(c) && !canPJ ? 'cursor-default' : 'cursor-pointer'}`}>
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
                        {isEquipePJ(c) && !canPJ ? (
                          <span title="Valores individuais sob sigilo — acesso restrito à supervisão de Contratos"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-100">
                            <Lock size={11} /> Sigiloso
                          </span>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); nav(isEquipePJ(c) ? '/contratos/equipe-pj' : `/contratos/detalhe/${c.id}`) }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all">
                            <Eye size={11} /> Detalhes
                          </button>
                        )}
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
function TabAditivosReajustes() {
  const { perfil } = useAuth()
  const [statusFilter, setStatusFilter] = useState('')
  const [busca, setBusca] = useState('')
  const [view, setView] = useState<'table' | 'card'>('table')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const { data: aditivos = [], isLoading: l1 } = useAditivos()
  const { data: reajustes = [], isLoading: l2 } = useReajustes()
  const isLoading = l1 || l2
  const atualizarAditivo = useAtualizarAditivo()

  // Linha unificada (mesmo padrão da tela Aditivos & Renovações de Locações):
  // aditivos e reajustes continuam em tabelas separadas; o merge é só visual.
  const linhas = [
    ...aditivos.map(a => ({ kind: 'aditivo' as const, key: `a-${a.id}`, data: ((a as any).created_at ?? '').slice(0, 10), a, r: undefined })),
    ...reajustes.map(r => ({ kind: 'reajuste' as const, key: `r-${r.id}`, data: r.data_base ?? '', a: undefined, r })),
  ]

  const filtered = linhas.filter(l => {
    if (statusFilter === 'aditivo' && l.kind !== 'aditivo') return false
    if (statusFilter === 'reajuste' && l.kind !== 'reajuste') return false
    if (['rascunho', 'em_aprovacao', 'aprovado', 'rejeitado'].includes(statusFilter) &&
        (l.kind !== 'aditivo' || l.a!.status !== statusFilter)) return false
    if (busca) {
      const q = busca.toLowerCase()
      if (l.kind === 'aditivo') {
        const a = l.a!
        return (
          a.numero_aditivo.toLowerCase().includes(q) ||
          a.descricao.toLowerCase().includes(q) ||
          a.contrato?.numero?.toLowerCase().includes(q) ||
          a.contrato?.objeto?.toLowerCase().includes(q)
        )
      }
      const r = l.r!
      return (
        r.indice_nome.toLowerCase().includes(q) ||
        r.observacoes?.toLowerCase().includes(q) ||
        r.contrato?.numero?.toLowerCase().includes(q) ||
        r.contrato?.objeto?.toLowerCase().includes(q)
      )
    }
    return true
  }).sort((x, y) => (y.data || '').localeCompare(x.data || ''))

  const impacto = filtered.reduce((s, l) =>
    s + (l.kind === 'aditivo' ? (l.a!.valor_acrescimo || 0) : (l.r!.valor_depois - l.r!.valor_antes)), 0)

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
    { label: 'Todos', value: '' },
    { label: 'Aditivos', value: 'aditivo' }, { label: 'Reajustes', value: 'reajuste' },
    { label: 'Rascunho', value: 'rascunho' }, { label: 'Em Aprovação', value: 'em_aprovacao' },
    { label: 'Aprovados', value: 'aprovado' }, { label: 'Rejeitados', value: 'rejeitado' },
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

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-widest">Aditivos</p>
          <p className="text-lg font-extrabold text-slate-800 mt-1">{aditivos.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-cyan-500 uppercase tracking-widest">Reajustes</p>
          <p className="text-lg font-extrabold text-slate-800 mt-1">{reajustes.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest">Impacto</p>
          <p className={`text-lg font-extrabold mt-1 ${impacto >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtFull(impacto)}</p>
        </div>
      </div>

      {/* Toolbar: busca + filtros + toggle (1 linha, padrão Locações) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <UpperInput value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar aditivo, reajuste, contrato..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm
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
        <div className="flex items-center gap-1">
          <button onClick={() => setView('table')} title="Tabela"
            className={`p-1.5 rounded-lg transition-colors ${view === 'table' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-600'}`}>
            <LayoutList size={16} />
          </button>
          <button onClick={() => setView('card')} title="Cards"
            className={`p-1.5 rounded-lg transition-colors ${view === 'card' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-slate-600'}`}>
            <LayoutGrid size={16} />
          </button>
        </div>
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
          <p className="text-sm font-semibold text-slate-500">Nenhum aditivo ou reajuste encontrado</p>
        </div>
      ) : view === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="px-4 py-3">Contrato</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Detalhe</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const contrato = l.kind === 'aditivo' ? l.a!.contrato : l.r!.contrato
                  return (
                    <tr key={l.key} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-slate-800">{contrato?.numero ?? '-'}</p>
                        <p className="text-[10px] truncate max-w-[160px] text-slate-400">{contrato?.objeto}</p>
                      </td>
                      <td className="px-4 py-3">
                        {l.kind === 'aditivo' ? (
                          <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 ${TIPO_ADITIVO[l.a!.tipo].bg} ${TIPO_ADITIVO[l.a!.tipo].text}`}>
                            Aditivo · {TIPO_ADITIVO[l.a!.tipo].label}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 bg-cyan-50 text-cyan-700">
                            Reajuste
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[220px] text-slate-600">
                        {l.kind === 'aditivo' ? (
                          <>
                            <span className="font-mono font-semibold text-slate-700">{l.a!.numero_aditivo}</span>
                            <span className="block truncate text-[11px] text-slate-400">{l.a!.descricao}</span>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700">{l.r!.indice_nome}</span>
                            <span className={`inline-flex items-center gap-0.5 font-bold ${l.r!.percentual_aplicado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {l.r!.percentual_aplicado >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                              {fmtPct(l.r!.percentual_aplicado)}
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">{l.data ? fmtData(l.data) : '—'}</td>
                      <td className="px-4 py-3 text-xs text-right whitespace-nowrap">
                        {l.kind === 'aditivo' ? (
                          <span className={`font-bold ${l.a!.valor_acrescimo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtFull(l.a!.valor_acrescimo)}</span>
                        ) : (
                          <span className="text-slate-500">
                            {fmtFull(l.r!.valor_antes)}
                            <span className={`ml-1 font-bold ${l.r!.valor_depois - l.r!.valor_antes >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>→ {fmtFull(l.r!.valor_depois)}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {l.kind === 'aditivo' ? (
                          <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${STATUS_ADITIVO[l.a!.status].bg} ${STATUS_ADITIVO[l.a!.status].text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_ADITIVO[l.a!.status].dot}`} />{STATUS_ADITIVO[l.a!.status].label}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Aplicado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {l.kind === 'aditivo' ? (
                          <div className="flex items-center justify-center gap-1">
                            {l.a!.status === 'em_aprovacao' && (
                              <>
                                <button onClick={() => handleStatusChange(l.a!.id, 'aprovado')} disabled={atualizarAditivo.isPending}
                                  title="Aprovar" className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-all disabled:opacity-50">
                                  <CheckCircle2 size={13} />
                                </button>
                                <button onClick={() => handleStatusChange(l.a!.id, 'rejeitado')} disabled={atualizarAditivo.isPending}
                                  title="Rejeitar" className="w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-all disabled:opacity-50">
                                  <XCircle size={13} />
                                </button>
                              </>
                            )}
                            {l.a!.status === 'rascunho' && (
                              <button onClick={() => handleStatusChange(l.a!.id, 'em_aprovacao')} disabled={atualizarAditivo.isPending}
                                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all disabled:opacity-50">
                                Enviar
                              </button>
                            )}
                            {(l.a!.status === 'aprovado' || l.a!.status === 'rejeitado') && (
                              <span className="text-[10px] text-slate-400">—</span>
                            )}
                          </div>
                        ) : (
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
      ) : (
        <div className="space-y-2">
          {filtered.map(l => {
            const contrato = l.kind === 'aditivo' ? l.a!.contrato : l.r!.contrato
            return (
              <div key={l.key} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-indigo-200 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {l.kind === 'aditivo' ? (
                      <>
                        <p className="text-sm font-bold text-slate-800 truncate">{l.a!.numero_aditivo}</p>
                        <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 shrink-0 ${TIPO_ADITIVO[l.a!.tipo].bg} ${TIPO_ADITIVO[l.a!.tipo].text}`}>
                          Aditivo · {TIPO_ADITIVO[l.a!.tipo].label}
                        </span>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-slate-800 truncate">{l.r!.indice_nome}</p>
                        <span className="inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 shrink-0 bg-cyan-50 text-cyan-700">Reajuste</span>
                      </>
                    )}
                  </div>
                  {l.kind === 'aditivo' ? (
                    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 shrink-0 ${STATUS_ADITIVO[l.a!.status].bg} ${STATUS_ADITIVO[l.a!.status].text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_ADITIVO[l.a!.status].dot}`} />{STATUS_ADITIVO[l.a!.status].label}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 shrink-0 bg-emerald-50 text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Aplicado
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mb-2 truncate">{contrato?.numero ?? '-'}{contrato?.objeto ? ` · ${contrato.objeto}` : ''}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  {l.data && <span>{fmtData(l.data)}</span>}
                  {l.kind === 'aditivo' ? (
                    <>
                      <span className={`font-bold ${l.a!.valor_acrescimo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtFull(l.a!.valor_acrescimo)}</span>
                      {l.a!.descricao && <span className="truncate max-w-[320px] text-slate-400">{l.a!.descricao}</span>}
                    </>
                  ) : (
                    <>
                      <span className={`inline-flex items-center gap-0.5 font-bold ${l.r!.percentual_aplicado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {l.r!.percentual_aplicado >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                        {fmtPct(l.r!.percentual_aplicado)}
                      </span>
                      <span>
                        {fmtFull(l.r!.valor_antes)}
                        <span className={`ml-1 font-bold ${l.r!.valor_depois - l.r!.valor_antes >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>→ {fmtFull(l.r!.valor_depois)}</span>
                      </span>
                    </>
                  )}
                </div>
                {l.kind === 'aditivo' && (l.a!.status === 'rascunho' || l.a!.status === 'em_aprovacao') && (
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5">
                    {l.a!.status === 'em_aprovacao' && (
                      <>
                        <button onClick={() => handleStatusChange(l.a!.id, 'aprovado')} disabled={atualizarAditivo.isPending}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-50">
                          <CheckCircle2 size={12} /> Aprovar
                        </button>
                        <button onClick={() => handleStatusChange(l.a!.id, 'rejeitado')} disabled={atualizarAditivo.isPending}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:text-red-600 disabled:opacity-50 ml-3">
                          <XCircle size={12} /> Rejeitar
                        </button>
                      </>
                    )}
                    {l.a!.status === 'rascunho' && (
                      <button onClick={() => handleStatusChange(l.a!.id, 'em_aprovacao')} disabled={atualizarAditivo.isPending}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-700 disabled:opacity-50">
                        <Send size={12} /> Enviar p/ aprovação
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
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
  const { isDark } = useTheme()
  const nav = useNavigate()
  const { perfil, hasSetorPapel } = useAuth()
  const canPJ = perfil?.role === 'administrador' || hasSetorPapel('contratos', ['supervisor', 'diretor', 'ceo'])
  const [statusFilter, setStatusFilter] = useState('')
  const [de, setDe] = useState(ymHoje())          // período: padrão mês atual → +36 meses (mostra tudo)
  const [ate, setAte] = useState(ymMais(36))
  const [quick, setQuick] = useState<'7d' | null>(null)   // atalho "próximos 7 dias" (precisão de dia)
  const { data: parcelas = [], isLoading } = useParcelas()

  // "Quanto tenho que pagar" na janela: aluguel (recorrente) = valor_mensal × meses ativos
  // dentro da janela [de, ate]; não-recorrente = a parcela, se vence na janela. Atalho 7 dias =
  // aluguel cujo dia de vencimento cai nos próximos 7 dias (1 mês).
  const hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0)
  const lim7d = new Date(hoje0); lim7d.setDate(lim7d.getDate() + 7)
  const mesHoje = ymHoje()
  const aPagarDe = (p: typeof parcelas[number]): number => {
    const c = p.contrato
    if (quick === '7d') {
      const fim = (c?.data_fim_previsto || '9999-12').slice(0, 7)
      if (fim < mesHoje) return 0
      const dia = parseInt((p.data_vencimento || '').slice(8, 10)) || 1
      let occ = new Date(hoje0.getFullYear(), hoje0.getMonth(), dia)
      if (occ < hoje0) occ = new Date(hoje0.getFullYear(), hoje0.getMonth() + 1, dia)
      if (occ > lim7d) return 0
      return c?.recorrente ? (c.valor_mensal || 0) : p.valor
    }
    if (c?.recorrente) {
      const ini = (c.data_inicio || '').slice(0, 7) || '0000-00'
      const fim = (c.data_fim_previsto || '9999-12').slice(0, 7)
      const lo = ini > de ? ini : de
      const hi = fim < ate ? fim : ate
      if (lo > hi) return 0
      return (c.valor_mensal || 0) * (diffMeses(lo, hi) + 1)
    }
    const ym = (p.data_vencimento || '').slice(0, 7)
    return (ym >= de && ym <= ate) ? p.valor : 0
  }
  const compromissos = parcelas
    .filter(p => p.contrato?.tipo_contrato === 'despesa')
    .map(p => ({ ...p, aPagar: aPagarDe(p) }))
    .filter(p => p.aPagar > 0)

  const filtered = compromissos.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false
    return true
  })

  // Bloco agregado Equipe PJ fixo no topo (saldo do período = mensal × meses na janela)
  const pjRow = filtered.find(p => p.contrato?.numero === 'EQUIPE-PJ')
  const demais = filtered.filter(p => p.contrato?.numero !== 'EQUIPE-PJ')
  const pjMeses = pjRow?.contrato?.valor_mensal ? Math.round(pjRow.aPagar / pjRow.contrato.valor_mensal) : 0

  const totalEmAberto = compromissos
    .filter(p => p.status !== 'pago' && p.status !== 'cancelado')
    .reduce((s, p) => s + p.aPagar, 0)
  const totalPago = compromissos
    .filter(p => p.status === 'pago')
    .reduce((s, p) => s + p.aPagar, 0)
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

  // atalhos de período
  const mesAtual = ymHoje(), mesProx = ymMais(1)
  const anoFim = `${new Date().getFullYear()}-12`
  const ATALHOS: Array<[string, boolean, () => void]> = [
    ['Próx. 7 dias', quick === '7d', () => setQuick('7d')],
    ['Esse mês', quick === null && de === mesAtual && ate === mesAtual, () => { setQuick(null); setDe(mesAtual); setAte(mesAtual) }],
    ['Próx. mês', quick === null && de === mesProx && ate === mesProx, () => { setQuick(null); setDe(mesProx); setAte(mesProx) }],
    ['Esse ano', quick === null && de === mesAtual && ate === anoFim, () => { setQuick(null); setDe(mesAtual); setAte(anoFim) }],
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

      <div className="flex items-center gap-2 flex-wrap">
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
        <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
          {ATALHOS.map(([label, active, onClick]) => (
            <button key={label} onClick={onClick}
              className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all
                ${active ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200'}`}>
              {label}
            </button>
          ))}
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1">Período</span>
          <PeriodoSelect value={de} onChange={v => { setQuick(null); setDe(v); if (v > ate) setAte(v) }} isDark={isDark} />
          <span className="text-xs text-slate-400">→</span>
          <PeriodoSelect value={ate} onChange={v => { setQuick(null); setAte(v); if (v < de) setDe(v) }} isDark={isDark} />
        </div>
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
          {pjRow && (
            <div
              onClick={() => { if (canPJ) nav('/contratos/equipe-pj') }}
              className={`bg-white rounded-2xl border border-indigo-200 shadow-sm p-4 transition-all ${canPJ ? 'cursor-pointer hover:shadow-md' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <Users size={16} className="text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800 truncate flex items-center gap-2">
                      Equipe PJ
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-wide">
                        <Lock size={9} /> sigiloso
                      </span>
                    </p>
                    <div className="text-right shrink-0 leading-tight">
                      <p className="text-sm font-extrabold text-indigo-600">{fmtFull(pjRow.aPagar)}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">no período</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {fmt(pjRow.contrato?.valor_mensal || 0)}/mês × {pjMeses} {pjMeses === 1 ? 'mês' : 'meses'} no período selecionado
                  </p>
                </div>
              </div>
            </div>
          )}
          {demais.map(p => {
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
                      <div className="text-right shrink-0 leading-tight">
                        <p className="text-sm font-extrabold text-amber-600">{fmtFull(p.aPagar)}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">a pagar</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                      <span className={`inline-flex items-center gap-1 rounded-full font-semibold px-2 py-0.5 ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                      </span>
                      {p.contrato?.recorrente && p.contrato?.valor_mensal ? (
                        <span className="bg-amber-50 text-amber-700 font-semibold rounded-full px-2 py-0.5">Mensal {fmt(p.contrato.valor_mensal)}</span>
                      ) : null}
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
export function NovaMedicaoModal({
  open, onClose, contratos, medicoes, onToast, contratoInicial,
}: {
  open: boolean
  onClose: () => void
  contratos: Contrato[]
  medicoes: ContratoMedicao[]
  onToast: (type: 'success' | 'error', msg: string) => void
  // Quando informado, o contrato vem pré-selecionado e travado (uso na tela de detalhe).
  contratoInicial?: string
}) {
  const criar = useCriarMedicao()
  const upload = useUploadMedicaoArquivo()
  const today = new Date().toISOString().slice(0, 10)
  const [file, setFile] = useState<File | null>(null)
  const [contratoId, setContratoId] = useState(contratoInicial ?? '')
  const [numeroBm, setNumeroBm] = useState(() => {
    const cid = contratoInicial ?? ''
    if (!cid) return ''
    const n = medicoes.filter(m => m.contrato_id === cid).length + 1
    return `BM-${String(n).padStart(3, '0')}`
  })
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
    setContratoId(contratoInicial ?? ''); setNumeroBm(''); setBmTouched(false)
    setPeriodoInicio(today); setPeriodoFim(today)
    setValorMedido(''); setValorRetencao(''); setObservacoes(''); setFile(null)
  }

  const handleSave = async () => {
    if (!contratoId) { onToast('error', 'Selecione o contrato'); return }
    if (!numeroBm.trim()) { onToast('error', 'Informe o número do BM'); return }
    if (!periodoInicio || !periodoFim) { onToast('error', 'Informe o período (início e fim)'); return }
    if (periodoFim < periodoInicio) { onToast('error', 'O fim do período não pode ser antes do início'); return }
    if (medido <= 0) { onToast('error', 'Valor medido deve ser maior que zero'); return }
    if (retencao > medido) { onToast('error', 'Retenção não pode ser maior que o valor medido'); return }

    try {
      const criada = await criar.mutateAsync({
        contrato_id: contratoId,
        numero_bm: numeroBm.trim().toUpperCase(),
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        valor_medido: medido,
        valor_retencao: retencao,
        // valor_liquido é coluna gerada no banco (valor_medido - valor_retencao); não enviar
        status: 'em_aprovacao',
        observacoes: observacoes.trim() || undefined,
      } as any)
      if (file) {
        try {
          await upload.mutateAsync({ medicaoId: criada.id, file })
          onToast('success', 'Medição criada com documento anexado')
        } catch (e: any) {
          // Medição já existe — não bloqueia; dá pra anexar depois pela lista.
          onToast('error', `Medição criada, mas o anexo falhou: ${e?.message ?? 'desconhecido'}. Anexe pela lista de medições.`)
        }
      } else {
        onToast('success', 'Medição criada com sucesso')
      }
      reset(); onClose()
    } catch (err: any) {
      onToast('error', `Erro ao criar medição: ${err?.message ?? 'desconhecido'}`)
    }
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
            {contratoInicial ? (
              <div className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-600">
                {(() => {
                  const c = contratos.find(x => x.id === contratoInicial)
                  const cp = c?.fornecedor?.razao_social || c?.fornecedor?.nome_fantasia || c?.cliente?.nome || ''
                  return c ? `${c.numero}${cp ? ` — ${cp}` : ''}` : 'Contrato atual'
                })()}
              </div>
            ) : (
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
            )}
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

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Documento (opcional)</label>
            <p className="text-[11px] text-slate-400 mb-1.5">Planilha de medição, boletim (BM) ou nota — acompanha a medição até o Financeiro.</p>
            {file ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-fuchsia-200 bg-fuchsia-50">
                <span className="flex items-center gap-1.5 text-xs font-medium text-fuchsia-700 truncate">
                  <Paperclip size={12} /> {file.name}
                </span>
                <button onClick={() => setFile(null)} disabled={criar.isPending || upload.isPending} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={14} /></button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-slate-300 bg-white text-xs font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer">
                <Upload size={14} /> Selecionar arquivo
                <input type="file" className="hidden" disabled={criar.isPending || upload.isPending}
                  onChange={e => { const f = e.currentTarget.files?.[0]; if (f) setFile(f) }} />
              </label>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            disabled={criar.isPending || upload.isPending}
            className="px-4 py-2 rounded-xl text-[11px] font-semibold text-slate-600 border border-slate-200 hover:bg-white transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={criar.isPending || upload.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold text-white bg-fuchsia-600 hover:bg-fuchsia-700 shadow-sm transition-all disabled:opacity-50"
          >
            {(criar.isPending || upload.isPending) ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Criar Medição
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Enviar Medição ao Financeiro (com opção de anexar documento) ─────────────
function EnviarMedicaoModal({
  medicao, contrato, onClose, onToast,
}: {
  medicao: ContratoMedicao
  contrato?: Contrato
  onClose: () => void
  onToast: (type: 'success' | 'error', msg: string) => void
}) {
  const upload = useUploadMedicaoArquivo()
  const faturar = useFaturarMedicao()
  const [file, setFile] = useState<File | null>(null)
  const busy = upload.isPending || faturar.isPending

  const cp = contrato?.fornecedor?.razao_social || contrato?.fornecedor?.nome_fantasia || contrato?.cliente?.nome || ''
  const destinoTipo = contrato?.tipo_contrato === 'receita' ? 'Contas a Receber' : 'Contas a Pagar'

  const submit = async () => {
    try {
      if (file) await upload.mutateAsync({ medicaoId: medicao.id, file })
      const res = await faturar.mutateAsync(medicao.id)
      if (res.ok) {
        const destino = res.tipo_contrato === 'receita' ? 'Contas a Receber' : 'Contas a Pagar'
        onToast('success', `Enviada ao ${destino}${res.data_vencimento ? ` • Vence ${fmtData(res.data_vencimento)}` : ''}`)
        onClose()
      } else {
        onToast('error', (res as any).mensagem ?? `Não enviada: ${res.motivo ?? 'desconhecido'}`)
      }
    } catch (e: any) {
      onToast('error', `Erro ao enviar: ${e?.message ?? 'desconhecido'}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Send size={16} className="text-fuchsia-600" />
            <h2 className="text-sm font-bold text-slate-800">Enviar Medição ao Financeiro</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Contrato</span><span className="font-semibold text-slate-700">{contrato?.numero ?? '—'}{cp ? ` · ${cp}` : ''}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">BM</span><span className="font-mono font-semibold text-slate-700">{medicao.numero_bm}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Valor líquido</span><span className="font-bold text-fuchsia-700">{fmtFull(medicao.valor_liquido)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Destino</span><span className="font-semibold text-slate-700">{destinoTipo}</span></div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Documento (opcional)</label>
            <p className="text-[11px] text-slate-400 mb-1.5">Planilha de medição, boletim (BM) ou nota — fica anexado e visível no Financeiro.</p>
            {file ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-fuchsia-200 bg-fuchsia-50">
                <span className="flex items-center gap-1.5 text-xs font-medium text-fuchsia-700 truncate">
                  <Paperclip size={12} /> {file.name}
                </span>
                <button onClick={() => setFile(null)} disabled={busy} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={14} /></button>
              </div>
            ) : medicao.arquivo_url ? (
              <div className="flex items-center justify-between gap-2">
                <a href={medicao.arquivo_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-fuchsia-700 hover:underline truncate">
                  <ExternalLink size={12} /> {medicao.arquivo_nome || 'Documento já anexado'}
                </a>
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer shrink-0">
                  <Upload size={12} /> Trocar
                  <input type="file" className="hidden" disabled={busy} onChange={e => { const f = e.currentTarget.files?.[0]; if (f) setFile(f) }} />
                </label>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-slate-300 bg-white text-xs font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer">
                <Upload size={14} /> Selecionar arquivo
                <input type="file" className="hidden" disabled={busy} onChange={e => { const f = e.currentTarget.files?.[0]; if (f) setFile(f) }} />
              </label>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 rounded-xl text-[11px] font-semibold text-slate-600 border border-slate-200 hover:bg-white transition-all disabled:opacity-50">Cancelar</button>
          <button onClick={submit} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold text-white bg-fuchsia-600 hover:bg-fuchsia-700 shadow-sm transition-all disabled:opacity-50">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {file ? 'Anexar e Enviar' : 'Enviar ao Financeiro'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Anexar/trocar documento de uma medição já enviada (ex.: envio automático na aprovação).
function MedicaoAnexoInline({ medicao, onToast }: {
  medicao: ContratoMedicao
  onToast: (type: 'success' | 'error', msg: string) => void
}) {
  const upload = useUploadMedicaoArquivo()
  return (
    <div className="inline-flex items-center gap-1.5">
      {medicao.arquivo_url && (
        <a href={medicao.arquivo_url} target="_blank" rel="noopener noreferrer"
          title={medicao.arquivo_nome || 'Abrir documento'}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-fuchsia-50 border border-fuchsia-200 text-[10px] font-bold text-fuchsia-700 hover:bg-fuchsia-100 transition-all">
          <ExternalLink size={11} /> Documento
        </a>
      )}
      <label
        title={medicao.arquivo_url ? 'Trocar documento' : 'Anexar documento'}
        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-white border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all">
        {upload.isPending ? <Loader2 size={11} className="animate-spin" /> : <Paperclip size={11} />}
        {medicao.arquivo_url ? 'Trocar' : 'Anexar'}
        <input
          type="file"
          className="hidden"
          disabled={upload.isPending}
          onChange={async e => {
            const f = e.currentTarget.files?.[0]
            e.currentTarget.value = ''
            if (!f) return
            try {
              await upload.mutateAsync({ medicaoId: medicao.id, file: f })
              onToast('success', 'Documento anexado à medição')
            } catch (err: any) {
              onToast('error', `Falha ao anexar: ${err?.message ?? 'desconhecido'}`)
            }
          }}
        />
      </label>
    </div>
  )
}

function TabMedicoes() {
  const { perfil, isAdmin, hasSetorPapel } = useAuth()
  const podeAprovar = isAdmin || hasSetorPapel('contratos', ['supervisor', 'diretor', 'ceo'])
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [novaMedicaoOpen, setNovaMedicaoOpen] = useState(false)
  const [enviarMedicao, setEnviarMedicao] = useState<ContratoMedicao | null>(null)

  const { data: medicoes = [], isLoading } = useMedicoes()
  const { data: contratos = [] } = useContratos()
  const faturar = useFaturarMedicao()
  const atualizar = useAtualizarMedicao()

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

  // O envio ao Financeiro passa pelo EnviarMedicaoModal (permite anexar documento).
  // O reenvio manual (status 'aprovado') abre o modal via setEnviarMedicao.

  const handleSubmeter = (medicaoId: string) => {
    atualizar.mutate({ id: medicaoId, status: 'em_aprovacao' }, {
      onSuccess: () => showToast('success', 'Medição enviada para aprovação'),
      onError: (err: any) => showToast('error', `Erro: ${err?.message ?? 'desconhecido'}`),
    })
  }

  const handleAprovar = (medicaoId: string) => {
    if (!confirm('Aprovar esta medição?\n\nApós aprovada, o contrato será atualizado e a medição será automaticamente enviada ao Financeiro (cria CP/CR previsto).')) return
    atualizar.mutate({
      id: medicaoId,
      status: 'aprovado',
      aprovado_por: perfil?.nome ?? 'Sistema',
      aprovado_em: new Date().toISOString(),
    }, {
      onSuccess: () => {
        // Encadeia o envio ao Financeiro logo após a aprovação.
        faturar.mutate(medicaoId, {
          onSuccess: (res) => {
            if (res.ok) {
              const destino = res.tipo_contrato === 'receita' ? 'Contas a Receber' : 'Contas a Pagar'
              showToast('success', `Aprovada e enviada ao ${destino} • Vence ${fmtData(res.data_vencimento!)}`)
            } else {
              showToast('error', (res as any).mensagem ?? `Aprovada, mas não enviada: ${res.motivo ?? 'desconhecido'}`)
            }
          },
          onError: () => showToast('error', 'Aprovada, mas falhou ao enviar ao Financeiro'),
        })
      },
      onError: (err: any) => showToast('error', `Erro ao aprovar: ${err?.message ?? 'desconhecido'}`),
    })
  }

  const handleRejeitar = (medicaoId: string) => {
    if (!confirm('Rejeitar esta medição?')) return
    atualizar.mutate({ id: medicaoId, status: 'rejeitado' }, {
      onSuccess: () => showToast('success', 'Medição rejeitada'),
      onError: (err: any) => showToast('error', `Erro: ${err?.message ?? 'desconhecido'}`),
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

      {enviarMedicao && (
        <EnviarMedicaoModal
          key={enviarMedicao.id}
          medicao={enviarMedicao}
          contrato={contratoMap.get(enviarMedicao.contrato_id)}
          onClose={() => setEnviarMedicao(null)}
          onToast={showToast}
        />
      )}

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
                        <div className="inline-flex items-center gap-1.5">
                          {m.status === 'rascunho' && (
                            <button
                              onClick={() => handleSubmeter(m.id)}
                              disabled={atualizar.isPending}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl
                                bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700
                                hover:bg-amber-100 transition-all disabled:opacity-50"
                              title="Enviar para aprovação"
                            >
                              <Send size={11} /> Enviar p/ Aprovação
                            </button>
                          )}
                          {m.status === 'em_aprovacao' && (
                            podeAprovar ? (
                              <>
                                <button
                                  onClick={() => handleAprovar(m.id)}
                                  disabled={atualizar.isPending || faturar.isPending}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl
                                    bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700
                                    hover:bg-emerald-100 transition-all disabled:opacity-50"
                                  title="Aprovar medição (envia ao Financeiro automaticamente)"
                                >
                                  {atualizar.isPending || faturar.isPending
                                    ? <Loader2 size={11} className="animate-spin" />
                                    : <CheckCircle2 size={11} />}
                                  Aprovar
                                </button>
                                <button
                                  onClick={() => handleRejeitar(m.id)}
                                  disabled={atualizar.isPending || faturar.isPending}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl
                                    bg-red-50 border border-red-200 text-[10px] font-bold text-red-700
                                    hover:bg-red-100 transition-all disabled:opacity-50"
                                  title="Rejeitar medição"
                                >
                                  <XCircle size={11} /> Rejeitar
                                </button>
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 italic"
                                title="Apenas Supervisor/Diretor/CEO de Contratos podem aprovar">
                                <Lock size={11} /> Aguardando aprovação
                              </span>
                            )
                          )}
                          {podeEnviar && (
                            <button
                              onClick={() => setEnviarMedicao(m)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl
                                bg-fuchsia-50 border border-fuchsia-200 text-[10px] font-bold text-fuchsia-700
                                hover:bg-fuchsia-100 transition-all disabled:opacity-50"
                              title="Enviar ao Financeiro (com opção de anexar documento)"
                            >
                              <Send size={11} />
                              Enviar ao Financeiro
                            </button>
                          )}
                          {jaEnviada && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700">
                              <CheckCircle2 size={11} /> No Financeiro
                            </span>
                          )}
                          {m.status === 'rejeitado' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500">
                              <XCircle size={11} /> Rejeitada
                            </span>
                          )}
                          {/* Anexo disponível em qualquer status — o doc acompanha a medição até o Financeiro */}
                          <MedicaoAnexoInline medicao={m} onToast={showToast} />
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
    aditivos: aditivos.length + reajustes.length,
  }), [contratos, medicoes, parcelas, aditivos, reajustes])

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className={`text-lg font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <Briefcase size={18} className="text-indigo-500" /> Gestão de Contratos
        </h1>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Contratos ativos, aditivos, reajustes e provisionamento
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
        {tab === 'aditivos' && <TabAditivosReajustes />}
      </div>
    </div>
  )
}
