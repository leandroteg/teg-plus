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
