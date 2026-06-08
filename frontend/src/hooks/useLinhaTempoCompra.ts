import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

// =============================================================================
// useLinhaTempoCompra — marcos datados das 7 etapas do FluxoTimeline para uma
// requisição de compra. Retorna um array de 7 posições (ISO date | null),
// alinhado por índice com as ETAPAS do FluxoTimeline:
//   0 Requisição · 1 Valid. Técnica · 2 Cotação · 3 Aprov. Fin. · 4 Pedido
//   5 Entrega · 6 Pagamento
// Busca sob demanda (enabled só quando a seção é aberta no card de aprovação).
// =============================================================================

export function useLinhaTempoCompra(requisicaoId: string | undefined) {
  return useQuery<(string | null)[]>({
    queryKey: ['linha-tempo-compra', requisicaoId],
    enabled: !!requisicaoId,
    queryFn: async () => {
      const id = requisicaoId!
      const [reqRes, cotRes, pedRes, aprRes] = await Promise.all([
        supabase
          .from('cmp_requisicoes')
          .select('created_at, data_aprovacao')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('cmp_cotacoes')
          .select('data_conclusao')
          .eq('requisicao_id', id)
          .not('data_conclusao', 'is', null)
          .order('data_conclusao', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('cmp_pedidos')
          .select('data_pedido, data_entrega_real, pago_em')
          .eq('requisicao_id', id)
          .order('data_pedido', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('apr_aprovacoes')
          .select('data_decisao')
          .eq('entidade_id', id)
          .eq('modulo', 'cmp')
          .eq('tipo_aprovacao', 'cotacao')
          .eq('status', 'aprovada')
          .not('data_decisao', 'is', null)
          .order('data_decisao', { ascending: true })
          .limit(1)
          .maybeSingle(),
      ])

      const req = reqRes.data as { created_at?: string; data_aprovacao?: string } | null
      const cot = cotRes.data as { data_conclusao?: string } | null
      const ped = pedRes.data as { data_pedido?: string; data_entrega_real?: string; pago_em?: string } | null
      const aprFin = aprRes.data as { data_decisao?: string } | null

      return [
        req?.created_at ?? null,        // 0 Requisição
        req?.data_aprovacao ?? null,    // 1 Valid. Técnica
        cot?.data_conclusao ?? null,    // 2 Cotação
        aprFin?.data_decisao ?? null,   // 3 Aprov. Financeira
        ped?.data_pedido ?? null,       // 4 Pedido
        ped?.data_entrega_real ?? null, // 5 Entrega
        ped?.pago_em ?? null,           // 6 Pagamento
      ]
    },
    staleTime: 60_000,
  })
}
