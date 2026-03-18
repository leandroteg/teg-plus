import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  ContaPagar, ContaReceber, Fornecedor,
  FinanceiroDashboardData, FinanceiroKPIs,
} from '../types/financeiro'

const EMPTY_KPIS: FinanceiroKPIs = {
  total_cp: 0, cp_a_vencer: 0, cp_vencidas: 0, cp_pagas_periodo: 0,
  valor_total_aberto: 0, valor_pago_periodo: 0, valor_a_vencer_7d: 0,
  aguardando_aprovacao: 0, total_cr: 0, valor_cr_aberto: 0,
}

function getSupabaseErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const message = 'message' in error ? (error as { message?: unknown }).message : null
    if (typeof message === 'string' && message.trim()) return message
    const hint = 'hint' in error ? (error as { hint?: unknown }).hint : null
    if (typeof hint === 'string' && hint.trim()) return hint
    const details = 'details' in error ? (error as { details?: unknown }).details : null
    if (typeof details === 'string' && details.trim()) return details
  }
  return fallback
}

function appendExtraRequestDetailsToObservacoes(
  observacoesBase: string,
  dadosBancarios?: {
    favorecido?: string
    banco_nome?: string
    agencia?: string
    conta?: string
    pix_tipo?: string
    pix_chave?: string
  },
  anexos?: Array<{ nome: string; url: string }>,
) {
  const detalhes: string[] = [observacoesBase]
  const banco = [
    dadosBancarios?.favorecido && `Favorecido: ${dadosBancarios.favorecido}`,
    dadosBancarios?.banco_nome && `Banco: ${dadosBancarios.banco_nome}`,
    dadosBancarios?.agencia && `Agencia: ${dadosBancarios.agencia}`,
    dadosBancarios?.conta && `Conta: ${dadosBancarios.conta}`,
    dadosBancarios?.pix_tipo && `PIX Tipo: ${dadosBancarios.pix_tipo}`,
    dadosBancarios?.pix_chave && `PIX Chave: ${dadosBancarios.pix_chave}`,
  ].filter(Boolean)

  if (banco.length > 0) detalhes.push(`Dados bancarios: ${banco.join(' | ')}`)
  if ((anexos?.length ?? 0) > 0) detalhes.push(`Anexos: ${anexos!.map(a => `${a.nome} (${a.url})`).join(' | ')}`)
  return detalhes.join('\n')
}

// â”€â”€ Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useFinanceiroDashboard(periodo = '30d') {
  return useQuery<FinanceiroDashboardData>({
    queryKey: ['financeiro-dashboard', periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_financeiro', {
        p_periodo: periodo,
      })
      if (error) {
        // Fallback: tabela pode não existir ainda
        return { kpis: EMPTY_KPIS, por_status: [], por_centro_custo: [], vencimentos_proximos: [], recentes: [] }
      }
      return data as FinanceiroDashboardData
    },
    refetchInterval: 30_000,
  })
}

// â”€â”€ Contas a Pagar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SELECT_CP = `
  *,
  pedido:cmp_pedidos!pedido_id(numero_pedido, status, data_pedido, data_prevista_entrega, status_pagamento),
  requisicao:cmp_requisicoes!requisicao_id(numero, descricao, justificativa, obra_nome, categoria, centro_custo, classe_financeira, projeto_id)
