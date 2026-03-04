import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Clock, CheckCircle, AlertTriangle, ChevronRight, Info, XCircle, MessageSquare, ChevronDown, ChevronUp, FileText, Ban } from 'lucide-react'
import { useCotacoes } from '../hooks/useCotacoes'
import { useDecisaoRequisicao } from '../hooks/useAprovacoes'
import { useEmitirPedido, useCancelarRequisicao } from '../hooks/usePedidos'
import { useAuth } from '../contexts/AuthContext'
import type { StatusCotacao } from '../types'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const STATUS_TABS: { value: StatusCotacao | ''; label: string; icon: typeof Clock }[] = [
  { value: '',           label: 'Todas',         icon: ShoppingCart  },
  { value: 'pendente',   label: 'Pendentes',     icon: Clock         },
  { value: 'em_andamento', label: 'Em andamento', icon: AlertTriangle },
  { value: 'concluida', label: 'Concluídas',    icon: CheckCircle   },
]

const statusCotConfig: Record<string, { bg: string; text: string; label: string }> = {
  pendente:    { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Pendente'     },
  em_andamento:{ bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'Em andamento' },
  concluida:   { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Concluída'    },
  cancelada:   { bg: 'bg-gray-100',    text: 'text-gray-500',    label: 'Cancelada'    },
}

const urgenciaConfig: Record<string, { bg: string; text: string }> = {
  normal:  { bg: 'bg-slate-100', text: 'text-slate-600'  },
  urgente: { bg: 'bg-amber-100', text: 'text-amber-700'  },
  critica: { bg: 'bg-red-100',   text: 'text-red-700'    },
}

// Calcula dias em aberto
function diasEmAberto(createdAt: string) {
  const dias = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  return dias
}

// Alerta de cotações mínimas baseado no valor
function AlertaCotacoes({ valor }: { valor: number }) {
  const minCot = valor <= 500 ? 1 : valor <= 2000 ? 2 : 3
  if (minCot === 1) return null
  return (
    <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
      <Info size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
      <p className="text-[11px] text-amber-700">
        Mín. <strong>{minCot} cotações</strong> obrigatórias{' '}
        ({valor <= 2000 ? 'valor acima de R$500' : 'valor acima de R$2.000'})
      </p>
    </div>
  )
}

export default function FilaCotacoes() {
  const nav = useNavigate()
  const [statusFilter, setStatusFilter] = useState<StatusCotacao | ''>('')
  const { data: cotacoes, isLoading } = useCotacoes(undefined, statusFilter || undefined)
  const { isAdmin, perfil } = useAuth()
  const decisaoMutation = useDecisaoRequisicao()
  const emitirPedidoMutation = useEmitirPedido()
  const cancelarMutation = useCancelarRequisicao()

  // Estado para card expandido (comentário) e toast
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [observacao, setObservacao] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const handleDecisao = (
    reqId: string, numero: string, alcada: number,
    decisao: 'aprovada' | 'rejeitada' | 'esclarecimento',
    categoria?: string, currentStatus?: string,
  ) => {
    if (!perfil) return
    if (decisao === 'esclarecimento' && !observacao.trim()) {
      setExpandedCard(reqId)
      return
    }
    decisaoMutation.mutate({
      requisicaoId: reqId,
      decisao,
      observacao: observacao.trim() || undefined,
      requisicaoNumero: numero,
      alcadaNivel: alcada,
      aprovadorNome: perfil.nome,
      aprovadorEmail: perfil.email,
      categoria,
      currentStatus,
    }, {
      onSuccess: () => {
        setExpandedCard(null)
        setObservacao('')
        const label = decisao === 'aprovada' ? 'Aprovada ✓' : decisao === 'rejeitada' ? 'Rejeitada' : 'Esclarecimento solicitado'
        setToast({ type: 'success', msg: `${numero}: ${label}` })
        setTimeout(() => setToast(null), 4000)
      },
      onError: () => {
        setToast({ type: 'error', msg: `Erro ao processar ${numero}. Tente novamente.` })
        setTimeout(() => setToast(null), 5000)
      },
    })
  }

  return (
    <div className="space-y-4">
      {/* Toast feedback */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success'
            ? 'bg-emerald-500 text-white shadow-emerald-500/30'
            : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
        <ShoppingCart size={18} className="text-teal-500" />
        Fila de Cotações
      </h2>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {STATUS_TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex-shrink-0 ${
                statusFilter === tab.value
                  ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}>
              <Icon size={12} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && (!cotacoes || cotacoes.length === 0) && (
        <div className="text-center py-12 text-slate-400">
          <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma cotação encontrada</p>
        </div>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {cotacoes?.map(cot => {
          const st = statusCotConfig[cot.status] || statusCotConfig.pendente
          const urgCfg = cot.requisicao?.urgencia ? urgenciaConfig[cot.requisicao.urgencia] : urgenciaConfig.normal
          const valor = cot.valor_selecionado ?? (cot.requisicao as any)?.valor_estimado ?? 0
          const dias = diasEmAberto(cot.created_at)
          const concluida = cot.status === 'concluida'

          return (
            <div key={cot.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${concluida ? 'border-emerald-200' : 'border-slate-200'}`}>
              {/* Header */}
              <div className={`px-4 py-3 ${concluida ? 'bg-emerald-50' : 'bg-slate-50'} border-b ${concluida ? 'border-emerald-100' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-sm text-slate-800">{cot.requisicao?.numero ?? '—'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
                    {cot.requisicao?.urgencia && cot.requisicao.urgencia !== 'normal' && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${urgCfg.bg} ${urgCfg.text}`}>
                        ⚡ {cot.requisicao.urgencia}
                      </span>
                    )}
                  </div>
                  {dias > 0 && !concluida && (
                    <span className={`text-[10px] font-semibold flex-shrink-0 ${dias > 5 ? 'text-red-500' : 'text-slate-400'}`}>
                      {dias}d aberta
                    </span>
                  )}
                </div>
              </div>

              {/* Conteúdo */}
              <div className="px-4 py-3 space-y-2.5">
                <p className="text-sm font-semibold text-slate-800 line-clamp-2">
                  {cot.requisicao?.descricao}
                </p>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{cot.requisicao?.obra_nome}</span>
                  <span className={`font-extrabold text-sm ${concluida ? 'text-emerald-600' : 'text-teal-600'}`}>
                    {fmt(valor)}
                  </span>
                </div>

                {/* Alerta de cotações mínimas */}
                {!concluida && <AlertaCotacoes valor={valor} />}

                {/* Fornecedor selecionado */}
                {cot.fornecedor_selecionado_nome && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                    <CheckCircle size={13} /> {cot.fornecedor_selecionado_nome}
                  </div>
                )}

                {/* Categoria badge */}
                {cot.requisicao?.categoria && (
                  <span className="inline-block text-[10px] bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
                    {cot.requisicao.categoria.replace(/_/g, ' ')}
                  </span>
                )}

                {/* Status de aprovação financeira */}
                {concluida && cot.requisicao?.status === 'cotacao_enviada' && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-teal-50 text-teal-600 border border-teal-200 rounded-full px-2 py-0.5 font-semibold">
                    <Clock size={10} /> Aguard. Aprovação Financeira
                  </span>
                )}
                {concluida && cot.requisicao?.status === 'cotacao_aprovada' && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full px-2 py-0.5 font-semibold">
                    <CheckCircle size={10} /> Aprovada — Pronta para Pedido
                  </span>
                )}
                {concluida && cot.requisicao?.status === 'pedido_emitido' && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-teal-50 text-teal-600 border border-teal-200 rounded-full px-2 py-0.5 font-semibold">
                    <FileText size={10} /> Pedido Emitido
                  </span>
                )}
              </div>

              {/* Botões de aprovação financeira — admin + cotação concluída + aguardando */}
              {isAdmin && concluida && cot.requisicao?.status === 'cotacao_enviada' && cot.requisicao?.id && (() => {
                const req = cot.requisicao!
                const isExpanded = expandedCard === req.id
                const isProcessing = decisaoMutation.isPending && decisaoMutation.variables?.requisicaoId === req.id
                return (
                  <div className="px-4 py-3 border-t border-teal-100 bg-teal-50/30 space-y-2">
                    <p className="text-[10px] text-teal-600 font-bold text-center uppercase tracking-wide">Aprovação Financeira</p>

                    {/* Toggle comentário */}
                    <button
                      onClick={() => {
                        if (isExpanded) { setExpandedCard(null); setObservacao('') }
                        else { setExpandedCard(req.id); setObservacao('') }
                      }}
                      className="flex items-center gap-1 text-xs text-indigo-500 font-semibold mx-auto"
                    >
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {isExpanded ? 'Ocultar' : 'Comentário'}
                    </button>

                    {isExpanded && (
                      <textarea
                        rows={2}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                        placeholder="Observação / motivo..."
                        value={observacao}
                        onChange={e => setObservacao(e.target.value)}
                      />
                    )}

                    <div className="flex gap-2">
                      <button
                        disabled={isProcessing}
                        onClick={() => handleDecisao(req.id, req.numero, req.alcada_nivel, 'rejeitada', req.categoria, 'cotacao_enviada')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold
                          text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 active:scale-[0.98]
                          transition-all disabled:opacity-50"
                      >
                        <XCircle size={14} /> Rejeitar
                      </button>
                      <button
                        disabled={isProcessing}
                        onClick={() => handleDecisao(req.id, req.numero, req.alcada_nivel, 'esclarecimento', req.categoria, 'cotacao_enviada')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold
                          text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 active:scale-[0.98]
                          transition-all disabled:opacity-50"
                      >
                        <MessageSquare size={14} /> Esclarecer
                      </button>
                      <button
                        disabled={isProcessing}
                        onClick={() => handleDecisao(req.id, req.numero, req.alcada_nivel, 'aprovada', req.categoria, 'cotacao_enviada')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold
                          text-emerald-600 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-[0.98]
                          transition-all disabled:opacity-50"
                      >
                        {isProcessing
                          ? <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                          : <CheckCircle size={14} />}
                        Aprovar
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* Botões Emitir Pedido / Cancelar — admin + cotação aprovada */}
              {isAdmin && concluida && cot.requisicao?.status === 'cotacao_aprovada' && cot.requisicao?.id && (() => {
                const req = cot.requisicao!
                const isEmitting = emitirPedidoMutation.isPending && emitirPedidoMutation.variables?.requisicaoId === req.id
                const isCancelling = cancelarMutation.isPending && cancelarMutation.variables === req.id
                return (
                  <div className="px-4 py-3 border-t border-teal-100 bg-teal-50/30 space-y-2">
                    <p className="text-[10px] text-teal-600 font-bold text-center uppercase tracking-wide">
                      Emissão de Pedido
                    </p>
                    <div className="flex gap-2">
                      <button
                        disabled={isCancelling || isEmitting}
                        onClick={() => {
                          if (!confirm('Cancelar esta requisição?')) return
                          cancelarMutation.mutate(req.id, {
                            onSuccess: () => {
                              setToast({ type: 'success', msg: `${req.numero}: Cancelada` })
                              setTimeout(() => setToast(null), 4000)
                            },
                            onError: () => {
                              setToast({ type: 'error', msg: `Erro ao cancelar ${req.numero}` })
                              setTimeout(() => setToast(null), 5000)
                            },
                          })
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold
                          text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 active:scale-[0.98]
                          transition-all disabled:opacity-50"
                      >
                        {isCancelling
                          ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          : <Ban size={14} />}
                        Cancelar
                      </button>
                      <button
                        disabled={isEmitting || isCancelling}
                        onClick={() => {
                          emitirPedidoMutation.mutate({
                            requisicaoId: req.id,
                            cotacaoId: cot.id,
                            fornecedorNome: cot.fornecedor_selecionado_nome ?? 'N/A',
                            valorTotal: cot.valor_selecionado ?? req.valor_estimado,
                            compradorId: cot.comprador_id,
                          }, {
                            onSuccess: (pedido) => {
                              setToast({ type: 'success', msg: `${pedido.numero_pedido} emitido ✓` })
                              setTimeout(() => setToast(null), 4000)
                            },
                            onError: () => {
                              setToast({ type: 'error', msg: `Erro ao emitir pedido para ${req.numero}` })
                              setTimeout(() => setToast(null), 5000)
                            },
                          })
                        }}
                        className="flex-[2] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold
                          text-white bg-teal-500 border border-teal-500 hover:bg-teal-600 shadow-sm shadow-teal-500/20
                          active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {isEmitting
                          ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <FileText size={14} />}
                        Emitir Pedido
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* Botão de ação */}
              <button onClick={() => nav(`/cotacoes/${cot.id}`)}
                className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-bold border-t transition-all ${
                  concluida
                    ? 'border-emerald-100 text-emerald-600 hover:bg-emerald-50'
                    : 'border-slate-100 text-teal-600 hover:bg-teal-50'
                }`}>
                {concluida ? 'Ver detalhes' : 'Abrir e Cotar'}
                <ChevronRight size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
