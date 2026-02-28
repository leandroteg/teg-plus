import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AprovacaoPendente } from '../types'
import { supabase } from '../services/supabase'
import { api } from '../services/api'

export function useAprovacoesPendentes() {
  return useQuery<AprovacaoPendente[]>({
    queryKey: ['aprovacoes-pendentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aprovacoes')
        .select(`
          id, requisicao_id, aprovador_nome, aprovador_email,
          nivel, status, observacao, token, data_limite,
          requisicao:requisicoes(
            id, numero, solicitante_nome, obra_nome, descricao,
            valor_estimado, urgencia, status, alcada_nivel, categoria, created_at
          )
        `)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as unknown as AprovacaoPendente[]
    },
    refetchInterval: 15_000,
    retry: 1,
    staleTime: 5_000,
  })
}

export function useProcessarAprovacaoAi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { token: string; decisao: 'aprovada' | 'rejeitada'; observacao?: string }) =>
      api.processarAprovacao(vars.token, vars.decisao, vars.observacao),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
