import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Cotacao, NovaCotacaoPayload, ItemPreco } from '../types'
import { supabase } from '../services/supabase'
import { api } from '../services/api'
import { calcularRecomendacao } from '../utils/cotacaoRecomendacao'

// Tabelas: cmp_cotacoes, cmp_cotacao_fornecedores (módulo Compras)
const TABLE_COT  = 'cmp_cotacoes'
const TABLE_FORN = 'cmp_cotacao_fornecedores'

const SELECT_COTACAO = `
  id, requisicao_id, comprador_id, status,
  fornecedor_selecionado_id, valor_selecionado, fornecedor_selecionado_nome,
  observacao, data_limite, data_conclusao, created_at,
  requisicao:cmp_requisicoes(
    id, numero, solicitante_nome, obra_nome, descricao, justificativa,
    valor_estimado, urgencia, status, alcada_nivel, categoria, created_at,
    compra_recorrente,
    itens:cmp_requisicao_itens(id, descricao, quantidade, unidade, valor_unitario_estimado)
  ),
  comprador:cmp_compradores(nome, email)
`

const SELECT_COTACAO_FULL = `
  ${SELECT_COTACAO},
  fornecedores:cmp_cotacao_fornecedores!cotacao_id(*)
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
    refetchInterval: 60_000,
    retry: false,
    staleTime: 30_000,
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
    retry: false,
  })
}

export function useSubmeterCotacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: NovaCotacaoPayload & {
      sem_cotacoes_minimas?: boolean
      justificativa_sem_cotacoes?: string
    }) => api.submeterCotacao(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotacoes'] })
      qc.invalidateQueries({ queryKey: ['cotacao'] })
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useAlertaCotacao(requisicaoId: string | undefined) {
  return useQuery<{ sem_cotacoes_minimas: boolean; justificativa: string | null }>({
    queryKey: ['alerta-cotacao', requisicaoId],
    enabled: !!requisicaoId,
    queryFn: async () => {
      const { data } = await supabase
        .rpc('get_alerta_cotacao', { p_requisicao_id: requisicaoId! })
      return data ?? { sem_cotacoes_minimas: false, justificativa: null }
    },
    staleTime: 30_000,
  })
}

// ── Busca cotação pelo requisicao_id (para exibir no detalhe da RC) ──────────

export function useCotacaoByRequisicao(requisicaoId?: string) {
  return useQuery<Cotacao | null>({
    queryKey: ['cotacao-req', requisicaoId],
    enabled: !!requisicaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE_COT)
        .select(SELECT_COTACAO_FULL)
        .eq('requisicao_id', requisicaoId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      const cot = data as Record<string, unknown>
      const comprador = cot.comprador as Record<string, string> | null
      return { ...cot, comprador_nome: comprador?.nome ?? '' } as Cotacao
    },
    staleTime: 15_000,
  })
}

// ── Finalizar cotação: salva fornecedores + cria aprovação financeira ─────────

export interface FinalizarCotacaoPayload {
  cotacao_id: string
  requisicao_id: string
  fornecedores: {
    fornecedor_nome: string
    fornecedor_contato?: string
    fornecedor_cnpj?: string
    valor_total: number
    prazo_entrega_dias?: number
    condicao_pagamento?: string
    observacao?: string
    arquivo_url?: string
    itens_precos?: ItemPreco[]
  }[]
  sem_cotacoes_minimas?: boolean
  justificativa_sem_cotacoes?: string
}

export function useFinalizarCotacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: FinalizarCotacaoPayload) => {
      const { cotacao_id, requisicao_id, fornecedores } = payload

      // 1. Insere fornecedores no Supabase
      const fornecedoresInsert = fornecedores.map(f => ({
        cotacao_id,
        fornecedor_nome: f.fornecedor_nome,
        fornecedor_contato: f.fornecedor_contato || null,
        fornecedor_cnpj: f.fornecedor_cnpj || null,
        valor_total: f.valor_total,
        prazo_entrega_dias: f.prazo_entrega_dias || null,
        condicao_pagamento: f.condicao_pagamento || null,
        itens_precos: f.itens_precos ?? [],
        observacao: f.observacao || null,
        arquivo_url: f.arquivo_url || null,
        selecionado: false,
      }))

      const { data: fornInserted, error: fornError } = await supabase
        .from(TABLE_FORN)
        .insert(fornecedoresInsert)
        .select('id, fornecedor_nome, valor_total')

      if (fornError) throw new Error(fornError.message)

      // 2. Determina vencedor (menor preço)
      const vencedor = (fornInserted ?? []).reduce(
        (best, f) => (!best || f.valor_total < best.valor_total ? f : best),
        null as { id: string; fornecedor_nome: string; valor_total: number } | null
      )

      // Marca vencedor como selecionado
      if (vencedor) {
        await supabase
          .from(TABLE_FORN)
          .update({ selecionado: true })
          .eq('id', vencedor.id)
      }

      // 3. Atualiza cotação → concluída
      const { error: cotError } = await supabase
        .from(TABLE_COT)
        .update({
          status: 'concluida',
          fornecedor_selecionado_id: vencedor?.id ?? null,
          fornecedor_selecionado_nome: vencedor?.fornecedor_nome ?? null,
          valor_selecionado: vencedor?.valor_total ?? null,
          data_conclusao: new Date().toISOString(),
          sem_cotacoes_minimas: payload.sem_cotacoes_minimas ?? false,
          justificativa_sem_cotacoes: payload.justificativa_sem_cotacoes ?? null,
        })
        .eq('id', cotacao_id)

      if (cotError) throw new Error(cotError.message)

      // 4. Atualiza RC → cotacao_enviada (aguardando aprovação financeira)
      const { error: reqError } = await supabase
        .from('cmp_requisicoes')
        .update({ status: 'cotacao_enviada' })
        .eq('id', requisicao_id)

      if (reqError) console.warn('Aviso: RC não atualizada:', reqError.message)

      // 5. Busca dados da RC para criar aprovação financeira
      const { data: rcData } = await supabase
        .from('cmp_requisicoes')
        .select('numero, alcada_nivel, valor_estimado')
        .eq('id', requisicao_id)
        .single()

      // 6. Cria aprovação financeira pendente em apr_aprovacoes
      if (rcData) {
        const aprovadorNome = (rcData.valor_estimado ?? 0) > 2000 ? 'Laucídio' : 'Welton'

        // Monta texto de recomendação multi-critério
        const fornParaScore = (fornInserted ?? []).map(fi => {
          const orig = fornecedores.find(f => f.fornecedor_nome === fi.fornecedor_nome)
          return {
            id: fi.id,
            cotacao_id: cotacao_id,
            fornecedor_nome: fi.fornecedor_nome,
            valor_total: fi.valor_total,
            prazo_entrega_dias: orig?.prazo_entrega_dias || undefined,
            condicao_pagamento: orig?.condicao_pagamento || undefined,
            itens_precos: [] as any[],
            selecionado: false,
          }
        })
        const rec = calcularRecomendacao(fornParaScore)
        const obsText = rec
          ? `Aprovacao financeira — ${rec.resumo}`
          : `Aprovacao financeira — menor cotacao: ${vencedor?.fornecedor_nome ?? 'N/A'} (${
              vencedor ? vencedor.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A'
            })`

        const { error: aprError } = await supabase
          .from('apr_aprovacoes')
          .insert({
            modulo: 'cmp',
            tipo_aprovacao: 'cotacao',
            entidade_id: requisicao_id,
            entidade_numero: rcData.numero,
            aprovador_nome: aprovadorNome,
            aprovador_email: '',
            nivel: rcData.alcada_nivel ?? 1,
            status: 'pendente',
            observacao: obsText,
          })
        if (aprError) console.warn('Aviso: aprovação financeira não criada:', aprError.message)
      }

      // 7. Tenta enviar para n8n (notificação, non-critical)
      try {
        await api.submeterCotacao({
          cotacao_id,
          fornecedores: fornecedores.map(f => ({ ...f, itens_precos: [], arquivo_url: f.arquivo_url ?? null })),
        })
      } catch {
        // n8n indisponível, tudo já está salvo no Supabase
      }

      return { cotacao_id, vencedor }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotacoes'] })
      qc.invalidateQueries({ queryKey: ['cotacao'] })
      qc.invalidateQueries({ queryKey: ['cotacao-req'] })
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['requisicao'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
