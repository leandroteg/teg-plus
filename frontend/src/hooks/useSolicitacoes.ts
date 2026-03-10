// ─────────────────────────────────────────────────────────────────────────────
// hooks/useSolicitacoes.ts — Contratos V2: Fluxo de Solicitacoes (7 etapas)
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  Solicitacao,
  SolicitacaoHistorico,
  Minuta,
  ResumoExecutivo,
  NovaSolicitacaoPayload,
  EtapaSolicitacao,
  ConfigAnalise,
  MinutaAiAnalise,
} from '../types/contratos'

// ── Lista de Solicitacoes ────────────────────────────────────────────────────

const SELECT_SOLICITACAO = `
  *,
  obra:sys_obras!obra_id(id, nome)
`

export function useSolicitacoes(filtros?: {
  etapa_atual?: EtapaSolicitacao
  status?: string
  busca?: string
}) {
  return useQuery<Solicitacao[]>({
    queryKey: ['con-solicitacoes', filtros],
    queryFn: async () => {
      let q = supabase
        .from('con_solicitacoes')
        .select(SELECT_SOLICITACAO)
        .order('created_at', { ascending: false })
      if (filtros?.etapa_atual) q = q.eq('etapa_atual', filtros.etapa_atual)
      if (filtros?.status) q = q.eq('status', filtros.status)
      if (filtros?.busca) {
        q = q.or(
          `numero.ilike.%${filtros.busca}%,objeto.ilike.%${filtros.busca}%,contraparte_nome.ilike.%${filtros.busca}%`
        )
      }
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as Solicitacao[]
    },
  })
}

// ── Solicitacao por ID ───────────────────────────────────────────────────────

export function useSolicitacao(id: string | undefined) {
  return useQuery<Solicitacao | null>({
    queryKey: ['con-solicitacao', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_solicitacoes')
        .select(SELECT_SOLICITACAO)
        .eq('id', id!)
        .single()
      if (error) return null
      return data as Solicitacao
    },
  })
}

// ── Dashboard (contagem por etapa) ───────────────────────────────────────────

export function useSolicitacoesDashboard() {
  return useQuery<Record<string, number>>({
    queryKey: ['con-solicitacoes-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_solicitacoes')
        .select('etapa_atual')
      if (error) return {}
      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        counts[row.etapa_atual] = (counts[row.etapa_atual] ?? 0) + 1
      }
      return counts
    },
    refetchInterval: 30_000,
  })
}

// ── Criar Solicitacao ────────────────────────────────────────────────────────

export function useCriarSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: NovaSolicitacaoPayload & {
      status?: string
      etapa_atual?: string
    }) => {
      // Generate sequential number: SOL-CON-YYYY-NNN
      const year = new Date().getFullYear()
      const prefix = `SOL-CON-${year}-`

      const { count, error: countError } = await supabase
        .from('con_solicitacoes')
        .select('id', { count: 'exact', head: true })
        .like('numero', `${prefix}%`)
      if (countError) throw countError

      const seq = String((count ?? 0) + 1).padStart(3, '0')
      const numero = `${prefix}${seq}`

      const { status: overrideStatus, etapa_atual: overrideEtapa, ...rest } = payload

      const { data, error } = await supabase
        .from('con_solicitacoes')
        .insert({
          ...rest,
          numero,
          urgencia: rest.urgencia ?? 'normal',
          etapa_atual: overrideEtapa ?? 'solicitacao',
          status: overrideStatus ?? 'rascunho',
          documentos_ref: [],
        })
        .select(SELECT_SOLICITACAO)
        .single()
      if (error) throw error
      return data as Solicitacao
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['con-solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['con-solicitacoes-dashboard'] })
    },
  })
}

// ── Atualizar Solicitacao ────────────────────────────────────────────────────

export function useAtualizarSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string } & Partial<Solicitacao>) => {
      const { id, ...rest } = payload
      const { data, error } = await supabase
        .from('con_solicitacoes')
        .update(rest)
        .eq('id', id)
        .select(SELECT_SOLICITACAO)
        .single()
      if (error) throw error
      return data as Solicitacao
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['con-solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['con-solicitacao', vars.id] })
      qc.invalidateQueries({ queryKey: ['con-solicitacoes-dashboard'] })
    },
  })
}

// ── Historico ────────────────────────────────────────────────────────────────

export function useSolicitacaoHistorico(solicitacaoId: string | undefined) {
  return useQuery<SolicitacaoHistorico[]>({
    queryKey: ['con-solicitacao-historico', solicitacaoId],
    enabled: !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_solicitacao_historico')
        .select('*')
        .eq('solicitacao_id', solicitacaoId!)
        .order('created_at', { ascending: true })
      if (error) return []
      return (data ?? []) as SolicitacaoHistorico[]
    },
  })
}

// ── Avancar Etapa ───────────────────────────────────────────────────────────

