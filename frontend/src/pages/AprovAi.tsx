import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle, XCircle, ChevronDown, ChevronRight,
  Clock, Building, Sparkles, Shield, AlertTriangle,
  MessageSquare, ExternalLink, ArrowLeft,
  FileSearch, Banknote, FileSignature, ShoppingCart,
  History, ListChecks, Timer, TrendingUp, Filter,
  Calendar, FileText, Download,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  useAprovacoesPendentes,
  useDecisaoRequisicao,
  useDecisaoGenerica,
  useHistoricoAprovacoes,
  useAprovacaoKPIs,
} from '../hooks/useAprovacoes'
import type { HistoricoFiltros } from '../hooks/useAprovacoes'
import FluxoTimeline from '../components/FluxoTimeline'
import type { AprovacaoPendente, AprovacaoHistorico, TipoAprovacao } from '../types'

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const urgenciaConfig: Record<string, { bg: string; text: string; label: string }> = {
  normal:  { bg: 'bg-slate-100',  text: 'text-slate-600',  label: 'Normal'  },
  urgente: { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Urgente' },
  critica: { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Critica' },
}

const tipoConfig: Record<TipoAprovacao, {
  label: string
  icon: typeof ShoppingCart
  color: string
  bgLight: string
  textColor: string
  borderColor: string
  badgeBg: string
  badgeText: string
  headerBg: string
}> = {
  cotacao: {
    label: 'Aprovacao Compras',
    icon: FileSearch,
    color: 'blue',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    headerBg: 'bg-gradient-to-r from-blue-600 to-blue-500',
  },
  autorizacao_pagamento: {
    label: 'Autorizacoes de Pagamento',
    icon: Banknote,
    color: 'amber',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    headerBg: 'bg-gradient-to-r from-amber-600 to-amber-500',
  },
  minuta_contratual: {
    label: 'Minutas Contratuais',
    icon: FileSignature,
    color: 'violet',
    bgLight: 'bg-violet-50',
    textColor: 'text-violet-700',
    borderColor: 'border-violet-200',
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-700',
    headerBg: 'bg-gradient-to-r from-violet-600 to-violet-500',
  },
  requisicao_compra: {
    label: 'Validacao Tec. Requisicao de Compra',
    icon: ShoppingCart,
    color: 'teal',
    bgLight: 'bg-teal-50',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-200',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-700',
    headerBg: 'bg-gradient-to-r from-teal-600 to-teal-500',
  },
}

const tipoOrder: TipoAprovacao[] = [
  'cotacao',
  'autorizacao_pagamento',
  'minuta_contratual',
  'requisicao_compra',
]

function timeLeft(dateStr?: string): string {
  if (!dateStr) return ''
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return 'Expirado'
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h restantes`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

function getAlcada(valor: number, nivel: number) {
  if (valor <= 2000) return { label: `Alcada 1`, sublabel: `Welton ou Claudinor <= R$2.000` }
  if (nivel <= 2)    return { label: 'Alcada 2', sublabel: 'Laucidio > R$2.000' }
  return { label: 'Aprovacao de Pagamento', sublabel: 'Laucidio -- etapa final' }
}

function formatDateShort(dateStr?: string): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── AprovacaoCard (requisicoes de compra — card completo) ──────────────────────

function AprovacaoCard({ aprovacao, aprovadorNome, aprovadorEmail }: {
  aprovacao: AprovacaoPendente
  aprovadorNome: string
  aprovadorEmail: string
}) {
  const mutation = useDecisaoRequisicao()
  const [expanded, setExpanded] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [action, setAction] = useState<'aprovada' | 'rejeitada' | 'esclarecimento' | null>(null)

  const req  = aprovacao.requisicao
  const cot  = aprovacao.cotacao_resumo

  if (!req) return null

  const urg  = urgenciaConfig[req.urgencia] || urgenciaConfig.normal
  const alc  = getAlcada(req.valor_estimado, aprovacao.nivel)

  const handleDecision = async (decisao: 'aprovada' | 'rejeitada') => {
    setAction(decisao)
    try {
      await mutation.mutateAsync({
        requisicaoId: aprovacao.requisicao_id,
        decisao,
        observacao: observacao || undefined,
        requisicaoNumero: req.numero,
        alcadaNivel: aprovacao.nivel,
        aprovadorNome,
        aprovadorEmail,
        categoria: req.categoria,
        currentStatus: req.status,
      })
    } catch { /* error handled by mutation state */ }
  }

  const handleEsclarecimento = async () => {
    if (!observacao.trim()) {
      setExpanded(true)
      setAction('esclarecimento')
      return
    }
    setAction('esclarecimento')
    try {
      await mutation.mutateAsync({
        requisicaoId: aprovacao.requisicao_id,
        decisao: 'esclarecimento',
        observacao,
        requisicaoNumero: req.numero,
        alcadaNivel: aprovacao.nivel,
        aprovadorNome,
        aprovadorEmail,
        categoria: req.categoria,
        currentStatus: req.status,
      })
    } catch { /* error handled by mutation state */ }
  }

  // Resultado pos-decisao
  if (mutation.isSuccess) {
    const colors = action === 'aprovada'
      ? { bg: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-500', text: 'text-emerald-700', msg: 'Aprovada' }
      : action === 'esclarecimento'
      ? { bg: 'bg-amber-50 border-amber-200', icon: 'text-amber-500', text: 'text-amber-700', msg: 'Esclarecimento solicitado' }
      : { bg: 'bg-red-50 border-red-200', icon: 'text-red-500', text: 'text-red-700', msg: 'Rejeitada' }

    return (
      <div className={`rounded-2xl p-6 text-center border-2 ${colors.bg}`}>
        {action === 'aprovada' && <CheckCircle size={44} className={`${colors.icon} mx-auto mb-3`} />}
        {action === 'rejeitada' && <XCircle size={44} className={`${colors.icon} mx-auto mb-3`} />}
        {action === 'esclarecimento' && <MessageSquare size={44} className={`${colors.icon} mx-auto mb-3`} />}
        <p className={`font-bold text-base ${colors.text}`}>
          {req.numero} -- {colors.msg}
        </p>
        <p className="text-xs text-slate-500 mt-1">Aprovador notificado automaticamente</p>
      </div>
    )
  }

  // Card principal
  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
      {/* Badge de nivel / tipo */}
      <div className="bg-indigo-600 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-indigo-200" />
          <span className="text-xs font-bold text-white">{alc.label}</span>
          <span className="text-indigo-300 text-[10px]">{alc.sublabel}</span>
        </div>
        {aprovacao.data_limite && (
          <span className="text-[10px] text-indigo-200 font-semibold flex items-center gap-1">
            <Clock size={10} /> {timeLeft(aprovacao.data_limite)}
          </span>
        )}
      </div>

      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-sm font-bold text-slate-800">{req.numero}</p>
            <p className="text-xs text-slate-500">{req.solicitante_nome}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${urg.bg} ${urg.text}`}>
            {urg.label}
          </span>
        </div>

        <p className="text-sm text-slate-700 mb-2">{req.descricao}</p>

        <a
          href={`/requisicoes/${req.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-indigo-400 font-semibold hover:text-indigo-600 transition mb-3"
        >
          <ExternalLink size={11} /> Ver detalhes completos
        </a>

        {/* Obra */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
          <Building size={12} /> {req.obra_nome}
          {req.categoria && (
            <>
              <span className="text-slate-300">|</span>
              <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                {req.categoria.replace(/_/g, ' ')}
              </span>
            </>
          )}
        </div>

        {/* FluxoTimeline compact */}
        <FluxoTimeline status={req.status} compact className="mb-3" />

        {/* Valor + Cotacao */}
        <div className="bg-slate-50 rounded-2xl p-3.5 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Valor estimado</span>
            <span className="text-lg font-extrabold text-indigo-600">{fmt(req.valor_estimado)}</span>
          </div>

          {cot && (
            <div className="border-t border-slate-200 pt-2 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Menor cotacao</span>
                <span className="text-lg font-extrabold text-emerald-600">{fmt(cot.valor)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>{cot.fornecedor_nome}</span>
                <span>{cot.prazo_dias}d | {cot.total_cotados} cotado{cot.total_cotados !== 1 ? 's' : ''}</span>
              </div>
              {cot.valor < req.valor_estimado && (
                <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                  <Sparkles size={11} />
                  Economia de {fmt(req.valor_estimado - cot.valor)}{' '}
                  ({Math.round((1 - cot.valor / req.valor_estimado) * 100)}%)
                </div>
              )}
            </div>
          )}

          {!cot && req.valor_estimado > 2000 && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-600">
              <AlertTriangle size={11} /> Valor acima de R$2.000 -- alcada Laucidio
            </div>
          )}
        </div>

        {/* Expandir para observacao */}
        <button type="button" onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-indigo-500 mt-3 mx-auto font-semibold">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {expanded ? 'Menos detalhes' : 'Adicionar observacao'}
        </button>

        {expanded && (
          <div className="mt-3">
            <label className="text-xs text-slate-400">
              {action === 'esclarecimento' ? 'Descreva o esclarecimento necessario (obrigatorio)' : 'Observacao (opcional)'}
            </label>
            <textarea
              rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:ring-2 focus:ring-indigo-300 outline-none"
              placeholder={action === 'esclarecimento' ? 'O que precisa ser esclarecido...' : 'Motivo da decisao...'}
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Botoes de acao -- 3 colunas */}
      <div className="grid grid-cols-3 border-t border-slate-100">
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => handleDecision('rejeitada')}
          className="flex flex-col items-center justify-center gap-1 py-4 text-xs font-bold text-red-500 hover:bg-red-50 active:bg-red-100 transition border-r border-slate-100 disabled:opacity-50"
        >
          {mutation.isPending && action === 'rejeitada'
            ? <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            : <XCircle size={20} />}
          <span>Rejeitar</span>
        </button>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={handleEsclarecimento}
          className="flex flex-col items-center justify-center gap-1 py-4 text-xs font-bold text-amber-600 hover:bg-amber-50 active:bg-amber-100 transition border-r border-slate-100 disabled:opacity-50"
        >
          {mutation.isPending && action === 'esclarecimento'
            ? <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            : <MessageSquare size={20} />}
          <span>Esclarecer</span>
        </button>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => handleDecision('aprovada')}
          className="flex flex-col items-center justify-center gap-1 py-4 text-xs font-bold text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 transition disabled:opacity-50"
        >
          {mutation.isPending && action === 'aprovada'
            ? <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            : <CheckCircle size={20} />}
          <span>Aprovar</span>
        </button>
      </div>

      {mutation.isError && (
        <p className="text-red-500 text-xs text-center py-2 border-t border-red-100">
          Erro ao processar: {mutation.error?.message || 'Tente novamente.'}
        </p>
      )}
    </div>
  )
}

// ── GenericPendingCard (cotacao, autorizacao_pagamento, minuta_contratual) ─────

function GenericPendingCard({ aprovacao, aprovadorNome, aprovadorEmail }: {
  aprovacao: AprovacaoPendente
  aprovadorNome: string
  aprovadorEmail: string
}) {
  const mutation = useDecisaoGenerica()
  const [expanded, setExpanded] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [action, setAction] = useState<'aprovada' | 'rejeitada' | null>(null)

  const tipo = tipoConfig[aprovacao.tipo_aprovacao] || tipoConfig.requisicao_compra
  const IconComp = tipo.icon

  const handleDecision = async (decisao: 'aprovada' | 'rejeitada') => {
    setAction(decisao)
    try {
      await mutation.mutateAsync({
        aprovacaoId: aprovacao.id,
        entidadeId: aprovacao.entidade_id,
        entidadeNumero: aprovacao.entidade_numero,
        tipoAprovacao: aprovacao.tipo_aprovacao,
        modulo: aprovacao.modulo,
        nivel: aprovacao.nivel,
        decisao,
        observacao: observacao || undefined,
        aprovadorNome,
        aprovadorEmail,
      })
    } catch { /* error handled by mutation state */ }
  }

  // Resultado pos-decisao
  if (mutation.isSuccess) {
    const colors = action === 'aprovada'
      ? { bg: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-500', text: 'text-emerald-700', msg: 'Aprovada' }
      : { bg: 'bg-red-50 border-red-200', icon: 'text-red-500', text: 'text-red-700', msg: 'Rejeitada' }

    return (
      <div className={`rounded-2xl p-6 text-center border-2 ${colors.bg}`}>
        {action === 'aprovada'
          ? <CheckCircle size={44} className={`${colors.icon} mx-auto mb-3`} />
          : <XCircle size={44} className={`${colors.icon} mx-auto mb-3`} />}
        <p className={`font-bold text-base ${colors.text}`}>
          {aprovacao.entidade_numero || tipo.label} — {colors.msg}
        </p>
        <p className="text-xs text-slate-500 mt-1">Decisao registrada com sucesso</p>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-2xl shadow-md border ${tipo.borderColor} overflow-hidden`}>
      <div className={`${tipo.headerBg} px-4 py-2.5 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <IconComp size={14} className="text-white/70" />
          <span className="text-xs font-bold text-white">{tipo.label}</span>
          {aprovacao.entidade_numero && (
            <span className="text-white/60 text-[10px]">{aprovacao.entidade_numero}</span>
          )}
        </div>
        {aprovacao.data_limite && (
          <span className="text-[10px] text-white/70 font-semibold flex items-center gap-1">
            <Clock size={10} /> {timeLeft(aprovacao.data_limite)}
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="text-sm font-bold text-slate-800 mb-1">
          {aprovacao.entidade_numero || `#${aprovacao.entidade_id.slice(0, 8)}`}
        </p>
        <p className="text-xs text-slate-500 mb-2">
          Nivel {aprovacao.nivel} | Aprovador: {aprovacao.aprovador_nome}
        </p>

        {/* ── Resumo Executivo para Minuta Contratual ── */}
        {aprovacao.tipo_aprovacao === 'minuta_contratual' && aprovacao.minuta_resumo ? (
          <MinutaExecutiveSummary resumo={aprovacao.minuta_resumo} />
        ) : (
          <p className="text-sm text-slate-600">
            {aprovacao.requisicao?.descricao || `Aguardando aprovacao ${tipo.label.toLowerCase()}`}
          </p>
        )}

        {aprovacao.requisicao?.valor_estimado > 0 && aprovacao.tipo_aprovacao !== 'minuta_contratual' && (
          <div className="mt-3 bg-slate-50 rounded-xl p-3 flex justify-between items-center">
            <span className="text-xs text-slate-500">Valor</span>
            <span className={`text-lg font-extrabold ${tipo.textColor}`}>
              {fmt(aprovacao.requisicao.valor_estimado)}
            </span>
          </div>
        )}

        {/* Expandir para observacao */}
        <button type="button" onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-indigo-500 mt-3 mx-auto font-semibold">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {expanded ? 'Menos detalhes' : 'Adicionar observacao'}
        </button>

        {expanded && (
          <div className="mt-3">
            <label className="text-xs text-slate-400">Observacao (opcional)</label>
            <textarea
              rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:ring-2 focus:ring-indigo-300 outline-none"
              placeholder="Motivo da decisao..."
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
            />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 border-t border-slate-100">
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => handleDecision('rejeitada')}
          className="flex items-center justify-center gap-2 py-3.5 text-xs font-bold text-red-500 hover:bg-red-50 active:bg-red-100 transition border-r border-slate-100 disabled:opacity-50"
        >
          {mutation.isPending && action === 'rejeitada'
            ? <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            : <XCircle size={18} />}
          Rejeitar
        </button>
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => handleDecision('aprovada')}
          className="flex items-center justify-center gap-2 py-3.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 transition disabled:opacity-50"
        >
          {mutation.isPending && action === 'aprovada'
            ? <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            : <CheckCircle size={18} />}
          Aprovar
        </button>
      </div>

      {mutation.isError && (
        <p className="text-red-500 text-xs text-center py-2 border-t border-red-100">
          Erro ao processar: {mutation.error?.message || 'Tente novamente.'}
        </p>
      )}
    </div>
  )
}

// ── Minuta Executive Summary (inline in GenericPendingCard) ───────────────────

function MinutaExecutiveSummary({ resumo }: {
  resumo: NonNullable<AprovacaoPendente['minuta_resumo']>
}) {
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'

  return (
    <div className="space-y-3">
      {/* Key info grid */}
      <div className="bg-indigo-50/60 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <FileSignature size={13} className="text-indigo-500" />
          <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Resumo Executivo</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div>
            <span className="text-slate-400">Contraparte</span>
            <p className="font-semibold text-slate-800">{resumo.contraparte || '—'}</p>
          </div>
          <div>
            <span className="text-slate-400">Valor Estimado</span>
            <p className="font-extrabold text-indigo-700">{resumo.valor_estimado > 0 ? fmt(resumo.valor_estimado) : '—'}</p>
          </div>
          <div className="col-span-2">
            <span className="text-slate-400">Objeto</span>
            <p className="font-medium text-slate-700 leading-snug">{resumo.objeto || '—'}</p>
          </div>
          {resumo.tipo_contrato && (
            <div>
              <span className="text-slate-400">Tipo</span>
              <p className="font-medium text-slate-700 capitalize">{resumo.tipo_contrato.replace(/_/g, ' ')}</p>
            </div>
          )}
          {(resumo.vigencia_inicio || resumo.vigencia_fim) && (
            <div>
              <span className="text-slate-400">Vigencia</span>
              <p className="font-medium text-slate-700">{fmtDate(resumo.vigencia_inicio)} — {fmtDate(resumo.vigencia_fim)}</p>
            </div>
          )}
        </div>
      </div>

      {/* AI Analysis summary */}
      {resumo.ai_resumo && (
        <div className="bg-violet-50/60 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={13} className="text-violet-500" />
            <span className="text-[11px] font-bold text-violet-600 uppercase tracking-wider">Analise IA</span>
            {typeof resumo.ai_score === 'number' && (
              <span className={`ml-auto text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                resumo.ai_score >= 80 ? 'bg-emerald-100 text-emerald-700' :
                resumo.ai_score >= 60 ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                Score {resumo.ai_score}/100
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-4">{resumo.ai_resumo}</p>
        </div>
      )}

      {/* PDF attachment link */}
      {resumo.arquivo_url && (
        <a
          href={resumo.arquivo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
            <FileText size={16} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-700 truncate">
              {resumo.arquivo_nome || resumo.minuta_titulo || 'Minuta PDF'}
            </p>
            <p className="text-[10px] text-slate-400">Clique para visualizar a minuta</p>
          </div>
          <Download size={14} className="text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0" />
        </a>
      )}
    </div>
  )
}

// ── Accordion Section ──────────────────────────────────────────────────────────

function AccordionSection({
  tipo,
  aprovacoes,
  aprovadorNome,
  aprovadorEmail,
  defaultOpen = false,
}: {
  tipo: TipoAprovacao
  aprovacoes: AprovacaoPendente[]
  aprovadorNome: string
  aprovadorEmail: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const config = tipoConfig[tipo]
  const IconComp = config.icon
  const count = aprovacoes.length

  return (
    <div className={`rounded-2xl overflow-hidden border ${count > 0 ? config.borderColor : 'border-white/10'} ${count > 0 ? 'bg-white/5' : 'bg-white/[0.02]'}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${count > 0 ? config.badgeBg : 'bg-white/10'}`}>
            <IconComp size={16} className={count > 0 ? config.badgeText : 'text-white/40'} />
          </div>
          <span className={`text-sm font-bold ${count > 0 ? 'text-white' : 'text-white/40'}`}>
            {config.label}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${count > 0 ? `${config.badgeBg} ${config.badgeText}` : 'bg-white/10 text-white/30'}`}>
            {count}
          </span>
        </div>
        {count > 0 && (
          open
            ? <ChevronDown size={18} className="text-white/60" />
            : <ChevronRight size={18} className="text-white/60" />
        )}
      </button>

      {open && count > 0 && (
        <div className="px-4 pb-4 space-y-3">
          {aprovacoes.map(apr =>
            tipo === 'requisicao_compra' ? (
              <AprovacaoCard
                key={apr.id}
                aprovacao={apr}
                aprovadorNome={aprovadorNome}
                aprovadorEmail={aprovadorEmail}
              />
            ) : (
              <GenericPendingCard key={apr.id} aprovacao={apr} aprovadorNome={aprovadorNome} aprovadorEmail={aprovadorEmail} />
            )
          )}
        </div>
      )}

      {open && count === 0 && (
        <div className="px-4 pb-4">
          <p className="text-center text-white/30 text-xs py-4">
            Nenhuma aprovacao pendente
          </p>
        </div>
      )}
    </div>
  )
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof CheckCircle
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center">
      <Icon size={18} className={`${color} mx-auto mb-1`} />
      <p className="text-lg font-extrabold text-white">{value}</p>
      <p className="text-[10px] text-indigo-300 font-medium leading-tight">{label}</p>
    </div>
  )
}

// ── Tab Pendentes ──────────────────────────────────────────────────────────────

function TabPendentes({
  aprovacoes,
  isLoading,
  isError,
  refetch,
  aprovadorNome,
  aprovadorEmail,
}: {
  aprovacoes: AprovacaoPendente[] | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
  aprovadorNome: string
  aprovadorEmail: string
}) {
  const { data: kpis } = useAprovacaoKPIs()

  // Agrupar por tipo
  const grouped = useMemo(() => {
    const map: Record<TipoAprovacao, AprovacaoPendente[]> = {
      cotacao: [],
      autorizacao_pagamento: [],
      minuta_contratual: [],
      requisicao_compra: [],
    }
    for (const apr of aprovacoes ?? []) {
      const tipo = apr.tipo_aprovacao || 'requisicao_compra'
      if (map[tipo]) {
        map[tipo].push(apr)
      } else {
        map.requisicao_compra.push(apr)
      }
    }
    return map
  }, [aprovacoes])

  return (
    <div className="space-y-4">
      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-4 gap-2">
          <KpiCard icon={ListChecks} label="Pendentes" value={kpis.totalPendentes} color="text-indigo-300" />
          <KpiCard icon={CheckCircle} label="Aprovadas Hoje" value={kpis.aprovadasHoje} color="text-emerald-400" />
          <KpiCard icon={XCircle} label="Rejeitadas Hoje" value={kpis.rejeitadasHoje} color="text-red-400" />
          <KpiCard icon={Timer} label="Tempo Medio" value={kpis.tempoMedioHoras > 0 ? `${kpis.tempoMedioHoras}h` : '--'} color="text-amber-400" />
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {!isLoading && isError && (
        <div className="text-center py-14">
          <AlertTriangle size={44} className="text-amber-300 mx-auto mb-3" />
          <p className="text-white text-base font-bold">Erro ao carregar</p>
          <p className="text-indigo-300 text-sm mt-1 mb-4">Nao foi possivel buscar as aprovacoes</p>
          <button
            onClick={() => refetch()}
            className="bg-white/20 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-white/30 transition"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && (!aprovacoes || aprovacoes.length === 0) && (
        <div className="text-center py-14">
          <CheckCircle size={52} className="text-indigo-300 mx-auto mb-3 opacity-80" />
          <p className="text-white text-base font-bold">Tudo em dia!</p>
          <p className="text-indigo-300 text-sm mt-1">Nenhuma aprovacao pendente</p>
        </div>
      )}

      {/* Accordion sections */}
      {!isLoading && !isError && aprovacoes && aprovacoes.length > 0 && (
        <div className="space-y-3">
          {tipoOrder.map(tipo => (
            <AccordionSection
              key={tipo}
              tipo={tipo}
              aprovacoes={grouped[tipo]}
              aprovadorNome={aprovadorNome}
              aprovadorEmail={aprovadorEmail}
              defaultOpen={grouped[tipo].length > 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab Historico ──────────────────────────────────────────────────────────────

const periodoOptions = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'todos', label: 'Todos' },
] as const

const decisaoOptions = [
  { value: '', label: 'Todas' },
  { value: 'aprovada', label: 'Aprovadas' },
  { value: 'rejeitada', label: 'Rejeitadas' },
] as const

function HistoricoCard({ item }: { item: AprovacaoHistorico }) {
  const tipo = tipoConfig[item.tipo_aprovacao] || tipoConfig.requisicao_compra
  const statusColor = item.status === 'aprovada'
    ? { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Aprovada' }
    : item.status === 'rejeitada'
    ? { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejeitada' }
    : item.status === 'expirada'
    ? { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Expirada' }
    : { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Esclarecimento' }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tipo.badgeBg} ${tipo.badgeText}`}>
            {tipo.label}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor.bg} ${statusColor.text}`}>
            {statusColor.label}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          <Calendar size={10} />
          {formatDateShort(item.data_decisao || item.created_at)}
        </span>
      </div>
      <p className="text-sm font-bold text-slate-800 mb-0.5">
        {item.entidade_numero || `#${item.entidade_id.slice(0, 8)}`}
      </p>
      <p className="text-xs text-slate-500 mb-1">
        Nivel {item.nivel} | {item.aprovador_nome}
      </p>
      {item.observacao && (
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 mt-2 italic">
          "{item.observacao}"
        </p>
      )}
    </div>
  )
}

function TabHistorico() {
  const [filtros, setFiltros] = useState<HistoricoFiltros>({ periodo: '30d' })
  const [tiposSelecionados, setTiposSelecionados] = useState<TipoAprovacao[]>([])
  const [showFilters, setShowFilters] = useState(false)

  const queryFiltros: HistoricoFiltros = {
    ...filtros,
    tipo: tiposSelecionados.length > 0 ? tiposSelecionados : undefined,
  }

  const { data: historico, isLoading, isError } = useHistoricoAprovacoes(queryFiltros)

  const toggleTipo = (tipo: TipoAprovacao) => {
    setTiposSelecionados(prev =>
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros toggle */}
      <button
        type="button"
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 text-xs text-white/70 font-semibold hover:text-white transition"
      >
        <Filter size={14} />
        Filtros
        {showFilters ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {showFilters && (
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 space-y-3">
          {/* Tipo multi-select */}
          <div>
            <label className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wider mb-1.5 block">
              Tipo
            </label>
            <div className="flex flex-wrap gap-1.5">
              {tipoOrder.map(tipo => {
                const config = tipoConfig[tipo]
                const selected = tiposSelecionados.includes(tipo)
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => toggleTipo(tipo)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                      selected
                        ? `${config.badgeBg} ${config.badgeText}`
                        : 'bg-white/10 text-white/50 hover:bg-white/20'
                    }`}
                  >
                    {config.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Periodo */}
          <div>
            <label className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wider mb-1.5 block">
              Periodo
            </label>
            <div className="flex gap-1.5">
              {periodoOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFiltros(f => ({ ...f, periodo: opt.value }))}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition ${
                    filtros.periodo === opt.value
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white/10 text-white/50 hover:bg-white/20'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Decisao */}
          <div>
            <label className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wider mb-1.5 block">
              Decisao
            </label>
            <div className="flex gap-1.5">
              {decisaoOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFiltros(f => ({ ...f, decisao: (opt.value || undefined) as HistoricoFiltros['decisao'] }))}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition ${
                    (filtros.decisao || '') === opt.value
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white/10 text-white/50 hover:bg-white/20'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {!isLoading && isError && (
        <div className="text-center py-10">
          <AlertTriangle size={36} className="text-amber-300 mx-auto mb-3" />
          <p className="text-white text-sm font-bold">Erro ao carregar historico</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && (!historico || historico.length === 0) && (
        <div className="text-center py-10">
          <History size={40} className="text-indigo-300/50 mx-auto mb-3" />
          <p className="text-white/60 text-sm font-bold">Nenhum registro encontrado</p>
          <p className="text-indigo-300/50 text-xs mt-1">Ajuste os filtros para ver mais resultados</p>
        </div>
      )}

      {/* Lista */}
      {!isLoading && !isError && historico && historico.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-indigo-300/60 font-semibold px-1">
            {historico.length} registro{historico.length !== 1 ? 's' : ''}
          </p>
          {historico.map(item => (
            <HistoricoCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

type Tab = 'pendentes' | 'historico'

export default function AprovAi() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('pendentes')
  const { data: aprovacoes, isLoading, isError, refetch } = useAprovacoesPendentes()

  const aprovadorNome = perfil?.nome ?? 'Aprovador'
  const aprovadorEmail = perfil?.email ?? ''

  const totalPendentes = aprovacoes?.length ?? 0

  return (
    <div className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #312e81 0%, #4f46e5 40%, #6d28d9 100%)' }}>

      {/* Header */}
      <header className="px-4 pt-6 pb-5">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-indigo-300 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={18} />
          <span className="text-xs font-semibold">Voltar</span>
        </button>

        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Sparkles size={22} className="text-indigo-200" />
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Aprov<span className="text-indigo-200">Ai</span>
            </h1>
          </div>
          <p className="text-indigo-300 text-xs font-medium">Aprovacoes inteligentes com 1 toque</p>
          {activeTab === 'pendentes' && totalPendentes > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5">
              <span className="text-white text-lg font-extrabold">{totalPendentes}</span>
              <span className="text-indigo-200 text-xs">pendente{totalPendentes !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex bg-white/10 backdrop-blur-sm rounded-2xl p-1">
          <button
            type="button"
            onClick={() => setActiveTab('pendentes')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'pendentes'
                ? 'bg-white text-indigo-700 shadow-md'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <ListChecks size={14} />
            Pendentes
            {totalPendentes > 0 && activeTab !== 'pendentes' && (
              <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px]">
                {totalPendentes}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('historico')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'historico'
                ? 'bg-white text-indigo-700 shadow-md'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <History size={14} />
            Historico
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-12">
        {activeTab === 'pendentes' && (
          <TabPendentes
            aprovacoes={aprovacoes}
            isLoading={isLoading}
            isError={isError}
            refetch={refetch}
            aprovadorNome={aprovadorNome}
            aprovadorEmail={aprovadorEmail}
          />
        )}
        {activeTab === 'historico' && (
          <TabHistorico />
        )}
      </div>

      <footer className="text-center pb-8">
        <p className="text-indigo-400 text-[10px]">TEG+ | TEG Uniao Energia</p>
      </footer>
    </div>
  )
}
