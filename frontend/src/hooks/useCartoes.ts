import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  CartaoCredito, PortadorCartao,
  ApontamentoCartao, FaturaCartao, ItemFaturaCartao,
  StatusApontamentoCartao,
} from '../types/financeiro'

// ── Cartões ───────────────────────────────────────────────────────────────────

export function useCartoesCredito() {
  return useQuery<CartaoCredito[]>({
    queryKey: ['cartoes-credito'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_cartoes_credito')
        .select('*')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return (data ?? []) as CartaoCredito[]
    },
    retry: false,
  })
}

export function useCartoesAll() {
  return useQuery<CartaoCredito[]>({
    queryKey: ['cartoes-credito-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_cartoes_credito')
        .select('*')
        .order('nome')
      if (error) throw error
      return (data ?? []) as CartaoCredito[]
    },
    retry: false,
  })
}

export function useCriarCartao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<CartaoCredito>) => {
      const { data, error } = await supabase
        .from('fin_cartoes_credito')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as CartaoCredito
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cartoes-credito'] })
      qc.invalidateQueries({ queryKey: ['cartoes-credito-all'] })
    },
  })
}

export function useAtualizarCartao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<CartaoCredito> & { id: string }) => {
      const { data, error } = await supabase
        .from('fin_cartoes_credito')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as CartaoCredito
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cartoes-credito'] })
      qc.invalidateQueries({ queryKey: ['cartoes-credito-all'] })
    },
  })
}

// ── Portadores ────────────────────────────────────────────────────────────────

export function usePortadoresCartao(cartaoId?: string) {
  return useQuery<PortadorCartao[]>({
    queryKey: ['portadores-cartao', cartaoId],
    queryFn: async () => {
      let q = supabase
        .from('fin_portadores_cartao')
        .select('*')
        .eq('ativo', true)
        .order('nome')
      if (cartaoId) q = q.eq('cartao_id', cartaoId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as PortadorCartao[]
    },
    retry: false,
  })
}

// ── Apontamentos ──────────────────────────────────────────────────────────────

const SELECT_APONTAMENTO = `*, cartao:fin_cartoes_credito(id,nome,bandeira,ultimos4)`

export function useApontamentosCartao(filters?: {
  cartao_id?: string
  status?: StatusApontamentoCartao
  data_inicio?: string
  data_fim?: string
  user_id?: string
}) {
  return useQuery<ApontamentoCartao[]>({
    queryKey: ['apontamentos-cartao', filters],
    queryFn: async () => {
      let q = supabase
        .from('fin_apontamentos_cartao')
        .select(SELECT_APONTAMENTO)
        .order('data_lancamento', { ascending: false })
      if (filters?.cartao_id) q = q.eq('cartao_id', filters.cartao_id)
      if (filters?.status)    q = q.eq('status', filters.status)
      if (filters?.data_inicio) q = q.gte('data_lancamento', filters.data_inicio)
      if (filters?.data_fim)    q = q.lte('data_lancamento', filters.data_fim)
      if (filters?.user_id)     q = q.eq('user_id', filters.user_id)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ApontamentoCartao[]
    },
    retry: false,
  })
}

export interface ApontamentoPayload {
  cartao_id: string
  data_lancamento: string
  descricao: string
  estabelecimento?: string
  valor: number
  centro_custo?: string
  classe_financeira?: string
  projeto_id?: string
  comprovante_url?: string
  comprovante_nome?: string
  observacoes?: string
}

export function useCriarApontamentoCartao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ApontamentoPayload) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')
      const { data, error } = await supabase
        .from('fin_apontamentos_cartao')
        .insert({ ...payload, user_id: user.id, status: 'rascunho' })
        .select(SELECT_APONTAMENTO)
        .single()
      if (error) throw error
      return data as ApontamentoCartao
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apontamentos-cartao'] }),
  })
}

export function useAtualizarApontamentoCartao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ApontamentoPayload> & { id: string }) => {
      const { data, error } = await supabase
        .from('fin_apontamentos_cartao')
        .update(payload)
        .eq('id', id)
        .select(SELECT_APONTAMENTO)
        .single()
      if (error) throw error
      return data as ApontamentoCartao
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apontamentos-cartao'] }),
  })
}

export function useEnviarApontamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fin_apontamentos_cartao')
        .update({ status: 'enviado' })
        .eq('id', id)
        .eq('status', 'rascunho')
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apontamentos-cartao'] }),
  })
}