`

export function useContasPagar(filters?: { status?: string; centro_custo?: string }) {
  return useQuery<ContaPagar[]>({
    queryKey: ['contas-pagar', filters],
    queryFn: async () => {
      let q = supabase
        .from('fin_contas_pagar')
        .select(SELECT_CP)
        .order('data_vencimento', { ascending: true })
      if (filters?.status) q = q.eq('status', filters.status)
      if (filters?.centro_custo) q = q.eq('centro_custo', filters.centro_custo)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ContaPagar[]
    },
    retry: false,
  })
}

// â”€â”€ Contas a Receber â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useContasReceber() {
  return useQuery<ContaReceber[]>({
    queryKey: ['contas-receber'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_contas_receber')
        .select('*')
        .order('data_vencimento', { ascending: true })
      if (error) throw error
      return (data ?? []) as ContaReceber[]
    },
    retry: false,
  })
}

// â”€â”€ Fornecedores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useFornecedores() {
  return useQuery<Fornecedor[]>({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cmp_fornecedores')
        .select('*')
        .order('razao_social')
      if (error) return []
      return (data ?? []) as Fornecedor[]
    },
  })
}

// â”€â”€ Fornecedor por ID (Issue #36: dados bancarios/PIX) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useFornecedorById(fornecedorId?: string | null) {
  return useQuery<Fornecedor | null>({
    queryKey: ['fornecedor', fornecedorId],
    queryFn: async () => {
      if (!fornecedorId) return null
      const { data, error } = await supabase
        .from('cmp_fornecedores')
        .select('*')
        .eq('id', fornecedorId)
        .single()
      if (error) return null
      return data as Fornecedor
    },
    enabled: !!fornecedorId,
    staleTime: 300_000,
  })
}

// â”€â”€ Confirmar CP: previsto â†’ confirmado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useConfirmarCP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cpIds }: { cpIds: string[] }) => {
      const { error } = await supabase
        .from('fin_contas_pagar')
        .update({ status: 'confirmado' })
        .in('id', cpIds)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}

export function useCancelarCPBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cpIds }: { cpIds: string[] }) => {
      const { error } = await supabase
        .from('fin_contas_pagar')
        .update({ status: 'cancelado' })
        .in('id', cpIds)
        .eq('status', 'previsto')
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}

export function useCriarSolicitacaoExtraordinariaCP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      descricao,
      justificativa,
      centro_custo,
      classe_financeira,
      valor,
      solicitanteNome,
      dadosBancarios,
      arquivos,
    }: {
      descricao: string
      justificativa: string
      centro_custo: string
      classe_financeira: string
      valor: number
      solicitanteNome?: string
      dadosBancarios?: {
        favorecido?: string
        banco_nome?: string
        agencia?: string
        conta?: string
        pix_tipo?: string
        pix_chave?: string
      }
      arquivos?: File[]
    }) => {
      const hoje = new Date().toISOString().split('T')[0]
      const numeroDocumento = `EXT-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`
      const uploadedArquivos: Array<{ nome: string; url: string }> = []
      const uploadFalhas: string[] = []
      const observacoesBase = `Solicita\u00e7\u00e3o extraordin\u00e1ria urgente. Justificativa: ${justificativa.trim()}${solicitanteNome ? ` | Solicitante: ${solicitanteNome}` : ''}`

      const { data, error } = await supabase
        .from('fin_contas_pagar')
        .insert({
          fornecedor_nome: 'Pagamento Extraordin\u00e1rio',
          origem: 'manual',
          valor_original: valor,
          valor_pago: 0,
          data_emissao: hoje,
          data_vencimento: hoje,
          data_vencimento_orig: hoje,
          centro_custo,
          classe_financeira,
          natureza: 'extraordinario',
          numero_documento: numeroDocumento,
          status: 'confirmado',
          descricao: descricao.trim(),
          observacoes: observacoesBase,
        })
        .select('id')
        .single()
      if (error) throw new Error(getSupabaseErrorMessage(error, 'Erro ao criar solicita\u00e7\u00e3o extraordin\u00e1ria'))

      for (const arquivo of arquivos ?? []) {
        const ext = arquivo.name.split('.').pop()?.toLowerCase() || 'bin'
        const path = `financeiro/extraordinarios/${numeroDocumento}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const uploadResult = await supabase.storage.from('tesouraria-extratos').upload(path, arquivo)
        if (uploadResult.error) {
          uploadFalhas.push(`${arquivo.name}: ${getSupabaseErrorMessage(uploadResult.error, 'falha no upload')}`)
          continue
        }
        const { data: urlData } = supabase.storage.from('tesouraria-extratos').getPublicUrl(path)
        uploadedArquivos.push({ nome: arquivo.name, url: urlData.publicUrl })
      }

      if (dadosBancarios || uploadedArquivos.length > 0 || uploadFalhas.length > 0) {
        const observacoesComplementares = appendExtraRequestDetailsToObservacoes(
          observacoesBase,
          dadosBancarios,
          uploadedArquivos,
        )

        const { error: updateError } = await supabase
          .from('fin_contas_pagar')
          .update({ observacoes: observacoesComplementares })
          .eq('id', data.id)

        if (updateError) {
          throw new Error(getSupabaseErrorMessage(updateError, 'Solicita\u00e7\u00e3o criada, mas n\u00e3o foi poss\u00edvel salvar os detalhes complementares'))
        }
      }

      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}

// â”€â”€ Aprovar Pagamento (AP): aguardando_aprovacao â†’ aprovado_pgto â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Autorização de Pagamento: o financeiro aprova a CP para pagamento efetivo.

