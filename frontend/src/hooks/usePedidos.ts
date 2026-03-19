import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Pedido } from '../types'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'
import { gerarPreviaParcelas } from '../utils/pagamentos'

export function usePedidos(status?: string) {
  return useQuery<Pedido[]>({
    queryKey: ['pedidos', status],
    queryFn: async () => {
      let query = supabase
        .from('cmp_pedidos')
        .select(`
          id, requisicao_id, cotacao_id, comprador_id,
          numero_pedido, fornecedor_nome, valor_total, status,
          data_pedido, data_prevista_entrega, data_entrega_real,
          nf_numero, observacoes, created_at,
          status_pagamento, liberado_pagamento_em, liberado_pagamento_por, pago_em,
          centro_custo, centro_custo_id, classe_financeira, classe_financeira_id,
          condicao_pagamento, parcelas_preview,
          requisicao:cmp_requisicoes(numero, descricao, justificativa, obra_nome, categoria, urgencia, data_necessidade, itens:cmp_requisicao_itens(descricao, quantidade, unidade, valor_unitario_estimado)),
          comprador:cmp_compradores(nome)
        `)
        .order('data_prevista_entrega', { ascending: true })
        .limit(100)

      if (status) query = query.eq('status', status)

      const { data, error } = await query
      if (error) throw error

      return ((data ?? []) as any[]).map((pedido) => ({
        ...pedido,
        comprador: pedido.comprador ? { nome: pedido.comprador.nome } : undefined,
      })) as Pedido[]
    },
    refetchInterval: 60_000,
    retry: false,
    staleTime: 30_000,
  })
}

export function useAtualizarPedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, data_entrega_real }: {
      id: string
      status: string
      data_entrega_real?: string
    }) => {
      const { error } = await supabase
        .from('cmp_pedidos')
        .update({ status, ...(data_entrega_real ? { data_entrega_real } : {}) })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
    },
  })
}

