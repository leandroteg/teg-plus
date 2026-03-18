import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'
import type {
  SolicitacaoNF,
  SolicitacaoNFFilters,
  CriarSolicitacaoPayload,
  EmitirNFPayload,
} from '../types/solicitacaoNF'

// ── Select com joins ────────────────────────────────────────────────────────
const SELECT_SOL = `
  *,
  fornecedor:cmp_fornecedores!fornecedor_id(id, razao_social, cnpj)
`

// ── Listar Solicitações NF ──────────────────────────────────────────────────
export function useSolicitacoesNF(filters: SolicitacaoNFFilters) {
  return useQuery<SolicitacaoNF[]>({
    queryKey: ['solicitacoes-nf', filters],
    queryFn: async () => {
      let q = supabase
        .from('fis_solicitacoes_nf')
        .select(SELECT_SOL)
        .order('solicitado_em', { ascending: false })

      // Filtro por mês/ano (baseado em solicitado_em)
      if (filters.mes && filters.ano) {
        const startDate = `${filters.ano}-${String(filters.mes).padStart(2, '0')}-01`
        const endMonth = filters.mes === 12 ? 1 : filters.mes + 1
        const endYear = filters.mes === 12 ? filters.ano + 1 : filters.ano
        const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
        q = q.gte('solicitado_em', startDate).lt('solicitado_em', endDate)
      } else if (filters.ano) {
        q = q.gte('solicitado_em', `${filters.ano}-01-01`).lt('solicitado_em', `${filters.ano + 1}-01-01`)
      }

      // Filtros diretos
      if (filters.status) q = q.eq('status', filters.status)
      if (filters.origem) q = q.eq('origem', filters.origem)
      if (filters.fornecedor_id) q = q.eq('fornecedor_id', filters.fornecedor_id)

      // Busca livre
      if (filters.busca) {
        const busca = filters.busca.trim()
        q = q.or(`fornecedor_nome.ilike.%${busca}%,numero_nf.ilike.%${busca}%,descricao.ilike.%${busca}%`)
      }

      const { data, error } = await q
      if (error) return []
      return (data ?? []) as SolicitacaoNF[]
    },
  })
}

// ── Resumo por status (useMemo) ─────────────────────────────────────────────
export function useSolResumo(items: SolicitacaoNF[]) {
  return useMemo(() => {
    const pendentes = items.filter(s => s.status === 'pendente').length
    const em_emissao = items.filter(s => s.status === 'em_emissao').length
    const aguardando = items.filter(s => s.status === 'aguardando_aprovacao').length
    const emitidas = items.filter(s => s.status === 'emitida').length
    const rejeitadas = items.filter(s => s.status === 'rejeitada').length
    const total = items.length
    return { pendentes, em_emissao, aguardando, emitidas, rejeitadas, total }
  }, [items])
}

// ── Criar Solicitação ───────────────────────────────────────────────────────
export function useCriarSolicitacao() {
  const qc = useQueryClient()
  const { perfil } = useAuth()

  return useMutation({
    mutationFn: async (payload: CriarSolicitacaoPayload) => {
      const { data, error } = await supabase
        .from('fis_solicitacoes_nf')
        .insert({
          ...payload,
          status: 'pendente',
          solicitado_por: perfil?.id ?? null,
        })
        .select()
        .single()
      if (error) throw new Error('Falha ao criar solicitação: ' + error.message)
      return data as SolicitacaoNF
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitacoes-nf'] })
    },
  })
}

// ── Iniciar Emissão ─────────────────────────────────────────────────────────
export function useIniciarEmissao() {
  const qc = useQueryClient()
  const { perfil } = useAuth()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('fis_solicitacoes_nf')
        .update({
          status: 'em_emissao',
          emitido_por: perfil?.id ?? null,
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error('Falha ao iniciar emissão: ' + error.message)
      return data as SolicitacaoNF
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitacoes-nf'] })
    },
  })
}

