import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Cotacao, NovaCotacaoPayload } from '../types'
import { supabase } from '../services/supabase'
import { api } from '../services/api'

// Tabelas: cmp_cotacoes, cmp_cotacao_fornecedores (módulo Compras)
const TABLE_COT  = 'cmp_cotacoes'
const TABLE_FORN = 'cmp_cotacao_fornecedores'

const SELECT_COTACAO = `
  id, requisicao_id, comprador_id, status,
  fornecedor_selecionado_id, valor_selecionado, fornecedor_selecionado_nome,
  observacao, data_limite, data_conclusao, created_at,
  requisicao:cmp_requisicoes(
    id, numero, solicitante_nome, obra_nome, descricao,
    valor_estimado, urgencia, status, alcada_nivel, categoria, created_at
  ),
  comprador:cmp_compradores(nome, email)
`

const SELECT_COTACAO_FULL = `
  ${SELECT_COTACAO},
  fornecedores:cmp_cotacao_fornecedores(*)
`

export function useCotacoes(compradorId?: string, status?: string) {
  return useQuery<Cotacao[]>({
    queryKey: ['cotacoes', compradorId, status],
    queryFn: async () => {
      let query = supabase
        .from(TABLE_COT)
        .select(SELECT_COTACAO)
        .order('created_at', { ascending: false })

      if (compradorId) query = query.eq('comprador_id', compradorId)
      if (status)      query = query.eq('status', status)

      const { data, error } = await query
      if (error) throw error

      return ((data ?? []) as unknown[]).map((c: unknown) => {
        const cot = c as Record<string, unknown>
        const comprador = cot.comprador as Record<string, string> | null
        return { ...cot, comprador_nome: comprador?.nome ?? '' } as Cotacao
      })
    },
    refetchInterval: 30_000,
    retry: 1,
    staleTime: 10_000,
  })
}

export function useCotacao(id?: string) {
  return useQuery<Cotacao | null>({
    queryKey: ['cotacao', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE_COT)
        .select(SELECT_COTACAO_FULL)
        .eq('id', id!)
        .single()

      if (error) throw error
      if (!data) return null

      const cot = data as Record<string, unknown>
      const comprador = cot.comprador as Record<string, string> | null
      return { ...cot, comprador_nome: comprador?.nome ?? '' } as Cotacao
    },
    retry: 1,
  })
}

export function useSubmeterCotacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: NovaCotacaoPayload) => api.submeterCotacao(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotacoes'] })
      qc.invalidateQueries({ queryKey: ['cotacao'] })
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
