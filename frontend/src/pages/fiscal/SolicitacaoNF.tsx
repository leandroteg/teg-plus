import { useState, useMemo, useCallback } from 'react'
import {
  FileInput, Clock, CheckCircle2, XCircle, Search, Filter,
  ArrowRight, Edit3, Send, ThumbsUp, ThumbsDown, Building2,
  Calendar, Hash, AlertTriangle, Loader2, X, FileText,
  Truck, ShoppingCart, PenLine, Eye, ChevronDown, Key,
} from 'lucide-react'
import type {
  SolicitacaoNF as SolicitacaoNFType,
  SolicitacaoNFFilters,
  StatusSolicitacaoNF,
  EmitirNFPayload,
} from '../../types/solicitacaoNF'
import {
  useSolicitacoesNF, useSolResumo, useIniciarEmissao,
  useEmitirNF, useAprovarSolicitacao, useRejeitarSolicitacao,
} from '../../hooks/useSolicitacoesNF'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'

// ── Formatters ──────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })

const fmtDateFull = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

const fmtRelative = (d: string) => {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Agora'
  if (mins < 60) return `${mins}min atras`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atras`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d atras`
  return fmtDate(d)
}

const fmtCnpj = (cnpj: string) => {
  const c = cnpj.replace(/\D/g, '')
  if (c.length !== 14) return cnpj
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`
}

// ── Constants ───────────────────────────────────────────────────────────────

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Marco' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
]

const STATUS_CONFIG: Record<StatusSolicitacaoNF, {
  label: string
  bg: string; text: string; border: string
  darkBg: string; darkText: string; darkBorder: string
  icon: typeof Clock
}> = {
  pendente: {
    label: 'Pendente', icon: Clock,
    bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200',
    darkBg: 'bg-amber-500/10', darkText: 'text-amber-400', darkBorder: 'border-amber-500/20',
  },
  em_emissao: {
    label: 'Em Emissao', icon: Edit3,
    bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200',
    darkBg: 'bg-blue-500/10', darkText: 'text-blue-400', darkBorder: 'border-blue-500/20',
  },
  aguardando_aprovacao: {
    label: 'Aguardando', icon: Clock,
    bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200',
    darkBg: 'bg-violet-500/10', darkText: 'text-violet-400', darkBorder: 'border-violet-500/20',
  },
  aprovada: {
    label: 'Aprovada', icon: CheckCircle2,
    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',
    darkBg: 'bg-emerald-500/10', darkText: 'text-emerald-400', darkBorder: 'border-emerald-500/20',
  },
  emitida: {
    label: 'Emitida', icon: CheckCircle2,
    bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200',
    darkBg: 'bg-green-500/10', darkText: 'text-green-400', darkBorder: 'border-green-500/20',
  },
  rejeitada: {
    label: 'Rejeitada', icon: XCircle,
    bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200',
    darkBg: 'bg-red-500/10', darkText: 'text-red-400', darkBorder: 'border-red-500/20',
  },
}

const ORIGEM_CONFIG: Record<string, {
  label: string; icon: typeof Truck
  bg: string; text: string; border: string
  darkBg: string; darkText: string; darkBorder: string
}> = {
  logistica: {
    label: 'Logistica', icon: Truck,
    bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200',
    darkBg: 'bg-blue-500/10', darkText: 'text-blue-400', darkBorder: 'border-blue-500/20',
  },
  compras: {
    label: 'Compras', icon: ShoppingCart,
    bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200',
    darkBg: 'bg-emerald-500/10', darkText: 'text-emerald-400', darkBorder: 'border-emerald-500/20',
  },
  manual: {
    label: 'Manual', icon: PenLine,
    bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200',
    darkBg: 'bg-slate-500/10', darkText: 'text-slate-400', darkBorder: 'border-slate-500/20',
  },
}

// ── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status, isDark }: { status: StatusSolicitacaoNF; isDark: boolean }) {
  const cfg = STATUS_CONFIG[status]
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide rounded-full px-2.5 py-0.5 border transition-colors ${
      isDark
        ? `${cfg.darkBg} ${cfg.darkText} ${cfg.darkBorder}`
        : `${cfg.bg} ${cfg.text} ${cfg.border}`
    }`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  )
}

