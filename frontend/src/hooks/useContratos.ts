import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  Contrato, Parcela, ParcelaAnexo, ContratoItem,
  ContratosDashboardData, ContratoCliente,
  NovoContratoPayload, NovaParcelaPayload,
  ContratoMedicao, ContratoMedicaoItem, ContratoAditivo,
  ContratoReajuste, ContratoCronograma,
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
  obra:sys_obras!obra_id(id, codigo, nome),
  solicitacao:con_solicitacoes!solicitacao_id(id, contraparte_nome)
`

export function useContratos(filters?: { status?: string; tipo_contrato?: string }) {
  return useQuery<Contrato[]>({
    queryKey: ['contratos', filters],
    queryFn: async () => {
      let q = supabase
        .from('con_contratos')
        .select(SELECT_CONTRATO)
        .order('created_at', { ascending: false })
      if (filters?.status) q = q.eq('status', filters.status)
      if (filters?.tipo_contrato) q = q.eq('tipo_contrato', filters.tipo_contrato)
      const { data, error } = await q
      if (error) return []
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
export function useParcelas(contratoId?: string, filters?: { status?: string }) {
  return useQuery<Parcela[]>({
    queryKey: ['parcelas', contratoId, filters],
    queryFn: async () => {
      let q = supabase
        .from('con_parcelas')
        .select(`
          *,
          contrato:con_contratos!contrato_id(numero, objeto, tipo_contrato, status)
        `)
        .order('data_vencimento', { ascending: true })
      if (contratoId) q = q.eq('contrato_id', contratoId)
      if (filters?.status) q = q.eq('status', filters.status)
      const { data, error } = await q
      if (error) return []
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

// ── Medições ────────────────────────────────────────────────────────────────
export function useMedicoes(contratoId?: string) {
  return useQuery<ContratoMedicao[]>({
    queryKey: ['con-medicoes', contratoId],
    queryFn: async () => {
      let q = supabase
        .from('con_medicoes')
        .select('*, contrato:con_contratos!contrato_id(numero, objeto)')
        .order('created_at', { ascending: false })
      if (contratoId) q = q.eq('contrato_id', contratoId)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as ContratoMedicao[]
    },
  })
}

export function useMedicaoItens(medicaoId: string | undefined) {
  return useQuery<ContratoMedicaoItem[]>({
    queryKey: ['con-medicao-itens', medicaoId],
    enabled: !!medicaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_medicao_itens')
        .select('*')
        .eq('medicao_id', medicaoId!)
        .order('created_at')
      if (error) return []
      return (data ?? []) as ContratoMedicaoItem[]
    },
  })
}

export function useCriarMedicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<ContratoMedicao, 'id' | 'created_at' | 'updated_at' | 'contrato'>) => {
      const { data, error } = await supabase
        .from('con_medicoes')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as ContratoMedicao
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['con-medicoes'] })
      qc.invalidateQueries({ queryKey: ['con-medicoes', vars.contrato_id] })
      qc.invalidateQueries({ queryKey: ['contratos-dashboard'] })
    },
  })
}

// ── Aditivos ────────────────────────────────────────────────────────────────
export function useAditivos(contratoId?: string) {
  return useQuery<ContratoAditivo[]>({
    queryKey: ['con-aditivos', contratoId],
    queryFn: async () => {
      let q = supabase
        .from('con_aditivos')
        .select('*, contrato:con_contratos!contrato_id(numero, objeto)')
        .order('created_at', { ascending: false })
      if (contratoId) q = q.eq('contrato_id', contratoId)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as ContratoAditivo[]
    },
  })
}

export function useCriarAditivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<ContratoAditivo, 'id' | 'created_at' | 'updated_at' | 'contrato'>) => {
      const { data, error } = await supabase
        .from('con_aditivos')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as ContratoAditivo
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['con-aditivos'] })
      qc.invalidateQueries({ queryKey: ['con-aditivos', vars.contrato_id] })
      qc.invalidateQueries({ queryKey: ['contratos-dashboard'] })
    },
  })
}

// ── Atualizar Contrato ─────────────────────────────────────────────────────
export function useAtualizarContrato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contrato> & { id: string }) => {
      const { data, error } = await supabase
        .from('con_contratos')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Contrato
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['contratos'] })
      qc.invalidateQueries({ queryKey: ['contrato', data.id] })
      qc.invalidateQueries({ queryKey: ['contratos-dashboard'] })
    },
  })
}

// ── Atualizar Medição ──────────────────────────────────────────────────────
export function useAtualizarMedicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ContratoMedicao> & { id: string }) => {
      const { data, error } = await supabase
        .from('con_medicoes')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as ContratoMedicao
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['con-medicoes'] })
      qc.invalidateQueries({ queryKey: ['con-medicoes', data.contrato_id] })
      qc.invalidateQueries({ queryKey: ['contratos-dashboard'] })
    },
  })
}

// ── Criar Itens de Medição ─────────────────────────────────────────────────
export function useCriarMedicaoItens() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itens: Omit<ContratoMedicaoItem, 'id' | 'created_at'>[]) => {
      const { data, error } = await supabase
        .from('con_medicao_itens')
        .insert(itens)
        .select()
      if (error) throw error
      return data as ContratoMedicaoItem[]
    },
    onSuccess: (data) => {
      if (data.length > 0) {
        qc.invalidateQueries({ queryKey: ['con-medicao-itens', data[0].medicao_id] })
      }
    },
  })
}

// ── Atualizar Aditivo ──────────────────────────────────────────────────────
export function useAtualizarAditivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ContratoAditivo> & { id: string }) => {
      const { data, error } = await supabase
        .from('con_aditivos')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as ContratoAditivo
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['con-aditivos'] })
      qc.invalidateQueries({ queryKey: ['con-aditivos', data.contrato_id] })
      qc.invalidateQueries({ queryKey: ['contratos-dashboard'] })
    },
  })
}

// ── Criar Reajuste ─────────────────────────────────────────────────────────
export function useCriarReajuste() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<ContratoReajuste, 'id' | 'created_at' | 'contrato'>) => {
      const { data, error } = await supabase
        .from('con_reajustes')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as ContratoReajuste
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['con-reajustes'] })
      qc.invalidateQueries({ queryKey: ['con-reajustes', data.contrato_id] })
      qc.invalidateQueries({ queryKey: ['contratos-dashboard'] })
    },
  })
}

// ── Atualizar Parcela ──────────────────────────────────────────────────────
export function useAtualizarParcela() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Parcela> & { id: string }) => {
      const { data, error } = await supabase
        .from('con_parcelas')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Parcela
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parcelas'] })
      qc.invalidateQueries({ queryKey: ['contratos-dashboard'] })
    },
  })
}

// ── Reajustes ───────────────────────────────────────────────────────────────
export function useReajustes(contratoId?: string) {
  return useQuery<ContratoReajuste[]>({
    queryKey: ['con-reajustes', contratoId],
    queryFn: async () => {
      let q = supabase
        .from('con_reajustes')
        .select('*, contrato:con_contratos!contrato_id(numero, objeto)')
        .order('data_base', { ascending: false })
      if (contratoId) q = q.eq('contrato_id', contratoId)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as ContratoReajuste[]
    },
  })
}

// ── Cronograma ──────────────────────────────────────────────────────────────
export function useCronograma(contratoId: string | undefined) {
  return useQuery<ContratoCronograma[]>({
    queryKey: ['con-cronograma', contratoId],
    enabled: !!contratoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_cronograma')
        .select('*')
        .eq('contrato_id', contratoId!)
        .order('ordem')
      if (error) return []
      return (data ?? []) as ContratoCronograma[]
    },
  })
}

export function useCriarEtapaCronograma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<ContratoCronograma, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('con_cronograma')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as ContratoCronograma
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['con-cronograma', vars.contrato_id] })
    },
  })
}

export function useAtualizarEtapaCronograma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ContratoCronograma> & { id: string }) => {
      const { data, error } = await supabase
        .from('con_cronograma')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as ContratoCronograma
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['con-cronograma', data.contrato_id] })
    },
  })
}

// ── Resumo (view) ───────────────────────────────────────────────────────────
export interface ContratoResumo {
  id: string
  numero: string
  objeto: string
  valor_total: number
  valor_aditivos: number
  valor_medido: number
  percentual_fisico: number
  status: string
  data_fim_previsto: string
}

export function useContratosResumo() {
  return useQuery<ContratoResumo[]>({
    queryKey: ['con-resumo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_con_contratos_resumo')
        .select('*')
        .order('numero')
      if (error) return []
      return (data ?? []) as ContratoResumo[]
    },
  })
}

// ── Modelos de Contrato ──────────────────────────────────────────────────────

export interface ModeloContrato {
  id: string
  nome: string
  tipo_contrato: 'receita' | 'despesa'
  objeto: string | null
  descricao: string | null
  clausulas: string | null
  recorrencia: string
  indice_reajuste: string | null
  itens_padrao: { descricao: string; unidade: string; quantidade: number; valor_unitario: number }[]
  ativo: boolean
  created_at: string
  updated_at: string
  created_by: string | null
}

export function useModelosContrato() {
  return useQuery({
    queryKey: ['con-modelos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_modelos_contrato')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ModeloContrato[]
    },
  })
}

export function useCriarModelo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<ModeloContrato, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('con_modelos_contrato')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as ModeloContrato
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['con-modelos'] })
    },
  })
}

export function useAtualizarModelo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ModeloContrato> & { id: string }) => {
      const { data, error } = await supabase
        .from('con_modelos_contrato')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as ModeloContrato
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['con-modelos'] })
    },
  })
}

export function useExcluirModelo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('con_modelos_contrato')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['con-modelos'] })
    },
  })
}
