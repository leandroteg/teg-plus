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
          id, requisicao_id, cotacao_id, comprador_id, fornecedor_id,
          numero_pedido, fornecedor_nome, valor_total, status,
          data_pedido, data_prevista_entrega, data_entrega_real, data_vencimento,
          nf_numero, observacoes, created_at, updated_at, criado_por_nome, atualizado_por_nome,
          status_pagamento, liberado_pagamento_em, liberado_pagamento_por, pago_em,
          centro_custo, centro_custo_id, classe_financeira, classe_financeira_id,
          condicao_pagamento, parcelas_preview, sem_cotacao, justificativa_sem_cotacao, itens_direto,
          requisicao:cmp_requisicoes(numero, descricao, justificativa, obra_nome, obra_id, categoria, urgencia, data_necessidade, compra_recorrente, solicitante_nome, arquivo_url, base_destino_id, base_destino:est_bases!base_destino_id(nome), itens:cmp_requisicao_itens(descricao, descricao_complementar, quantidade, unidade, valor_unitario_estimado, natureza)),
          comprador:cmp_compradores(nome),
          cotacao:cmp_cotacoes!cotacao_id(concluido_por_nome)
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

export interface ImpostoItemPayload {
  descricao:        string
  valor_item:       number
  imposto_tipo:     string | null
  imposto_aliquota: number | null
  imposto_valor:    number
  deduzir:          boolean
}

export interface ImpostoPayload {
  itens:       ImpostoItemPayload[]
  valor_total: number
  deduzir:     boolean   // true se ao menos 1 item deduz
}

