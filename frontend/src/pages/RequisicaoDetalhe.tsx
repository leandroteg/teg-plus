import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Building, User, Calendar, Tag, Package,
  CheckCircle, XCircle, MessageSquare, AlertTriangle,
  ChevronDown, ChevronUp, ShoppingCart, UserCog, ExternalLink,
  FileText, Ban, Send, Undo2, Pencil, History, Boxes,
} from 'lucide-react'
import { useRequisicao, useReenviarEsclarecimento, useReenviarAposDevolucao, useHistoricoAlteracoesItens, useSaldosPorItens, useSaldosNoCD, useTriagemAtenderItem, useTriagemLiberarRC, type AlteracaoItemSnapshot } from '../hooks/useRequisicoes'
import { useDecisaoRequisicao, podeAprovarCompras } from '../hooks/useAprovacoes'
import { useCotacaoByRequisicao } from '../hooks/useCotacoes'
import { useEmitirPedido, useCancelarRequisicao } from '../hooks/usePedidos'
import { useEditorLock } from '../hooks/useEditorLock'
import { useBases } from '../hooks/useEstoque'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'
import AuditoriaCard from '../components/AuditoriaCard'
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

const fmtItemLinha = (it: AlteracaoItemSnapshot) => {
  const marca = it.marca ? ` (${it.marca})` : ''
  const valor = it.valor_unitario_estimado ? ` · ${fmt(it.valor_unitario_estimado)}` : ''
  return `${it.descricao}${marca} — ${it.quantidade} ${it.unidade}${valor}`
}

