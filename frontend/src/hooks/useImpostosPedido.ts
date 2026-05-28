import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

export type TipoNota = 'nf_produto' | 'nfs_e'

export interface ImpostosPedido {
  id?: string
  pedido_id: string
  tipo_nota: TipoNota
  nf_numero?: string | null
  nf_serie?: string | null
  nf_chave_acesso?: string | null
  nf_arquivo_url?: string | null
  data_emissao?: string | null
  data_recebimento?: string | null
  valor_total_nota?: number
  // Produto
  base_calculo_icms?: number
  valor_icms?: number
  base_calculo_icms_st?: number
  valor_icms_st?: number
  valor_ipi?: number
  valor_pis?: number
  valor_cofins?: number
  valor_frete?: number
  valor_seguro?: number
  valor_desconto?: number
  outras_despesas?: number
  // Servico
  base_calculo_iss?: number
  aliquota_iss?: number
  valor_iss?: number
  iss_retido?: boolean
  valor_iss_retido?: number
  valor_inss_retido?: number
  valor_ir_retido?: number
  valor_csll_retido?: number
  valor_pis_retido?: number
  valor_cofins_retido?: number
  observacao?: string | null
  registrado_por_nome?: string | null
  created_at?: string
  updated_at?: string
}

export function useImpostosPedido(pedidoId?: string) {
  return useQuery<ImpostosPedido[]>({
    queryKey: ['cmp-pedido-impostos', pedidoId],
    enabled: !!pedidoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cmp_pedido_impostos')
        .select('*')
        .eq('pedido_id', pedidoId!)
      if (error) return []
      return (data ?? []) as ImpostosPedido[]
    },
  })
}

export function useSalvarImpostosPedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ImpostosPedido) => {
      const { id, ...rest } = payload
      // Captura quem registrou
      const { data: auth } = await supabase.auth.getUser()
      if (auth?.user?.id) {
        const { data: perfil } = await supabase
          .from('sys_perfis')
          .select('id, nome')
          .eq('auth_id', auth.user.id)
          .maybeSingle()
        if (perfil) {
          ;(rest as ImpostosPedido).registrado_por_nome = perfil.nome as string
          ;(rest as { registrado_por_id?: string }).registrado_por_id = perfil.id as string
        }
      }
      if (id) {
        const { error } = await supabase.from('cmp_pedido_impostos').update(rest).eq('id', id)
        if (error) throw error
      } else {
        // Upsert por (pedido_id, tipo_nota)
        const { error } = await supabase
          .from('cmp_pedido_impostos')
          .upsert(rest, { onConflict: 'pedido_id,tipo_nota' })
        if (error) throw error
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['cmp-pedido-impostos', vars.pedido_id] })
    },
  })
}
