import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FileText, ExternalLink, Clock, CheckCircle2,
  XCircle, AlertTriangle, ChevronRight, Send,
  Archive, Unlock, Ban, Eye, Pencil, Building2, Calendar,
  DollarSign, User, Briefcase, Tag, ShieldCheck, Info, PenTool, X,
} from 'lucide-react'
import {
  useSolicitacao,
  useSolicitacaoHistorico,
  useAvancarEtapa,
  useCancelarSolicitacao,
} from '../../hooks/useSolicitacoes'
import type { EtapaSolicitacao, Solicitacao } from '../../types/contratos'

// ── Formatters ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

const fmtDataHora = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

// ── Constants ───────────────────────────────────────────────────────────────────

const ETAPAS_FLOW: { key: EtapaSolicitacao; label: string; icon: typeof FileText }[] = [
  { key: 'solicitacao',         label: 'Solicitacao',         icon: FileText },
  { key: 'preparar_minuta',     label: 'Preparar Minuta',     icon: Pencil },
  { key: 'resumo_executivo',    label: 'Resumo Executivo',    icon: Eye },
  { key: 'aprovacao_diretoria', label: 'Aprovacao Diretoria', icon: ShieldCheck },
  { key: 'enviar_assinatura',   label: 'Enviar Assinatura',   icon: Send },
  { key: 'arquivar',            label: 'Arquivar',            icon: Archive },
  { key: 'liberar_execucao',    label: 'Liberar Execucao',    icon: Unlock },
]

const ETAPA_LABEL: Record<string, string> = {
  solicitacao:         'Solicitacao',
  preparar_minuta:     'Preparar Minuta',
  resumo_executivo:    'Resumo Executivo',
  aprovacao_diretoria: 'Aprovacao Diretoria',
  enviar_assinatura:   'Enviar Assinatura',
  arquivar:            'Arquivar',
  liberar_execucao:    'Liberar Execucao',
  concluido:           'Concluido',
  cancelado:           'Cancelado',
}

const URGENCIA_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  baixa:   { label: 'Baixa',   bg: 'bg-slate-50',  text: 'text-slate-600', dot: 'bg-slate-400' },
  normal:  { label: 'Normal',  bg: 'bg-blue-50',   text: 'text-blue-700',  dot: 'bg-blue-400'  },
  alta:    { label: 'Alta',    bg: 'bg-amber-50',  text: 'text-amber-700', dot: 'bg-amber-400' },
  critica: { label: 'Critica', bg: 'bg-red-50',    text: 'text-red-700',   dot: 'bg-red-500'   },
}

const TIPO_LABEL: Record<string, string> = {
  receita: 'Receita', despesa: 'Despesa', pj: 'PJ',
}

