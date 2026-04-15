import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Building, User, Calendar, Tag, Package,
  CheckCircle, XCircle, MessageSquare, AlertTriangle,
  ChevronDown, ChevronUp, ShoppingCart, UserCog, ExternalLink,
  FileText, Ban, Send, Undo2,
} from 'lucide-react'
import { useRequisicao, useReenviarEsclarecimento, useReenviarAposDevolucao } from '../hooks/useRequisicoes'
import { useDecisaoRequisicao } from '../hooks/useAprovacoes'
import { useCotacaoByRequisicao } from '../hooks/useCotacoes'
import { useEmitirPedido, useCancelarRequisicao } from '../hooks/usePedidos'
import { useEditorLock } from '../hooks/useEditorLock'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'
import StatusBadge from '../components/StatusBadge'
import FluxoTimeline from '../components/FluxoTimeline'
import CotacaoComparativo from '../components/CotacaoComparativo'
import EmitirPedidoModal from '../components/EmitirPedidoModal'
import { UpperTextarea } from '../components/UpperInput'
import type { StatusRequisicao } from '../types'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

const NIVEL_LABEL: Record<number, string> = {
  1: 'Coordenador', 2: 'Gerente', 3: 'Diretor', 4: 'CEO',
}

export default function RequisicaoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: req, isLoading, error } = useRequisicao(id)
  const decisaoMutation = useDecisaoRequisicao()
  const reenviarMutation = useReenviarEsclarecimento()
  const reenviarDevolucaoMutation = useReenviarAposDevolucao()
  const emitirPedidoMutation = useEmitirPedido()
  const cancelarMutation = useCancelarRequisicao()
  const { isAdmin, atLeast, perfil, canTechnicalApprove } = useAuth()

  // Cotação vinculada à RC
  const showCotacao = req && ['em_cotacao', 'cotacao_enviada', 'cotacao_aprovada', 'cotacao_rejeitada', 'pedido_emitido'].includes(req.status)
  const { data: cotacao } = useCotacaoByRequisicao(showCotacao ? id : undefined)

  const [observacao, setObservacao] = useState('')
  const [showObservacao, setShowObservacao] = useState(false)
  const [respostaEsclarecimento, setRespostaEsclarecimento] = useState('')
  const [respostaDevolucao, setRespostaDevolucao] = useState('')
  const [showItens, setShowItens] = useState(true)
  const [pendingAction, setPendingAction] = useState<'aprovada' | 'rejeitada' | 'esclarecimento' | null>(null)
  const [pedidoToast, setPedidoToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [showEmitirModal, setShowEmitirModal] = useState(false)

  // Decisão técnica (pendente/em_aprovacao/esclarecimento) OU financeira (cotacao_enviada)
  const canDecideTechnical = !!req
    && ['pendente', 'em_aprovacao', 'em_esclarecimento'].includes(req.status)
    && canTechnicalApprove('compras')
  const canDecideFinancial = !!req
    && req.status === 'cotacao_enviada'
    && isAdmin
  const canDecide = canDecideTechnical || canDecideFinancial
  const canEmitPedido = !!req
    && atLeast('comprador')
    && req.status === 'cotacao_aprovada'
  const canMutateComprasReq = canDecide || canEmitPedido
    || req?.status === 'em_esclarecimento'
    || req?.status === 'devolvida_solicitante'
  const { isLocked, blockedByName } = useEditorLock({
    resourceType: 'cmp_requisicao',
    resourceId: id,
    enabled: Boolean(id) && canMutateComprasReq,
  })

  const handleDecisao = (decisao: 'aprovada' | 'rejeitada' | 'esclarecimento') => {
    if (!req || !perfil) return
    if (isLocked) {
      setPedidoToast({ type: 'error', msg: `${blockedByName ?? 'Outro usuário'} está editando esta requisição.` })
      return
    }
    if (decisao === 'esclarecimento' && !observacao.trim()) {
      setShowObservacao(true)
      setPendingAction('esclarecimento')
      return
    }
    setPendingAction(decisao)
    decisaoMutation.mutate({
      requisicaoId: req.id,
      decisao,
      observacao: observacao.trim() || undefined,
      requisicaoNumero: req.numero,
      alcadaNivel: req.alcada_nivel,
      aprovadorNome: perfil.nome,
      aprovadorEmail: perfil.email,
      categoria: req.categoria,
      currentStatus: req.status,
    })
  }

  // ── Loading / Error ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !req) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-slate-400 text-sm">Requisição não encontrada</p>
        <button onClick={() => navigate(-1)} className="text-teal-600 text-sm font-semibold underline">
          ← Voltar
        </button>
      </div>
    )
  }

  const totalItens = req.itens.reduce(
    (sum, i) => sum + i.quantidade * i.valor_unitario_estimado, 0
  )

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition">
          <ArrowLeft size={16} className="text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-slate-500">{req.numero}</span>
            {req.urgencia !== 'normal' && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                req.urgencia === 'critica' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                ⚡ {req.urgencia}
              </span>
            )}
          </div>
        </div>
        <StatusBadge status={req.status as StatusRequisicao} />
      </div>

      {/* Descrição */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <p className="text-base font-bold text-slate-800 leading-snug">{req.descricao}</p>
      </div>

      {/* FluxoTimeline */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <FluxoTimeline status={req.status} />
      </div>

      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-700">
              {blockedByName ?? 'Outro usuário'} está editando
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Esta requisição fica bloqueada para evitar conflito até a finalização da edição.
            </p>
          </div>
        </div>
      )}

      {/* Alerta Devolução pelo Cotador */}
      {req.status === 'devolvida_solicitante' && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Undo2 size={16} className="text-rose-600 flex-shrink-0" />
            <span className="text-sm font-bold text-rose-700">Devolvida pelo Comprador</span>
          </div>
          <p className="text-sm text-rose-700">{req.devolucao_msg}</p>
          <div className="flex items-center gap-2 text-xs text-rose-500">
            <span>Por: {req.devolucao_por}</span>
            {req.devolucao_em && <span>· {fmtData(req.devolucao_em)}</span>}
          </div>

          <p className="text-[11px] text-rose-600 bg-rose-100/60 border border-rose-200 rounded-lg px-3 py-2">
            <strong>Importante:</strong> ajuste os itens da requisição conforme necessário.
            Ao reenviar, o ciclo de aprovação reinicia pela alçada 1.
          </p>

          {!reenviarDevolucaoMutation.isSuccess && (
            <div className="pt-2 border-t border-rose-200 space-y-2">
              <p className="text-xs font-semibold text-rose-700">Descrição do ajuste (opcional):</p>
              <UpperTextarea
                rows={2}
                value={respostaDevolucao}
                disabled={isLocked}
                onChange={e => setRespostaDevolucao(e.target.value)}
                placeholder="Explique brevemente o que foi ajustado..."
                className="w-full border border-rose-300 bg-white rounded-xl px-3 py-2 text-sm
                  focus:ring-2 focus:ring-rose-400 outline-none placeholder-rose-300"
              />
              <button
                disabled={reenviarDevolucaoMutation.isPending || isLocked}
                onClick={() => {
                  if (!perfil) return
                  reenviarDevolucaoMutation.mutate({
                    requisicaoId: req.id,
                    requisicaoNumero: req.numero,
                    solicitanteNome: perfil.nome,
                    resposta: respostaDevolucao.trim() || undefined,
                  })
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                  bg-rose-500 text-white text-sm font-bold hover:bg-rose-600
                  active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {reenviarDevolucaoMutation.isPending
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Send size={15} />}
                Reenviar para Aprovação
              </button>
              {reenviarDevolucaoMutation.isError && (
                <p className="text-xs text-red-600">Erro ao reenviar. Tente novamente.</p>
              )}
            </div>
          )}

          {reenviarDevolucaoMutation.isSuccess && (
            <div className="pt-2 border-t border-rose-200 flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle size={16} className="text-emerald-500" />
              Reenviado para aprovação com sucesso
            </div>
          )}
        </div>
      )}

      {/* Alerta Esclarecimento */}
      {req.status === 'em_esclarecimento' && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
            <span className="text-sm font-bold text-amber-700">Esclarecimento Solicitado</span>
          </div>
          <p className="text-sm text-amber-700">{req.esclarecimento_msg}</p>
          <div className="flex items-center gap-2 text-xs text-amber-500">
            <span>Por: {req.esclarecimento_por}</span>
            {req.esclarecimento_em && <span>· {fmtData(req.esclarecimento_em)}</span>}
          </div>

          {/* Reenviar para aprovador */}
          {!reenviarMutation.isSuccess && (
            <div className="pt-2 border-t border-amber-200 space-y-2">
              <p className="text-xs font-semibold text-amber-700">Responder e reenviar ao aprovador:</p>
              <UpperTextarea
                rows={2}
                value={respostaEsclarecimento}
                disabled={isLocked}
                onChange={e => setRespostaEsclarecimento(e.target.value)}
                placeholder="Descreva o esclarecimento prestado (opcional)..."
                className="w-full border border-amber-300 bg-white rounded-xl px-3 py-2 text-sm
                  focus:ring-2 focus:ring-amber-400 outline-none placeholder-amber-300"
              />
              <button
                disabled={reenviarMutation.isPending || isLocked}
                onClick={() => {
                  if (!perfil) return
                  reenviarMutation.mutate({
                    requisicaoId: req.id,
                    requisicaoNumero: req.numero,
                    alcadaNivel: req.alcada_nivel,
                    solicitanteNome: perfil.nome,
                    resposta: respostaEsclarecimento.trim() || undefined,
                  })
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                  bg-amber-500 text-white text-sm font-bold hover:bg-amber-600
                  active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {reenviarMutation.isPending
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Send size={15} />}
                Reenviar para Aprovador
              </button>
              {reenviarMutation.isError && (
                <p className="text-xs text-red-600">Erro ao reenviar. Tente novamente.</p>
              )}
            </div>
          )}

          {reenviarMutation.isSuccess && (
            <div className="pt-2 border-t border-amber-200 flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle size={16} className="text-emerald-500" />
              Reenviado ao aprovador com sucesso
            </div>
          )}
        </div>
      )}

      {/* Metadados */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Building size={12} /> Obra
            </div>
            <p className="text-sm font-semibold text-slate-700">{req.obra_nome}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <User size={12} /> Solicitante
            </div>
            <p className="text-sm font-semibold text-slate-700">{req.solicitante_nome}</p>
          </div>
          {req.categoria && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Tag size={12} /> Categoria
              </div>
              <p className="text-sm font-semibold text-slate-700">{req.categoria.replace(/_/g, ' ')}</p>
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Calendar size={12} /> Criação
            </div>
            <p className="text-sm font-semibold text-slate-700">{fmtData(req.created_at)}</p>
          </div>
        </div>

        {/* Valor + Alçada */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Valor estimado</p>
            <p className="text-xl font-extrabold text-teal-600">{fmt(req.valor_estimado)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Alçada</p>
            <p className="text-sm font-bold text-indigo-600">
              Nível {req.alcada_nivel} — {NIVEL_LABEL[req.alcada_nivel] ?? 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Descrição */}
      {req.justificativa && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-400 mb-1">Descrição</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{req.justificativa}</p>
        </div>
      )}

      {/* Itens */}
      {req.itens.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowItens(!showItens)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-2">
              <Package size={14} className="text-slate-500" />
              <span className="text-sm font-bold text-slate-700">
                Itens ({req.itens.length})
              </span>
            </div>
            {showItens ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </button>

          {showItens && (
            <div className="px-4 pb-4 overflow-x-auto">
              <table className="w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase">Descrição</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase text-right">Qtd</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase text-right">Un</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase text-right">Vl. Unit.</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {req.itens.map((item, idx) => (
                    <tr key={item.id ?? idx} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-slate-700">{item.descricao}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">{item.quantidade}</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500">{item.unidade}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-slate-600">{fmt(item.valor_unitario_estimado)}</td>
                      <td className="px-3 py-2 text-right font-semibold font-mono text-xs text-slate-800">
                        {fmt(item.quantidade * item.valor_unitario_estimado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td colSpan={4} className="px-3 py-2 text-xs font-bold text-slate-500">Total estimado</td>
                    <td className="px-3 py-2 text-right font-extrabold text-sm text-teal-600">{fmt(totalItens)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Comprador */}
      {req.comprador_nome && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 mb-1">Comprador designado</p>
          <p className="text-sm font-bold text-slate-700">{req.comprador_nome}</p>
        </div>
      )}

      {/* ── Cotação / Comparativo ──────────────────────────────────────────────── */}
      {req.status === 'em_cotacao' && cotacao && (
        <div className="bg-violet-50 border-2 border-violet-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-violet-600" />
            <span className="text-sm font-bold text-violet-700">Em Cotação</span>
            <span className="text-[10px] text-violet-500">
              {cotacao.comprador_nome ? `Comprador: ${cotacao.comprador_nome}` : 'Sem comprador'}
            </span>
          </div>
          <p className="text-xs text-violet-600">
            Aguardando o comprador inserir propostas de fornecedores.
          </p>
          <a
            href={`/cotacoes/${cotacao.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-800 transition"
          >
            <ExternalLink size={12} /> Ir para formulário de cotação
          </a>
        </div>
      )}

      {/* Comparativo de fornecedores — aprovação financeira */}
      {req.status === 'cotacao_enviada' && cotacao?.fornecedores && cotacao.fornecedores.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <ShoppingCart size={14} className="text-teal-600" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Cotações Recebidas — Aprovação Financeira
            </span>
          </div>
          <CotacaoComparativo fornecedores={cotacao.fornecedores} readOnly />
          {cotacao.sem_cotacoes_minimas && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-700">Cotação sem mínimo de fornecedores</p>
                {cotacao.justificativa_sem_cotacoes && (
                  <p className="text-xs text-amber-600 mt-1">{cotacao.justificativa_sem_cotacoes}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cotação aprovada/rejeitada — resultado */}
      {(req.status === 'cotacao_aprovada' || req.status === 'cotacao_rejeitada') && cotacao?.fornecedores && cotacao.fornecedores.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            {req.status === 'cotacao_aprovada' ? '✓ Cotação Aprovada' : '✗ Cotação Rejeitada'}
          </span>
          <CotacaoComparativo fornecedores={cotacao.fornecedores} readOnly />
        </div>
      )}

      {/* ── Emitir Pedido / Cancelar — cotação aprovada ───────────────────────── */}
      {canEmitPedido && (
        <div className="bg-white rounded-2xl border-2 border-teal-200 shadow-sm overflow-hidden">
          <div className="bg-teal-50 px-4 py-3 border-b border-teal-100">
            <p className="text-xs font-bold text-teal-700 uppercase tracking-wider flex items-center gap-2">
              <FileText size={14} />
              Próximo Passo — Emissão de Pedido
            </p>
          </div>

          <div className="p-4 space-y-3">
            {/* Resumo da cotação vencedora */}
            {cotacao?.fornecedor_selecionado_nome && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-emerald-500 font-semibold uppercase">Fornecedor Vencedor</p>
                    <p className="text-sm font-bold text-emerald-700">{cotacao.fornecedor_selecionado_nome}</p>
                  </div>
                  <p className="text-lg font-extrabold text-emerald-600">
                    {fmt(cotacao.valor_selecionado ?? req.valor_estimado)}
                  </p>
                </div>
              </div>
            )}

            {/* Toast feedback */}
            {pedidoToast && (
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                pedidoToast.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {pedidoToast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                {pedidoToast.msg}
              </div>
            )}

            {/* Botões */}
            {!emitirPedidoMutation.isSuccess && !cancelarMutation.isSuccess && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={cancelarMutation.isPending || emitirPedidoMutation.isPending || isLocked}
                  onClick={() => {
                    if (!confirm('Cancelar esta requisição? Esta ação não pode ser desfeita.')) return
                    cancelarMutation.mutate(req.id, {
                      onSuccess: () => {
                        setPedidoToast({ type: 'success', msg: 'Requisição cancelada' })
                        setTimeout(() => setPedidoToast(null), 4000)
                      },
                      onError: () => {
                        setPedidoToast({ type: 'error', msg: 'Erro ao cancelar. Tente novamente.' })
                        setTimeout(() => setPedidoToast(null), 5000)
                      },
                    })
                  }}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold
                    text-red-500 bg-red-50 border-2 border-red-200 hover:bg-red-100 active:scale-[0.98]
                    transition-all disabled:opacity-50"
                >
                  {cancelarMutation.isPending
                    ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    : <Ban size={16} />}
                  Cancelar RC
                </button>

                <button
                  disabled={emitirPedidoMutation.isPending || cancelarMutation.isPending || isLocked}
                  onClick={() => setShowEmitirModal(true)}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold
                    text-white bg-teal-500 border-2 border-teal-500 hover:bg-teal-600 shadow-lg shadow-teal-500/20
                    active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {emitirPedidoMutation.isPending
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <FileText size={16} />}
                  Emitir Pedido
                </button>
              </div>
            )}

            {/* Success state */}
            {emitirPedidoMutation.isSuccess && (
              <div className="text-center py-2">
                <CheckCircle size={36} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-emerald-700">Pedido Emitido!</p>
                <p className="text-xs text-slate-500 mt-1">O pedido aparece na tela de Pedidos</p>
              </div>
            )}

            {cancelarMutation.isSuccess && (
              <div className="text-center py-2">
                <Ban size={36} className="text-red-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-red-600">Requisição Cancelada</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Decisão Admin ──────────────────────────────────────────────────────── */}

      {req && showEmitirModal && (
        <EmitirPedidoModal
          open
          onClose={() => setShowEmitirModal(false)}
          requisicaoId={req.id}
          cotacao={cotacao ? {
            id: cotacao.id,
            fornecedorNome: cotacao.fornecedor_selecionado_nome ?? "N/A",
            valorTotal: cotacao.valor_selecionado ?? req.valor_estimado,
            compradorId: cotacao.comprador_id ?? undefined,
          } : undefined}
          onConfirm={(payload) => {
            emitirPedidoMutation.mutate({
              requisicaoId: req.id,
              ...payload,
            }, {
              onSuccess: (pedido) => {
                setShowEmitirModal(false)
                setPedidoToast({ type: "success", msg: `${pedido.numero_pedido} emitido` })
              },
              onError: (err: any) => {
                setPedidoToast({ type: "error", msg: `Erro ao emitir pedido: ${err?.message || "erro desconhecido"}` })
                setTimeout(() => setPedidoToast(null), 5000)
              },
            })
          }}
          isSubmitting={emitirPedidoMutation.isPending}
        />
      )}

      {canDecide && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {req.status === 'cotacao_enviada' ? 'Aprovação Financeira' : 'Decisão'}
          </p>

          {/* Sucesso */}
          {decisaoMutation.isSuccess && (
            <div className={`rounded-xl p-4 text-center ${
              pendingAction === 'aprovada' ? 'bg-emerald-50 border border-emerald-200' :
              pendingAction === 'rejeitada' ? 'bg-red-50 border border-red-200' :
              'bg-amber-50 border border-amber-200'
            }`}>
              {pendingAction === 'aprovada' && <CheckCircle size={32} className="text-emerald-500 mx-auto mb-2" />}
              {pendingAction === 'rejeitada' && <XCircle size={32} className="text-red-500 mx-auto mb-2" />}
              {pendingAction === 'esclarecimento' && <MessageSquare size={32} className="text-amber-500 mx-auto mb-2" />}
              <p className={`font-bold text-sm ${
                pendingAction === 'aprovada' ? 'text-emerald-700' :
                pendingAction === 'rejeitada' ? 'text-red-700' :
                'text-amber-700'
              }`}>
                {pendingAction === 'aprovada' ? 'Aprovada ✓' :
                 pendingAction === 'rejeitada' ? 'Rejeitada' :
                 'Esclarecimento solicitado'}
              </p>
            </div>
          )}

          {/* Observação */}
          {!decisaoMutation.isSuccess && (
            <>
              <button
                onClick={() => setShowObservacao(!showObservacao)}
                className="flex items-center gap-1 text-xs text-indigo-500 font-semibold"
              >
                {showObservacao ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {showObservacao ? 'Ocultar comentário' : 'Adicionar comentário'}
              </button>

              {showObservacao && (
                <UpperTextarea
                  rows={3}
                  disabled={isLocked}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                  placeholder={pendingAction === 'esclarecimento'
                    ? 'Descreva o que precisa ser esclarecido... (obrigatório)'
                    : 'Observação (opcional)...'}
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                />
              )}

              {/* Botões */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  disabled={decisaoMutation.isPending || isLocked}
                  onClick={() => handleDecisao('rejeitada')}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold
                    text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 active:scale-[0.98]
                    transition-all disabled:opacity-50"
                >
                  {decisaoMutation.isPending && pendingAction === 'rejeitada'
                    ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    : <XCircle size={14} />}
                  Rejeitar
                </button>
                <button
                  disabled={decisaoMutation.isPending || isLocked}
                  onClick={() => handleDecisao('esclarecimento')}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold
                    text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 active:scale-[0.98]
                    transition-all disabled:opacity-50"
                >
                  {decisaoMutation.isPending && pendingAction === 'esclarecimento'
                    ? <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    : <MessageSquare size={14} />}
                  Esclarecer
                </button>
                <button
                  disabled={decisaoMutation.isPending || isLocked}
                  onClick={() => handleDecisao('aprovada')}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold
                    text-emerald-600 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-[0.98]
                    transition-all disabled:opacity-50"
                >
                  {decisaoMutation.isPending && pendingAction === 'aprovada'
                    ? <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    : <CheckCircle size={14} />}
                  Aprovar
                </button>
              </div>

              {decisaoMutation.isError && (
                <p className="text-red-500 text-xs text-center">Erro ao processar. Tente novamente.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
