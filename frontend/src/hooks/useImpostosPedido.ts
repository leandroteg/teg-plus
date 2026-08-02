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

export interface ImpostoItemNota {
  id?: string
  imposto_id?: string
  pedido_id?: string
  requisicao_item_id?: string | null
  descricao: string
  valor_item?: number
  base_calculo_icms?: number
  valor_icms?: number
  base_calculo_icms_st?: number
  valor_icms_st?: number
  valor_ipi?: number
  valor_pis?: number
  valor_cofins?: number
  valor_outros?: number
  observacao?: string | null
}

export function useImpostoItensNota(pedidoId?: string) {
  return useQuery<ImpostoItemNota[]>({
    queryKey: ['cmp-pedido-impostos-itens', pedidoId],
    enabled: !!pedidoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cmp_pedido_impostos_itens')
        .select('*')
        .eq('pedido_id', pedidoId!)
        .order('created_at')
      if (error) return []
      return (data ?? []) as ImpostoItemNota[]
    },
  })
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
    // `itens` undefined = nao mexe no detalhe por item; array = substitui as linhas do registro
    mutationFn: async (payload: ImpostosPedido & { itens?: ImpostoItemNota[] }) => {
      const { id, itens, ...rest } = payload
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
      let impostoId = id
      if (id) {
        const { error } = await supabase.from('cmp_pedido_impostos').update(rest).eq('id', id)
        if (error) throw error
      } else {
        // Upsert por (pedido_id, tipo_nota)
        const { data, error } = await supabase
          .from('cmp_pedido_impostos')
          .upsert(rest, { onConflict: 'pedido_id,tipo_nota' })
          .select('id')
          .single()
        if (error) throw error
        impostoId = data?.id
      }

      if (itens !== undefined && impostoId) {
        const { error: delError } = await supabase
          .from('cmp_pedido_impostos_itens')
          .delete()
          .eq('imposto_id', impostoId)
        if (delError) throw delError
        const linhas = itens
          .map(it => ({
            imposto_id: impostoId,
            pedido_id: rest.pedido_id,
            requisicao_item_id: it.requisicao_item_id ?? null,
            descricao: it.descricao,
            valor_item: it.valor_item ?? 0,
            base_calculo_icms: it.base_calculo_icms ?? 0,
            valor_icms: it.valor_icms ?? 0,
            base_calculo_icms_st: it.base_calculo_icms_st ?? 0,
            valor_icms_st: it.valor_icms_st ?? 0,
            valor_ipi: it.valor_ipi ?? 0,
            valor_pis: it.valor_pis ?? 0,
            valor_cofins: it.valor_cofins ?? 0,
            valor_outros: it.valor_outros ?? 0,
          }))
          // Guarda so linhas com algum imposto lancado
          .filter(l =>
            l.base_calculo_icms + l.valor_icms + l.base_calculo_icms_st + l.valor_icms_st +
            l.valor_ipi + l.valor_pis + l.valor_cofins + l.valor_outros > 0)
        if (linhas.length > 0) {
          const { error: insError } = await supabase.from('cmp_pedido_impostos_itens').insert(linhas)
          if (insError) throw insError
        }
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['cmp-pedido-impostos', vars.pedido_id] })
      qc.invalidateQueries({ queryKey: ['cmp-pedido-impostos-itens', vars.pedido_id] })
    },
  })
}