export function useCriarPrevisaoPagamentoCP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      nome,
      valor,
      centro_custo,
      classe_financeira,
      recorrente,
      periodicidade,
      recorrenciaFim,
      dataVencimento,
      solicitanteNome,
    }: {
      nome: string
      valor: number
      centro_custo: string
      classe_financeira: string
      recorrente: boolean
      periodicidade?: string
      recorrenciaFim?: string
      dataVencimento: string
      solicitanteNome?: string
    }) => {
      const observacoes = [
        'Previsão de pagamento registrada manualmente.',
        solicitanteNome ? `Solicitante: ${solicitanteNome}` : null,
        recorrente ? `Recorrência: ${periodicidade || 'mensal'} até ${recorrenciaFim || dataVencimento}` : null,
      ].filter(Boolean).join(' | ')

      const { data, error } = await supabase
        .from('fin_contas_pagar')
        .insert({
          fornecedor_nome: nome.trim(),
          origem: 'manual',
          valor_original: valor,
          valor_pago: 0,
          data_emissao: new Date().toISOString().split('T')[0],
          data_vencimento: dataVencimento,
          data_vencimento_orig: dataVencimento,
          centro_custo,
          classe_financeira,
          natureza: 'previsao_pagamento',
          status: 'previsto',
          descricao: nome.trim(),
          observacoes,
        })
        .select('id')
        .single()
      if (error) throw new Error(getSupabaseErrorMessage(error, 'Erro ao criar previsão de pagamento'))
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}

export function useAprovarPagamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cpId, aprovadorNome }: { cpId: string; aprovadorNome?: string }) => {
      const nome = aprovadorNome ?? 'Financeiro'

      // 1. Update CP status
      const { error } = await supabase
        .from('fin_contas_pagar')
        .update({
          status: 'aprovado_pgto',
          aprovado_por: nome,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', cpId)
      if (error) throw error

      // 2. Resolve any pending apr_aprovacoes for this CP
      await supabase
        .from('apr_aprovacoes')
        .update({
          status: 'aprovada',
          data_decisao: new Date().toISOString(),
        })
        .eq('entidade_id', cpId)
        .eq('tipo_aprovacao', 'autorizacao_pagamento')
        .eq('status', 'pendente')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-kpis'] })
    },
  })
}

// â”€â”€ Marcar CP como Pago â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Atualiza diretamente fin_contas_pagar quando não há pedido vinculado,
// ou quando o financeiro quer forçar status independente do fluxo de compras.

export function useMarcarCPPago() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cpId, dataPagamento }: { cpId: string; dataPagamento?: string }) => {
      const { error } = await supabase
        .from('fin_contas_pagar')
        .update({
          status: 'pago',
          data_pagamento: dataPagamento ?? new Date().toISOString().split('T')[0],
        })
        .eq('id', cpId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contas-pagar'] }),
  })
}

// â”€â”€ Classificação em lote (CP) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useClassificarCPBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ids,
      centro_custo,
      classe_financeira,
      projeto_id,
    }: {
      ids: string[]
      centro_custo?: string
      classe_financeira?: string
      projeto_id?: string
    }) => {
      const updates: Record<string, string | undefined> = {}
      if (centro_custo !== undefined) updates.centro_custo = centro_custo
      if (classe_financeira !== undefined) updates.classe_financeira = classe_financeira
      if (projeto_id !== undefined) updates.projeto_id = projeto_id
      if (Object.keys(updates).length === 0) return

      const { error } = await supabase
        .from('fin_contas_pagar')
        .update(updates)
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}

// â”€â”€ Conciliar em lote (CP) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useConciliarCPBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids }: { ids: string[] }) => {
      const { error } = await supabase
        .from('fin_contas_pagar')
        .update({ status: 'conciliado' })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}

