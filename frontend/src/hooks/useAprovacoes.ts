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
    refetchInterval: 30_000,
    retry: false,
    staleTime: 15_000,
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

// ── Decisão centralizada (admin): atualiza RC + cria registro apr_aprovacoes ──

export interface DecisaoPayload {
  requisicaoId: string
  decisao: 'aprovada' | 'rejeitada' | 'esclarecimento'
  observacao?: string
  requisicaoNumero: string
  alcadaNivel: number
  aprovadorNome: string
  aprovadorEmail: string
}

export function useDecisaoRequisicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: DecisaoPayload) => {
      const {
        requisicaoId, decisao, observacao,
        requisicaoNumero, alcadaNivel, aprovadorNome, aprovadorEmail,
      } = payload

      // 1. Update cmp_requisicoes status
      const updates: Record<string, unknown> = {}

      if (decisao === 'aprovada') {
        updates.status = 'aprovada'
        updates.data_aprovacao = new Date().toISOString()
      } else if (decisao === 'rejeitada') {
        updates.status = 'rejeitada'
      } else if (decisao === 'esclarecimento') {
        updates.status = 'em_esclarecimento'
        updates.esclarecimento_msg = observacao || 'Esclarecimento solicitado'
        updates.esclarecimento_por = aprovadorNome
        updates.esclarecimento_em = new Date().toISOString()
      }

      const { error: reqError } = await supabase
        .from(TABLE_REQ)
        .update(updates)
        .eq('id', requisicaoId)

      if (reqError) throw reqError

      // 2. Create apr_aprovacoes record (audit trail + feeds AprovAi)
      const aprStatus = decisao === 'aprovada' ? 'aprovada'
                      : decisao === 'rejeitada' ? 'rejeitada'
                      : 'esclarecimento'

      const { error: aprError } = await supabase
        .from(TABLE_APR)
        .insert({
          modulo: 'cmp',
          entidade_id: requisicaoId,
          entidade_numero: requisicaoNumero,
          aprovador_nome: aprovadorNome,
          aprovador_email: aprovadorEmail,
          nivel: alcadaNivel,
          status: aprStatus,
          observacao: observacao || null,
          data_decisao: new Date().toISOString(),
        })

      // Non-critical: log warning but don't throw
      if (aprError) console.warn('Aviso: apr_aprovacoes não inserido:', aprError.message)

      return { decisao }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['requisicao'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