export function useLiberarPagamento() {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  return useMutation({
    mutationFn: async ({ pedidoId, imposto }: { pedidoId: string; imposto?: ImpostoPayload | null }) => {
      // Trava: so libera pagamento apos recebimento confirmado E com nota fiscal
      const { data: ped, error: pedErr } = await supabase
        .from('cmp_pedidos')
        .select('status, nf_numero')
        .eq('id', pedidoId)
        .single()
      if (pedErr) throw pedErr
      if (!ped || !['entregue', 'parcialmente_recebido'].includes(ped.status)) {
        throw new Error('So e possivel liberar pagamento apos a confirmacao do recebimento pelo destino/CD.')
      }
      // NF/Boleto nao sao mais obrigatorios para liberar. Pendencia visualizada via badge "NF pendente" no card.

      const { error } = await supabase
        .from('cmp_pedidos')
        .update({
          status_pagamento: 'liberado',
          liberado_pagamento_em: new Date().toISOString(),
          liberado_pagamento_por: perfil?.nome ?? 'Comprador',
        })
        .eq('id', pedidoId)
      if (error) throw error

      // Propaga imposto para a CP vinculada ao pedido, se houver
      if (imposto && imposto.valor_total > 0 && imposto.itens.length > 0) {
        await supabase
          .from('fin_contas_pagar')
          .update({
            impostos_itens:  imposto.itens,
            imposto_valor:   imposto.valor_total,
            imposto_deduzir: imposto.deduzir,
            updated_at:      new Date().toISOString(),
          })
          .eq('pedido_id', pedidoId)
          .neq('status', 'pago')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
    },
  })
}

export interface EmitirPedidoPayload {
  requisicaoId: string
  cotacaoId: string
  fornecedorId?: string
  fornecedorNome: string
  valorTotal: number
  compradorId?: string
  condicaoPagamento?: string
  formaPagamento?: 'pix' | 'cartao' | 'boleto' | 'transferencia'
  cartaoId?: string
  cartaoNome?: string
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

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function buildDescricaoParcela(
  descricaoBase: string | null | undefined,
  parcela: ParcelaPedido,
  totalParcelas: number,
  ctx?: { numeroPedido?: string; valorTotalPedido?: number },
) {
  const base = descricaoBase?.trim() || 'Pedido de compra'
  const ref = ctx?.numeroPedido ? `Pedido ${ctx.numeroPedido}` : null
  const valorTotal = ctx?.valorTotalPedido && ctx.valorTotalPedido > 0
    ? ` de ${fmtBRL(ctx.valorTotalPedido)}`
    : ''
  const valorParcela = fmtBRL(Number(parcela.valor || 0))

  if (parcela.tipo === 'adiantamento') {
    const head = ref ? `${ref} — Adiantamento` : `${base} - Adiantamento`
    return `${head} (${valorParcela}${valorTotal})`
  }

  if (totalParcelas <= 1) {
    return ref ? `${ref} — ${base} (${valorParcela})` : base
  }

  const parcelaLabel = parcela.descricao?.trim() || `Parcela ${parcela.numero}/${totalParcelas}`
  const head = ref ? `${ref} — ${parcelaLabel}` : `${base} - ${parcelaLabel}`
  return `${head} (${valorParcela}${valorTotal})`
}

export function useEmitirPedido() {
  const qc = useQueryClient()
  const { perfil } = useAuth()

  return useMutation({
    mutationFn: async (payload: EmitirPedidoPayload) => {
      let {
        requisicaoId,
        cotacaoId,
        fornecedorId,
        fornecedorNome,
        valorTotal,
        compradorId,
        condicaoPagamento,
        formaPagamento,
        cartaoId,
        cartaoNome,
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
      const prefix = `PC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`

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
      const numeroPedido = `${prefix}-${String(nextSeq).padStart(5, '0')}`

      const parcelasResolvidas = parcelasPreview && parcelasPreview.length > 0
        ? parcelasPreview
        : gerarPreviaParcelas(valorTotal, condicaoPagamento || '', dataPrevistaEntrega || now.toISOString().split('T')[0])

      // Resolve comprador_id (FK -> cmp_compradores.id). Pode vir como
      // cmp_compradores.id (vindo da cotacao) ou perfil.id (vindo do front).
      // Valida antes de inserir pra nao quebrar o FK.
      let compradorIdResolvido: string | null = null
      if (compradorId) {
        const { data: byId } = await supabase
          .from('cmp_compradores')
          .select('id').eq('id', compradorId).maybeSingle()
        if (byId?.id) {
          compradorIdResolvido = byId.id as string
        } else if (perfil) {
          const { data: byUsuario } = await supabase
            .from('cmp_compradores')
            .select('id').eq('usuario_id', compradorId).maybeSingle()
          if (byUsuario?.id) compradorIdResolvido = byUsuario.id as string
          else if (perfil.email) {
            const { data: byEmail } = await supabase
              .from('cmp_compradores')
              .select('id').ilike('email', perfil.email).maybeSingle()
            if (byEmail?.id) compradorIdResolvido = byEmail.id as string
          }
        }
      }

      const { data: pedido, error: pedError } = await supabase
        .from('cmp_pedidos')
        .insert({
          requisicao_id: requisicaoId,
          cotacao_id: cotacaoId,
          comprador_id: compradorIdResolvido,
          fornecedor_id: fornecedorId || null,
          numero_pedido: numeroPedido,
          fornecedor_nome: fornecedorNome,
          valor_total: valorTotal,
          status: 'emitido',
          data_pedido: now.toISOString().split('T')[0],
          data_prevista_entrega: dataPrevistaEntrega || null,
          condicao_pagamento: condicaoPagamento || null,
          observacoes: [
            observacoes?.trim() || null,
            formaPagamento === 'cartao' && cartaoNome ? `Cartão selecionado: ${cartaoNome}` : null,
          ].filter(Boolean).join(' | ') || null,
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

      // Atendimento parcial: estampa em cada item da RC qual pedido o cobriu.
      // Match por descrição (cotação usa rcMatch — descrição canônica da RC).
      // Só carimba itens ainda sem atendimento; tolerante a múltiplas chamadas do hook (split).
      try {
        const { data: cotFor } = await supabase
          .from('cmp_cotacao_fornecedores')
          .select('itens_precos')
          .eq('cotacao_id', cotacaoId)
          .eq('fornecedor_nome', fornecedorNome)
          .eq('selecionado', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const descricoesCobertas = ((cotFor?.itens_precos ?? []) as Array<{ descricao?: string; selecionado?: boolean }>)
          .filter(ip => ip.selecionado && typeof ip.descricao === 'string' && ip.descricao.trim().length > 0)
          .map(ip => (ip.descricao as string).trim())

        if (descricoesCobertas.length > 0) {
          await supabase
            .from('cmp_requisicao_itens')
            .update({ atendido_em_pedido_id: pedido.id })
            .eq('requisicao_id', requisicaoId)
            .is('atendido_em_pedido_id', null)
            .in('descricao', descricoesCobertas)
        } else {
          // Fallback: cotação sem item selecionado explicito (caso legado de fornecedor único).
          // Estampa todos os itens da RC ainda não atendidos com este pedido.
          await supabase
            .from('cmp_requisicao_itens')
            .update({ atendido_em_pedido_id: pedido.id })
            .eq('requisicao_id', requisicaoId)
            .is('atendido_em_pedido_id', null)
        }
      } catch (stampErr) {
        console.warn('Aviso: falha ao estampar atendimento de itens da RC:', stampErr)
      }

      // RC só vai pra 'pedido_emitido' quando TODOS os itens forem cobertos.
      // Enquanto sobrar item sem atendimento, fica em 'em_cotacao' (badge "Parcialmente Atendida" no front).
      const { count: itensPendentes } = await supabase
        .from('cmp_requisicao_itens')
        .select('id', { count: 'exact', head: true })
        .eq('requisicao_id', requisicaoId)
        .is('atendido_em_pedido_id', null)

      const novoStatusRC: string = (itensPendentes ?? 0) === 0 ? 'pedido_emitido' : 'em_cotacao'

      const { error: reqError } = await supabase
        .from('cmp_requisicoes')
        .update({
          status: novoStatusRC,
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
        fornecedor_id: fornecedorId || null,
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
        descricao: buildDescricaoParcela(requisicao.descricao, parcela, parcelasSanitizadas.length, {
          numeroPedido: pedido.numero_pedido,
          valorTotalPedido: valorTotal,
        }),
        natureza: 'material',
        forma_pagamento: formaPagamento || null,
        cartao_id: formaPagamento === 'cartao' ? cartaoId || null : null,
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

export interface PedidoDiretoPayload {
  fornecedorNome: string
  fornecedorId?: string
  valorTotal: number
  itens: Array<{ descricao: string; quantidade: number; unidade: string; valor_unitario: number }>
  obraId?: string
  obraNome?: string
  centroCusto?: string
  centroCustoId?: string
  classeFinanceira?: string
  classeFinanceiraId?: string
  condicaoPagamento?: string
  dataPrevistaEntrega?: string
  justificativaSemCotacao: string
  observacoes?: string
  compradorId?: string
}

export function useEmitirPedidoDireto() {
  const qc = useQueryClient()
  const { perfil } = useAuth()

  return useMutation({
    mutationFn: async (payload: PedidoDiretoPayload) => {
      const now = new Date()
      const prefix = `PC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`

      // Resolve comprador_id (FK -> cmp_compradores.id). O front pode mandar
      // perfil.id (sys_perfis.id), que NAO existe em cmp_compradores e quebra
      // o FK. Tenta casar por usuario_id; senao por email; senao null.
      let compradorIdResolvido: string | null = null
      if (payload.compradorId && perfil) {
        const { data: cmpByUsuario } = await supabase
          .from('cmp_compradores')
          .select('id')
          .eq('usuario_id', payload.compradorId)
          .maybeSingle()
        if (cmpByUsuario?.id) {
          compradorIdResolvido = cmpByUsuario.id as string
        } else if (perfil.email) {
          const { data: cmpByEmail } = await supabase
            .from('cmp_compradores')
            .select('id')
            .ilike('email', perfil.email)
            .maybeSingle()
          if (cmpByEmail?.id) compradorIdResolvido = cmpByEmail.id as string
        }
      }

      const { data: lastPedido } = await supabase
        .from('cmp_pedidos')
        .select('numero_pedido')
        .like('numero_pedido', `${prefix}%`)
        .order('numero_pedido', { ascending: false })
        .limit(1)
        .maybeSingle()

      let nextSeq = 1
      if (lastPedido?.numero_pedido) {
        const parts = lastPedido.numero_pedido.split('-')
        const lastNum = parseInt(parts[parts.length - 1], 10)
        if (!Number.isNaN(lastNum)) nextSeq = lastNum + 1
      }
      const numeroPedido = `${prefix}-${String(nextSeq).padStart(5, '0')}`

      const parcelasResolvidas = gerarPreviaParcelas(
        payload.valorTotal,
        payload.condicaoPagamento || '',
        payload.dataPrevistaEntrega || now.toISOString().split('T')[0],
      )

      const { data: pedido, error } = await supabase
        .from('cmp_pedidos')
        .insert({
          numero_pedido: numeroPedido,
          fornecedor_nome: payload.fornecedorNome,
          fornecedor_id: payload.fornecedorId || null,
          valor_total: payload.valorTotal,
          status: 'emitido',
          data_pedido: now.toISOString().split('T')[0],
          data_prevista_entrega: payload.dataPrevistaEntrega || null,
          condicao_pagamento: payload.condicaoPagamento || null,
          centro_custo: payload.centroCusto || null,
          centro_custo_id: payload.centroCustoId || null,
          classe_financeira: payload.classeFinanceira || null,
          classe_financeira_id: payload.classeFinanceiraId || null,
          observacoes: payload.observacoes || null,
          comprador_id: compradorIdResolvido,
          parcelas_preview: parcelasResolvidas,
          sem_cotacao: true,
          justificativa_sem_cotacao: payload.justificativaSemCotacao,
          itens_direto: payload.itens.length > 0 ? payload.itens : null,
        })
        .select('id, numero_pedido')
        .single()

      if (error) throw new Error(error.message)

      return pedido
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
