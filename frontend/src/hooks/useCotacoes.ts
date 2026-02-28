import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Cotacao, NovaCotacaoPayload } from '../types'
import { supabase } from '../services/supabase'
import { api } from '../services/api'

export function useCotacoes(compradorId?: string, status?: string) {
  return useQuery<Cotacao[]>({
    queryKey: ['cotacoes', compradorId, status],
    queryFn: async () => {
      let query = supabase
        .from('cotacoes')
        .select(`
          id, requisicao_id, comprador_id, status,
          fornecedor_selecionado_id, valor_selecionado,
          observacao, data_limite, data_conclusao, created_at,
          requisicao:requisicoes(id, numero, solicitante_nome, obra_nome, descricao, valor_estimado, urgencia, status, alcada_nivel, categoria, created_at),
          comprador:compradores(nome, email)
        `)
        .order('created_at', { ascending: false })

      if (compradorId) query = query.eq('comprador_id', compradorId)
      if (status) query = query.eq('status', status)

      const { data, error } = await query
      if (error) throw error

      // Flatten comprador nome
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
        .from('cotacoes')
        .select(`
          id, requisicao_id, comprador_id, status,
          fornecedor_selecionado_id, valor_selecionado,
          observacao, data_limite, data_conclusao, created_at,
          requisicao:requisicoes(id, numero, solicitante_nome, obra_nome, descricao, valor_estimado, urgencia, status, alcada_nivel, categoria, created_at),
          comprador:compradores(nome, email),
          fornecedores:cotacao_fornecedores(*)
        `)
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
