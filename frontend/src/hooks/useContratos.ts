import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { PaginationControls } from './usePagination'
import type {
  Contrato, Parcela, ParcelaAnexo, ContratoItem,
  ContratosDashboardData, ContratoCliente,
  NovoContratoPayload, NovaParcelaPayload,
} from '../types/contratos'

// ── Dashboard ────────────────────────────────────────────────────────────────
export function useContratosDashboard() {
  return useQuery<ContratosDashboardData>({
    queryKey: ['contratos-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_contratos_gestao')
      if (error) {
        return {
          resumo: { total_contratos: 0, vigentes: 0, contratos_receita: 0, contratos_despesa: 0, valor_total_receita: 0, valor_total_despesa: 0 },
          parcelas: { previstas: 0, pendentes: 0, liberadas: 0, pagas: 0, valor_pendente: 0, valor_liberado: 0 },
          proximas_parcelas: [],
          alertas_ativos: 0,
        }
      }
      return data as ContratosDashboardData
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
}

// ── Clientes ────────────────────────────────────────────────────────────────
export function useClientes() {
  return useQuery<ContratoCliente[]>({
    queryKey: ['con-clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_clientes')
        .select('*')
        .eq('ativo', true)
        .order('nome')
      if (error) return []
      return (data ?? []) as ContratoCliente[]
    },
  })
}

// ── Contratos ────────────────────────────────────────────────────────────────
const SELECT_CONTRATO = `
  *,
  cliente:con_clientes!cliente_id(id, nome, cnpj, tipo),
  fornecedor:cmp_fornecedores!fornecedor_id(id, razao_social, nome_fantasia, cnpj),
  obra:sys_obras!obra_id(id, codigo, nome)
`

export function useContratos(filters?: { status?: string; tipo_contrato?: string }, pagination?: PaginationControls) {
  return useQuery<Contrato[]>({
    queryKey: ['contratos', filters, pagination?.page, pagination?.pageSize],
    queryFn: async () => {
      let q = supabase
        .from('con_contratos')
        .select(SELECT_CONTRATO, { count: 'exact' })
        .order('created_at', { ascending: false })
      if (filters?.status) q = q.eq('status', filters.status)
      if (filters?.tipo_contrato) q = q.eq('tipo_contrato', filters.tipo_contrato)
      if (pagination) q = q.range(...pagination.range)
      const { data, error, count } = await q
      if (error) return []
      if (pagination && count != null) pagination.setTotalCount(count)
      return (data ?? []) as Contrato[]
    },
  })
}

export function useContrato(id: string | undefined) {
  return useQuery<Contrato | null>({
    queryKey: ['contrato', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_contratos')
        .select(SELECT_CONTRATO)
        .eq('id', id!)
        .single()
      if (error) return null
      return data as Contrato
    },
  })
}

export function useCriarContrato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: NovoContratoPayload) => {
      const { itens, ...contratoData } = payload

      // 1. Criar contrato
      const { data: contrato, error } = await supabase
        .from('con_contratos')
        .insert(contratoData)
        .select()
        .single()
      if (error) throw error

      // 2. Criar itens se houver
      if (itens && itens.length > 0) {
        const { error: itemsError } = await supabase
          .from('con_contrato_itens')
          .insert(itens.map(item => ({ ...item, contrato_id: contrato.id })))
        if (itemsError) throw itemsError
      }

      // 3. Gerar parcelas recorrentes se aplicável
      if (contratoData.recorrencia !== 'personalizado') {
        await supabase.rpc('con_gerar_parcelas_recorrentes', {
          p_contrato_id: contrato.id,
        })
      }

      return contrato as Contrato
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contratos'] })
      qc.invalidateQueries({ queryKey: ['contratos-dashboard'] })
    },
  })
}

// ── Itens do Contrato ────────────────────────────────────────────────────────
export function useContratoItens(contratoId: string | undefined) {
  return useQuery<ContratoItem[]>({
    queryKey: ['contrato-itens', contratoId],
    enabled: !!contratoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_contrato_itens')
        .select('*')
        .eq('contrato_id', contratoId!)
        .order('created_at')
      if (error) return []
      return (data ?? []) as ContratoItem[]
    },
  })
}