// ── Emitir NF (preencher dados fiscais) ─────────────────────────────────────
export function useEmitirNF() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: EmitirNFPayload }) => {
      const { data, error } = await supabase
        .from('fis_solicitacoes_nf')
        .update({
          numero_nf: payload.numero_nf,
          serie: payload.serie ?? null,
          chave_acesso: payload.chave_acesso ?? null,
          data_emissao: payload.data_emissao,
          danfe_url: payload.danfe_url ?? null,
          cfop: payload.cfop ?? null,
          natureza_operacao: payload.natureza_operacao ?? null,
          emitente_cnpj: payload.emitente_cnpj ?? null,
          emitente_nome: payload.emitente_nome ?? null,
          destinatario_cnpj: payload.destinatario_cnpj ?? null,
          destinatario_nome: payload.destinatario_nome ?? null,
          destinatario_uf: payload.destinatario_uf ?? null,
          items: payload.items ?? null,
          ...(payload.valor_total != null ? { valor_total: payload.valor_total } : {}),
          valor_frete: payload.valor_frete ?? null,
          valor_seguro: payload.valor_seguro ?? null,
          valor_desconto_nf: payload.valor_desconto_nf ?? null,
          icms_base: payload.icms_base ?? null,
          icms_valor: payload.icms_valor ?? null,
          info_complementar: payload.info_complementar ?? null,
          emissao_tipo: 'sistema',
          status: 'aguardando_aprovacao',
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error('Falha ao emitir NF: ' + error.message)
      return data as SolicitacaoNF
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitacoes-nf'] })
    },
  })
}

// ── Upload DANFE ────────────────────────────────────────────────────────────
export function useUploadDANFE() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, danfe_url }: { id: string; danfe_url: string }) => {
      const { data, error } = await supabase
        .from('fis_solicitacoes_nf')
        .update({ danfe_url })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as SolicitacaoNF
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitacoes-nf'] }),
  })
}

// ── Aprovar Solicitação ─────────────────────────────────────────────────────
export function useAprovarSolicitacao() {
  const qc = useQueryClient()
  const { perfil } = useAuth()

  return useMutation({
    mutationFn: async (id: string) => {
      const agora = new Date().toISOString()

      // 1. Aprovar
      const { error: aprError } = await supabase
        .from('fis_solicitacoes_nf')
        .update({
          status: 'aprovada',
          aprovado_por: perfil?.id ?? null,
          aprovado_em: agora,
        })
        .eq('id', id)

      if (aprError) throw new Error('Falha ao aprovar: ' + aprError.message)

      // 2. Marcar como emitida
      const { data, error: emitError } = await supabase
        .from('fis_solicitacoes_nf')
        .update({
          status: 'emitida',
          emitido_em: agora,
        })
        .eq('id', id)
        .select()
        .single()

      if (emitError) throw new Error('Falha ao finalizar emissão: ' + emitError.message)
      return data as SolicitacaoNF
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitacoes-nf'] })
    },
  })
}

// ── Rejeitar Solicitação ────────────────────────────────────────────────────
export function useRejeitarSolicitacao() {
  const qc = useQueryClient()
  const { perfil } = useAuth()

  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data, error } = await supabase
        .from('fis_solicitacoes_nf')
        .update({
          status: 'rejeitada',
          motivo_rejeicao: motivo,
          aprovado_por: perfil?.id ?? null,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error('Falha ao rejeitar: ' + error.message)
      return data as SolicitacaoNF
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitacoes-nf'] })
    },
  })
}

// ── Anexar NF Emitida (upload + n8n parse) ──────────────────────────────────
const N8N_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || ''

export function useAnexarNFExterna() {
  const qc = useQueryClient()
  const { perfil } = useAuth()

  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      // 1. Upload file to Supabase Storage
      const ext = file.name.split('.').pop() || 'pdf'
      const path = `externa/${Date.now()}-nf.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('notas-fiscais')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (uploadError) throw new Error('Falha no upload: ' + uploadError.message)

      // 2. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('notas-fiscais')
        .getPublicUrl(path)

      // 3. Parse NF via n8n (AI/OCR)
      let parsed: Record<string, unknown> = {}
      try {
        const res = await fetch(`${N8N_BASE}/fiscal/nf/parse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ arquivo: publicUrl, nome: file.name }),
        })
        if (res.ok) parsed = await res.json()
      } catch {
        // Parse failure is non-blocking — file is already uploaded
      }

      // 4. Update solicitacao with parsed data (only include parsed fields that have values)
      const agora = new Date().toISOString()
      const updatePayload: Record<string, unknown> = {
        danfe_url: publicUrl,
        emissao_tipo: 'externa',
        status: 'emitida',
        emitido_por: perfil?.id ?? null,
        emitido_em: agora,
      }
      // Only set parsed fields if n8n returned them (valor_total is NOT NULL in DB)
      if (parsed.numero) updatePayload.numero_nf = parsed.numero
      if (parsed.serie) updatePayload.serie = parsed.serie
      if (parsed.data_emissao) updatePayload.data_emissao = parsed.data_emissao
      if (parsed.valor_total) updatePayload.valor_total = parsed.valor_total
      if (parsed.chave_acesso) updatePayload.chave_acesso = parsed.chave_acesso

      const { data, error } = await supabase
        .from('fis_solicitacoes_nf')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error('Falha ao anexar NF emitida: ' + error.message)
      return data as SolicitacaoNF
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitacoes-nf'] })
    },
  })
}
