import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { gerarNomeAmigavelAnexo } from '../utils/nomeAmigavelAnexo'
import type { ArquivoFinanceiro } from '../types/documentosFin'
import type {
  ContaPagar, ContaReceber, Fornecedor, DadosPagamento,
  FinanceiroDashboardData, FinanceiroKPIs,
} from '../types/financeiro'
import { STATUS_CP_FORA_DO_FINANCEIRO } from '../types/financeiro'

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

/**
 * Normaliza os dados para pagamento antes de gravar em dados_pagamento (mig 215):
 * campo vazio não vira string vazia no JSONB. Sem nenhum campo preenchido,
 * grava `{}` — é assim que as telas sabem que não há dado informado.
 */
export function normalizarDadosPagamento(dados?: DadosPagamento | null): DadosPagamento {
  if (!dados) return {}
  const limpo: DadosPagamento = {}
  for (const campo of ['favorecido', 'favorecido_documento', 'banco_nome', 'agencia', 'conta', 'pix_tipo', 'pix_chave'] as const) {
    const valor = dados[campo]?.trim()
    if (valor) limpo[campo] = valor
  }
  // PF/PJ é enum: qualquer outro valor entraria no JSONB como lixo
  if (dados.favorecido_tipo === 'pf' || dados.favorecido_tipo === 'pj') {
    limpo.favorecido_tipo = dados.favorecido_tipo
  }
  return limpo
}

