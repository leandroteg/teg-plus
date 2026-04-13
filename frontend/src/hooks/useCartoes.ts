import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  CartaoCredito, PortadorCartao,
  ApontamentoCartao, FaturaCartao, ItemFaturaCartao,
  StatusApontamentoCartao,
} from '../types/financeiro'

const N8N_WEBHOOK_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'

function sanitizeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function getFileExtension(file: File) {
  const fromName = file.name.split('.').pop()?.trim().toLowerCase()
  if (fromName) return fromName

  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  }

  return mimeMap[file.type] ?? 'bin'
}

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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      const { data: ap, error } = await supabase
        .from('fin_apontamentos_cartao')
        .update({ status: 'enviado' })
        .eq('id', id)
        .eq('status', 'rascunho')
        .select(`*, cartao:fin_cartoes_credito(id,nome,bandeira,ultimos4)`)
        .single()
      if (error) throw error

      // Notifica N8N para processar apontamento enviado
      try {
        await fetch(`${N8N_WEBHOOK_BASE}/apontamentos/cartao/enviado`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apontamento_id: ap.id,
            user_id: user.id,
            descricao: ap.descricao,
            valor: ap.valor,
            data_lancamento: ap.data_lancamento,
            estabelecimento: ap.estabelecimento,
            cartao_id: ap.cartao_id,
            centro_custo: ap.centro_custo,
            classe_financeira: ap.classe_financeira,
          }),
        })
      } catch {
        // falha no webhook não bloqueia o fluxo
      }
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
    refetchInterval: (query) => {
      const faturas = query.state.data ?? []
      return faturas.some(f => f.status === 'processando') ? 3000 : false
    },
  })
}

// ── Itens da fatura ────────────────────────────────────────────────────────────

const SELECT_ITEM = `*, apontamento:fin_apontamentos_cartao!apontamento_id(id,descricao,valor,status,user_id)`

export function useItensFatura(faturaId?: string, cartaoId?: string, isProcessing?: boolean) {
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
    refetchInterval: isProcessing ? 3000 : false,
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
      const ext = getFileExtension(file)
      const baseName = sanitizeFileName(file.name.replace(/\.[^.]+$/, '') || `fatura-${mesReferencia}`)
      const path = `faturas/${cartaoId}/${mesReferencia}_${Date.now()}_${baseName}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('faturas-cartao')
        .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: true })
      if (uploadError) throw uploadError

      // 2. URL assinada (válida por 1h) — bucket privado, dados financeiros
      const { data: signedData, error: signedError } = await supabase.storage
        .from('faturas-cartao')
        .createSignedUrl(path, 3600)
      if (signedError || !signedData) throw signedError ?? new Error('Falha ao gerar URL assinada')

      // 3. Registra a fatura no Supabase com status 'processando' (n8n atualizará depois)
      const { error: faturaError } = await supabase
        .from('fin_faturas_cartao')
        .upsert({
          cartao_id: cartaoId,
          mes_referencia: mesReferencia,
          arquivo_url: signedData.signedUrl,
          arquivo_nome: file.name,
          status: 'processando',
          erro_msg: null,
          processado_em: null,
        }, { onConflict: 'cartao_id,mes_referencia' })
      if (faturaError) throw faturaError

      // 4. Dispara o n8n de forma assíncrona — não aguarda resposta
      const payload = {
        cartao_id: cartaoId,
        mes_referencia: mesReferencia,
        fatura_url: signedData.signedUrl,
        arquivo_nome: file.name,
        mime_type: file.type || 'application/octet-stream',
        storage_path: path,
      }
      fetch(`${N8N_WEBHOOK_BASE}/financeiro/cartoes/processar-fatura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(300_000),
      }).catch(() => {
        // Falha silenciosa — fatura ficará como 'processando' ou 'erro' via n8n
      })
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
