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

      // 3. Busca dados de cotação para cotacao_resumo (fornecedor vencedor, valor, total cotados)
      const { data: cotData } = await supabase
        .from('cmp_cotacoes')
        .select('requisicao_id, fornecedor_selecionado_nome, valor_selecionado, fornecedores:cmp_cotacao_fornecedores!cotacao_id(id, prazo_entrega_dias)')
        .in('requisicao_id', entidadeIds)
        .eq('status', 'concluida')

      const cotMap = new Map<string, {
        fornecedor_nome: string
        valor: number
        prazo_dias: number
        total_cotados: number
      }>()
      for (const c of cotData ?? []) {
        const cot = c as Record<string, unknown>
        const fornecedores = (cot.fornecedores ?? []) as { id: string; prazo_entrega_dias?: number }[]
        const selecionado = fornecedores.find(() => true) // primeiro
        cotMap.set(cot.requisicao_id as string, {
          fornecedor_nome: (cot.fornecedor_selecionado_nome as string) ?? 'N/A',
          valor: (cot.valor_selecionado as number) ?? 0,
          prazo_dias: selecionado?.prazo_entrega_dias ?? 0,
          total_cotados: fornecedores.length,
        })
      }

      // 4. Mescla aprovações com dados da requisição + cotação
      return aprData
        .map(a => {
          const req = reqMap.get(a.entidade_id)
          if (!req) return null // Ignora aprovações sem requisição válida
          return {
            ...a,
            requisicao_id: a.entidade_id,
            requisicao: req,
            cotacao_resumo: cotMap.get(a.entidade_id) ?? undefined,
          } as AprovacaoPendente
        })
        .filter((a): a is AprovacaoPendente => a !== null)
    },
    refetchInterval: 15_000,
    refetchOnMount: 'always',
    retry: 1,
    staleTime: 10_000,
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
  categoria?: string       // para resolver comprador automaticamente
  currentStatus?: string   // para decisão contextual (técnica vs financeira)
}

export function useDecisaoRequisicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: DecisaoPayload) => {
      const {
        requisicaoId, decisao, observacao,
        requisicaoNumero, alcadaNivel, aprovadorNome, aprovadorEmail,
        categoria, currentStatus,
      } = payload

      // 1. Update cmp_requisicoes status
      const updates: Record<string, unknown> = {}
      const isFinancialApproval = currentStatus === 'cotacao_enviada'

      if (decisao === 'aprovada') {
        updates.data_aprovacao = new Date().toISOString()

        if (isFinancialApproval) {
          // Aprovação financeira pós-cotação → cotacao_aprovada
          updates.status = 'cotacao_aprovada'
        } else {
          // Aprovação técnica → em_cotacao (auto-cria cotação)
          updates.status = 'em_cotacao'
        }
      } else if (decisao === 'rejeitada') {
        updates.status = isFinancialApproval ? 'cotacao_rejeitada' : 'rejeitada'
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

      // 2b. Marca aprovações pendentes anteriores como resolvidas (para limpar do AprovAi)
      await supabase
        .from(TABLE_APR)
        .update({ status: aprStatus, data_decisao: new Date().toISOString() })
        .eq('entidade_id', requisicaoId)
        .eq('modulo', 'cmp')
        .eq('status', 'pendente')

      // 3. Auto-criar cotação quando aprovação técnica é concedida
      if (decisao === 'aprovada' && !isFinancialApproval) {
        try {
          // Resolve comprador pela categoria
          let compradorId: string | null = null
          if (categoria) {
            const { data: compradores } = await supabase
              .from('cmp_compradores')
              .select('id, categorias')
            const match = compradores?.find(
              (c: { id: string; categorias: string[] }) =>
                c.categorias?.includes(categoria)
            )
            compradorId = match?.id ?? null
          }

          // Data limite: 5 dias úteis
          const dataLimite = new Date()
          dataLimite.setDate(dataLimite.getDate() + 5)

          await supabase.from('cmp_cotacoes').insert({
            requisicao_id: requisicaoId,
            comprador_id: compradorId,
            status: 'pendente',
            data_limite: dataLimite.toISOString(),
          })
        } catch (e) {
          console.warn('Aviso: cotação não criada automaticamente:', e)
        }
      }

      return { decisao }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['requisicao'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['cotacoes'] })
      qc.invalidateQueries({ queryKey: ['cotacao'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
