import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

// Cancelamento de PEDIDO de compra (backend: migration 196 — cmp_cancelar_pedido).
// Cancela o pedido e cascateia o cancelamento dos CP não-liquidados do pedido.

export const PEDIDO_STATUS_CANCELAVEIS = ['emitido', 'confirmado', 'em_entrega']

export function podeCancelarPedido(perfil?: { pode_cancelar_pedido?: boolean } | null): boolean {
  return perfil?.pode_cancelar_pedido === true
}

export function pedidoEhCancelavel(status?: string): boolean {
  return !!status && PEDIDO_STATUS_CANCELAVEIS.includes(status)
}

export function useCancelarPedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ pedidoId, justificativa }: { pedidoId: string; justificativa: string }) => {
      const { data, error } = await supabase.rpc('cmp_cancelar_pedido', {
        p_pedido_id: pedidoId,
        p_justificativa: justificativa,
      })
      if (error) throw error
      return data as { pedido_id: string; cps_canceladas: number }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