export function useAvancarEtapa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      solicitacaoId: string
      etapaDe: EtapaSolicitacao
      etapaPara: EtapaSolicitacao
      observacao?: string
    }) => {
      // Update solicitacao etapa
      const { error: updateErr } = await supabase
        .from('con_solicitacoes')
        .update({
          etapa_atual: payload.etapaPara,
          status: payload.etapaPara === 'concluido' ? 'concluido'
            : payload.etapaPara === 'cancelado' ? 'cancelado'
            : 'em_andamento',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.solicitacaoId)
      if (updateErr) throw updateErr

      // Insert historico
      const { error: histErr } = await supabase
        .from('con_solicitacao_historico')
        .insert({
          solicitacao_id: payload.solicitacaoId,
          etapa_de: payload.etapaDe,
          etapa_para: payload.etapaPara,
          observacao: payload.observacao,
        })
      if (histErr) throw histErr
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['con-solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['con-solicitacao', vars.solicitacaoId] })
      qc.invalidateQueries({ queryKey: ['con-solicitacao-historico', vars.solicitacaoId] })
      qc.invalidateQueries({ queryKey: ['con-solicitacoes-dashboard'] })
    },
  })
}

// ── Cancelar Solicitacao ────────────────────────────────────────────────────

export function useCancelarSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; motivo: string }) => {
      const { error: updateErr } = await supabase
        .from('con_solicitacoes')
        .update({
          etapa_atual: 'cancelado',
          status: 'cancelado',
          motivo_cancelamento: payload.motivo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.id)
      if (updateErr) throw updateErr

      // Get current etapa for historico
      const { data: sol } = await supabase
        .from('con_solicitacoes')
        .select('etapa_atual')
        .eq('id', payload.id)
        .single()

      const { error: histErr } = await supabase
        .from('con_solicitacao_historico')
        .insert({
          solicitacao_id: payload.id,
          etapa_de: sol?.etapa_atual ?? 'desconhecida',
          etapa_para: 'cancelado',
          observacao: payload.motivo,
        })
      if (histErr) throw histErr
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['con-solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['con-solicitacao', vars.id] })
      qc.invalidateQueries({ queryKey: ['con-solicitacao-historico', vars.id] })
      qc.invalidateQueries({ queryKey: ['con-solicitacoes-dashboard'] })
    },
  })
}

// ── Minutas ─────────────────────────────────────────────────────────────────

export function useMinutas(solicitacaoId: string | undefined) {
  return useQuery<Minuta[]>({
    queryKey: ['con-minutas', solicitacaoId],
    enabled: !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_minutas')
        .select('*')
        .eq('solicitacao_id', solicitacaoId!)
        .order('versao', { ascending: false })
      if (error) return []
      return (data ?? []) as Minuta[]
    },
  })
}

export function useCriarMinuta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      solicitacao_id: string
      titulo: string
      tipo: string
      descricao?: string
      arquivo_url: string
      arquivo_nome: string
      versao?: number
    }) => {
      const { data, error } = await supabase
        .from('con_minutas')
        .insert({
          ...payload,
          status: 'rascunho',
          versao: payload.versao ?? 1,
        })
        .select('*')
        .single()
      if (error) throw error
      return data as Minuta
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['con-minutas', vars.solicitacao_id] })
    },
  })
}

export function useAtualizarMinuta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; solicitacao_id?: string } & Partial<Minuta>) => {
      const { id, ...rest } = payload
      const { data, error } = await supabase
        .from('con_minutas')
        .update(rest)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data as Minuta
    },
    onSuccess: (_d, vars) => {
      if (vars.solicitacao_id) {
        qc.invalidateQueries({ queryKey: ['con-minutas', vars.solicitacao_id] })
      }
    },
  })
}

// ── Resumo Executivo ────────────────────────────────────────────────────────

export function useResumoExecutivo(solicitacaoId: string | undefined) {
  return useQuery<ResumoExecutivo | null>({
    queryKey: ['con-resumo-executivo', solicitacaoId],
    enabled: !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_resumos_executivos')
        .select('*')
        .eq('solicitacao_id', solicitacaoId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) return null
      return data as ResumoExecutivo | null
    },
  })
}

export function useCriarResumo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<ResumoExecutivo, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('con_resumos_executivos')
        .insert(payload)
        .select('*')
        .single()
      if (error) throw error
      return data as ResumoExecutivo
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['con-resumo-executivo', vars.solicitacao_id] })
    },
  })
}

export function useAtualizarResumo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; solicitacao_id: string } & Partial<ResumoExecutivo>) => {
      const { id, ...rest } = payload
      const { data, error } = await supabase
        .from('con_resumos_executivos')
        .update(rest)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data as ResumoExecutivo
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['con-resumo-executivo', vars.solicitacao_id] })
    },
  })
}

// ── Config Analise IA ─────────────────────────────────────────────────────

const N8N_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'

