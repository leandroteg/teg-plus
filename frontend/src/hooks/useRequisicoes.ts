import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Requisicao, NovaRequisicaoPayload } from '../types'
import { supabase } from '../services/supabase'
import { api } from '../services/api'

// Tabelas: cmp_requisicoes (módulo Compras)
const TABLE = 'cmp_requisicoes'

export function useRequisicoes(status?: string, search?: string) {
  return useQuery<Requisicao[]>({
    queryKey: ['requisicoes', status, search],
    queryFn: async () => {
      let query = supabase
        .from(TABLE)
        .select(`
          id, numero, solicitante_nome, obra_nome, obra_id,
          descricao, justificativa, valor_estimado, urgencia, status,
          alcada_nivel, categoria, comprador_id, texto_original, ai_confianca,
          created_at,
          comprador:cmp_compradores(nome, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (status) query = query.eq('status', status)
      if (search) query = query.ilike('descricao', `%${search}%`)

      const { data, error } = await query
      if (error) throw error

      // Flattens o join: comprador.nome → comprador_nome
      return ((data ?? []) as any[]).map(r => ({
        ...r,
        comprador_nome: r.comprador?.nome ?? undefined,
        comprador: undefined,
      })) as Requisicao[]
    },
    refetchInterval: 30_000,
    retry: 1,
    staleTime: 10_000,
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
