import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AprovacaoPendente } from '../types'
import { supabase } from '../services/supabase'
import { api } from '../services/api'

// Tabelas: apr_aprovacoes (módulo Aprovações — ApprovaAi)
const TABLE_APR = 'apr_aprovacoes'
const TABLE_REQ = 'cmp_requisicoes'

export function useAprovacoesPendentes() {
  return useQuery<AprovacaoPendente[]>({
    queryKey: ['aprovacoes-pendentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE_APR)
        .select(`
          id, entidade_id, aprovador_nome, aprovador_email,
          nivel, status, observacao, token, data_limite,
          requisicao:cmp_requisicoes(
            id, numero, solicitante_nome, obra_nome, descricao,
            valor_estimado, urgencia, status, alcada_nivel, categoria, created_at
          )
        `)
        .eq('status', 'pendente')
        .eq('modulo', 'cmp')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Mapeia entidade_id → requisicao_id para compatibilidade com o tipo
      return ((data ?? []) as unknown[]).map((a: unknown) => {
        const apr = a as Record<string, unknown>
        return { ...apr, requisicao_id: apr.entidade_id } as AprovacaoPendente
      })
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