function appendExtraRequestDetailsToObservacoes(
  observacoesBase: string,
  dadosBancarios?: DadosPagamento,
  anexos?: Array<{ nome: string; url: string }>,
) {
  const detalhes: string[] = [observacoesBase]
  const banco = [
    dadosBancarios?.favorecido && `Favorecido: ${dadosBancarios.favorecido}`,
    dadosBancarios?.favorecido_documento && `CPF/CNPJ: ${dadosBancarios.favorecido_documento}`,
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
// Recebe intervalo em 'YYYY-MM'. A RPC antiga (p_periodo text) só aplicava o
// período em 2 dos 11 blocos — trocar 7d/30d/90d quase não mexia na tela.
// A sobrecarga por data aplica o intervalo em todos.
export function useFinanceiroDashboard(de: string, ate: string) {
  return useQuery<FinanceiroDashboardData>({
    queryKey: ['financeiro-dashboard', de, ate],
    queryFn: async () => {
      const fim = new Date(Number(ate.slice(0, 4)), Number(ate.slice(5, 7)), 0)  // último dia do mês
      const { data, error } = await supabase.rpc('get_dashboard_financeiro', {
        p_de: `${de}-01`,
        p_ate: `${ate}-${String(fim.getDate()).padStart(2, '0')}`,
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
  imposto_tipo, imposto_aliquota, imposto_valor, imposto_deduzir,
  pedido:cmp_pedidos!pedido_id(numero_pedido, status, data_pedido, data_prevista_entrega, status_pagamento, observacoes),
  requisicao:cmp_requisicoes!requisicao_id(numero, descricao, justificativa, obra_nome, categoria, centro_custo, classe_financeira, projeto_id, arquivo_url, itens:cmp_requisicao_itens(descricao, quantidade, unidade, valor_unitario_estimado))
`

export function useContasPagar(filters?: { status?: string; centro_custo?: string }) {
  return useQuery<ContaPagar[]>({
    queryKey: ['contas-pagar', filters],
    queryFn: async () => {
      // PostgREST capa em 1000 — paginar no cliente
      const PAGE = 1000
      const all: ContaPagar[] = []
      for (let from = 0; from < 50_000; from += PAGE) {
        let q = supabase
          .from('fin_contas_pagar')
          .select(SELECT_CP)
          .order('data_vencimento', { ascending: true })
          .range(from, from + PAGE - 1)
        if (filters?.status) q = q.eq('status', filters.status)
        // Extraordinário em conferência no Compras ainda não é do Financeiro (mig 212)
        else q = q.not('status', 'in', `(${STATUS_CP_FORA_DO_FINANCEIRO.join(',')})`)
        if (filters?.centro_custo) q = q.eq('centro_custo', filters.centro_custo)
        const { data, error } = await q
        if (error) throw error
        const batch = (data ?? []) as ContaPagar[]
        all.push(...batch)
        if (batch.length < PAGE) break
      }
      return all
    },
    retry: false,
  })
}

// â”€â”€ Contas a Receber â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useContasReceber() {
  return useQuery<ContaReceber[]>({
    queryKey: ['contas-receber'],
    queryFn: async () => {
      // PostgREST capa em 1000 — paginar no cliente
      const PAGE = 1000
      const all: ContaReceber[] = []
      for (let from = 0; from < 50_000; from += PAGE) {
        const { data, error } = await supabase
          .from('fin_contas_receber')
          .select('*, osc:osc_id(numero_os), obra:projeto_id(nome, codigo)')
          .order('data_vencimento', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error) throw error
        const batch = (data ?? []) as ContaReceber[]
        all.push(...batch)
        if (batch.length < PAGE) break
      }
      return all
    },
    retry: false,
  })
}

// â”€â”€ Fornecedores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useFornecedores() {
  return useQuery<Fornecedor[]>({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      // PostgREST capa em 1000 — paginar no cliente
      const PAGE = 1000
      const all: Fornecedor[] = []
      for (let from = 0; from < 50_000; from += PAGE) {
        const { data, error } = await supabase
          .from('cmp_fornecedores')
          .select('*')
          .order('razao_social')
          .range(from, from + PAGE - 1)
        if (error) return all
        const batch = (data ?? []) as Fornecedor[]
        all.push(...batch)
        if (batch.length < PAGE) break
      }
      return all
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

async function findFornecedorByName(fornecedorNome?: string | null) {
  const nome = fornecedorNome?.trim()
  if (!nome) return null

  const exactColumns: Array<'razao_social' | 'nome_fantasia'> = ['razao_social', 'nome_fantasia']
  for (const column of exactColumns) {
    const { data, error } = await supabase
      .from('cmp_fornecedores')
      .select('*')
      .eq(column, nome)
      .limit(1)

    if (!error && data?.length) return data[0] as Fornecedor
  }

  for (const column of exactColumns) {
    const { data, error } = await supabase
      .from('cmp_fornecedores')
      .select('*')
      .ilike(column, nome)
      .limit(1)

    if (!error && data?.length) return data[0] as Fornecedor
  }

  for (const column of exactColumns) {
    const { data, error } = await supabase
      .from('cmp_fornecedores')
      .select('*')
      .ilike(column, `%${nome}%`)
      .limit(1)

    if (!error && data?.length) return data[0] as Fornecedor
  }

  return null
}

export function useFornecedorByReference({
  fornecedorId,
  fornecedorNome,
}: {
  fornecedorId?: string | null
  fornecedorNome?: string | null
}) {
  return useQuery<Fornecedor | null>({
    queryKey: ['fornecedor-ref', fornecedorId ?? null, fornecedorNome ?? null],
    queryFn: async () => {
      if (fornecedorId) {
        const { data, error } = await supabase
          .from('cmp_fornecedores')
          .select('*')
          .eq('id', fornecedorId)
          .single()

        if (!error && data) return data as Fornecedor
      }

      return findFornecedorByName(fornecedorNome)
    },
    enabled: !!fornecedorId || !!fornecedorNome?.trim(),
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
      desconto,
      jurosMulta,
      empresaId,
      dataVencimento,
      solicitanteNome,
      fornecedorId,
      fornecedorNome,
      fornecedorCnpj,
      dadosBancarios,
      arquivos,
    }: {
      descricao: string
      justificativa: string
      centro_custo: string
      classe_financeira: string
      valor: number
      desconto?: number
      jurosMulta?: number
      empresaId?: string
      dataVencimento?: string
      solicitanteNome?: string
      fornecedorId?: string
      fornecedorNome?: string
      fornecedorCnpj?: string
      dadosBancarios?: DadosPagamento
      /** File puro = compat com chamadas antigas (entra como 'outro') */
      arquivos?: Array<File | ArquivoFinanceiro>
    }) => {
      const hoje = new Date().toISOString().split('T')[0]
      const vencimento = dataVencimento?.trim() || hoje
      const numeroDocumento = `EXT-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`
      const uploadedArquivos: Array<{ nome: string; url: string }> = []
      const uploadFalhas: string[] = []
      const observacoesBase = `Solicita\u00e7\u00e3o extraordin\u00e1ria urgente. Justificativa: ${justificativa.trim()}${solicitanteNome ? ` | Solicitante: ${solicitanteNome}` : ''}${fornecedorNome ? ` | Fornecedor: ${fornecedorNome}` : ''}${fornecedorCnpj ? ` | CNPJ: ${fornecedorCnpj}` : ''}`

      const { data, error } = await supabase
        .from('fin_contas_pagar')
        .insert({
          fornecedor_id: fornecedorId || null,
          fornecedor_nome: fornecedorNome?.trim() || 'Pagamento Extraordin\u00e1rio',
          origem: 'manual',
          valor_original: valor,
          valor_pago: 0,
          data_emissao: hoje,
          data_vencimento: vencimento,
          data_vencimento_orig: vencimento,
          centro_custo,
          classe_financeira,
          natureza: 'extraordinario',
          numero_documento: numeroDocumento,
          status: 'confirmado',
          descricao: descricao.trim(),
          observacoes: observacoesBase,
          empresa_id: empresaId || null,
          // mig 215: estruturado. O espelho em observacoes continua abaixo só
          // para quem lê a CP como texto (aprovação, e-mail, remessa).
          dados_pagamento: normalizarDadosPagamento(dadosBancarios),
          ...(desconto ? { valor_desconto: desconto } : {}),
          ...(jurosMulta ? { valor_juros_multa: jurosMulta } : {}),
        })
        .select('id')
        .single()
      if (error) throw new Error(getSupabaseErrorMessage(error, 'Erro ao criar solicita\u00e7\u00e3o extraordin\u00e1ria'))

      for (const item of arquivos ?? []) {
        // Compat: chamadas antigas mandavam File puro (sem tipo) — vira 'outro'.
        const arquivo = item instanceof File ? item : item.file
        const tipoDoc = item instanceof File ? 'outro' : item.tipo
        const ext = arquivo.name.split('.').pop()?.toLowerCase() || 'bin'
        // bucket financeiro-docs (mig 207) — antes apontava p/ 'tesouraria-extratos',
        // que nunca existiu: todo anexo falhava em silêncio.
        const path = `extraordinarios/${numeroDocumento}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const uploadResult = await supabase.storage.from('financeiro-docs').upload(path, arquivo, {
          contentType: arquivo.type || undefined,
        })
        if (uploadResult.error) {
          uploadFalhas.push(`${arquivo.name}: ${getSupabaseErrorMessage(uploadResult.error, 'falha no upload')}`)
          continue
        }
        const { data: urlData } = supabase.storage.from('financeiro-docs').getPublicUrl(path)

        // NF/boleto ganham nome legível, mesma regra dos anexos de Pedido
        let nomeExibicao = arquivo.name
        try {
          nomeExibicao = await gerarNomeAmigavelAnexo(arquivo, tipoDoc, fornecedorNome)
        } catch { /* mantém o nome original */ }
        uploadedArquivos.push({ nome: nomeExibicao, url: urlData.publicUrl })

        // Registra também em fin_documentos — é de lá que o AprovAí e demais
        // telas listam os anexos da CP (o texto em observacoes é só um espelho).
        const { error: docErr } = await supabase.from('fin_documentos').insert({
          entity_type: 'cp',
          entity_id: data.id,
          tipo: tipoDoc,
          nome_arquivo: nomeExibicao,
          arquivo_url: urlData.publicUrl,
          mime_type: arquivo.type || null,
          tamanho_bytes: arquivo.size || null,
        })
        if (docErr) uploadFalhas.push(`${arquivo.name}: ${docErr.message}`)
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

/** Documentos anexados a uma CP (fin_documentos) — NF, boleto, outros. */
export interface DocumentoCP {
  id: string
  tipo: string
  nome_arquivo: string
  arquivo_url: string
  uploaded_at: string
}

export function useDocumentosCP(cpId?: string) {
  return useQuery<DocumentoCP[]>({
    queryKey: ['fin-documentos', cpId],
    enabled: !!cpId,
    queryFn: async () => {
      // RPC (mig 216): traz também os anexos do adiantamento que gerou a CP —
      // a RLS de desp_adiantamentos esconde a linha de quem trabalha no
      // Financeiro, então o vínculo não pode ser resolvido no cliente.
      const { data, error } = await supabase.rpc('fin_documentos_cp', { p_cp_id: cpId })
      if (!error) return (data ?? []) as DocumentoCP[]

      const fallback = await supabase
        .from('fin_documentos')
        .select('id, tipo, nome_arquivo, arquivo_url, uploaded_at')
        .eq('entity_type', 'cp')
        .eq('entity_id', cpId!)
        .order('uploaded_at', { ascending: false })
      if (fallback.error) return []
      return (fallback.data ?? []) as DocumentoCP[]
    },
    staleTime: 60_000,
  })
}

/**
 * Anexa documentos a uma CP que já existe, em qualquer etapa.
 * Cobre o buraco de quem só descobre o documento faltando depois — títulos
 * criados antes do fix do bucket (o extraordinário subia p/ 'tesouraria-extratos',
 * que nunca existiu) ficavam sem anexo e sem nenhum caminho de UI pra corrigir.
 */
export function useAnexarDocumentosCP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cpId,
      arquivos,
      fornecedorNome,
    }: {
      cpId: string
      arquivos: ArquivoFinanceiro[]
      fornecedorNome?: string
    }) => {
      const falhas: string[] = []
      for (const item of arquivos) {
        const arquivo = item.file
        const ext = arquivo.name.split('.').pop()?.toLowerCase() || 'bin'
        const path = `cp/${cpId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const up = await supabase.storage.from('financeiro-docs').upload(path, arquivo, {
          contentType: arquivo.type || undefined,
        })
        if (up.error) {
          falhas.push(`${arquivo.name}: ${getSupabaseErrorMessage(up.error, 'falha no upload')}`)
          continue
        }
        const { data: urlData } = supabase.storage.from('financeiro-docs').getPublicUrl(path)

        let nomeExibicao = arquivo.name
        try {
          nomeExibicao = await gerarNomeAmigavelAnexo(arquivo, item.tipo, fornecedorNome)
        } catch { /* mantém o nome original */ }

        const { error: docErr } = await supabase.from('fin_documentos').insert({
          entity_type: 'cp',
          entity_id: cpId,
          tipo: item.tipo,
          nome_arquivo: nomeExibicao,
          arquivo_url: urlData.publicUrl,
          mime_type: arquivo.type || null,
          tamanho_bytes: arquivo.size || null,
        })
        if (docErr) falhas.push(`${arquivo.name}: ${docErr.message}`)
      }
      if (falhas.length > 0) throw new Error(`Falha ao anexar: ${falhas.join(' | ')}`)
      return arquivos.length
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fin-documentos'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
    },
  })
}

// ══ Adiantamento a fornecedor × título da nota (mig 218) ═══════════════════

export interface AdiantamentoDisponivel {
  cp_id: string
  numero_pedido?: string | null
  descricao?: string | null
  data_emissao?: string | null
  status: string
  valor: number
  ja_abatido: number
  saldo: number
}

export interface AbatimentoCP {
  id: string
  /** 'destino' = adiantamento que abate ESTE título · 'origem' = este adiantamento cobriu outro título */
  papel: 'destino' | 'origem'
  outra_cp_id: string
  outra_descricao?: string | null
  outro_pedido?: string | null
  valor: number
  criado_por_nome?: string | null
  created_at: string
}

/** Adiantamentos com saldo do mesmo fornecedor, para abater no título da nota. */
export function useAdiantamentosDisponiveis(args?: {
  fornecedorNome?: string | null
  empresaId?: string | null
  cpId?: string | null
  enabled?: boolean
}) {
  const { fornecedorNome, empresaId, cpId, enabled = true } = args ?? {}
  return useQuery<AdiantamentoDisponivel[]>({
    queryKey: ['fin-adiantamentos-disponiveis', fornecedorNome, empresaId, cpId],
    enabled: enabled && !!fornecedorNome,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fin_adiantamentos_disponiveis', {
        p_fornecedor_nome: fornecedorNome,
        p_empresa_id: empresaId ?? null,
        p_excluir_cp_id: cpId ?? null,
      })
      if (error) return []
      return (data ?? []) as AdiantamentoDisponivel[]
    },
    staleTime: 30_000,
  })
}

/** Vínculos já feitos, nos dois sentidos (o título que recebeu e o adiantamento que deu). */
export function useAbatimentosCP(cpId?: string) {
  return useQuery<AbatimentoCP[]>({
    queryKey: ['fin-abatimentos', cpId],
    enabled: !!cpId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fin_abatimentos_da_cp', { p_cp_id: cpId })
      if (error) return []
      return (data ?? []) as AbatimentoCP[]
    },
    staleTime: 30_000,
  })
}

function invalidarAbatimento(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['fin-abatimentos'] })
  qc.invalidateQueries({ queryKey: ['fin-adiantamentos-disponiveis'] })
  qc.invalidateQueries({ queryKey: ['contas-pagar'] })
}

export function useAbaterAdiantamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ adiantamentoCpId, destinoCpId, valor }: {
      adiantamentoCpId: string
      destinoCpId: string
      valor?: number
    }) => {
      const { data, error } = await supabase.rpc('fin_adiantamento_abater', {
        p_adiantamento_cp_id: adiantamentoCpId,
        p_destino_cp_id: destinoCpId,
        p_valor: valor ?? null,
      })
      if (error) throw new Error(error.message)
      const r = data as { ok: boolean; erro?: string; valor?: number; saldo_restante?: number }
      if (!r?.ok) throw new Error(r?.erro ?? 'Não foi possível abater o adiantamento.')
      return r
    },
    onSuccess: () => invalidarAbatimento(qc),
  })
}

export function useDesfazerAbatimento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (abatimentoId: string) => {
      const { data, error } = await supabase.rpc('fin_adiantamento_desfazer_abatimento', {
        p_abatimento_id: abatimentoId,
      })
      if (error) throw new Error(error.message)
      const r = data as { ok: boolean; erro?: string }
      if (!r?.ok) throw new Error(r?.erro ?? 'Não foi possível desfazer o abatimento.')
      return r
    },
    onSuccess: () => invalidarAbatimento(qc),
  })
}

/**
 * Remove um documento anexado por engano (NF do pedido errado, boleto trocado).
 * Apaga o registro e, em seguida, tenta apagar o arquivo do bucket — se o
 * storage recusar, o registro já saiu e o arquivo vira órfão inofensivo.
 */
export function useRemoverDocumentoFin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ docId, arquivoUrl }: { docId: string; arquivoUrl?: string | null }) => {
      // Via RPC (mig 217): a política de DELETE de fin_documentos exige
      // diretor/admin e o DELETE direto apagava 0 linhas SEM erro — supervisor
      // clicava e nada acontecia.
      const { data, error } = await supabase.rpc('fin_documento_remover', { p_doc_id: docId })
      if (error) throw new Error(`Não foi possível remover o documento: ${error.message}`)
      const r = data as { ok: boolean; erro?: string }
      if (!r?.ok) throw new Error(r?.erro ?? 'Não foi possível remover o documento.')

      // .../object/public/<bucket>/<path...>  →  bucket + path
      const m = arquivoUrl?.match(/\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/)
      if (m) {
        await supabase.storage.from(m[1]).remove([decodeURIComponent(m[2])])
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fin-documentos'] })
    },
  })
}

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
      desconto,
      jurosMulta,
      empresaId,
      imposto,
      arquivos,
      fornecedorId,
      fornecedorNome,
      dadosPagamento,
    }: {
      nome: string
      fornecedorId?: string
      fornecedorNome?: string
      /** Dados para pagamento do beneficiário (mig 215) */
      dadosPagamento?: DadosPagamento
      valor: number
      centro_custo: string
      classe_financeira: string
      recorrente: boolean
      periodicidade?: string
      recorrenciaFim?: string
      dataVencimento: string
      solicitanteNome?: string
      desconto?: number
      jurosMulta?: number
      empresaId?: string
      imposto?: { tipo: string; aliquota: number; valor: number; deduzir: boolean }
      arquivos?: ArquivoFinanceiro[]
    }) => {
      const observacoes = [
        'Previsão de pagamento registrada manualmente.',
        solicitanteNome ? `Solicitante: ${solicitanteNome}` : null,
        recorrente ? `Recorrência: ${periodicidade || 'mensal'} até ${recorrenciaFim || dataVencimento}` : null,
      ].filter(Boolean).join(' | ')

      const { data, error } = await supabase
        .from('fin_contas_pagar')
        .insert({
          fornecedor_id: fornecedorId || null,
          fornecedor_nome: (fornecedorNome || nome).trim(),
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
          empresa_id: empresaId || null,
          dados_pagamento: normalizarDadosPagamento(dadosPagamento),
          ...(desconto ? { valor_desconto: desconto } : {}),
          ...(jurosMulta ? { valor_juros_multa: jurosMulta } : {}),
          ...(imposto && imposto.valor > 0
            ? {
                imposto_tipo: imposto.tipo,
                imposto_aliquota: imposto.aliquota || null,
                imposto_valor: imposto.valor,
                imposto_deduzir: imposto.deduzir,
              }
            : {}),
        })
        .select('id')
        .single()
      if (error) throw new Error(getSupabaseErrorMessage(error, 'Erro ao criar previsão de pagamento'))

      // Anexos (NF/boleto/outros) → bucket financeiro-docs + fin_documentos.
      // NF e boleto ganham nome legível (mesma regra dos anexos de Pedido).
      const falhas: string[] = []
      for (const item of arquivos ?? []) {
        const arquivo = item.file
        const ext = arquivo.name.split('.').pop()?.toLowerCase() || 'bin'
        const path = `cp/${data.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const up = await supabase.storage.from('financeiro-docs').upload(path, arquivo, {
          contentType: arquivo.type || undefined,
        })
        if (up.error) {
          falhas.push(`${arquivo.name}: ${getSupabaseErrorMessage(up.error, 'falha no upload')}`)
          continue
        }
        const { data: urlData } = supabase.storage.from('financeiro-docs').getPublicUrl(path)

        let nomeExibicao = arquivo.name
        try {
          nomeExibicao = await gerarNomeAmigavelAnexo(arquivo, item.tipo, nome.trim())
        } catch { /* mantém o nome original */ }

        const { error: docErr } = await supabase.from('fin_documentos').insert({
          entity_type: 'cp',
          entity_id: data.id,
          tipo: item.tipo,
          nome_arquivo: nomeExibicao,
          arquivo_url: urlData.publicUrl,
          mime_type: arquivo.type || null,
          tamanho_bytes: arquivo.size || null,
        })
        if (docErr) falhas.push(`${arquivo.name}: ${docErr.message}`)
      }
      if (falhas.length > 0) {
        throw new Error(`Previsão criada, mas houve falha nos anexos: ${falhas.join(' | ')}`)
      }

      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
      qc.invalidateQueries({ queryKey: ['fin-documentos'] })
    },
  })
}

// ── Editar Previsão de Pagamento ────────────────────────────────────────────
// Só enquanto o título ainda é uma previsão (status 'previsto'): a partir de
// Confirmados ele entra na esteira de lote/aprovação e o caminho passa a ser o
// cancelamento com aprovação (mig 194). Permissão: sys_perfis.edita_previsao_fin.

export function useEditarPrevisaoPagamentoCP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cpId, nome, valor, centro_custo, classe_financeira, dataVencimento,
      desconto, jurosMulta, empresaId, imposto, arquivos, fornecedorId, fornecedorNome,
      dadosPagamento,
    }: {
      cpId: string
      nome: string
      fornecedorId?: string
      fornecedorNome?: string
      /** Dados para pagamento do beneficiário (mig 215) */
      dadosPagamento?: DadosPagamento
      valor: number
      centro_custo: string
      classe_financeira: string
      dataVencimento: string
      desconto?: number
      jurosMulta?: number
      empresaId?: string
      imposto?: { tipo: string; aliquota: number; valor: number; deduzir: boolean }
      arquivos?: ArquivoFinanceiro[]
    }) => {
      const { data: atual, error: readErr } = await supabase
        .from('fin_contas_pagar')
        .select('id, status, pedido_id, lote_id')
        .eq('id', cpId)
        .single()
      if (readErr) throw new Error(getSupabaseErrorMessage(readErr, 'Erro ao carregar o lançamento'))
      // Editável enquanto não entra na esteira de pagamento. Depois do lote, o
      // caminho é devolver p/ edição do lote ou o cancelamento com aprovação.
      if (!['previsto', 'confirmado'].includes(atual.status)) {
        throw new Error('Este lançamento já está em lote/pagamento e não pode ser editado. Use o cancelamento com aprovação.')
      }
      if (atual.lote_id) {
        throw new Error('Lançamento já vinculado a um lote — remova do lote antes de editar.')
      }

      // Título de pedido: valor e fornecedor pertencem ao pedido (itens, impostos,
      // recebimento). Mexer só aqui faria a CP divergir do pedido — nesse caso o
      // caminho é devolver para correção no Compras.
      const doPedido = Boolean(atual.pedido_id)

      const { error } = await supabase
        .from('fin_contas_pagar')
        .update({
          ...(doPedido ? {} : {
            fornecedor_id: fornecedorId || null,
            fornecedor_nome: (fornecedorNome || nome).trim(),
            valor_original: valor,
          }),
          data_vencimento: dataVencimento,
          centro_custo,
          classe_financeira,
          descricao: nome.trim(),
          valor_desconto: desconto ?? 0,
          valor_juros_multa: jurosMulta ?? 0,
          empresa_id: empresaId || null,
          dados_pagamento: normalizarDadosPagamento(dadosPagamento),
          imposto_tipo: imposto && imposto.valor > 0 ? imposto.tipo : null,
          imposto_aliquota: imposto && imposto.valor > 0 ? (imposto.aliquota || null) : null,
          imposto_valor: imposto && imposto.valor > 0 ? imposto.valor : null,
          imposto_deduzir: imposto && imposto.valor > 0 ? imposto.deduzir : false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cpId)
        .in('status', ['previsto', 'confirmado'])
      if (error) throw new Error(getSupabaseErrorMessage(error, 'Erro ao salvar o lançamento'))

      // Anexos novos são acrescentados (os já existentes continuam)
      const falhas: string[] = []
      for (const item of arquivos ?? []) {
        const arquivo = item.file
        const ext = arquivo.name.split('.').pop()?.toLowerCase() || 'bin'
        const path = `cp/${cpId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const up = await supabase.storage.from('financeiro-docs').upload(path, arquivo, {
          contentType: arquivo.type || undefined,
        })
        if (up.error) {
          falhas.push(`${arquivo.name}: ${getSupabaseErrorMessage(up.error, 'falha no upload')}`)
          continue
        }
        const { data: urlData } = supabase.storage.from('financeiro-docs').getPublicUrl(path)
        let nomeExibicao = arquivo.name
        try {
          nomeExibicao = await gerarNomeAmigavelAnexo(arquivo, item.tipo, nome.trim())
        } catch { /* mantém o nome original */ }
        const { error: docErr } = await supabase.from('fin_documentos').insert({
          entity_type: 'cp',
          entity_id: cpId,
          tipo: item.tipo,
          nome_arquivo: nomeExibicao,
          arquivo_url: urlData.publicUrl,
          mime_type: arquivo.type || null,
          tamanho_bytes: arquivo.size || null,
        })
        if (docErr) falhas.push(`${arquivo.name}: ${docErr.message}`)
      }
      if (falhas.length > 0) {
        throw new Error(`Alterações salvas, mas houve falha nos anexos: ${falhas.join(' | ')}`)
      }

      return { id: cpId }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
      qc.invalidateQueries({ queryKey: ['fin-documentos'] })
    },
  })
}

// ── Devolver título para correção (aviso de inconsistência) ─────────────────
// O título não muda de status nem é excluído: ganha a marca de pendência, que
// vira alerta na tela e notificação in-app para quem lançou (RPC mig 211).

export function useDevolverCPCorrecao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cpId, motivo }: { cpId: string; motivo: string }) => {
      const { data, error } = await supabase.rpc('fin_cp_devolver_correcao', {
        p_cp_id: cpId,
        p_motivo: motivo,
      })
      if (error) throw new Error(getSupabaseErrorMessage(error, 'Erro ao devolver o título'))
      return data as { ok: boolean; devolvido_para: string | null; notificado: boolean }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['cps-para-pagamento'] })
    },
  })
}

export function useResolverDevolucaoCP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cpId: string) => {
      const { error } = await supabase.rpc('fin_cp_resolver_devolucao', { p_cp_id: cpId })
      if (error) throw new Error(getSupabaseErrorMessage(error, 'Erro ao baixar a pendência'))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['cps-para-pagamento'] })
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
      // Sobrescreve aprovador_nome real (em vez do destinatario esperado).
      await supabase
        .from('apr_aprovacoes')
        .update({
          status: 'aprovada',
          data_decisao: new Date().toISOString(),
          aprovador_nome: nome,
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
    mutationFn: async ({ cpId, dataPagamento, valorOriginal, valorDesconto, valorJurosMulta }: {
      cpId: string
      dataPagamento?: string
      /** Quando informado junto com desconto/juros, grava valor_pago líquido (mig 203). */
      valorOriginal?: number
      valorDesconto?: number
      valorJurosMulta?: number
    }) => {
      const desconto = valorDesconto ?? 0
      const juros = valorJurosMulta ?? 0
      const { error } = await supabase
        .from('fin_contas_pagar')
        .update({
          status: 'pago',
          data_pagamento: dataPagamento ?? new Date().toISOString().split('T')[0],
          ...(desconto > 0 || juros > 0 ? {
            valor_desconto: desconto,
            valor_juros_multa: juros,
            ...(valorOriginal != null
              ? { valor_pago: Math.round((valorOriginal - desconto + juros) * 100) / 100 }
              : {}),
          } : {}),
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
      const { data: contas, error: loadError } = await supabase
        .from('fin_contas_pagar')
        .select('id, fornecedor_nome, pedido_id, centro_custo, classe_financeira')
        .in('id', ids)

      if (loadError) {
        throw new Error(getSupabaseErrorMessage(loadError, 'Erro ao validar contas antes da conciliação'))
      }

      const contasList = (contas ?? []) as Array<Pick<ContaPagar, 'id' | 'fornecedor_nome' | 'pedido_id' | 'centro_custo' | 'classe_financeira'>>
      // Validações de classificação e comprovante são feitas no modal (Conciliacao.tsx)
      // Aqui apenas logamos warnings para auditoria
      const semClassificacao = contasList.filter(cp => !cp.centro_custo || !cp.classe_financeira)
      if (semClassificacao.length > 0) {
        console.warn(`[Conciliar] ${semClassificacao.length} títulos sem CC ou classe financeira completos`)
      }

      const pedidoIds = Array.from(new Set(contasList.map(cp => cp.pedido_id).filter(Boolean))) as string[]

      const { error } = await supabase
        .from('fin_contas_pagar')
        .update({ status: 'conciliado' })
        .in('id', ids)
      if (error) throw new Error(getSupabaseErrorMessage(error, 'Erro ao conciliar contas a pagar'))

      if (pedidoIds.length > 0) {
        const agora = new Date().toISOString()
        const { error: pedidoError } = await supabase
          .from('cmp_pedidos')
          .update({
            status_pagamento: 'pago',
            pago_em: agora,
          })
          .in('id', pedidoIds)

        if (pedidoError) {
          throw new Error(getSupabaseErrorMessage(pedidoError, 'As contas foram conciliadas, mas não foi possível encerrar o pedido em Compras'))
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['tesouraria-dashboard'] })
      qc.invalidateQueries({ queryKey: ['movimentacoes-tesouraria'] })
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
      qc.invalidateQueries({ queryKey: ['tesouraria-dashboard'] })
      qc.invalidateQueries({ queryKey: ['movimentacoes-tesouraria'] })
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

// ── Bloqueio do recebimento (preenchido manual no modal) + histórico ─────────
export function useAtualizarBloqueioCR() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ crId, bloqueio }: { crId: string; bloqueio: string }) => {
      const { error } = await supabase
        .from('fin_contas_receber')
        .update({ bloqueio_tipo: bloqueio, updated_at: new Date().toISOString() })
        .eq('id', crId)
      if (error) throw error
      // linha do tempo: registra a alteração (pra medir tempo de solução)
      const { data: { user } } = await supabase.auth.getUser()
      const nome = (user?.user_metadata as { nome?: string })?.nome || user?.email || 'Financeiro'
      await supabase.from('fin_cr_bloqueio_hist').insert({ cr_id: crId, bloqueio_tipo: bloqueio, alterado_por_nome: nome })
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['contas-receber'] })
      qc.invalidateQueries({ queryKey: ['cr-bloqueio-hist', v.crId] })
    },
  })
}

export interface BloqueioHistRow { id: string; bloqueio_tipo: string; alterado_por_nome: string | null; created_at: string }
export function useBloqueioHist(crId?: string) {
  return useQuery<BloqueioHistRow[]>({
    queryKey: ['cr-bloqueio-hist', crId],
    enabled: !!crId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_cr_bloqueio_hist')
        .select('id, bloqueio_tipo, alterado_por_nome, created_at')
        .eq('cr_id', crId!).order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as BloqueioHistRow[]
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

// ── Conciliacao automatica via OFX (mig 130) ─────────────────────────────────

export interface SugestaoConciliacao {
  mov_id: string
  /** Vocabulário real da tabela; 'debito'/'credito' são legado. */
  mov_tipo: 'saida' | 'entrada' | 'debito' | 'credito'
  mov_valor: number
  mov_data: string
  mov_descricao: string | null
  mov_conta_id: string | null
  /** *_grupo = uma linha do extrato cobrindo vários títulos (SISPAG). */
  tipo_match: 'cp' | 'cr' | 'cp_grupo' | 'cr_grupo'
  cand_id: string
  /** Títulos cobertos. 1 item no match simples, N no de grupo. */
  cand_ids?: string[]
  cand_nome: string
  cand_descricao: string | null
  cand_valor: number
  cand_vencimento: string
  cand_status: string
  score: number
}

// Sugere matches entre extrato bancario e CPs/CRs em aberto.
// Filtros opcionais: conta, janela em dias (default 3), periodo.
export function useSugerirConciliacao() {
  return useMutation({
    mutationFn: async (opts?: {
      conta_id?: string
      dias_janela?: number
      periodo_inicio?: string
      periodo_fim?: string
    }) => {
      const { data, error } = await supabase.rpc('fn_sugerir_conciliacao_tesouraria', {
        p_conta_id: opts?.conta_id ?? null,
        p_dias_janela: opts?.dias_janela ?? 3,
        p_periodo_inicio: opts?.periodo_inicio ?? null,
        p_periodo_fim: opts?.periodo_fim ?? null,
      })
      if (error) throw error
      return data as { ok: boolean; count: number; sugestoes: SugestaoConciliacao[] }
    },
  })
}

// Busca candidatos do extrato bancario p/ um titulo (CP=saida ou CR=entrada).
// Filtra por: nao conciliado, valor exato, dentro de janela em torno da data de referencia.
export function useExtratoCandidatos(opts: {
  tipo: 'cp' | 'cr'
  valor: number
  dataRef: string  // YYYY-MM-DD
  janelaDias?: number
  enabled?: boolean
}) {
  const dias = opts.janelaDias ?? 30
  return useQuery({
    queryKey: ['extrato-candidatos', opts.tipo, opts.valor, opts.dataRef, dias],
    enabled: opts.enabled !== false && opts.valor > 0 && !!opts.dataRef,
    queryFn: async () => {
      const ref = new Date(opts.dataRef + 'T00:00:00')
      const ini = new Date(ref); ini.setDate(ini.getDate() - dias)
      const fim = new Date(ref); fim.setDate(fim.getDate() + dias)
      const iniIso = ini.toISOString().split('T')[0]
      const fimIso = fim.toISOString().split('T')[0]
      const tipoMov = opts.tipo === 'cp' ? 'saida' : 'entrada'

      const { data, error } = await supabase
        .from('fin_movimentacoes_tesouraria')
        .select('id, tipo, valor, data_movimentacao, descricao, conta_id, conta:fin_contas_bancarias(nome, cor)')
        .eq('conciliado', false)
        .eq('tipo', tipoMov)
        .gte('data_movimentacao', iniIso)
        .lte('data_movimentacao', fimIso)
        .gte('valor', opts.valor - 0.01)
        .lte('valor', opts.valor + 0.01)
        .order('data_movimentacao', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data ?? []).map((m: any) => ({
        ...m,
        conta_nome: m.conta?.nome,
        conta_cor: m.conta?.cor,
      }))
    },
  })
}

// Aplica matches aprovados pelo usuario em batch.
export function useAplicarConciliacaoAuto() {
  const qc = useQueryClient()
  return useMutation({
    // cand_ids e obrigatorio no match de grupo: sem ele a RPC cai no fallback
    // cand_id e conciliaria so um titulo dos N, dando a linha por resolvida.
    mutationFn: async (matches: Array<{
      mov_id: string
      tipo_match: 'cp' | 'cr' | 'cp_grupo' | 'cr_grupo'
      cand_id: string
      cand_ids?: string[]
    }>) => {
      const { data, error } = await supabase.rpc('fn_aplicar_conciliacao_tesouraria', {
        p_matches: matches as any,
      })
      if (error) throw error
      return data as { ok: boolean; aplicadas: number }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['contas-receber'] })
      qc.invalidateQueries({ queryKey: ['movimentacoes-tesouraria'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
      // A coluna do extrato na Tesouraria vem do dashboard, nao de
      // movimentacoes-tesouraria: sem esta linha o movimento conciliado
      // continuava na tela ate dar refresh.
      qc.invalidateQueries({ queryKey: ['tesouraria-dashboard'] })
    },
  })
}

// ── Lançar NF de Recebimento: cria a CR já em "NF Emitida" ───────────────────
// Atalho para a NF que já foi emitida fora do sistema (o caso da CEMIG hoje):
// em vez de criar Previsto → Autorizar → Faturar, entra direto no pipeline no
// ponto em que ela realmente está. A OSC traz obra, natureza e centro de custo.
export function useLancarNFRecebimento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      cliente_nome: string; cliente_cnpj?: string
      numero_nf: string; serie_nf?: string; chave_nfe?: string
      valor_original: number
      /** mig 213 — a receber = valor_original − desconto + juros/multa */
      valor_desconto?: number; valor_juros_multa?: number
      /** mig 214 — filial recebedora */
      empresa_id?: string | null
      data_emissao: string; data_vencimento: string
      osc_id?: string | null; projeto_id?: string | null
      natureza?: string | null; centro_custo?: string | null
      descricao?: string; observacoes?: string
      criado_por_nome?: string
      /** mig 215 — dados bancários do cliente pagador */
      dados_pagamento?: DadosPagamento
      danfeFile?: File
      /** NF/boleto/recibo/outros anexados no lançamento → fin_documentos (entity_type='cr') */
      anexos?: ArquivoFinanceiro[]
    }) => {
      const { danfeFile, dados_pagamento, anexos, ...campos } = v
      const { data, error } = await supabase.from('fin_contas_receber')
        .insert({
          ...campos,
          dados_pagamento: normalizarDadosPagamento(dados_pagamento),
          status: 'nf_emitida',
          bloqueio_tipo: 'sem_bloqueio',
        })
        .select('id').single()
      if (error) throw error
      const crId = (data as { id: string }).id

      // DANFE é opcional: se o upload falhar, a CR não é desfeita — o anexo
      // pode ser refeito depois pelo modal de detalhe.
      if (danfeFile) {
        const ext = danfeFile.name.split('.').pop() || 'pdf'
        const path = `cr/${crId}/danfe-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('notas-fiscais').upload(path, danfeFile, { upsert: false, contentType: danfeFile.type })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('notas-fiscais').getPublicUrl(path)
          await supabase.from('fin_contas_receber').update({ danfe_url: publicUrl }).eq('id', crId)
        }
      }

      // Demais documentos (recibo, boleto, outros) → financeiro-docs + fin_documentos.
      // Best-effort como a DANFE: falha aqui não desfaz a CR já criada.
      const falhasAnexo: string[] = []
      for (const item of anexos ?? []) {
        const ext = item.file.name.split('.').pop()?.toLowerCase() || 'bin'
        const path = `cr/${crId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const up = await supabase.storage.from('financeiro-docs').upload(path, item.file, {
          contentType: item.file.type || undefined,
        })
        if (up.error) { falhasAnexo.push(`${item.file.name}: ${up.error.message}`); continue }
        const { data: urlData } = supabase.storage.from('financeiro-docs').getPublicUrl(path)

        let nomeExibicao = item.file.name
        try {
          nomeExibicao = await gerarNomeAmigavelAnexo(item.file, item.tipo, v.cliente_nome)
        } catch { /* mantém o nome original */ }

        const { error: docErr } = await supabase.from('fin_documentos').insert({
          entity_type: 'cr',
          entity_id: crId,
          tipo: item.tipo,
          nome_arquivo: nomeExibicao,
          arquivo_url: urlData.publicUrl,
          mime_type: item.file.type || null,
          tamanho_bytes: item.file.size || null,
        })
        if (docErr) falhasAnexo.push(`${item.file.name}: ${docErr.message}`)
      }
      if (falhasAnexo.length > 0) {
        throw new Error(`NF lançada, mas houve falha nos anexos: ${falhasAnexo.join(' | ')}`)
      }

      return crId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-receber'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
      qc.invalidateQueries({ queryKey: ['fin-documentos'] })
    },
  })
}

/** OSCs para o seletor do lançamento de NF (traz obra, natureza e polo juntos) */
export function useOscsParaNF() {
  return useQuery<{ id: string; numero_os: string; tipo: string | null; obra_id: string | null; obra_nome: string | null; polo: string | null }[]>({
    queryKey: ['oscs-para-nf'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('pmo_fluxo_os')
        .select('id, numero_os, tipo, obra_id, obra:obra_id(nome, projeto:pmo_projeto_id(nome))')
        .order('numero_os', { ascending: false }).limit(1000)
      if (error) { console.error('useOscsParaNF:', error); return [] }
      type Row = { id: string; numero_os: string; tipo: string | null; obra_id: string | null
                   obra: { nome: string | null; projeto: { nome: string | null } | null } | null }
      return (data as unknown as Row[] ?? []).map(r => ({
        id: r.id, numero_os: r.numero_os, tipo: r.tipo, obra_id: r.obra_id,
        obra_nome: r.obra?.nome ?? null, polo: r.obra?.projeto?.nome ?? null,
      }))
    },
  })
}
