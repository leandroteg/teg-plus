import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Requisicao, NovaRequisicaoPayload } from '../types'
import { supabase } from '../services/supabase'
import { api } from '../services/api'

export function useRequisicoes(status?: string) {
  return useQuery<Requisicao[]>({
    queryKey: ['requisicoes', status],
    queryFn: async () => {
      let query = supabase
        .from('requisicoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (status) query = query.eq('status', status)

      const { data, error } = await query
      if (error) throw error
      return data as Requisicao[]
    },
    refetchInterval: 30_000,
  })
}

export function useCriarRequisicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: NovaRequisicaoPayload) => api.criarRequisicao(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useProcessarAprovacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { token: string; decisao: 'aprovada' | 'rejeitada'; observacao?: string }) =>
      api.processarAprovacao(vars.token, vars.decisao, vars.observacao),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