export function useLiberarPagamento() {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  return useMutation({
    mutationFn: async (pedidoId: string) => {
      const { error } = await supabase
        .from('cmp_pedidos')
        .update({
          status_pagamento: 'liberado',
          liberado_pagamento_em: new Date().toISOString(),
          liberado_pagamento_por: perfil?.nome ?? 'Comprador',
        })
        .eq('id', pedidoId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidos'] }),
  })
}

export function useRegistrarPagamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (pedidoId: string) => {
      const { error } = await supabase
        .from('cmp_pedidos')
        .update({ status_pagamento: 'pago', pago_em: new Date().toISOString() })
        .eq('id', pedidoId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidos'] }),
  })
}

export interface EmitirPedidoPayload {
  requisicaoId: string
  cotacaoId: string
  fornecedorNome: string
  valorTotal: number
  compradorId?: string
  condicaoPagamento?: string
  observacoes?: string
  dataPrevistaEntrega?: string
  classeFinanceiraId?: string
  classeFinanceira?: string
  centroCustoId?: string
  centroCusto?: string
  parcelasPreview?: Array<{
    numero: number
    valor: number
    data_vencimento: string
    descricao?: string
    tipo?: 'adiantamento' | 'parcela'
    status_inicial?: 'confirmado' | 'previsto'
  }>
}

type ParcelaPedido = {
  numero: number
  valor: number
  data_vencimento: string
  descricao?: string
  tipo?: 'adiantamento' | 'parcela'
  status_inicial?: 'confirmado' | 'previsto'
}

function extractHomogeneousClass(req: any) {
  const values = Array.from(new Set(
    (req?.itens ?? [])
      .map((item: any) => item.classe_financeira_codigo?.trim())
      .filter((value: string | undefined): value is string => Boolean(value)),
  ))

  if (values.length !== 1) {
    return {
      classeFinanceira: req?.classe_financeira ?? null,
      classeFinanceiraId: req?.classe_financeira_id ?? null,
    }
  }

  const item = (req?.itens ?? []).find((entry: any) => entry.classe_financeira_codigo === values[0])
  return {
    classeFinanceira: values[0],
    classeFinanceiraId: item?.classe_financeira_id ?? req?.classe_financeira_id ?? null,
  }
}

function buildDescricaoParcela(descricaoBase: string | null | undefined, parcela: ParcelaPedido, totalParcelas: number) {
  const base = descricaoBase?.trim() || 'Pedido de compra'
  if (parcela.tipo === 'adiantamento') return `${base} - Adiantamento`
  if (totalParcelas <= 1) return base
  return `${base} - ${parcela.descricao?.trim() || `Parcela ${parcela.numero}/${totalParcelas}`}`
}

export function useEmitirPedido() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: EmitirPedidoPayload) => {
      let {
        requisicaoId,
        cotacaoId,
        fornecedorNome,
        valorTotal,
        compradorId,
        condicaoPagamento,
        observacoes,
        dataPrevistaEntrega,
        classeFinanceira,
        classeFinanceiraId,
        centroCusto,
        centroCustoId,
        parcelasPreview,
      } = payload

      if (!cotacaoId) {
        const { data: cot } = await supabase
          .from('cmp_cotacoes')
          .select('id, comprador_id, fornecedor_selecionado_nome, valor_selecionado')
          .eq('requisicao_id', requisicaoId)
          .eq('status', 'concluida')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!cot) throw new Error('Cotacao concluida nao encontrada para esta requisicao.')

        cotacaoId = cot.id
        if (!compradorId) compradorId = cot.comprador_id ?? undefined
        if (cot.fornecedor_selecionado_nome && fornecedorNome === 'N/A') {
          fornecedorNome = cot.fornecedor_selecionado_nome
        }
        if (cot.valor_selecionado && cot.valor_selecionado > 0) {
          valorTotal = cot.valor_selecionado
        }
      }

      const { data: requisicao, error: reqLoadError } = await supabase
        .from('cmp_requisicoes')
        .select(`
          id, descricao, obra_nome,
          classe_financeira, classe_financeira_id,
          centro_custo, centro_custo_id,
          projeto_id,
          itens:cmp_requisicao_itens(classe_financeira_id, classe_financeira_codigo)
        `)
        .eq('id', requisicaoId)
        .single()

      if (reqLoadError) throw new Error(reqLoadError.message)

      const homog = extractHomogeneousClass(requisicao)
      classeFinanceira = classeFinanceira || homog.classeFinanceira || requisicao.classe_financeira || undefined
      classeFinanceiraId = classeFinanceiraId || homog.classeFinanceiraId || requisicao.classe_financeira_id || undefined
      centroCusto = centroCusto || requisicao.centro_custo || undefined
      centroCustoId = centroCustoId || requisicao.centro_custo_id || undefined

      const now = new Date()
      const prefix = `PO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`

      const { data: lastPedido, error: seqError } = await supabase
        .from('cmp_pedidos')
        .select('numero_pedido')
        .like('numero_pedido', `${prefix}%`)
        .order('numero_pedido', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (seqError) {
        throw new Error(`Erro ao gerar numero do pedido: ${seqError.message}`)
      }

      let nextSeq = 1
      if (lastPedido?.numero_pedido) {
        const parts = lastPedido.numero_pedido.split('-')
        const lastNum = parseInt(parts[parts.length - 1], 10)
        if (!Number.isNaN(lastNum)) nextSeq = lastNum + 1
      }
      const numeroPedido = `${prefix}-${String(nextSeq).padStart(4, '0')}`

      const parcelasResolvidas = parcelasPreview && parcelasPreview.length > 0
        ? parcelasPreview
        : gerarPreviaParcelas(valorTotal, condicaoPagamento || '', dataPrevistaEntrega || now.toISOString().split('T')[0])

      const { data: pedido, error: pedError } = await supabase
        .from('cmp_pedidos')
        .insert({
          requisicao_id: requisicaoId,
          cotacao_id: cotacaoId,
          comprador_id: compradorId || null,
          numero_pedido: numeroPedido,
          fornecedor_nome: fornecedorNome,
          valor_total: valorTotal,
          status: 'emitido',
          data_pedido: now.toISOString().split('T')[0],
          data_prevista_entrega: dataPrevistaEntrega || null,
          condicao_pagamento: condicaoPagamento || null,
          observacoes: observacoes || null,
          classe_financeira: classeFinanceira || null,
          classe_financeira_id: classeFinanceiraId || null,
          centro_custo: centroCusto || null,
          centro_custo_id: centroCustoId || null,
          parcelas_preview: parcelasResolvidas,
        })
        .select('id, numero_pedido')
        .single()

      if (pedError) {
        throw new Error(pedError.message || 'Falha ao criar pedido no banco de dados')
      }

      const { error: reqError } = await supabase
        .from('cmp_requisicoes')
        .update({
          status: 'pedido_emitido',
          classe_financeira: classeFinanceira || null,
          classe_financeira_id: classeFinanceiraId || null,
          centro_custo: centroCusto || null,
          centro_custo_id: centroCustoId || null,
        })
        .eq('id', requisicaoId)

      if (reqError) {
        console.warn('Aviso: requisicao nao atualizada:', reqError.message)
      }

      const { data: existingCPs, error: existingCPsError } = await supabase
        .from('fin_contas_pagar')
        .select('id, status')
        .eq('pedido_id', pedido.id)
        .order('created_at', { ascending: true })

      if (existingCPsError) {
        throw new Error(`Erro ao localizar contas a pagar do pedido: ${existingCPsError.message}`)
      }

      const parcelasDoPedido = parcelasResolvidas.length > 0
        ? parcelasResolvidas
        : [{
            numero: 1,
            valor: valorTotal,
            data_vencimento: dataPrevistaEntrega || now.toISOString().split('T')[0],
            descricao: condicaoPagamento || undefined,
          }]

      const parcelasSanitizadas = parcelasDoPedido.map((parcela, index) => ({
        numero: parcela.numero || index + 1,
        valor: Math.round(Number(parcela.valor || 0) * 100) / 100,
        data_vencimento: parcela.data_vencimento,
        descricao: parcela.descricao,
        tipo: parcela.tipo || 'parcela',
        status_inicial: parcela.status_inicial || 'previsto',
      }))

      const cpPayloads = parcelasSanitizadas.map((parcela) => ({
        pedido_id: pedido.id,
        requisicao_id: requisicaoId,
        fornecedor_nome: fornecedorNome,
        valor_original: parcela.valor,
        valor_pago: 0,
        data_emissao: now.toISOString().split('T')[0],
        data_vencimento: parcela.data_vencimento,
        data_vencimento_orig: parcela.data_vencimento,
        status: parcela.status_inicial === 'confirmado' ? 'confirmado' : 'previsto',
        centro_custo: centroCusto || null,
        classe_financeira: classeFinanceira || null,
        projeto_id: requisicao.projeto_id || null,
        descricao: buildDescricaoParcela(requisicao.descricao, parcela, parcelasSanitizadas.length),
        natureza: 'material',
        observacoes: condicaoPagamento ? `Condição: ${condicaoPagamento}` : null,
      }))

      const existingIds = (existingCPs ?? []).map((cp: any) => cp.id)
      const idsToUpdate = existingIds.slice(0, cpPayloads.length)
      const payloadsToInsert = cpPayloads.slice(idsToUpdate.length)
      const idsToDelete = existingIds.slice(cpPayloads.length)

      for (let index = 0; index < idsToUpdate.length; index += 1) {
        const { error: updateCPError } = await supabase
          .from('fin_contas_pagar')
          .update(cpPayloads[index])
          .eq('id', idsToUpdate[index])
        if (updateCPError) {
          throw new Error(`Erro ao atualizar parcelas do contas a pagar: ${updateCPError.message}`)
        }
      }

      if (payloadsToInsert.length > 0) {
        const { error: insertCPError } = await supabase
          .from('fin_contas_pagar')
          .insert(payloadsToInsert)
        if (insertCPError) {
          throw new Error(`Erro ao criar parcelas do contas a pagar: ${insertCPError.message}`)
        }
      }

      if (idsToDelete.length > 0) {
        const { error: deleteCPError } = await supabase
          .from('fin_contas_pagar')
          .delete()
          .in('id', idsToDelete)
        if (deleteCPError) {
          throw new Error(`Erro ao limpar parcelas antigas do contas a pagar: ${deleteCPError.message}`)
        }
      }

      return pedido
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['requisicao'] })
      qc.invalidateQueries({ queryKey: ['cotacoes'] })
      qc.invalidateQueries({ queryKey: ['cotacao'] })
      qc.invalidateQueries({ queryKey: ['cotacao-req'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useCancelarRequisicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (requisicaoId: string) => {
      const { error } = await supabase
        .from('cmp_requisicoes')
        .update({ status: 'cancelada' })
        .eq('id', requisicaoId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['requisicao'] })
      qc.invalidateQueries({ queryKey: ['cotacoes'] })
      qc.invalidateQueries({ queryKey: ['cotacao'] })
      qc.invalidateQueries({ queryKey: ['cotacao-req'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