export function useExcluirApontamentoCartao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fin_apontamentos_cartao')
        .delete()
        .eq('id', id)
        .eq('status', 'rascunho')
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apontamentos-cartao'] }),
  })
}

// ── Faturas ────────────────────────────────────────────────────────────────────

const SELECT_FATURA = `*, cartao:fin_cartoes_credito(id,nome,bandeira,ultimos4)`

export function useFaturasCartao(cartaoId?: string) {
  return useQuery<FaturaCartao[]>({
    queryKey: ['faturas-cartao', cartaoId],
    queryFn: async () => {
      let q = supabase
        .from('fin_faturas_cartao')
        .select(SELECT_FATURA)
        .order('mes_referencia', { ascending: false })
      if (cartaoId) q = q.eq('cartao_id', cartaoId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as FaturaCartao[]
    },
    retry: false,
  })
}

// ── Itens da fatura ────────────────────────────────────────────────────────────

const SELECT_ITEM = `*, apontamento:fin_apontamentos_cartao(id,descricao,valor,status,user_id)`

export function useItensFatura(faturaId?: string, cartaoId?: string) {
  return useQuery<ItemFaturaCartao[]>({
    queryKey: ['itens-fatura', faturaId, cartaoId],
    enabled: !!(faturaId || cartaoId),
    queryFn: async () => {
      let q = supabase
        .from('fin_itens_fatura_cartao')
        .select(SELECT_ITEM)
        .order('data_lancamento', { ascending: false })
      if (faturaId)  q = q.eq('fatura_id', faturaId)
      if (cartaoId)  q = q.eq('cartao_id', cartaoId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ItemFaturaCartao[]
    },
    retry: false,
  })
}

// ── Conciliar (vincular apontamento ↔ item fatura) ────────────────────────────

export function useConciliarItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      itemId,
      apontamentoId,
    }: { itemId: string; apontamentoId: string }) => {
      // Marca o item como conciliado
      const { error: e1 } = await supabase
        .from('fin_itens_fatura_cartao')
        .update({ conciliado: true, apontamento_id: apontamentoId })
        .eq('id', itemId)
      if (e1) throw e1

      // Atualiza o apontamento
      const { error: e2 } = await supabase
        .from('fin_apontamentos_cartao')
        .update({ status: 'conciliado', item_fatura_id: itemId })
        .eq('id', apontamentoId)
      if (e2) throw e2
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apontamentos-cartao'] })
      qc.invalidateQueries({ queryKey: ['itens-fatura'] })
    },
  })
}

// ── Upload de fatura PDF ───────────────────────────────────────────────────────

export function useUploadFatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cartaoId,
      mesReferencia,
      file,
    }: {
      cartaoId: string
      mesReferencia: string
      file: File
    }) => {
      // 1. Upload do PDF para o Supabase Storage
      const path = `faturas/${cartaoId}/${mesReferencia}_${Date.now()}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('faturas-cartao')
        .upload(path, file, { contentType: 'application/pdf', upsert: true })
      if (uploadError) throw uploadError

      // 2. URL pública do arquivo
      const { data: { publicUrl } } = supabase.storage
        .from('faturas-cartao')
        .getPublicUrl(path)

      // 3. Aciona o n8n para extrair os lançamentos da fatura
      const N8N_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'
      const res = await fetch(`${N8N_URL}/processar-fatura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartao_id: cartaoId, mes_referencia: mesReferencia, fatura_url: publicUrl }),
        signal: AbortSignal.timeout(60_000),
      })
      if (!res.ok) throw new Error('Falha ao processar fatura no n8n')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faturas-cartao'] })
      qc.invalidateQueries({ queryKey: ['itens-fatura'] })
    },
  })
}

export function useDesconciliarItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      itemId,
      apontamentoId,
    }: { itemId: string; apontamentoId: string }) => {
      const { error: e1 } = await supabase
        .from('fin_itens_fatura_cartao')
        .update({ conciliado: false, apontamento_id: null })
        .eq('id', itemId)
      if (e1) throw e1

      const { error: e2 } = await supabase
        .from('fin_apontamentos_cartao')
        .update({ status: 'enviado', item_fatura_id: null })
        .eq('id', apontamentoId)
      if (e2) throw e2
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apontamentos-cartao'] })
      qc.invalidateQueries({ queryKey: ['itens-fatura'] })
    },
  })
}