export default function RequisicaoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: req, isLoading, error } = useRequisicao(id)
  const decisaoMutation = useDecisaoRequisicao()
  const reenviarMutation = useReenviarEsclarecimento()
  const reenviarDevolucaoMutation = useReenviarAposDevolucao()
  const { data: alteracoesItens } = useHistoricoAlteracoesItens(id)
  const { data: saldosItens } = useSaldosPorItens((req?.itens ?? []).map(i => i.est_item_id))
  const { data: saldosCD = {} } = useSaldosNoCD((req?.itens ?? []).map(i => i.est_item_id))
  const emitirPedidoMutation = useEmitirPedido()
  const cancelarMutation = useCancelarRequisicao()
  const atenderTriagem = useTriagemAtenderItem()
  const liberarTriagem = useTriagemLiberarRC()
  const { data: bases = [] } = useBases()
  const { isAdmin, atLeast, perfil, canTechnicalApprove } = useAuth()

  // Cotação vinculada à RC
  const showCotacao = req && ['em_cotacao', 'cotacao_enviada', 'cotacao_aprovada', 'cotacao_rejeitada', 'pedido_emitido'].includes(req.status)
  const { data: cotacao } = useCotacaoByRequisicao(showCotacao ? id : undefined)

  // Triador do CD (admin ou lotado em base que faz_triagem)
  const isTriador = isAdmin || Boolean(((bases as any[]).find(b => b.id === perfil?.base_id) as any)?.faz_triagem)
  const podeTriagem = isTriador && req?.status === 'em_triagem_cd'
  const [qtdAtender, setQtdAtender] = useState<Record<string, string>>({})
  const [triagemMsg, setTriagemMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [observacao, setObservacao] = useState('')
  const [showObservacao, setShowObservacao] = useState(false)
  const [respostaEsclarecimento, setRespostaEsclarecimento] = useState('')
  const [respostaDevolucao, setRespostaDevolucao] = useState('')
  const [showItens, setShowItens] = useState(true)
  const [pendingAction, setPendingAction] = useState<'aprovada' | 'rejeitada' | 'esclarecimento' | null>(null)
  const [pedidoToast, setPedidoToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [showEmitirModal, setShowEmitirModal] = useState(false)

  // Decisão técnica (pendente/em_aprovacao/esclarecimento) OU financeira (cotacao_enviada).
  // Compras exige tambem allowlist de aprovadores (mesma regra do AprovAi).
  const isAprovadorCompras = podeAprovarCompras(perfil?.email)
  const canDecideTechnical = !!req
    && ['pendente', 'em_aprovacao', 'em_esclarecimento'].includes(req.status)
    && canTechnicalApprove('compras')
  const canDecideFinancial = !!req
    && req.status === 'cotacao_enviada'
    && isAdmin
  const canDecide = isAprovadorCompras && (canDecideTechnical || canDecideFinancial)
  const canEmitPedido = !!req
    && atLeast('comprador')
    && req.status === 'cotacao_aprovada'
  // Quem pode responder esclarecimento:
  // em_esclarecimento (necessidade): solicitante dono da RC OU o aprovador
  //   que pediu o esclarecimento (match por nome). Compradores nao envolvidos
  //   nao respondem.
  // cotacao_em_esclarecimento (cotação): somente comprador+ (fluxo de cotacao)
  const isDonoReq = !!perfil && !!req && perfil.id === req.solicitante_id
  const isAprovadorEnvolvidoEscl = !!perfil?.nome && !!req?.esclarecimento_por
    && perfil.nome.trim().toUpperCase() === req.esclarecimento_por.trim().toUpperCase()
  const canResponderEsclTecnico = isAdmin || isDonoReq || isAprovadorEnvolvidoEscl
  const canResponderEsclCotacao = atLeast('comprador')
  const canResponderEsteEsclarecimento =
    req?.status === 'em_esclarecimento' ? canResponderEsclTecnico
    : req?.status === 'cotacao_em_esclarecimento' ? canResponderEsclCotacao
    : false
  const canMutateComprasReq = canDecide || canEmitPedido
    || canResponderEsteEsclarecimento
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
            <button
              disabled={isLocked}
              onClick={() => navigate(`/requisicoes/${req.id}/editar`)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                bg-white border-2 border-rose-300 text-rose-600 text-sm font-bold
                hover:bg-rose-50 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <Pencil size={14} /> Editar requisição (itens, obra, categoria…)
            </button>
          )}

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

      {/* Editar RC aprovada antes de iniciar cotação */}
      {req.status === 'aprovada' && (
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Pencil size={15} className="text-sky-500 shrink-0" />
            <p className="text-sm text-sky-700">Precisa corrigir itens ou anexar a cotação de referência?</p>
          </div>
          <button
            onClick={() => navigate(`/requisicoes/${req.id}/editar`)}
            className="shrink-0 flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold
              border border-sky-300 bg-white text-sky-700 hover:bg-sky-50 transition-colors"
          >
            <Pencil size={12} /> Editar e reenviar
          </button>
        </div>
      )}

      {/* Alerta Esclarecimento */}
      {(req.status === 'em_esclarecimento' || req.status === 'cotacao_em_esclarecimento') && (
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
          {canResponderEsteEsclarecimento && !reenviarMutation.isSuccess && (
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
                    statusAtual: req.status,
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
              {req.status === 'em_esclarecimento' && (
                <button
                  disabled={isLocked}
                  onClick={() => navigate(`/requisicoes/${req.id}/editar`)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                    border border-amber-300 bg-white text-amber-700 text-sm font-semibold
                    hover:bg-amber-100 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <Pencil size={14} /> Editar itens e reenviar
                </button>
              )}
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

        {/* Aprovador técnico */}
        {req.aprovador_tecnico_nome && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <UserCog size={12} /> Aprovado por
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {req.aprovador_tecnico_nome}
              {req.aprovado_em && (
                <span className="text-xs font-normal text-slate-400 ml-1.5">
                  · {fmtData(req.aprovado_em)}
                </span>
              )}
            </p>
          </div>
        )}

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

      {/* Anexo / Referência de cotação */}
      {req.arquivo_url && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-400 mb-2">Anexo / Referência de cotação</p>
          <a
            href={req.arquivo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-sm font-semibold hover:bg-teal-100 transition-colors"
          >
            <FileText size={15} />
            {decodeURIComponent(req.arquivo_url.split('/').pop()?.replace(/^\d+-/, '') ?? 'Abrir anexo')}
          </a>
        </div>
      )}

      {/* Triagem CD — apenas triador, RC em em_triagem_cd */}
      {podeTriagem && (
        <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Boxes size={16} className="text-sky-600 flex-shrink-0" />
            <span className="text-sm font-bold text-sky-700">Triagem CD — Atender com estoque ou liberar para Compras</span>
          </div>
          <p className="text-xs text-sky-700">
            Informe a quantidade que o CD vai atender. Itens sem catálogo (descrição livre) só
            podem ser liberados ao Compras.
          </p>

          <div className="space-y-2">
            {req.itens.map(item => {
              const restante = item.quantidade - (item.qtd_atendida_cd ?? 0)
              const semCatalogo = !item.est_item_id
              const k = item.id ?? ''
              const saldoCD = item.est_item_id ? (saldosCD[item.est_item_id]?.disponivel ?? 0) : 0
              const sugerido = Math.min(restante, saldoCD)
              const maxAtender = Math.min(restante, saldoCD)
              const valorStr = qtdAtender[k] ?? (sugerido > 0 ? String(sugerido) : '0')
              const valorNum = Math.max(0, Math.min(maxAtender, Number(valorStr) || 0))
              const podeAtenderTotal = saldoCD >= restante
              const podeAtenderParcial = saldoCD > 0 && saldoCD < restante
              const semSaldo = !semCatalogo && saldoCD === 0
              const totalmenteAtendido = restante === 0
              const setVal = (v: number) => setQtdAtender(p => ({ ...p, [k]: String(Math.max(0, Math.min(maxAtender, v))) }))
              const pct = item.quantidade > 0 ? ((item.qtd_atendida_cd ?? 0) / item.quantidade) * 100 : 0
              return (
                <div key={k} className={`bg-white rounded-xl border-2 p-4 space-y-3 ${
                  totalmenteAtendido ? 'border-emerald-200 bg-emerald-50/30'
                  : semCatalogo ? 'border-amber-200'
                  : semSaldo ? 'border-rose-200'
                  : podeAtenderTotal ? 'border-emerald-200'
                  : 'border-sky-200'
                }`}>
                  {/* Header item */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800 truncate flex-1">{item.descricao}</p>
                    {totalmenteAtendido && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                        <CheckCircle size={11} /> Atendido
                      </span>
                    )}
                  </div>

                  {/* Stats Grid - 4 colunas grandes */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center bg-slate-50 rounded-lg p-2">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Solicitado</p>
                      <p className="text-lg font-extrabold text-slate-800">{item.quantidade}</p>
                      <p className="text-[9px] text-slate-400">{item.unidade}</p>
                    </div>
                    <div className="text-center bg-emerald-50 rounded-lg p-2">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">Atendido</p>
                      <p className="text-lg font-extrabold text-emerald-700">{item.qtd_atendida_cd ?? 0}</p>
                      <p className="text-[9px] text-emerald-500">{item.unidade}</p>
                    </div>
                    <div className="text-center bg-amber-50 rounded-lg p-2">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-amber-600">Pendente</p>
                      <p className="text-lg font-extrabold text-amber-700">{restante}</p>
                      <p className="text-[9px] text-amber-500">{item.unidade}</p>
                    </div>
                    <div className={`text-center rounded-lg p-2 ${
                      semCatalogo ? 'bg-slate-50'
                      : podeAtenderTotal ? 'bg-emerald-50'
                      : podeAtenderParcial ? 'bg-amber-50'
                      : 'bg-rose-50'
                    }`}>
                      <p className={`text-[9px] font-bold uppercase tracking-wider ${
                        semCatalogo ? 'text-slate-400'
                        : podeAtenderTotal ? 'text-emerald-600'
                        : podeAtenderParcial ? 'text-amber-600'
                        : 'text-rose-600'
                      }`}>Saldo CD</p>
                      <p className={`text-lg font-extrabold ${
                        semCatalogo ? 'text-slate-400'
                        : podeAtenderTotal ? 'text-emerald-700'
                        : podeAtenderParcial ? 'text-amber-700'
                        : 'text-rose-700'
                      }`}>{semCatalogo ? '—' : saldoCD}</p>
                      <p className={`text-[9px] ${
                        semCatalogo ? 'text-slate-400'
                        : podeAtenderTotal ? 'text-emerald-500'
                        : podeAtenderParcial ? 'text-amber-500'
                        : 'text-rose-500'
                      }`}>{semCatalogo ? 'sem cat.' : podeAtenderTotal ? '✓ cobre' : podeAtenderParcial ? 'parcial' : 'sem saldo'}</p>
                    </div>
                  </div>

                  {/* Barra de progresso de atendimento */}
                  {(item.qtd_atendida_cd ?? 0) > 0 && (
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>Atendimento</span>
                        <span className="font-bold">{Math.round(pct)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Controles de atendimento */}
                  {restante > 0 && !semCatalogo && !semSaldo && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-600">Atender pelo CD:</p>
                        <p className="text-2xl font-extrabold text-sky-600">
                          {valorNum} <span className="text-xs text-slate-400">/ {maxAtender} {item.unidade}</span>
                        </p>
                      </div>

                      {/* Slider */}
                      <input
                        type="range"
                        min={0}
                        max={maxAtender}
                        step={1}
                        value={valorNum}
                        onChange={e => setVal(Number(e.target.value))}
                        className="w-full accent-sky-500"
                      />

                      {/* Quick actions */}
                      <div className="flex gap-1.5">
                        <button onClick={() => setVal(0)}
                          className="flex-1 px-2 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                          Nada
                        </button>
                        <button onClick={() => setVal(Math.floor(maxAtender / 2))}
                          className="flex-1 px-2 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                          Metade ({Math.floor(maxAtender / 2)})
                        </button>
                        <button onClick={() => setVal(maxAtender)}
                          className="flex-1 px-2 py-1.5 text-[11px] font-bold rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100">
                          Tudo ({maxAtender})
                        </button>
                      </div>

                      <button
                        disabled={atenderTriagem.isPending || valorNum <= 0}
                        onClick={async () => {
                          try {
                            await atenderTriagem.mutateAsync({ itemId: k, quantidade: valorNum })
                            setTriagemMsg({ type: 'success', msg: `Atendido ${valorNum} ${item.unidade} de ${item.descricao}` })
                            setQtdAtender(p => ({ ...p, [k]: '' }))
                          } catch (e) {
                            setTriagemMsg({ type: 'error', msg: (e as Error).message })
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <CheckCircle size={15} />
                        Atender {valorNum} {item.unidade} com estoque
                      </button>
                    </div>
                  )}

                  {semCatalogo && restante > 0 && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-700">
                        <b>Item sem catálogo</b> — descrição livre, não dá pra atender com estoque. Use "Liberar para Compras" abaixo.
                      </p>
                    </div>
                  )}
                  {semSaldo && (
                    <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-2">
                      <AlertTriangle size={12} className="text-rose-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-rose-700">
                        <b>Sem saldo no CD</b> — use "Liberar para Compras" abaixo.
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {triagemMsg && (
            <div className={`rounded-xl px-3 py-2 text-xs font-semibold ${
              triagemMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {triagemMsg.msg}
            </div>
          )}

          {/* Liberar para Compras */}
          {req.itens.some(i => i.quantidade - (i.qtd_atendida_cd ?? 0) > 0) && (
            <button
              disabled={liberarTriagem.isPending}
              onClick={async () => {
                try {
                  await liberarTriagem.mutateAsync({ rcId: req.id })
                  setTriagemMsg({ type: 'success', msg: 'RC liberada para validação técnica' })
                } catch (e) {
                  setTriagemMsg({ type: 'error', msg: (e as Error).message })
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-500 text-white text-sm font-bold hover:bg-sky-600 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <Send size={15} />
              {liberarTriagem.isPending ? 'Liberando…' : 'Liberar restante para Compras'}
            </button>
          )}
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
                      <td className="px-3 py-2 text-slate-700">
                        {item.descricao}
                        {item.est_item_id && saldosItens && (() => {
                          const s = saldosItens[item.est_item_id] ?? { saldo: 0, reservado: 0, disponivel: 0 }
                          const cobre = s.disponivel >= item.quantidade
                          const parcial = s.disponivel > 0 && s.disponivel < item.quantidade
                          const cls = cobre
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : parcial
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          return (
                            <span
                              title={s.reservado > 0 ? `Saldo ${s.saldo} − ${s.reservado} reservado` : `Saldo ${s.saldo}`}
                              className={`mt-1 flex w-fit items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${cls}`}
                            >
                              <Boxes size={11} /> Estoque: {s.disponivel} {item.unidade} disp.
                            </span>
                          )
                        })()}
                      </td>
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

      {/* Histórico de alterações de itens (antes/depois) */}
      {alteracoesItens && alteracoesItens.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <History size={14} className="text-slate-500" />
            <span className="text-sm font-bold text-slate-700">Alterações nos itens</span>
          </div>
          {alteracoesItens.map(alt => (
            <div key={alt.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
              <p className="text-xs text-slate-500">
                Por <span className="font-semibold text-slate-700">{alt.responsavel_nome ?? 'Sistema'}</span>
                {' '}({alt.responsavel_tipo === 'requisitante' ? 'requisitante' : 'aprovador/comprador'})
                {' · '}{fmtData(alt.created_at)}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-rose-500">Antes</p>
                  {alt.antes.length === 0 && <p className="text-xs text-slate-400">—</p>}
                  {alt.antes.map((it, i) => (
                    <p key={i} className="text-xs text-slate-600 line-through decoration-rose-300">{fmtItemLinha(it)}</p>
                  ))}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Depois</p>
                  {alt.depois.length === 0 && <p className="text-xs text-slate-400">—</p>}
                  {alt.depois.map((it, i) => (
                    <p key={i} className="text-xs text-slate-700 font-medium">{fmtItemLinha(it)}</p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comprador */}
      {req.comprador_nome && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 mb-1">Comprador designado</p>
          <p className="text-sm font-bold text-slate-700">{req.comprador_nome}</p>
        </div>
      )}

      {/* Auditoria */}
      <AuditoriaCard
        createdAt={req.created_at}
        updatedAt={req.updated_at}
        criadoPor={req.criado_por_nome}
        atualizadoPor={req.atualizado_por_nome}
        extra={[
          { label: 'Solicitante', value: req.solicitante_nome },
        ]}
      />

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

              {(req.status === 'pendente' || req.status === 'em_aprovacao') && (
                <button
                  disabled={isLocked}
                  onClick={() => navigate(`/requisicoes/${req.id}/editar`)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold
                    border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-[0.98]
                    transition-all disabled:opacity-50"
                >
                  <Pencil size={13} /> Editar itens
                </button>
              )}

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