// ── Origin Badge ────────────────────────────────────────────────────────────

function OrigemBadge({ origem, isDark }: { origem?: string; isDark: boolean }) {
  if (!origem) return null
  const cfg = ORIGEM_CONFIG[origem]
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 border transition-colors ${
      isDark
        ? `${cfg.darkBg} ${cfg.darkText} ${cfg.darkBorder}`
        : `${cfg.bg} ${cfg.text} ${cfg.border}`
    }`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  )
}

// ── Skeleton Card ───────────────────────────────────────────────────────────

function SkeletonCard({ isDark }: { isDark: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 animate-pulse ${
      isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1">
          <div className={`h-5 rounded-lg w-40 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
          <div className={`h-4 rounded-full w-20 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
        </div>
        <div className={`h-5 rounded-full w-24 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
      </div>
      <div className="flex gap-6 mb-3">
        <div className={`h-4 rounded w-28 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
        <div className={`h-4 rounded w-32 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
        <div className={`h-4 rounded w-24 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
      </div>
      <div className="flex items-center justify-between">
        <div className={`h-3 rounded w-20 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
        <div className={`h-8 rounded-xl w-32 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
      </div>
    </div>
  )
}

// ── Emission Form (inline) ──────────────────────────────────────────────────

interface EmissionFormProps {
  sol: SolicitacaoNFType
  isDark: boolean
  onSubmit: (payload: EmitirNFPayload) => void
  onCancel: () => void
  isPending: boolean
}

function EmissionForm({ sol, isDark, onSubmit, onCancel, isPending }: EmissionFormProps) {
  const [numero, setNumero] = useState(sol.numero_nf || '')
  const [serie, setSerie] = useState(sol.serie || '1')
  const [chave, setChave] = useState(sol.chave_acesso || '')
  const [dataEmissao, setDataEmissao] = useState(
    sol.data_emissao || new Date().toISOString().split('T')[0]
  )
  const [formError, setFormError] = useState('')

  const labelCls = `text-[11px] font-semibold mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`
  const inputCls = `w-full rounded-xl border px-3 py-2 text-sm transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 ${
    isDark
      ? 'bg-slate-900/60 border-slate-700 text-slate-200 placeholder-slate-600'
      : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'
  }`

  const handleSubmit = () => {
    if (!numero.trim()) { setFormError('Numero da NF obrigatorio'); return }
    if (!dataEmissao) { setFormError('Data de emissao obrigatoria'); return }
    setFormError('')
    onSubmit({
      numero_nf: numero.trim(),
      serie: serie.trim() || undefined,
      chave_acesso: chave.trim() || undefined,
      data_emissao: dataEmissao,
    })
  }

  return (
    <div className={`mt-3 pt-3 border-t space-y-3 animate-[fadeSlideIn_0.25s_ease] ${
      isDark ? 'border-slate-700/60' : 'border-slate-100'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        <Edit3 size={13} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
        <span className={`text-xs font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
          Dados da Nota Fiscal
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className={labelCls}>Numero NF *</label>
          <div className="relative">
            <Hash size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${
              isDark ? 'text-slate-600' : 'text-slate-400'
            }`} />
            <input
              type="text"
              value={numero}
              onChange={e => setNumero(e.target.value)}
              placeholder="000123"
              className={`${inputCls} pl-8`}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Serie</label>
          <input
            type="text"
            value={serie}
            onChange={e => setSerie(e.target.value)}
            placeholder="1"
            className={inputCls}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Data Emissao *</label>
          <div className="relative">
            <Calendar size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${
              isDark ? 'text-slate-600' : 'text-slate-400'
            }`} />
            <input
              type="date"
              value={dataEmissao}
              onChange={e => setDataEmissao(e.target.value)}
              className={`${inputCls} pl-8`}
            />
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Chave de Acesso</label>
          <div className="relative">
            <Key size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${
              isDark ? 'text-slate-600' : 'text-slate-400'
            }`} />
            <input
              type="text"
              value={chave}
              onChange={e => setChave(e.target.value)}
              placeholder="44 digitos (opcional)"
              className={`${inputCls} pl-8`}
            />
          </div>
        </div>
      </div>

      {formError && (
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-xs ${
          isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <AlertTriangle size={12} className="shrink-0" />
          {formError}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white
            text-xs font-bold hover:bg-amber-700 transition-all disabled:opacity-50
            shadow-sm shadow-amber-600/20"
        >
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          Enviar para Aprovacao
        </button>
        <button
          onClick={onCancel}
          className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
            isDark
              ? 'border-slate-700 text-slate-400 hover:bg-slate-700/50'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Rejection Modal ─────────────────────────────────────────────────────────

interface RejectModalProps {
  isDark: boolean
  solicitacao: SolicitacaoNFType
  onConfirm: (motivo: string) => void
  onClose: () => void
  isPending: boolean
}

function RejectModal({ isDark, solicitacao, onConfirm, onClose, isPending }: RejectModalProps) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')

  const handleConfirm = () => {
    if (!motivo.trim()) { setError('Informe o motivo da rejeicao'); return }
    setError('')
    onConfirm(motivo.trim())
  }

  const cardBg = isDark ? 'bg-slate-800' : 'bg-white'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`${cardBg} rounded-2xl shadow-2xl w-full max-w-md overflow-hidden
        animate-[modalSlideUp_0.25s_ease]`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${
          isDark ? 'border-slate-700' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isDark ? 'bg-red-500/10' : 'bg-red-50'
            }`}>
              <XCircle size={16} className="text-red-500" />
            </div>
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                Rejeitar Solicitacao
              </h3>
              <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {solicitacao.fornecedor_nome}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <div>
            <label className={`text-[11px] font-semibold mb-1.5 block ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              Motivo da rejeicao *
            </label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da rejeicao..."
              rows={3}
              autoFocus
              className={`w-full rounded-xl border px-3 py-2.5 text-sm resize-none transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 ${
                isDark
                  ? 'bg-slate-900/60 border-slate-700 text-slate-200 placeholder-slate-600'
                  : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'
              }`}
            />
          </div>

          {error && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-xs ${
              isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              <AlertTriangle size={12} className="shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex gap-2 px-5 py-4 border-t ${
          isDark ? 'border-slate-700' : 'border-slate-100'
        }`}>
          <button
            onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
              isDark
                ? 'border-slate-700 text-slate-300 hover:bg-slate-700/50'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold
              hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2
              shadow-sm shadow-red-600/20"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <ThumbsDown size={14} />}
            Rejeitar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Solicitation Card ───────────────────────────────────────────────────────

interface SolCardProps {
  sol: SolicitacaoNFType
  isDark: boolean
  isGestor: boolean
  expandedId: string | null
  onToggleExpand: (id: string) => void
  onIniciar: (id: string) => void
  onEmitir: (id: string, payload: EmitirNFPayload) => void
  onAprovar: (id: string) => void
  onRejeitar: (id: string) => void
  iniciarPending: boolean
  emitirPending: boolean
  aprovarPending: boolean
}

function SolCard({
  sol, isDark, isGestor, expandedId, onToggleExpand,
  onIniciar, onEmitir, onAprovar, onRejeitar,
  iniciarPending, emitirPending, aprovarPending,
}: SolCardProps) {
  const isExpanded = expandedId === sol.id

  return (
    <div className={`group rounded-2xl border shadow-sm transition-all duration-200 hover:shadow-md ${
      isExpanded
        ? isDark
          ? 'border-amber-500/30 bg-amber-500/[0.03] shadow-amber-500/5'
          : 'border-amber-200 bg-amber-50/20 shadow-amber-100/50'
        : isDark
          ? 'border-slate-700 bg-slate-800/60 hover:border-slate-600'
          : 'border-slate-200 bg-white hover:border-slate-300'
    }`}>
      <div className="p-4 sm:p-5">
        {/* Row 1: Fornecedor + badges */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <Building2 size={14} className={isDark ? 'text-amber-400/70 shrink-0' : 'text-amber-500/70 shrink-0'} />
            <span className={`text-sm font-bold truncate ${
              isDark ? 'text-slate-100' : 'text-slate-800'
            }`}>
              {sol.fornecedor_nome}
            </span>
            {sol.fornecedor_cnpj && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md border ${
                isDark
                  ? 'bg-slate-700/50 text-slate-400 border-slate-600'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {fmtCnpj(sol.fornecedor_cnpj)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <OrigemBadge origem={sol.origem} isDark={isDark} />
            <StatusBadge status={sol.status} isDark={isDark} />
          </div>
        </div>

        {/* Row 2: Value + CFOP + Natureza + Descricao */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-2.5">
          {sol.valor_total != null && (
            <span className={`text-sm font-extrabold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
              {fmt(sol.valor_total)}
            </span>
          )}
          {sol.cfop && (
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              CFOP {sol.cfop}
            </span>
          )}
          {sol.natureza_operacao && (
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {sol.natureza_operacao}
            </span>
          )}
        </div>

        {sol.descricao && (
          <p className={`text-xs leading-relaxed mb-2.5 line-clamp-2 ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            {sol.descricao}
          </p>
        )}

        {/* NF data (for emitida / aguardando / rejeitada) */}
        {sol.numero_nf && (
          <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 mb-2.5 text-[11px] ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            <span className="flex items-center gap-1 font-semibold">
              <Hash size={10} />
              NF {sol.numero_nf}
              {sol.serie && <span className="font-normal">/ Serie {sol.serie}</span>}
            </span>
            {sol.data_emissao && (
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {fmtDate(sol.data_emissao)}
              </span>
            )}
            {sol.chave_acesso && (
              <span className={`flex items-center gap-1 font-mono text-[10px] ${
                isDark ? 'text-slate-600' : 'text-slate-400'
              }`}>
                <Key size={9} />
                {sol.chave_acesso.slice(0, 12)}...
              </span>
            )}
          </div>
        )}

        {/* Rejection reason */}
        {sol.status === 'rejeitada' && sol.motivo_rejeicao && (
          <div className={`flex items-start gap-2 rounded-xl px-3 py-2 border mb-2.5 ${
            isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
          }`}>
            <AlertTriangle size={12} className="text-red-500 mt-0.5 shrink-0" />
            <p className={`text-xs leading-relaxed ${isDark ? 'text-red-400' : 'text-red-700'}`}>
              {sol.motivo_rejeicao}
            </p>
          </div>
        )}

        {/* Row 3: Date + Actions */}
        <div className="flex items-center justify-between gap-3">
          <span className={`flex items-center gap-1 text-[11px] ${
            isDark ? 'text-slate-600' : 'text-slate-400'
          }`}>
            <Calendar size={10} />
            Solicitado {fmtRelative(sol.solicitado_em)}
            {sol.emitido_em && (
              <span className="ml-2">
                &bull; Emitido {fmtDateFull(sol.emitido_em)}
              </span>
            )}
          </span>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {/* Pendente -> Iniciar */}
            {sol.status === 'pendente' && (
              <button
                onClick={() => onIniciar(sol.id)}
                disabled={iniciarPending}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold
                  bg-amber-600 text-white hover:bg-amber-700 transition-all disabled:opacity-50
                  shadow-sm shadow-amber-600/20"
              >
                {iniciarPending
                  ? <Loader2 size={12} className="animate-spin" />
                  : <ArrowRight size={12} />}
                Iniciar Emissao
              </button>
            )}

            {/* Em Emissao -> Expand form */}
            {sol.status === 'em_emissao' && (
              <button
                onClick={() => onToggleExpand(sol.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold
                  transition-all ${
                  isExpanded
                    ? isDark
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-amber-100 text-amber-700 border border-amber-200'
                    : 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm shadow-amber-600/20'
                }`}
              >
                <Edit3 size={12} />
                {isExpanded ? 'Fechar' : 'Preencher NF'}
                <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
            )}

            {/* Aguardando -> Aprovar / Rejeitar (gestor only) */}
            {sol.status === 'aguardando_aprovacao' && isGestor && (
              <>
                <button
                  onClick={() => onAprovar(sol.id)}
                  disabled={aprovarPending}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold
                    bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-50
                    shadow-sm shadow-emerald-600/20"
                >
                  {aprovarPending
                    ? <Loader2 size={12} className="animate-spin" />
                    : <ThumbsUp size={12} />}
                  Aprovar
                </button>
                <button
                  onClick={() => onRejeitar(sol.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isDark
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                      : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                  }`}
                >
                  <ThumbsDown size={12} />
                  Rejeitar
                </button>
              </>
            )}

            {/* Emitida -> Ver NF */}
            {sol.status === 'emitida' && sol.danfe_url && (
              <a
                href={sol.danfe_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isDark
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                    : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                }`}
              >
                <Eye size={12} />
                Ver NF
              </a>
            )}
          </div>
        </div>

        {/* Expanded emission form */}
        {isExpanded && sol.status === 'em_emissao' && (
          <EmissionForm
            sol={sol}
            isDark={isDark}
            onSubmit={payload => onEmitir(sol.id, payload)}
            onCancel={() => onToggleExpand(sol.id)}
            isPending={emitirPending}
          />
        )}
      </div>
    </div>
  )
}

// ── Summary Pill ────────────────────────────────────────────────────────────

function SummaryPill({
  label, count, isDark, active, color, onClick,
}: {
  label: string
  count: number
  isDark: boolean
  active: boolean
  color: string
  onClick: () => void
}) {
  const colorMap: Record<string, {
    activeBg: string; activeText: string; activeBorder: string
    darkActiveBg: string; darkActiveText: string; darkActiveBorder: string
  }> = {
    amber: {
      activeBg: 'bg-amber-50', activeText: 'text-amber-700', activeBorder: 'border-amber-300',
      darkActiveBg: 'bg-amber-500/15', darkActiveText: 'text-amber-400', darkActiveBorder: 'border-amber-500/30',
    },
    blue: {
      activeBg: 'bg-blue-50', activeText: 'text-blue-700', activeBorder: 'border-blue-300',
      darkActiveBg: 'bg-blue-500/15', darkActiveText: 'text-blue-400', darkActiveBorder: 'border-blue-500/30',
    },
    violet: {
      activeBg: 'bg-violet-50', activeText: 'text-violet-700', activeBorder: 'border-violet-300',
      darkActiveBg: 'bg-violet-500/15', darkActiveText: 'text-violet-400', darkActiveBorder: 'border-violet-500/30',
    },
    green: {
      activeBg: 'bg-green-50', activeText: 'text-green-700', activeBorder: 'border-green-300',
      darkActiveBg: 'bg-green-500/15', darkActiveText: 'text-green-400', darkActiveBorder: 'border-green-500/30',
    },
    slate: {
      activeBg: 'bg-slate-100', activeText: 'text-slate-700', activeBorder: 'border-slate-300',
      darkActiveBg: 'bg-slate-500/15', darkActiveText: 'text-slate-300', darkActiveBorder: 'border-slate-500/30',
    },
  }

  const c = colorMap[color] ?? colorMap.slate

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold
        transition-all duration-200 whitespace-nowrap ${
        active
          ? isDark
            ? `${c.darkActiveBg} ${c.darkActiveText} ${c.darkActiveBorder}`
            : `${c.activeBg} ${c.activeText} ${c.activeBorder}`
          : isDark
            ? 'bg-slate-800/40 border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
            : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'
      }`}
    >
      {label}
      <span className={`text-[10px] font-bold tabular-nums min-w-[18px] h-[18px] rounded-md
        flex items-center justify-center ${
        active
          ? isDark
            ? `${c.darkActiveBg} ${c.darkActiveText}`
            : `${c.activeBg} ${c.activeText}`
          : isDark
            ? 'bg-slate-700 text-slate-400'
            : 'bg-slate-100 text-slate-500'
      }`}>
        {count}
      </span>
    </button>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function SolicitacaoNF() {
  const { isDark } = useTheme()
  const { role } = useAuth()
  const now = new Date()
  const isGestor = role === 'admin' || role === 'gerente'

  // ── Filters ─────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<StatusSolicitacaoNF | ''>('')
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [busca, setBusca] = useState('')

  const filters: SolicitacaoNFFilters = useMemo(() => ({
    status: statusFilter || undefined,
    mes,
    ano,
    busca: busca.trim() || undefined,
  }), [statusFilter, mes, ano, busca])

  const { data: solicitacoes = [], isLoading } = useSolicitacoesNF(filters)
  const resumo = useSolResumo(solicitacoes)

  // ── UI State ──────────────────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<SolicitacaoNFType | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  // ── Mutations ─────────────────────────────────────────────────────────
  const iniciarEmissao = useIniciarEmissao()
  const emitirNF = useEmitirNF()
  const aprovarSol = useAprovarSolicitacao()
  const rejeitarSol = useRejeitarSolicitacao()

  const handleIniciar = (id: string) => {
    iniciarEmissao.mutate(id, {
      onSuccess: () => {
        showToast('success', 'Emissao iniciada')
        setExpandedId(id)
      },
      onError: () => showToast('error', 'Erro ao iniciar emissao'),
    })
  }

  const handleEmitir = (id: string, payload: EmitirNFPayload) => {
    emitirNF.mutate({ id, payload }, {
      onSuccess: () => {
        showToast('success', 'NF enviada para aprovacao')
        setExpandedId(null)
      },
      onError: () => showToast('error', 'Erro ao enviar NF'),
    })
  }

  const handleAprovar = (id: string) => {
    aprovarSol.mutate(id, {
      onSuccess: () => showToast('success', 'Solicitacao aprovada e emitida'),
      onError: () => showToast('error', 'Erro ao aprovar'),
    })
  }

  const handleRejeitar = (id: string) => {
    const sol = solicitacoes.find(s => s.id === id)
    if (sol) setRejectTarget(sol)
  }

  const confirmReject = (motivo: string) => {
    if (!rejectTarget) return
    rejeitarSol.mutate({ id: rejectTarget.id, motivo }, {
      onSuccess: () => {
        showToast('success', 'Solicitacao rejeitada')
        setRejectTarget(null)
      },
      onError: () => showToast('error', 'Erro ao rejeitar'),
    })
  }

  // ── Year range ────────────────────────────────────────────────────────
  const currentYear = now.getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  // ── Shared input style ────────────────────────────────────────────────
  const selectCls = `rounded-xl border px-3 py-2 text-sm transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400
    appearance-none cursor-pointer ${
    isDark
      ? 'bg-slate-800/60 border-slate-700 text-slate-200'
      : 'bg-white border-slate-200 text-slate-700'
  }`

  return (
    <div className="space-y-5">
      {/* ── Keyframe Styles ──────────────────────────────────── */}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Toast ────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success'
            ? 'bg-emerald-500 text-white shadow-emerald-500/30'
            : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${
            isDark ? 'text-slate-100' : 'text-slate-800'
          }`}>
            <FileInput size={20} className={isDark ? 'text-amber-400' : 'text-amber-500'} />
            Solicitacao de NF
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Processar solicitacoes recebidas de Logistica e Compras
          </p>
        </div>
        <div className={`flex items-center gap-2 text-[11px] font-semibold px-3 py-1.5 rounded-xl border ${
          isDark
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}>
          <Filter size={12} />
          {resumo.total} {resumo.total === 1 ? 'solicitacao' : 'solicitacoes'}
        </div>
      </div>

      {/* ── Summary Bar ──────────────────────────────────────── */}
      <div className={`flex items-center gap-2 px-1 py-1 overflow-x-auto scrollbar-hide ${
        isDark ? '' : ''
      }`}>
        <SummaryPill
          label="Todas"
          count={resumo.total}
          isDark={isDark}
          active={statusFilter === ''}
          color="slate"
          onClick={() => setStatusFilter('')}
        />
        <SummaryPill
          label="Pendentes"
          count={resumo.pendentes}
          isDark={isDark}
          active={statusFilter === 'pendente'}
          color="amber"
          onClick={() => setStatusFilter(statusFilter === 'pendente' ? '' : 'pendente')}
        />
        <SummaryPill
          label="Em Emissao"
          count={resumo.em_emissao}
          isDark={isDark}
          active={statusFilter === 'em_emissao'}
          color="blue"
          onClick={() => setStatusFilter(statusFilter === 'em_emissao' ? '' : 'em_emissao')}
        />
        <SummaryPill
          label="Aguardando"
          count={resumo.aguardando}
          isDark={isDark}
          active={statusFilter === 'aguardando_aprovacao'}
          color="violet"
          onClick={() => setStatusFilter(statusFilter === 'aguardando_aprovacao' ? '' : 'aguardando_aprovacao')}
        />
        <SummaryPill
          label="Emitidas"
          count={resumo.emitidas}
          isDark={isDark}
          active={statusFilter === 'emitida'}
          color="green"
          onClick={() => setStatusFilter(statusFilter === 'emitida' ? '' : 'emitida')}
        />
        <SummaryPill
          label="Rejeitadas"
          count={resumo.rejeitadas}
          isDark={isDark}
          active={statusFilter === 'rejeitada'}
          color="slate"
          onClick={() => setStatusFilter(statusFilter === 'rejeitada' ? '' : 'rejeitada')}
        />
      </div>

      {/* ── Filters ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Month */}
        <select
          value={mes}
          onChange={e => setMes(Number(e.target.value))}
          className={selectCls}
        >
          {MESES.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        {/* Year */}
        <select
          value={ano}
          onChange={e => setAno(Number(e.target.value))}
          className={selectCls}
        >
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${
            isDark ? 'text-slate-500' : 'text-slate-400'
          }`} />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar fornecedor, numero NF..."
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 ${
              isDark
                ? 'bg-slate-800/60 border-slate-700 text-slate-200 placeholder-slate-600'
                : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'
            }`}
          />
        </div>
      </div>

      {/* ── Cards List ───────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} isDark={isDark} />)}
        </div>
      ) : solicitacoes.length === 0 ? (
        /* ── Empty State ──────────────────────────────────────── */
        <div className="text-center py-20">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            isDark ? 'bg-amber-500/10' : 'bg-amber-50'
          }`}>
            <FileText size={28} className={isDark ? 'text-amber-500/40' : 'text-amber-300'} />
          </div>
          <p className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Nenhuma solicitacao de NF encontrada
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            Ajuste os filtros ou aguarde novas solicitacoes da Logistica
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {solicitacoes.map(sol => (
            <SolCard
              key={sol.id}
              sol={sol}
              isDark={isDark}
              isGestor={isGestor}
              expandedId={expandedId}
              onToggleExpand={toggleExpand}
              onIniciar={handleIniciar}
              onEmitir={handleEmitir}
              onAprovar={handleAprovar}
              onRejeitar={handleRejeitar}
              iniciarPending={iniciarEmissao.isPending}
              emitirPending={emitirNF.isPending}
              aprovarPending={aprovarSol.isPending}
            />
          ))}
        </div>
      )}

      {/* ── Rejection Modal ──────────────────────────────────── */}
      {rejectTarget && (
        <RejectModal
          isDark={isDark}
          solicitacao={rejectTarget}
          onConfirm={confirmReject}
          onClose={() => setRejectTarget(null)}
          isPending={rejeitarSol.isPending}
        />
      )}
    </div>
  )
}
