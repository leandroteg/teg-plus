import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Pedido } from '../types'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

export function usePedidos(status?: string) {
  return useQuery<Pedido[]>({
    queryKey: ['pedidos', status],
    queryFn: async () => {
      let query = supabase
        .from('cmp_pedidos')
        .select(`
          id, requisicao_id, cotacao_id, comprador_id,
          numero_pedido, fornecedor_nome, valor_total, status,
          data_pedido, data_prevista_entrega, data_entrega_real,
          nf_numero, observacoes, created_at,
          qtd_itens_total, qtd_itens_recebidos,
          status_pagamento, liberado_pagamento_em, liberado_pagamento_por, pago_em,
          requisicao:cmp_requisicoes(numero, descricao, obra_nome, categoria),
          comprador:cmp_compradores(nome)
        `)
        .order('data_prevista_entrega', { ascending: true })
        .limit(100)

      if (status) query = query.eq('status', status)

      const { data, error } = await query
      if (error) throw error

      return ((data ?? []) as any[]).map(p => ({
        ...p,
        comprador: p.comprador ? { nome: p.comprador.nome } : undefined,
      })) as Pedido[]
    },
    refetchInterval: 60_000,
    retry: false,
    staleTime: 30_000,
  })
}

export function useAtualizarPedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, data_entrega_real }: {
      id: string
      status: string
      data_entrega_real?: string
    }) => {
      const { error } = await supabase
        .from('cmp_pedidos')
        .update({ status, ...(data_entrega_real ? { data_entrega_real } : {}) })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
    },
  })
}

export function useLiberarPagamento() {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  return useMutation({
    mutationFn: async (pedidoId: string) => {
      const { error } = await supabase
        .from('cmp_pedidos')
        .update({
          status_pagamento: 'liberado',
          liberado_pagamento_em: new Date().toISOString(),
          liberado_pagamento_por: perfil?.nome ?? 'Comprador',
        })
        .eq('id', pedidoId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidos'] }),
  })
}

export function useRegistrarPagamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (pedidoId: string) => {
      const { error } = await supabase
        .from('cmp_pedidos')
        .update({ status_pagamento: 'pago', pago_em: new Date().toISOString() })
        .eq('id', pedidoId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidos'] }),
  })
}

// ── Emitir Pedido: cria pedido a partir de cotação aprovada ────────────────

export interface EmitirPedidoPayload {
  requisicaoId: string
  cotacaoId: string
  fornecedorNome: string
  valorTotal: number
  compradorId?: string
  condicaoPagamento?: string
  observacoes?: string
  dataPrevistaEntrega?: string
}

export function useEmitirPedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: EmitirPedidoPayload) => {
      let {
        requisicaoId, cotacaoId, fornecedorNome, valorTotal,
        compradorId, condicaoPagamento, observacoes, dataPrevistaEntrega,
      } = payload

      // 0. Resolve cotação a partir da RC se não informada
      if (!cotacaoId) {
        const { data: cot } = await supabase
          .from('cmp_cotacoes')
          .select('id, comprador_id, fornecedor_selecionado_nome, valor_selecionado')
          .eq('requisicao_id', requisicaoId)
          .eq('status', 'concluida')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!cot) throw new Error('Cotação concluída não encontrada para esta requisição.')

        cotacaoId = cot.id
        if (!compradorId) compradorId = cot.comprador_id ?? undefined
        if (cot.fornecedor_selecionado_nome && fornecedorNome === 'N/A') {
          fornecedorNome = cot.fornecedor_selecionado_nome
        }
        if (cot.valor_selecionado && cot.valor_selecionado > 0) {
          valorTotal = cot.valor_selecionado
        }
      }

      // 1. Gera número do pedido: PO-YYYYMM-XXXX
      const now = new Date()
      const prefix = `PO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
      const { count } = await supabase
        .from('cmp_pedidos')
        .select('id', { count: 'exact', head: true })
        .like('numero_pedido', `${prefix}%`)
      const seq = String((count ?? 0) + 1).padStart(4, '0')
      const numeroPedido = `${prefix}-${seq}`

      // 2. Cria o pedido
      const { data: pedido, error: pedError } = await supabase
        .from('cmp_pedidos')
        .insert({
          requisicao_id: requisicaoId,
          cotacao_id: cotacaoId,
          comprador_id: compradorId || null,
          numero_pedido: numeroPedido,
          fornecedor_nome: fornecedorNome,
          valor_total: valorTotal,
          status: 'emitido',
          data_pedido: now.toISOString().split('T')[0],
          data_prevista_entrega: dataPrevistaEntrega || null,
          condicao_pagamento: condicaoPagamento || null,
          observacoes: observacoes || null,
        })
        .select('id, numero_pedido')
        .single()

      if (pedError) throw pedError

      // 3. Atualiza RC → pedido_emitido
      const { error: reqError } = await supabase
        .from('cmp_requisicoes')
        .update({ status: 'pedido_emitido' })
        .eq('id', requisicaoId)

      if (reqError) console.warn('Aviso: RC não atualizada:', reqError.message)

      return pedido
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['requisicao'] })
      qc.invalidateQueries({ queryKey: ['cotacoes'] })
      qc.invalidateQueries({ queryKey: ['cotacao'] })
      qc.invalidateQueries({ queryKey: ['cotacao-req'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ── Cancelar Requisição ────────────────────────────────────────────────────

export function useCancelarRequisicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (requisicaoId: string) => {
      const { error } = await supabase
        .from('cmp_requisicoes')
        .update({ status: 'cancelada' })
        .eq('id', requisicaoId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['requisicao'] })
      qc.invalidateQueries({ queryKey: ['cotacoes'] })
      qc.invalidateQueries({ queryKey: ['cotacao'] })
      qc.invalidateQueries({ queryKey: ['cotacao-req'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
