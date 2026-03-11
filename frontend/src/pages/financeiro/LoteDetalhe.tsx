import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Package, Send, CheckCircle2, XCircle,
  Clock, User, FileText, AlertTriangle, Trash2,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useLoteById,
  useEnviarLoteAprovacao,
  useDecidirItemLote,
  useDecidirLoteCompleto,
  useRemoverItemLote,
} from '../../hooks/useLotesPagamento'
import type { StatusLote, DecisaoLoteItem, LoteItem, ContaPagar } from '../../types/financeiro'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtFull = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const fmtDataFull = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

const STATUS_LABELS: Record<StatusLote, { label: string; color: string }> = {
  montando:                { label: 'Montando',           color: 'slate' },
  enviado_aprovacao:       { label: 'Em Aprovação',       color: 'amber' },
  parcialmente_aprovado:   { label: 'Parcialm. Aprovado', color: 'orange' },
  aprovado:                { label: 'Aprovado',           color: 'emerald' },
  em_pagamento:            { label: 'Em Pagamento',       color: 'blue' },
  pago:                    { label: 'Pago',               color: 'green' },
  cancelado:               { label: 'Cancelado',          color: 'red' },
}

const DECISAO_CONFIG: Record<DecisaoLoteItem, { label: string; bg: string; text: string }> = {
  pendente:  { label: 'Pendente',  bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  aprovado:  { label: 'Aprovado',  bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  rejeitado: { label: 'Rejeitado', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function LoteDetalhe() {
  const { loteId } = useParams<{ loteId: string }>()
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { data: lote, isLoading } = useLoteById(loteId)
  const enviarAprovacao = useEnviarLoteAprovacao()
  const decidirItem = useDecidirItemLote()
  const decidirCompleto = useDecidirLoteCompleto()
  const removerItem = useRemoverItemLote()

  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  if (isLoading || !lote) {
    return <div className="text-center text-sm text-slate-400 py-12">Carregando...</div>
  }

  const itens = lote.itens ?? []
  const pendentes = itens.filter(i => i.decisao === 'pendente').length
  const aprovados = itens.filter(i => i.decisao === 'aprovado').length
  const rejeitados = itens.filter(i => i.decisao === 'rejeitado').length
  const total = itens.length
  const valorAprovado = itens.filter(i => i.decisao === 'aprovado').reduce((s, i) => s + i.valor, 0)

  const isMontando = lote.status === 'montando'
  const isEmAprovacao = lote.status === 'enviado_aprovacao'
  const isResolvido = ['aprovado', 'parcialmente_aprovado', 'cancelado', 'pago'].includes(lote.status)

  const stConfig = STATUS_LABELS[lote.status] ?? STATUS_LABELS.montando

  const cardBg = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'

  // ── Actions ──
  const handleEnviar = async () => {
    try {
      await enviarAprovacao.mutateAsync({ loteId: lote.id, lote })
      showToast('success', 'Lote enviado para aprovação!')
    } catch {
      showToast('error', 'Erro ao enviar lote')
    }
  }

  const handleDecidir = async (item: LoteItem, decisao: 'aprovado' | 'rejeitado') => {
    try {
      await decidirItem.mutateAsync({
        itemId: item.id,
        loteId: lote.id,
        decisao,
        decidido_por: 'Financeiro', // TODO: auth user
      })
      showToast('success', `Item ${decisao === 'aprovado' ? 'aprovado' : 'rejeitado'}`)
    } catch {
      showToast('error', 'Erro ao processar decisão')
    }
  }

  const handleDecidirTodos = async (decisao: 'aprovado' | 'rejeitado') => {
    try {
      await decidirCompleto.mutateAsync({
        loteId: lote.id,
        decisao,
        decidido_por: 'Financeiro',
      })
      showToast('success', `Todos os itens ${decisao === 'aprovado' ? 'aprovados' : 'rejeitados'}`)
    } catch {
      showToast('error', 'Erro ao processar decisão em lote')
    }
  }

  const handleRemover = async (item: LoteItem) => {
    try {
      await removerItem.mutateAsync({ itemId: item.id, cpId: item.cp_id })
      showToast('success', 'Item removido do lote')
    } catch {
      showToast('error', 'Erro ao remover item')
    }
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Back + Header */}
      <button
        onClick={() => navigate('/financeiro/lotes')}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-500 transition-colors"
      >
        <ArrowLeft size={14} /> Voltar aos lotes
      </button>

      <div className={`rounded-xl border p-5 ${cardBg}`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isDark ? 'bg-indigo-900/30' : 'bg-indigo-50'
          }`}>
            <Package size={22} className="text-indigo-500" />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{lote.numero_lote}</h1>
              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full bg-${stConfig.color}-100 dark:bg-${stConfig.color}-900/30 text-${stConfig.color}-700 dark:text-${stConfig.color}-400`}>
                {stConfig.label}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Criado por {lote.criado_por} · {fmtDataFull(lote.created_at)}
              {lote.observacao && <span> · 💬 {lote.observacao}</span>}
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-indigo-500">{fmtFull(lote.valor_total)}</div>
            <div className="text-xs text-slate-400">{lote.qtd_itens} item(ns)</div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className={`rounded-xl border p-4 ${cardBg}`}>
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Aprovados: {aprovados}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span>Rejeitados: {rejeitados}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Pendentes: {pendentes}</span>
          </div>
          {aprovados > 0 && (
            <span className="text-xs text-emerald-500 font-semibold ml-auto">
              Valor aprovado: {fmtFull(valorAprovado)}
            </span>
          )}
        </div>

        {/* Stacked bar */}
        <div className="h-3 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex">
          {aprovados > 0 && (
            <div className="bg-emerald-500 transition-all" style={{ width: `${(aprovados / total) * 100}%` }} />
          )}
          {rejeitados > 0 && (
            <div className="bg-red-500 transition-all" style={{ width: `${(rejeitados / total) * 100}%` }} />
          )}
          {pendentes > 0 && (
            <div className="bg-amber-400 transition-all" style={{ width: `${(pendentes / total) * 100}%` }} />
          )}
        </div>
      </div>

      {/* Bulk actions */}
      {(isMontando || isEmAprovacao) && (
        <div className="flex flex-wrap gap-2">
          {isMontando && (
            <button
              onClick={handleEnviar}
              disabled={enviarAprovacao.isPending || itens.length === 0}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
            >
              <Send size={14} />
              {enviarAprovacao.isPending ? 'Enviando...' : 'Enviar para Aprovação'}
            </button>
          )}
          {isEmAprovacao && pendentes > 0 && (
            <>
              <button
                onClick={() => handleDecidirTodos('aprovado')}
                disabled={decidirCompleto.isPending}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 size={14} />
                Aprovar Todos ({pendentes})
              </button>
              <button
                onClick={() => handleDecidirTodos('rejeitado')}
                disabled={decidirCompleto.isPending}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
              >
                <XCircle size={14} />
                Rejeitar Todos ({pendentes})
              </button>
            </>
          )}
        </div>
      )}

      {/* Items list */}
      <div className={`rounded-xl border overflow-hidden ${cardBg}`}>
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Itens do Lote
          </span>
        </div>

        {itens.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-8">Nenhum item</div>
        )}

        {itens.map((item, i) => {
          const cp = item.cp
          const dCfg = DECISAO_CONFIG[item.decisao]
          const isPending = item.decisao === 'pendente'

          return (
            <div
              key={item.id}
              className={`px-4 py-3 ${
                i > 0 ? 'border-t border-slate-100 dark:border-slate-700/50' : ''
              } ${
                item.decisao === 'aprovado' ? (isDark ? 'bg-emerald-900/5' : 'bg-emerald-50/30') :
                item.decisao === 'rejeitado' ? (isDark ? 'bg-red-900/5' : 'bg-red-50/30') : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Status icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  item.decisao === 'aprovado'
                    ? 'bg-emerald-100 dark:bg-emerald-900/40'
                    : item.decisao === 'rejeitado'
                    ? 'bg-red-100 dark:bg-red-900/40'
                    : isDark ? 'bg-slate-700' : 'bg-slate-100'
                }`}>
                  {item.decisao === 'aprovado' ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  ) : item.decisao === 'rejeitado' ? (
                    <XCircle size={16} className="text-red-500" />
                  ) : (
                    <Clock size={16} className="text-amber-400" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{cp?.fornecedor_nome ?? '—'}</div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 truncate">
                    {cp?.numero_documento && <span>{cp.numero_documento}</span>}
                    {cp?.data_vencimento && <span>Venc. {fmtData(cp.data_vencimento)}</span>}
                    {cp?.requisicao?.obra_nome && <span>· {cp.requisicao.obra_nome}</span>}
                  </div>
                </div>

                {/* Value + badge */}
                <div className="text-right shrink-0 mr-2">
                  <div className="text-sm font-bold">{fmtFull(item.valor)}</div>
                  <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${dCfg.bg} ${dCfg.text}`}>
                    {dCfg.label}
                  </span>
                </div>

                {/* Actions */}
                {isPending && isEmAprovacao && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleDecidir(item, 'aprovado')}
                      disabled={decidirItem.isPending}
                      className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-600 transition-colors"
                      title="Aprovar"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDecidir(item, 'rejeitado')}
                      disabled={decidirItem.isPending}
                      className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 transition-colors"
                      title="Rejeitar"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                )}

                {isMontando && (
                  <button
                    onClick={() => handleRemover(item)}
                    disabled={removerItem.isPending}
                    className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors"
                    title="Remover do lote"
                  >
                    <Trash2 size={15} />
                  </button>
                )}

                {/* Decision info */}
                {!isPending && item.decidido_por && (
                  <div className="text-[10px] text-slate-400 shrink-0">
                    <div className="flex items-center gap-1">
                      <User size={10} /> {item.decidido_por}
                    </div>
                    {item.decidido_em && <div>{fmtDataFull(item.decidido_em)}</div>}
                  </div>
                )}
              </div>

              {item.observacao && (
                <div className="text-[11px] text-slate-400 mt-1.5 ml-11">
                  💬 {item.observacao}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
