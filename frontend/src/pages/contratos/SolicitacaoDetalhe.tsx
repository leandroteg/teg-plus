import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../services/supabase'
import {
  ArrowLeft, FileText, ExternalLink, Clock, CheckCircle2,
  XCircle, AlertTriangle, ChevronRight, Send,
  Archive, Unlock, Ban, Eye, Pencil, Building2, Calendar,
  DollarSign, User, Briefcase, Tag, ShieldCheck, Info, PenTool, X,
  Plus, Trash2, Users, Upload, FileCheck2,
} from 'lucide-react'
import {
  useSolicitacao,
  useSolicitacaoHistorico,
  useAvancarEtapa,
  useCancelarSolicitacao,
  useEnviarAssinatura,
  useConfirmarAssinatura,
  useMinutas,
  useResumoExecutivo,
  useAssinaturas,
} from '../../hooks/useSolicitacoes'
import { GRUPO_CONTRATO_LABEL } from '../../constants/contratos'
import type { GrupoContrato } from '../../types/contratos'
import type { EtapaSolicitacao, ParcelaPlanejada, Solicitacao, TipoAssinatura } from '../../types/contratos'
import { calcularDiferencaParcelas, normalizarParcelasPlanejadas, sugerirParcelasContrato } from '../../utils/contratosParcelas'
import NumericInput from '../../components/NumericInput'

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
  { key: 'solicitacao',         label: 'Solicitação',         icon: FileText },
  { key: 'preparar_minuta',     label: 'Preparar Minuta',     icon: Pencil },
  { key: 'resumo_executivo',    label: 'Resumo Executivo',    icon: Eye },
  { key: 'aprovacao_diretoria', label: 'Aprovação Diretoria', icon: ShieldCheck },
  { key: 'enviar_assinatura',   label: 'Enviar Assinatura',   icon: Send },
  { key: 'arquivar',            label: 'Arquivar',            icon: Archive },
  { key: 'liberar_execucao',    label: 'Liberar Execução',    icon: Unlock },
]