export function useConfigAnalise() {
  return useQuery<ConfigAnalise[]>({
    queryKey: ['con-config-analise'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_config_analise')
        .select('*')
        .order('categoria')
        .order('chave')
      if (error) return []
      return (data ?? []) as ConfigAnalise[]
    },
  })
}

export function useAtualizarConfigAnalise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; valor: string; ativo?: boolean }) => {
      const { id, ...rest } = payload
      const { data, error } = await supabase
        .from('con_config_analise')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data as ConfigAnalise
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['con-config-analise'] })
    },
  })
}

// ── Upload Arquivo Minuta (Supabase Storage) ──────────────────────────────

export function useUploadMinutaFile() {
  return useMutation({
    mutationFn: async ({ file, solicitacaoId }: { file: File; solicitacaoId: string }) => {
      const ext = file.name.split('.').pop() ?? 'bin'
      const ts = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `minutas/${solicitacaoId}/${ts}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('contratos-anexos')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (uploadError) throw new Error('Falha no upload: ' + uploadError.message)

      const { data: { publicUrl } } = supabase.storage
        .from('contratos-anexos')
        .getPublicUrl(path)

      return {
        arquivo_url: publicUrl,
        arquivo_nome: file.name,
        mime_type: file.type,
        tamanho_bytes: file.size,
      }
    },
  })
}

// ── Melhorar Minuta via AI (n8n webhook) ────────────────────────────────────

export interface MelhoriaMinuta {
  resumo_melhorias: string
  score_estimado: number
  clausulas_melhoradas: Array<{
    nome: string
    status_anterior: string
    acao: string
    texto_original?: string
    texto_melhorado: string
    justificativa: string
  }>
  riscos_mitigados: Array<{
    risco_original: string
    severidade_original: string
    severidade_apos: string
    acao_tomada: string
  }>
  clausulas_novas: Array<{
    nome: string
    texto: string
    motivo: string
    base_legal?: string
  }>
  observacoes_gerais?: string
  solicitacao_id?: string
  minuta_id?: string
  data_geracao?: string
}

export function useMelhorarMinuta() {
  return useMutation<
    { success: boolean; melhorias: MelhoriaMinuta },
    Error,
    {
      solicitacao_id: string
      minuta_id: string
      arquivo_url?: string
      titulo?: string
      analise?: MinutaAiAnalise
      contexto: {
        objeto?: string
        contraparte?: string
        valor?: number
        tipo_contrato?: string
        data_inicio?: string
        data_fim?: string
        obra?: string
      }
    }
  >({
    mutationFn: async (payload) => {
      const res = await fetch(`${N8N_BASE}/contratos/melhorar-minuta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Erro ao melhorar minuta: ${res.status}`)
      return res.json()
    },
  })
}

// ── Gerar Resumo Executivo via AI (n8n webhook) ─────────────────────────────

export interface ResumoAiGerado {
  titulo: string
  partes_envolvidas: Array<{ nome: string; papel: string; cnpj?: string }> | string
  objeto_resumo: string
  valor_total?: number
  prazo_meses?: number
  score_analise?: number
  riscos: Array<{
    descricao: string
    impacto?: string
    probabilidade?: string
    mitigacao?: string
    nivel?: string
  }>
  oportunidades: Array<{
    descricao: string
    beneficio?: string
    impacto?: string
    prioridade?: string
  }>
  recomendacao?: string
  parecer_juridico?: string
  solicitacao_id?: string
  status?: string
  data_geracao?: string
}

export function useGerarResumoAI() {
  return useMutation<
    { success: boolean; resumo: ResumoAiGerado },
    Error,
    {
      solicitacao_id: string
      analise?: MinutaAiAnalise
      dados_contrato: {
        contratante?: string
        contratada?: string
        objeto?: string
        valor_total?: number
        prazo_meses?: number
        titulo?: string
        cnpj_contratante?: string
        cnpj_contratada?: string
      }
    }
  >({
    mutationFn: async (payload) => {
      const res = await fetch(`${N8N_BASE}/contratos/gerar-resumo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Erro ao gerar resumo: ${res.status}`)
      return res.json()
    },
  })
}

// ── Analisar Minuta via AI (n8n webhook) ────────────────────────────────────

export function useAnalisarMinuta() {
  const qc = useQueryClient()
  return useMutation<
    { success: boolean; analise: MinutaAiAnalise },
    Error,
    {
      minuta_id: string
      solicitacao_id: string
      texto_minuta?: string
      descricao_minuta?: string
      contexto: {
        objeto?: string
        contraparte?: string
        valor?: number
        tipo_contrato?: string
        data_inicio?: string
        data_fim?: string
        obra?: string
      }
      regras: ConfigAnalise[]
    }
  >({
    mutationFn: async (payload) => {
      const res = await fetch(`${N8N_BASE}/contratos/analisar-minuta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Erro na analise: ${res.status}`)
      return res.json()
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['con-minutas', vars.solicitacao_id] })
    },
  })
}
