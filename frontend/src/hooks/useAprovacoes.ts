import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AprovacaoPendente } from '../types'
import { supabase } from '../services/supabase'
import { api } from '../services/api'

// Tabelas: apr_aprovacoes (módulo Aprovações — ApprovaAi)
// NOTE: apr_aprovacoes.entidade_id NAO tem FK para cmp_requisicoes (design genérico).
// Por isso NÃO usamos PostgREST join — fazemos duas queries separadas.
const TABLE_APR = 'apr_aprovacoes'
const TABLE_REQ = 'cmp_requisicoes'

export function useAprovacoesPendentes() {
  return useQuery<AprovacaoPendente[]>({
    queryKey: ['aprovacoes-pendentes'],
    queryFn: async () => {
      // 1. Busca aprovações pendentes do módulo compras
      const { data: aprData, error: aprError } = await supabase
        .from(TABLE_APR)
        .select('id, entidade_id, aprovador_nome, aprovador_email, nivel, status, observacao, token, data_limite, created_at')
        .eq('status', 'pendente')
        .eq('modulo', 'cmp')
        .order('created_at', { ascending: false })

      if (aprError) throw aprError
      if (!aprData || aprData.length === 0) return []

      // 2. Busca as requisições relacionadas pelos IDs
      const entidadeIds = aprData.map(a => a.entidade_id).filter(Boolean)
      const { data: reqData } = await supabase
        .from(TABLE_REQ)
        .select('id, numero, solicitante_nome, obra_nome, descricao, valor_estimado, urgencia, status, alcada_nivel, categoria, created_at')
        .in('id', entidadeIds)

      const reqMap = new Map((reqData ?? []).map(r => [r.id, r]))

      // 3. Mescla aprovações com dados da requisição
      return aprData.map(a => {
        const req = reqMap.get(a.entidade_id)
        return {
          ...a,
          requisicao_id: a.entidade_id,
          requisicao: req ?? null,
        } as AprovacaoPendente
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