// ── Parcelas ────────────────────────────────────────────────────────────────
export function useParcelas(contratoId?: string, filters?: { status?: string }, pagination?: PaginationControls) {
  return useQuery<Parcela[]>({
    queryKey: ['parcelas', contratoId, filters, pagination?.page, pagination?.pageSize],
    queryFn: async () => {
      let q = supabase
        .from('con_parcelas')
        .select(`
          *,
          contrato:con_contratos!contrato_id(numero, objeto, tipo_contrato, status)
        `, { count: 'exact' })
        .order('data_vencimento', { ascending: true })
      if (contratoId) q = q.eq('contrato_id', contratoId)
      if (filters?.status) q = q.eq('status', filters.status)
      if (pagination) q = q.range(...pagination.range)
      const { data, error, count } = await q
      if (error) return []
      if (pagination && count != null) pagination.setTotalCount(count)
      return (data ?? []) as Parcela[]
    },
  })
}

export function useCriarParcela() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: NovaParcelaPayload) => {
      const { data, error } = await supabase
        .from('con_parcelas')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as Parcela
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['parcelas', vars.contrato_id] })
      qc.invalidateQueries({ queryKey: ['contratos-dashboard'] })
    },
  })
}

// ── Liberar Parcela (Pagamento ou Recebimento) ──────────────────────────────
export function useLiberarParcela() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      parcelaId,
      liberadoPor,
      nfNumero,
    }: {
      parcelaId: string
      liberadoPor: string
      nfNumero?: string
    }) => {
      const { error } = await supabase
        .from('con_parcelas')
        .update({
          status: 'liberado',
          liberado_em: new Date().toISOString(),
          liberado_por: liberadoPor,
          nf_numero: nfNumero,
        })
        .eq('id', parcelaId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parcelas'] })
      qc.invalidateQueries({ queryKey: ['contratos-dashboard'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['contas-receber'] })
    },
  })
}

// ── Confirmar Pagamento/Recebimento ─────────────────────────────────────────
export function useConfirmarPagamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      parcelaId,
      dataPagamento,
    }: {
      parcelaId: string
      dataPagamento?: string
    }) => {
      const { error } = await supabase
        .from('con_parcelas')
        .update({
          status: 'pago',
          data_pagamento: dataPagamento ?? new Date().toISOString().split('T')[0],
          pago_em: new Date().toISOString(),
        })
        .eq('id', parcelaId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parcelas'] })
      qc.invalidateQueries({ queryKey: ['contratos-dashboard'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['contas-receber'] })
    },
  })
}

// ── Upload de Anexo de Parcela ──────────────────────────────────────────────
export function useUploadAnexoParcela() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      parcelaId,
      file,
      tipo,
      observacao,
    }: {
      parcelaId: string
      file: File
      tipo: string
      observacao?: string
    }) => {
      const ext = file.name.split('.').pop()
      const path = `${parcelaId}/${Date.now()}.${ext}`

      // 1. Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('contratos-anexos')
        .upload(path, file)
      if (uploadError) throw uploadError

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from('contratos-anexos')
        .getPublicUrl(path)

      // 3. Save record
      const { error: insertError } = await supabase
        .from('con_parcela_anexos')
        .insert({
          parcela_id: parcelaId,
          tipo,
          nome_arquivo: file.name,
          url: urlData.publicUrl,
          mime_type: file.type,
          tamanho_bytes: file.size,
          observacao,
        })
      if (insertError) throw insertError
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parcela-anexos'] })
    },
  })
}

export function useAnexosParcela(parcelaId: string | undefined) {
  return useQuery<ParcelaAnexo[]>({
    queryKey: ['parcela-anexos', parcelaId],
    enabled: !!parcelaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_parcela_anexos')
        .select('*')
        .eq('parcela_id', parcelaId!)
        .order('uploaded_at', { ascending: false })
      if (error) return []
      return (data ?? []) as ParcelaAnexo[]
    },
  })
}