const ETAPA_LABEL: Record<string, string> = {
  solicitacao:         'Solicitação',
  preparar_minuta:     'Preparar Minuta',
  resumo_executivo:    'Resumo Executivo',
  aprovacao_diretoria: 'Aprovação Diretoria',
  enviar_assinatura:   'Enviar Assinatura',
  arquivar:            'Arquivar',
  liberar_execucao:    'Liberar Execução',
  concluido:           'Concluído',
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

// CATEGORIA_LABEL removido — usar GRUPO_CONTRATO_LABEL de constants/contratos

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
              {isConcluido ? 'Concluído' : 'Cancelado'}
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
            <h3 className="text-base font-extrabold text-slate-800">Cancelar Solicitação</h3>
            <p className="text-xs text-slate-400">Esta ação não pode ser desfeita.</p>
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

function CertisignModal({ open, onClose, solicitacao, minutaUrl, onSuccess }: {
  open: boolean
  onClose: () => void
  solicitacao: Solicitacao
  minutaUrl: string | null
  onSuccess: () => void | Promise<void>
}) {
  const [signatarios, setSignatarios] = useState<{ nome: string; email: string; cpf: string; papel: string }[]>([
    { nome: '', email: '', cpf: '', papel: 'Contratante' },
    { nome: '', email: '', cpf: '', papel: 'Contratada' },
  ])
  const [tipoAssinatura, setTipoAssinatura] = useState<TipoAssinatura>('eletronica')
  const [erro, setErro] = useState<string | null>(null)
  const enviar = useEnviarAssinatura()

  if (!open) return null

  const addSignatario = () =>
    setSignatarios(prev => [...prev, { nome: '', email: '', cpf: '', papel: '' }])

  const removeSignatario = (idx: number) =>
    setSignatarios(prev => prev.filter((_, i) => i !== idx))

  const updateSignatario = (idx: number, field: string, value: string) =>
    setSignatarios(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))

  const handleSubmit = async () => {
    setErro(null)
    if (!minutaUrl) { setErro('Nenhuma minuta disponível para envio.'); return }
    const invalidos = signatarios.filter(s => !s.nome || !s.email || !s.cpf)
    if (invalidos.length) { setErro('Preencha nome, e-mail e CPF de todos os signatários.'); return }
    try {
      await enviar.mutateAsync({
        solicitacao_id: solicitacao.id,
        minuta_url: minutaUrl,
        tipo_assinatura: tipoAssinatura,
        signatarios: signatarios.map(s => ({ nome: s.nome, email: s.email, cpf: s.cpf, papel: s.papel })),
      })
      // Avançar etapa ANTES de fechar o modal — await garante que erros sejam capturados
      await onSuccess()
      onClose()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido ao enviar.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-sm">
              <PenTool size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">Enviar para Assinatura</h3>
              <p className="text-xs text-slate-400">Integração Certisign — {solicitacao.numero}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Erro */}
        {erro && (
          <div className="bg-red-50 rounded-xl border border-red-200 px-4 py-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700 font-medium">{erro}</p>
          </div>
        )}

        {/* Tipo assinatura */}
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1.5 block">Tipo de Assinatura</label>
          <select
            value={tipoAssinatura}
            onChange={e => setTipoAssinatura(e.target.value as TipoAssinatura)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          >
            <option value="eletronica">Eletronica</option>
            <option value="digital_icp">Digital ICP-Brasil</option>
          </select>
        </div>

        {/* Signatarios */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-teal-600" />
              <span className="text-xs font-bold text-slate-600">Signatarios ({signatarios.length})</span>
            </div>
            <button
              type="button"
              onClick={addSignatario}
              className="flex items-center gap-1 text-[11px] font-bold text-teal-600 hover:text-teal-700 transition-colors"
            >
              <Plus size={12} /> Adicionar
            </button>
          </div>

          <div className="space-y-3">
            {signatarios.map((s, idx) => (
              <div key={idx} className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Signatario {idx + 1}
                  </span>
                  {signatarios.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSignatario(idx)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={s.nome}
                    onChange={e => updateSignatario(idx, 'nome', e.target.value)}
                    placeholder="Nome completo"
                    className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/30 bg-white"
                  />
                  <input
                    value={s.email}
                    onChange={e => updateSignatario(idx, 'email', e.target.value)}
                    placeholder="E-mail"
                    className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/30 bg-white"
                  />
                  <input
                    value={s.cpf}
                    onChange={e => updateSignatario(idx, 'cpf', e.target.value)}
                    placeholder="CPF"
                    className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/30 bg-white"
                  />
                  <input
                    value={s.papel}
                    onChange={e => updateSignatario(idx, 'papel', e.target.value)}
                    placeholder="Papel (ex: Contratante)"
                    className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/30 bg-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold
              text-slate-600 hover:bg-slate-50 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={enviar.isPending}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600
              text-white text-sm font-semibold shadow-sm
              hover:from-teal-600 hover:to-teal-700 transition-all disabled:opacity-50
              flex items-center justify-center gap-2"
          >
            {enviar.isPending
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Send size={14} />}
            Enviar para Certisign
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Confirmar Assinatura Modal (manual / externo) ───────────────────────────────

function ConfirmarAssinaturaModal({ open, onClose, solicitacaoId, onSuccess }: {
  open: boolean
  onClose: () => void
  solicitacaoId: string
  onSuccess: () => void | Promise<void>
}) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const confirmar = useConfirmarAssinatura()

  if (!open) return null

  const handleSubmit = async () => {
    setErro(null)
    try {
      await confirmar.mutateAsync({
        solicitacao_id: solicitacaoId,
        arquivo: arquivo ?? undefined,
        observacao: observacao || undefined,
      })
      await onSuccess()
      onClose()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <FileCheck2 size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">Confirmar Assinatura</h3>
              <p className="text-xs text-slate-400">Assinatura realizada fora do sistema ou via Certisign</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {erro && (
          <div className="bg-red-50 rounded-xl border border-red-200 px-4 py-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700 font-medium">{erro}</p>
          </div>
        )}

        {/* Upload cópia assinada */}
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1.5 block">
            Cópia Assinada (PDF)
          </label>
          <div className="relative">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={e => setArquivo(e.target.files?.[0] ?? null)}
              className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
                file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700
                hover:file:bg-emerald-100 file:cursor-pointer file:transition-colors
                border border-slate-200 rounded-xl px-3 py-2"
            />
          </div>
          {arquivo && (
            <p className="text-[10px] text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
              <FileCheck2 size={10} /> {arquivo.name} ({(arquivo.size / 1024).toFixed(0)} KB)
            </p>
          )}
          <p className="text-[10px] text-slate-400 mt-1">
            Opcional — anexe a cópia assinada do contrato (PDF, DOC ou imagem)
          </p>
        </div>

        {/* Observação */}
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1.5 block">Observação</label>
          <textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            placeholder="Ex: Assinado presencialmente em reunião, assinado via DocuSign, etc."
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold
              text-slate-600 hover:bg-slate-50 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={confirmar.isPending}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600
              text-white text-sm font-semibold shadow-sm
              hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50
              flex items-center justify-center gap-2"
          >
            {confirmar.isPending
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <CheckCircle2 size={14} />}
            Confirmar Assinatura
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Etapa Actions ───────────────────────────────────────────────────────────────

function PlanejamentoParcelasCard({
  parcelas,
  valorContrato,
  destinoFinanceiro,
  onChange,
  onRegenerar,
}: {
  parcelas: ParcelaPlanejada[]
  valorContrato: number
  destinoFinanceiro: 'cp' | 'cr'
  onChange: (parcelas: ParcelaPlanejada[]) => void
  onRegenerar: () => void
}) {
  const diferenca = calcularDiferencaParcelas(parcelas, valorContrato)
  const totalPlanejado = parcelas.reduce((acc, parcela) => acc + parcela.valor, 0)

  const updateParcela = (index: number, patch: Partial<ParcelaPlanejada>) => {
    onChange(parcelas.map((parcela, currentIndex) => (
      currentIndex === index ? { ...parcela, ...patch } : parcela
    )))
  }

  const addParcela = () => {
    const ultima = parcelas[parcelas.length - 1]
    onChange([
      ...parcelas,
      {
        numero: parcelas.length + 1,
        valor: 0,
        data_vencimento: ultima?.data_vencimento ?? new Date().toISOString().slice(0, 10),
      },
    ])
  }

  const removeParcela = (index: number) => {
    onChange(
      parcelas
        .filter((_, currentIndex) => currentIndex !== index)
        .map((parcela, currentIndex) => ({ ...parcela, numero: currentIndex + 1 })),
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-slate-800">Planejamento de Parcelas</h2>
          <p className="text-xs text-slate-400 mt-1">
            As parcelas serao criadas como {destinoFinanceiro === 'cp' ? 'CP previstas' : 'CR previstas'} ao liberar a execucao.
          </p>
        </div>
        <button
          onClick={onRegenerar}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all"
        >
          Regenerar
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Destino</p>
            <p className="text-sm font-bold text-slate-700 mt-1">{destinoFinanceiro === 'cp' ? 'Financeiro > CP' : 'Financeiro > CR'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Valor do Contrato</p>
            <p className="text-sm font-bold text-slate-700 mt-1">{fmt(valorContrato || 0)}</p>
          </div>
          <div className={`rounded-xl border px-4 py-3 ${Math.abs(diferenca) <= 0.05 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Planejado</p>
            <p className={`text-sm font-bold mt-1 ${Math.abs(diferenca) <= 0.05 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {fmt(totalPlanejado)}
            </p>
            <p className="text-[11px] mt-1 text-slate-500">
              {Math.abs(diferenca) <= 0.05 ? 'Total conciliado com o contrato' : `Diferenca de ${fmt(Math.abs(diferenca))}`}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {parcelas.map((parcela, index) => (
            <div key={`${parcela.numero}-${index}`} className="grid grid-cols-[72px_1fr_1fr_44px] gap-2 items-center">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Parcela</p>
                <p className="text-sm font-bold text-slate-700">{parcela.numero}</p>
              </div>
              <input
                type="date"
                value={parcela.data_vencimento}
                onChange={(event) => updateParcela(index, { data_vencimento: event.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
              />
              <NumericInput
                min={0}
                step={0.01}
                value={Number.isFinite(parcela.valor) ? parcela.valor : 0}
                onChange={v => updateParcela(index, { valor: v })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
              />
              <button
                onClick={() => removeParcela(index)}
                disabled={parcelas.length === 1}
                className="w-11 h-11 rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 size={14} className="mx-auto" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addParcela}
          className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
        >
          <Plus size={12} /> Adicionar Parcela
        </button>
      </div>
    </div>
  )
}

function EtapaActions({ etapa, solicitacaoId, onAvancar, onCancel, onEnviarAssinatura, onConfirmarAssinatura, isPending, nav, jaEnviado }: {
  etapa: EtapaSolicitacao
  solicitacaoId: string
  onAvancar: (etapaPara: EtapaSolicitacao, obs?: string) => void
  onCancel: () => void
  onEnviarAssinatura: () => void
  onConfirmarAssinatura: () => void
  isPending: boolean
  nav: ReturnType<typeof useNavigate>
  jaEnviado?: boolean
}) {
  const { role, hasSetorPapel } = useAuth()
  const canReleaseExecution = role === 'administrador'
    || role === 'diretor'
    || hasSetorPapel('contratos', ['supervisor', 'diretor', 'ceo'])
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
      <Ban size={12} /> Cancelar Solicitação
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
            Enviar para Preparação de Minuta
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
            Voltar para Solicitação
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

    case 'aprovacao_diretoria': {
      const canApproveHere = role === 'administrador' || role === 'diretor' || role === 'supervisor'
        || hasSetorPapel('contratos', ['supervisor', 'diretor', 'ceo'])
      const [approving, setApproving] = useState(false)
      return (
        <>
          {canApproveHere ? (
            <button
              disabled={approving || isPending}
              onClick={async () => {
                setApproving(true)
                try {
                  // Aprovar em apr_aprovacoes
                  await supabase
                    .from('apr_aprovacoes')
                    .update({ status: 'aprovada', updated_at: new Date().toISOString() })
                    .eq('entidade_id', solicitacaoId)
                    .eq('modulo', 'con')
                    .eq('status', 'pendente')
                  // Avançar etapa
                  onAvancar('enviar_assinatura', 'Aprovado pela diretoria')
                } catch {
                  setApproving(false)
                }
              }}
              className={`${btnPrimary} bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-sm`}
            >
              {approving ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={13} />}
              Aprovar Solicitação
            </button>
          ) : (
            <button disabled className={`${btnPrimary} bg-amber-100 text-amber-700 cursor-not-allowed`}>
              <Clock size={13} /> Aguardando Aprovação...
            </button>
          )}
          {cancelBtn}
        </>
      )
    }

    case 'enviar_assinatura':
      return (
        <>
          {jaEnviado ? (
            <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-700">
              <CheckCircle2 size={14} />
              <span className="text-xs font-semibold">Enviado para assinatura via Certisign</span>
            </div>
          ) : (
            <button
              onClick={onEnviarAssinatura}
              className={`${btnPrimary} bg-gradient-to-r from-teal-500 to-teal-600 text-white
                hover:from-teal-600 hover:to-teal-700 shadow-sm`}
            >
              <PenTool size={13} /> Enviar via Certisign
            </button>
          )}
          <button
            onClick={onConfirmarAssinatura}
            className={`${btnPrimary} bg-gradient-to-r from-emerald-500 to-emerald-600 text-white
              hover:from-emerald-600 hover:to-emerald-700 shadow-sm`}
          >
            <FileCheck2 size={13} /> Assinatura Confirmada
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
            disabled={isPending || !canReleaseExecution}
            className={`${btnPrimary} bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm`}
          >
            {isPending ? spinner : <Unlock size={13} />}
            Liberar Execução
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
  const { role, hasSetorPapel } = useAuth()

  const { data: solicitacao, isLoading } = useSolicitacao(id)
  const { data: resumoExecutivo } = useResumoExecutivo(id)
  const { data: historico = [] } = useSolicitacaoHistorico(id)
  const avancarEtapa = useAvancarEtapa()
  const cancelarSolicitacao = useCancelarSolicitacao()
  const { data: minutas } = useMinutas(id)
  const { data: assinaturas = [] } = useAssinaturas(id)

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showCertisignModal, setShowCertisignModal] = useState(false)
  const [showConfirmarAssinaturaModal, setShowConfirmarAssinaturaModal] = useState(false)
  const [parcelasPlanejadas, setParcelasPlanejadas] = useState<ParcelaPlanejada[]>([])
  const [parcelasTouched, setParcelasTouched] = useState(false)
  const [execucaoErro, setExecucaoErro] = useState('')

  // Hook must be called unconditionally (before any early return)
  const etapaAtual = solicitacao?.etapa_atual
  const valorContrato_ = Number(resumoExecutivo?.valor_total ?? solicitacao?.valor_estimado ?? 0)
  useEffect(() => {
    if (!solicitacao) return
    if (etapaAtual !== 'liberar_execucao' || parcelasTouched) return

    setParcelasPlanejadas(sugerirParcelasContrato({
      solicitacao: {
        forma_pagamento: solicitacao.forma_pagamento,
        valor_estimado: valorContrato_,
        data_inicio_prevista: solicitacao.data_inicio_prevista,
        data_fim_prevista: solicitacao.data_fim_prevista,
        prazo_meses: solicitacao.prazo_meses,
      },
      resumo: resumoExecutivo ?? null,
    }))
  }, [
    solicitacao,
    etapaAtual,
    parcelasTouched,
    resumoExecutivo,
    valorContrato_,
  ])

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
        <p className="text-sm font-semibold text-slate-500">Solicitação não encontrada</p>
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
  const valorContrato = Number(resumoExecutivo?.valor_total ?? s.valor_estimado ?? 0)
  const destinoFinanceiro = s.tipo_contrato === 'receita' ? 'cr' : 'cp'
  const canReleaseExecution = role === 'administrador'
    || role === 'diretor'
    || hasSetorPapel('contratos', ['supervisor', 'diretor', 'ceo'])

  const handleAvancar = async (
    etapaPara: EtapaSolicitacao,
    observacao?: string,
    dadosEtapa?: Record<string, unknown>,
  ) => {
    await avancarEtapa.mutateAsync({
      solicitacaoId: s.id,
      etapaDe: etapa,
      etapaPara,
      observacao,
      dadosEtapa,
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

  const handleRegenerarParcelas = () => {
    setParcelasTouched(false)
    setExecucaoErro('')
    setParcelasPlanejadas(sugerirParcelasContrato({
      solicitacao: {
        forma_pagamento: s.forma_pagamento,
        valor_estimado: valorContrato,
        data_inicio_prevista: s.data_inicio_prevista,
        data_fim_prevista: s.data_fim_prevista,
        prazo_meses: s.prazo_meses,
      },
      resumo: resumoExecutivo ?? null,
    }))
  }

  const handleChangeParcelas = (next: ParcelaPlanejada[]) => {
    setParcelasTouched(true)
    setExecucaoErro('')
    setParcelasPlanejadas(normalizarParcelasPlanejadas(next))
  }

  const handleLiberarExecucao = async () => {
    if (!canReleaseExecution) {
      setExecucaoErro('Somente Supervisor de Contratos ou Diretor pode liberar a execução.')
      return
    }

    const parcelasNormalizadas = normalizarParcelasPlanejadas(
      parcelasPlanejadas.filter(p => p.data_vencimento && p.valor > 0),
      valorContrato
    )
    const diferenca = calcularDiferencaParcelas(parcelasNormalizadas, valorContrato)

    if (!parcelasNormalizadas.length) {
      setExecucaoErro('Adicione pelo menos uma parcela antes de liberar a execução.')
      return
    }

    if (Math.abs(diferenca) > 0.05) {
      setExecucaoErro('O total das parcelas precisa fechar com o valor do contrato antes de liberar a execução.')
      return
    }

    await handleAvancar(
      'concluido',
      `Contrato liberado para execucao com ${parcelasNormalizadas.length} parcelas previstas no financeiro`,
      {
        parcelas_planejadas: parcelasNormalizadas,
        financeiro_destino: destinoFinanceiro,
        resumo_executivo_id: resumoExecutivo?.id ?? null,
      },
    )
  }

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
              <h2 className="text-sm font-extrabold text-slate-800">Dados da Solicitação</h2>
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
                <InfoItem label="Categoria" value={(() => {
                  const grupoLabel = GRUPO_CONTRATO_LABEL[s.grupo_contrato as GrupoContrato] ?? s.grupo_contrato ?? s.categoria_contrato
                  return s.subtipo_contrato ? `${grupoLabel} — ${s.subtipo_contrato}` : grupoLabel
                })()} icon={Tag} />
                <InfoItem label={(s as any).recorrente ? 'Valor Total (contrato)' : 'Valor Estimado'} value={s.valor_estimado ? fmt(s.valor_estimado) : undefined} icon={DollarSign} />
                {(s as any).valor_mensal && (
                  <InfoItem label="Valor Mensal" value={`${fmt((s as any).valor_mensal)}${s.prazo_meses ? ` × ${s.prazo_meses} meses` : ''}`} icon={DollarSign} />
                )}
                <InfoItem label="Forma de Pagamento" value={s.forma_pagamento} icon={DollarSign} />
                <InfoItem label="Vigência" value={vigencia} icon={Calendar} />
                <InfoItem label="Prazo (meses)" value={s.prazo_meses ? `${s.prazo_meses} meses` : undefined} icon={Clock} />
                <InfoItem label="Centro de Custo" value={s.centro_custo} icon={Briefcase} />
                <InfoItem label="Classe Financeira" value={s.classe_financeira} icon={Tag} />
                <InfoItem label="Índice Reajuste" value={s.indice_reajuste} icon={Tag} />
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

          {etapa === 'liberar_execucao' && (
            <PlanejamentoParcelasCard
              parcelas={parcelasPlanejadas}
              valorContrato={valorContrato}
              destinoFinanceiro={destinoFinanceiro}
              onChange={handleChangeParcelas}
              onRegenerar={handleRegenerarParcelas}
            />
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
                  <ChevronRight size={14} className="text-indigo-500" /> Ações
                </h2>
              </div>
              <div className="px-5 py-4 space-y-2.5">
                {etapa === 'liberar_execucao' ? (
                  <>
                    <button
                      onClick={handleLiberarExecucao}
                      disabled={avancarEtapa.isPending || !canReleaseExecution}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50"
                    >
                      {avancarEtapa.isPending
                        ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        : <Unlock size={13} />}
                      Liberar Execução
                    </button>
                    {execucaoErro && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-[11px] font-medium text-amber-700">{execucaoErro}</p>
                      </div>
                    )}
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-all"
                    >
                      <Ban size={12} /> Cancelar Solicitação
                    </button>
                  </>
                ) : (
                  <EtapaActions
                    etapa={etapa}
                    solicitacaoId={s.id}
                    onAvancar={handleAvancar}
                    onCancel={() => setShowCancelModal(true)}
                    onEnviarAssinatura={() => setShowCertisignModal(true)}
                    onConfirmarAssinatura={() => setShowConfirmarAssinaturaModal(true)}
                    isPending={avancarEtapa.isPending}
                    nav={nav}
                    jaEnviado={assinaturas.some(a => a.status === 'enviado' || a.status === 'assinado')}
                  />
                )}
              </div>
            </div>
          )}

          {/* Concluido badge */}
          {etapa === 'concluido' && (
            <div className="bg-emerald-50 rounded-2xl border border-emerald-200 px-5 py-5 text-center">
              <CheckCircle2 size={28} className="text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-extrabold text-emerald-700">Solicitação Concluída</p>
              <p className="text-[10px] text-emerald-500 mt-1">Processo finalizado com sucesso</p>
            </div>
          )}

          {/* Cancelado badge */}
          {etapa === 'cancelado' && (
            <div className="bg-red-50 rounded-2xl border border-red-200 px-5 py-5 text-center">
              <XCircle size={28} className="text-red-500 mx-auto mb-2" />
              <p className="text-sm font-extrabold text-red-700">Solicitação Cancelada</p>
              {s.motivo_cancelamento && (
                <p className="text-xs text-red-600 mt-2 leading-relaxed">{s.motivo_cancelamento}</p>
              )}
            </div>
          )}

          {/* Historico */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Clock size={14} className="text-slate-400" /> Histórico
              </h2>
            </div>
            <div className="px-5 py-3">
              {historicoSorted.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Nenhuma transição registrada</p>
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

      {/* ── Certisign Modal ──────────────────────────────────────────── */}
      <CertisignModal
        open={showCertisignModal}
        onClose={() => setShowCertisignModal(false)}
        solicitacao={solicitacao}
        minutaUrl={minutas?.find(m => m.arquivo_url)?.arquivo_url ?? null}
        onSuccess={async () => {
          // Não avança etapa — permanece em enviar_assinatura
          // A etapa avança quando: callback Certisign confirma ou "Assinatura Confirmada" manual
        }}
      />

      {/* ── Confirmar Assinatura Modal ─────────────────────────────────── */}
      <ConfirmarAssinaturaModal
        open={showConfirmarAssinaturaModal}
        onClose={() => setShowConfirmarAssinaturaModal(false)}
        solicitacaoId={s.id}
        onSuccess={() => handleAvancar('arquivar')}
      />
    </div>
  )
}