// â”€â”€ Classificação em lote (CR) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useClassificarCRBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ids,
      centro_custo,
      classe_financeira,
      projeto_id,
    }: {
      ids: string[]
      centro_custo?: string
      classe_financeira?: string
      projeto_id?: string
    }) => {
      const updates: Record<string, string | undefined> = {}
      if (centro_custo !== undefined) updates.centro_custo = centro_custo
      if (classe_financeira !== undefined) updates.classe_financeira = classe_financeira
      if (projeto_id !== undefined) updates.projeto_id = projeto_id
      if (Object.keys(updates).length === 0) return

      const { error } = await supabase
        .from('fin_contas_receber')
        .update(updates)
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-receber'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}

// â”€â”€ Conciliar em lote (CR) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useConciliarCRBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids }: { ids: string[] }) => {
      const { error } = await supabase
        .from('fin_contas_receber')
        .update({ status: 'conciliado' })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-receber'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}

// â”€â”€ Autorizar CR: previsto â†’ autorizado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useAutorizarCR() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ crId, autorizadorNome }: { crId: string; autorizadorNome?: string }) => {
      const { error } = await supabase
        .from('fin_contas_receber')
        .update({
          status: 'autorizado',
          autorizado_por: autorizadorNome ?? 'Financeiro',
          autorizado_em: new Date().toISOString(),
        })
        .eq('id', crId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-receber'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}

// â”€â”€ Faturar CR: autorizado â†’ nf_emitida (com upload DANFE/XML) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useFaturarCR() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      crId, numero_nf, serie_nf, chave_nfe, data_emissao,
      danfeFile, xmlFile,
    }: {
      crId: string
      numero_nf: string
      serie_nf?: string
      chave_nfe?: string
      data_emissao?: string
      danfeFile?: File
      xmlFile?: File
    }) => {
      let danfe_url: string | undefined
      let xml_url: string | undefined

      if (danfeFile) {
        const ext = danfeFile.name.split('.').pop() || 'pdf'
        const path = `cr/${crId}/danfe-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('notas-fiscais').upload(path, danfeFile, { upsert: false, contentType: danfeFile.type })
        if (upErr) throw new Error('Falha no upload DANFE: ' + upErr.message)
        const { data: { publicUrl } } = supabase.storage.from('notas-fiscais').getPublicUrl(path)
        danfe_url = publicUrl
      }

      if (xmlFile) {
        const path = `cr/${crId}/xml-${Date.now()}.xml`
        const { error: upErr } = await supabase.storage
          .from('notas-fiscais').upload(path, xmlFile, { upsert: false, contentType: 'text/xml' })
        if (upErr) throw new Error('Falha no upload XML: ' + upErr.message)
        const { data: { publicUrl } } = supabase.storage.from('notas-fiscais').getPublicUrl(path)
        xml_url = publicUrl
      }

      const updates: Record<string, unknown> = {
        status: 'nf_emitida',
        numero_nf,
        data_emissao: data_emissao ?? new Date().toISOString().split('T')[0],
      }
      if (serie_nf) updates.serie_nf = serie_nf
      if (chave_nfe) updates.chave_nfe = chave_nfe
      if (danfe_url) updates.danfe_url = danfe_url
      if (xml_url) updates.xml_url = xml_url

      const { error } = await supabase
        .from('fin_contas_receber').update(updates).eq('id', crId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-receber'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}

// â”€â”€ Avançar status CR (transições simples) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useAvancarStatusCR() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ crId, novoStatus }: { crId: string; novoStatus: string }) => {
      const { error } = await supabase
        .from('fin_contas_receber')
        .update({ status: novoStatus, updated_at: new Date().toISOString() })
        .eq('id', crId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-receber'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}

// â”€â”€ Registrar Recebimento CR: aguardando â†’ recebido â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useRegistrarRecebimentoCR() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ crId, valorRecebido, dataRecebimento }: {
      crId: string; valorRecebido: number; dataRecebimento?: string
    }) => {
      const { error } = await supabase
        .from('fin_contas_receber')
        .update({
          status: 'recebido',
          valor_recebido: valorRecebido,
          data_recebimento: dataRecebimento ?? new Date().toISOString().split('T')[0],
        })
        .eq('id', crId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-receber'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}

// â”€â”€ Compartilhar NF por Email (marca envio, não muda status) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useCompartilharNFEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ crId, email }: { crId: string; email: string }) => {
      const { error } = await supabase
        .from('fin_contas_receber')
        .update({
          email_compartilhado_em: new Date().toISOString(),
          email_compartilhado_para: email,
        })
        .eq('id', crId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-receber'] })
    },
  })
}

// â”€â”€ Valores distintos para autocomplete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useDistinctCentroCusto() {
  return useQuery<string[]>({
    queryKey: ['distinct-centro-custo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_centros_custo')
        .select('nome')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return (data ?? []).map(r => r.nome).filter(Boolean)
    },
    staleTime: 60_000,
  })
}

export function useDistinctClasseFinanceira() {
  return useQuery<string[]>({
    queryKey: ['distinct-classe-financeira'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_classes_financeiras')
        .select('nome')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return (data ?? []).map(r => r.nome).filter(Boolean)
    },
    staleTime: 60_000,
  })
}

export function useObras() {
  return useQuery<{ id: string; nome: string; codigo: string }[]>({
    queryKey: ['obras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_obras')
        .select('id, nome, codigo')
        .order('nome')
      if (error) return []
      return data ?? []
    },
    staleTime: 300_000,
  })
}