const CATEGORIA_LABEL: Record<string, string> = {
  prestacao_servico: 'Prestacao de Servico',
  fornecimento:      'Fornecimento',
  locacao:           'Locacao',
  empreitada:        'Empreitada',
  consultoria:       'Consultoria',
  pj_pessoa_fisica:  'PJ - Pessoa Fisica',
  outro:             'Outro',
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function UrgenciaBadge({ urgencia }: { urgencia: string }) {
  const c = URGENCIA_CONFIG[urgencia] ?? URGENCIA_CONFIG.normal
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full text-[10px] font-semibold px-2.5 py-1 ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

function EtapaBadge({ etapa }: { etapa: string }) {
  const isConcluido = etapa === 'concluido'
  const isCancelado = etapa === 'cancelado'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full text-[10px] font-bold px-2.5 py-1 ${
      isConcluido ? 'bg-emerald-50 text-emerald-700'
      : isCancelado ? 'bg-red-50 text-red-600'
      : 'bg-indigo-50 text-indigo-700'
    }`}>
      {isConcluido ? <CheckCircle2 size={10} /> : isCancelado ? <XCircle size={10} /> : <Clock size={10} />}
      {ETAPA_LABEL[etapa] ?? etapa}
    </span>
  )
}

function InfoItem({ label, value, icon: Icon }: {
  label: string; value?: string | number | null; icon?: typeof DollarSign
}) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex items-start gap-2.5 py-2">
      {Icon && (
        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 mt-0.5">
          <Icon size={12} className="text-slate-400" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-700 font-medium mt-0.5 break-words">
          {typeof value === 'number' ? fmt(value) : value}
        </p>
      </div>
    </div>
  )
}

function VerticalStepper({ etapaAtual }: { etapaAtual: EtapaSolicitacao }) {
  const isCancelado = etapaAtual === 'cancelado'
  const isConcluido = etapaAtual === 'concluido'
  const currentIdx = ETAPAS_FLOW.findIndex(e => e.key === etapaAtual)

  return (
    <div className="space-y-0">
      {ETAPAS_FLOW.map((step, idx) => {
        const isCompleted = !isCancelado && (isConcluido || idx < currentIdx)
        const isCurrent = !isCancelado && !isConcluido && idx === currentIdx
        const isLast = idx === ETAPAS_FLOW.length - 1
        const StepIcon = step.icon

        return (
          <div key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                isCompleted
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                  : isCurrent
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 ring-4 ring-indigo-100'
                  : 'bg-slate-100 text-slate-400'
              }`}>
                {isCompleted ? <CheckCircle2 size={14} /> : <StepIcon size={13} />}
              </div>
              {!isLast && (
                <div className={`w-0.5 h-8 ${isCompleted ? 'bg-emerald-300' : 'bg-slate-200'}`} />
              )}
            </div>
            <div className="pt-1.5 pb-4">
              <p className={`text-xs font-semibold leading-none ${
                isCompleted ? 'text-emerald-700' : isCurrent ? 'text-indigo-700' : 'text-slate-400'
              }`}>
                {step.label}
              </p>
              {isCurrent && (
                <p className="text-[10px] text-indigo-500 mt-1 font-medium">Etapa atual</p>
              )}
            </div>
          </div>
        )
      })}

      {(isConcluido || isCancelado) && (
        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              isConcluido
                ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                : 'bg-red-500 text-white shadow-sm shadow-red-200'
            }`}>
              {isConcluido ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            </div>
          </div>
          <div className="pt-1.5">
            <p className={`text-xs font-bold ${isConcluido ? 'text-emerald-700' : 'text-red-600'}`}>
              {isConcluido ? 'Concluido' : 'Cancelado'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function CancelModal({ open, onClose, onConfirm, isPending }: {
  open: boolean
  onClose: () => void
  onConfirm: (motivo: string) => void
  isPending: boolean
}) {
  const [motivo, setMotivo] = useState('')
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800">Cancelar Solicitacao</h3>
            <p className="text-xs text-slate-400">Esta acao nao pode ser desfeita.</p>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">
            Motivo do cancelamento *
          </label>
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            rows={3}
            placeholder="Descreva o motivo do cancelamento..."
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700
              placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30
              focus:border-red-400 resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold
              text-slate-600 hover:bg-slate-50 transition-all"
          >
            Voltar
          </button>
          <button
            onClick={() => motivo.trim() && onConfirm(motivo.trim())}
            disabled={!motivo.trim() || isPending}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold
              hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <XCircle size={14} />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Certisign Modal ──────────────────────────────────────────────────────────────

function CertisignModal({ open, onClose, onConfirm, isPending }: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  isPending: boolean
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-sm">
              <PenTool size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">Enviar para Assinatura</h3>
              <p className="text-xs text-slate-400">Integracao com Certisign</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-700">Integracao em Desenvolvimento</p>
              <p className="text-[11px] text-amber-600 mt-1 leading-relaxed">
                A integracao com a plataforma Certisign para assinatura digital esta em desenvolvimento.
                Por enquanto, voce pode avancar a etapa manualmente e enviar o contrato para assinatura por outros meios.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold
              text-slate-600 hover:bg-slate-50 transition-all"
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600
              text-white text-sm font-semibold shadow-sm
              hover:from-teal-600 hover:to-teal-700 transition-all disabled:opacity-50
              flex items-center justify-center gap-2"
          >
            {isPending
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Send size={14} />}
            Confirmar Envio
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Etapa Actions ───────────────────────────────────────────────────────────────

function EtapaActions({ etapa, solicitacaoId, onAvancar, onCancel, onEnviarAssinatura, isPending, nav }: {
  etapa: EtapaSolicitacao
  solicitacaoId: string
  onAvancar: (etapaPara: EtapaSolicitacao, obs?: string) => void
  onCancel: () => void
  onEnviarAssinatura: () => void
  isPending: boolean
  nav: ReturnType<typeof useNavigate>
}) {
  const btnPrimary = `w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold
    transition-all disabled:opacity-50`
  const btnSecondary = `w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold
    border transition-all`
  const spinner = (
    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
  )
  const spinnerDark = (
    <div className="w-3.5 h-3.5 border-2 border-slate-300/40 border-t-slate-500 rounded-full animate-spin" />
  )

  const cancelBtn = (
    <button onClick={onCancel} className={`${btnSecondary} border-red-200 text-red-600 hover:bg-red-50`}>
      <Ban size={12} /> Cancelar Solicitacao
    </button>
  )

  switch (etapa) {
    case 'solicitacao':
      return (
        <>
          <button
            onClick={() => onAvancar('preparar_minuta')}
            disabled={isPending}
            className={`${btnPrimary} bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm`}
          >
            {isPending ? spinner : <Send size={13} />}
            Enviar para Preparacao de Minuta
          </button>
          {cancelBtn}
        </>
      )

    case 'preparar_minuta':
      return (
        <>
          <button
            onClick={() => nav(`/contratos/solicitacoes/${solicitacaoId}/minuta`)}
            className={`${btnPrimary} bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm`}
          >
            <Pencil size={13} /> Ir para Minuta
          </button>
          <button
            onClick={() => onAvancar('solicitacao')}
            disabled={isPending}
            className={`${btnSecondary} border-slate-200 text-slate-600 hover:bg-slate-50`}
          >
            {isPending ? spinnerDark : <ArrowLeft size={12} />}
            Voltar para Solicitacao
          </button>
          {cancelBtn}
        </>
      )

    case 'resumo_executivo':
      return (
        <>
          <button
            onClick={() => nav(`/contratos/solicitacoes/${solicitacaoId}/resumo`)}
            className={`${btnPrimary} bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm`}
          >
            <Eye size={13} /> Ir para Resumo Executivo
          </button>
          <button
            onClick={() => onAvancar('preparar_minuta')}
            disabled={isPending}
            className={`${btnSecondary} border-slate-200 text-slate-600 hover:bg-slate-50`}
          >
            {isPending ? spinnerDark : <Pencil size={12} />}
            Revisar Minuta
          </button>
          {cancelBtn}
        </>
      )

    case 'aprovacao_diretoria':
      return (
        <>
          <button disabled className={`${btnPrimary} bg-amber-100 text-amber-700 cursor-not-allowed`}>
            <Clock size={13} /> Aguardando Aprovacao...
          </button>
          {cancelBtn}
        </>
      )

    case 'enviar_assinatura':
      return (
        <>
          <button
            onClick={onEnviarAssinatura}
            className={`${btnPrimary} bg-gradient-to-r from-teal-500 to-teal-600 text-white
              hover:from-teal-600 hover:to-teal-700 shadow-sm`}
          >
            <PenTool size={13} /> Enviar para Assinatura
          </button>
          <button
            onClick={() => onAvancar('arquivar')}
            disabled={isPending}
            className={`${btnSecondary} border-slate-200 text-slate-600 hover:bg-slate-50`}
          >
            {isPending ? spinnerDark : <ChevronRight size={12} />}
            Pular para Arquivamento
          </button>
          {cancelBtn}
        </>
      )

    case 'arquivar':
      return (
        <>
          <button
            onClick={() => onAvancar('liberar_execucao')}
            disabled={isPending}
            className={`${btnPrimary} bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm`}
          >
            {isPending ? spinner : <Archive size={13} />}
            Confirmar Arquivamento
          </button>
          {cancelBtn}
        </>
      )

    case 'liberar_execucao':
      return (
        <>
          <button
            onClick={() => onAvancar('concluido')}
            disabled={isPending}
            className={`${btnPrimary} bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm`}
          >
            {isPending ? spinner : <Unlock size={13} />}
            Liberar Execucao
          </button>
          {cancelBtn}
        </>
      )

    default:
      return null
  }
}

// ── Main Component ──────────────────────────────────────────────────────────────

export default function SolicitacaoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()

  const { data: solicitacao, isLoading } = useSolicitacao(id)
  const { data: historico = [] } = useSolicitacaoHistorico(id)
  const avancarEtapa = useAvancarEtapa()
  const cancelarSolicitacao = useCancelarSolicitacao()

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showCertisignModal, setShowCertisignModal] = useState(false)

  // ── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Not found ──────────────────────────────────────────────────────────
  if (!solicitacao) {
    return (
      <div className="text-center py-24">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <FileText size={28} className="text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-500">Solicitacao nao encontrada</p>
        <button
          onClick={() => nav('/contratos/solicitacoes')}
          className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold
            hover:bg-indigo-700 transition-all"
        >
          Voltar para lista
        </button>
      </div>
    )
  }

  const s = solicitacao as Solicitacao
  const etapa = s.etapa_atual

  const handleAvancar = async (etapaPara: EtapaSolicitacao, observacao?: string) => {
    await avancarEtapa.mutateAsync({
      solicitacaoId: s.id,
      etapaDe: etapa,
      etapaPara,
      observacao,
    })
  }

  const handleCancelar = async (motivo: string) => {
    await cancelarSolicitacao.mutateAsync({ id: s.id, motivo })
    setShowCancelModal(false)
  }

  const vigencia =
    s.data_inicio_prevista && s.data_fim_prevista
      ? `${fmtData(s.data_inicio_prevista)} a ${fmtData(s.data_fim_prevista)}`
      : s.prazo_meses
      ? `${s.prazo_meses} meses`
      : null

  const historicoSorted = [...historico].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => nav('/contratos/solicitacoes')}
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center
            justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300
            transition-all shrink-0 mt-0.5"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 rounded-full px-2.5 py-0.5 font-mono">
              {s.numero}
            </span>
            <EtapaBadge etapa={etapa} />
            <UrgenciaBadge urgencia={s.urgencia} />
          </div>
          <h1 className="text-xl font-extrabold text-slate-800 mt-1.5 leading-tight">
            {s.objeto}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Solicitado por {s.solicitante_nome} em {fmtData(s.created_at)}
          </p>
        </div>
      </div>

      {/* ── 2-column layout ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── LEFT (2/3) ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Dados da Solicitacao */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Info size={13} className="text-indigo-600" />
              </div>
              <h2 className="text-sm font-extrabold text-slate-800">Dados da Solicitacao</h2>
            </div>
            <div className="px-5 py-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <InfoItem label="Solicitante" value={s.solicitante_nome} icon={User} />
                <InfoItem label="Departamento" value={s.departamento} icon={Briefcase} />
                <InfoItem label="Obra" value={s.obra?.nome} icon={Building2} />
                <InfoItem
                  label="Contraparte"
                  value={`${s.contraparte_nome}${s.contraparte_cnpj ? ` (${s.contraparte_cnpj})` : ''}`}
                  icon={Building2}
                />
                <InfoItem label="Tipo de Contrato" value={TIPO_LABEL[s.tipo_contrato] ?? s.tipo_contrato} icon={Tag} />
                <InfoItem label="Categoria" value={CATEGORIA_LABEL[s.categoria_contrato] ?? s.categoria_contrato} icon={Tag} />
                <InfoItem label="Valor Estimado" value={s.valor_estimado ? fmt(s.valor_estimado) : undefined} icon={DollarSign} />
                <InfoItem label="Forma de Pagamento" value={s.forma_pagamento} icon={DollarSign} />
                <InfoItem label="Vigencia" value={vigencia} icon={Calendar} />
                <InfoItem label="Prazo (meses)" value={s.prazo_meses ? `${s.prazo_meses} meses` : undefined} icon={Clock} />
                <InfoItem label="Centro de Custo" value={s.centro_custo} icon={Briefcase} />
                <InfoItem label="Classe Financeira" value={s.classe_financeira} icon={Tag} />
                <InfoItem label="Indice Reajuste" value={s.indice_reajuste} icon={Tag} />
                <InfoItem label="Data Necessidade" value={s.data_necessidade ? fmtData(s.data_necessidade) : undefined} icon={Calendar} />
                <InfoItem label="Responsavel" value={s.responsavel_nome} icon={User} />
              </div>
            </div>
          </div>

          {/* Escopo e Justificativa */}
          {(s.descricao_escopo || s.justificativa) && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                  <FileText size={13} className="text-violet-600" />
                </div>
                <h2 className="text-sm font-extrabold text-slate-800">Escopo e Justificativa</h2>
              </div>
              <div className="px-5 py-4 space-y-4">
                {s.descricao_escopo && (
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                      Descricao do Escopo
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {s.descricao_escopo}
                    </p>
                  </div>
                )}
                {s.justificativa && (
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                      Justificativa
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {s.justificativa}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Documentos */}
          {s.documentos_ref && s.documentos_ref.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <FileText size={13} className="text-blue-600" />
                </div>
                <h2 className="text-sm font-extrabold text-slate-800">Documentos de Referencia</h2>
              </div>
              <div className="divide-y divide-slate-50">
                {s.documentos_ref.map((doc, idx) => (
                  <a
                    key={idx}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <FileText size={13} className="text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">
                        {doc.nome}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">{doc.tipo}</p>
                    </div>
                    <ExternalLink size={13} className="text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Observacoes */}
          {s.observacoes && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 px-5 py-4">
              <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider mb-1">Observacoes</p>
              <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">{s.observacoes}</p>
            </div>
          )}
        </div>

        {/* ── RIGHT (1/3) ────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Status / Stepper */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Clock size={14} className="text-indigo-500" /> Progresso
              </h2>
            </div>
            <div className="px-5 py-4">
              <VerticalStepper etapaAtual={etapa} />
            </div>
          </div>

          {/* Acoes */}
          {etapa !== 'concluido' && etapa !== 'cancelado' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <ChevronRight size={14} className="text-indigo-500" /> Acoes
                </h2>
              </div>
              <div className="px-5 py-4 space-y-2.5">
                <EtapaActions
                  etapa={etapa}
                  solicitacaoId={s.id}
                  onAvancar={handleAvancar}
                  onCancel={() => setShowCancelModal(true)}
                  onEnviarAssinatura={() => setShowCertisignModal(true)}
                  isPending={avancarEtapa.isPending}
                  nav={nav}
                />
              </div>
            </div>
          )}

          {/* Concluido badge */}
          {etapa === 'concluido' && (
            <div className="bg-emerald-50 rounded-2xl border border-emerald-200 px-5 py-5 text-center">
              <CheckCircle2 size={28} className="text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-extrabold text-emerald-700">Solicitacao Concluida</p>
              <p className="text-[10px] text-emerald-500 mt-1">Processo finalizado com sucesso</p>
            </div>
          )}

          {/* Cancelado badge */}
          {etapa === 'cancelado' && (
            <div className="bg-red-50 rounded-2xl border border-red-200 px-5 py-5 text-center">
              <XCircle size={28} className="text-red-500 mx-auto mb-2" />
              <p className="text-sm font-extrabold text-red-700">Solicitacao Cancelada</p>
              {s.motivo_cancelamento && (
                <p className="text-xs text-red-600 mt-2 leading-relaxed">{s.motivo_cancelamento}</p>
              )}
            </div>
          )}

          {/* Historico */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Clock size={14} className="text-slate-400" /> Historico
              </h2>
            </div>
            <div className="px-5 py-3">
              {historicoSorted.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Nenhuma transicao registrada</p>
              ) : (
                <div className="space-y-0">
                  {historicoSorted.map((h, idx) => (
                    <div key={h.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                        {idx < historicoSorted.length - 1 && (
                          <div className="w-px flex-1 bg-slate-200 my-1" />
                        )}
                      </div>
                      <div className="pb-4 min-w-0 flex-1">
                        <div className="flex items-center flex-wrap gap-1.5">
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                            {ETAPA_LABEL[h.etapa_de] ?? h.etapa_de}
                          </span>
                          <ChevronRight size={10} className="text-slate-300" />
                          <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5">
                            {ETAPA_LABEL[h.etapa_para] ?? h.etapa_para}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {fmtDataHora(h.created_at)}
                          {h.executado_nome && ` \u2014 ${h.executado_nome}`}
                        </p>
                        {h.observacao && (
                          <p className="text-[11px] text-slate-500 mt-1 leading-snug">{h.observacao}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Cancel Modal ────────────────────────────────────────────── */}
      <CancelModal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelar}
        isPending={cancelarSolicitacao.isPending}
      />
    </div>
  )
}
