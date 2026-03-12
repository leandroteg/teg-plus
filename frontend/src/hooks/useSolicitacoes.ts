// ─────────────────────────────────────────────────────────────────────────────
// hooks/useSolicitacoes.ts — Contratos V2: Fluxo de Solicitacoes (7 etapas)
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { sanitizeAiText } from '../utils/sanitizeAiText'
import type {
  Solicitacao,
  SolicitacaoHistorico,
  Minuta,
  ResumoExecutivo,
  NovaSolicitacaoPayload,
  EtapaSolicitacao,
  ConfigAnalise,
  MinutaAiAnalise,
  Assinatura,
  EnviarAssinaturaPayload,
  EnviarAssinaturaResponse,
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

      // ── Criar contrato em con_contratos ao liberar execucao ──
      if (payload.etapaPara === 'concluido') {
        try {
          const { data: sol } = await supabase
            .from('con_solicitacoes')
            .select('*')
            .eq('id', payload.solicitacaoId)
            .single()

          if (sol) {
            const today = new Date().toISOString().slice(0, 10)
            const tipoMap: Record<string, 'receita' | 'despesa'> = {
              servico: 'despesa', fornecimento: 'despesa', locacao: 'despesa',
              consultoria: 'despesa', obra: 'despesa', receita: 'receita',
            }

            await supabase
              .from('con_contratos')
              .insert({
                numero:             sol.numero,
                tipo_contrato:      tipoMap[sol.tipo_contrato] ?? 'despesa',
                tipo_categoria:     sol.categoria_contrato ?? sol.tipo_contrato,
                fornecedor_id:      sol.contraparte_id ?? undefined,
                obra_id:            sol.obra_id ?? undefined,
                objeto:             sol.objeto,
                descricao:          sol.descricao_escopo ?? undefined,
                valor_total:        sol.valor_estimado ?? 0,
                data_assinatura:    today,
                data_inicio:        sol.data_inicio_prevista ?? today,
                data_fim_previsto:  sol.data_fim_prevista ?? today,
                centro_custo:       sol.centro_custo ?? undefined,
                classe_financeira:  sol.classe_financeira ?? undefined,
                indice_reajuste:    sol.indice_reajuste ?? undefined,
                status:             'vigente',
                solicitacao_id:     payload.solicitacaoId,
              })
          }
        } catch (e) {
          console.warn('Aviso: con_contratos nao criado ao liberar execucao:', e)
        }
      }

      // ── Criar aprovacao pendente quando avança para aprovacao_diretoria ──
      if (payload.etapaPara === 'aprovacao_diretoria') {
        try {
          // Busca dados da solicitacao para preencher a aprovacao
          const { data: sol } = await supabase
            .from('con_solicitacoes')
            .select('numero, objeto, contraparte_nome, valor_estimado')
            .eq('id', payload.solicitacaoId)
            .single()

          if (sol) {
            const valor = sol.valor_estimado ?? 0
            // Determina nivel/aprovador pela alcada de valor
            const nivel = valor > 100000 ? 4 : valor > 25000 ? 3 : valor > 5000 ? 2 : 1
            const aprovadorNome = valor > 25000 ? 'Laucidio' : 'Welton'

            await supabase
              .from('apr_aprovacoes')
              .insert({
                modulo: 'con',
                tipo_aprovacao: 'minuta_contratual',
                entidade_id: payload.solicitacaoId,
                entidade_numero: sol.numero ?? '',
                aprovador_nome: aprovadorNome,
                aprovador_email: '',
                nivel,
                status: 'pendente',
                observacao: `Aprovacao minuta contratual — ${sol.contraparte_nome ?? ''} — ${sol.objeto ?? ''}`,
                data_limite: new Date(Date.now() + 72 * 3600_000).toISOString(),
              })
          }
        } catch (e) {
          console.warn('Aviso: apr_aprovacoes nao criado para contrato:', e)
        }
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['con-solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['con-solicitacao', vars.solicitacaoId] })
      qc.invalidateQueries({ queryKey: ['con-solicitacao-historico', vars.solicitacaoId] })
      qc.invalidateQueries({ queryKey: ['con-solicitacoes-dashboard'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-kpis'] })
      qc.invalidateQueries({ queryKey: ['contratos'] })
      qc.invalidateQueries({ queryKey: ['contratos-dashboard'] })
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
  const qc = useQueryClient()
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
      const result = await res.json()

      // Save melhorias to Supabase
      if (result.success && result.melhorias) {
        await supabase
          .from('con_minutas')
          .update({
            ai_melhorias: result.melhorias,
            ai_melhorado_em: new Date().toISOString(),
          })
          .eq('id', payload.minuta_id)
      }

      return result
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['con-minutas', vars.solicitacao_id] })
    },
  })
}

// ── Minuta Texto Estruturado (retornado pelo n8n AI) ─────────────────────────

export interface MinutaTextoGerado {
  preambulo: string
  /** n8n returns "secoes", frontend alias "clausulas" — accept both */
  secoes?: Array<{ titulo: string; conteudo: string }>
  clausulas?: Array<{ numero?: string; titulo: string; conteudo: string }>
  /** n8n returns "clausulas_finais", frontend alias "disposicoes_finais" */
  clausulas_finais?: string
  disposicoes_finais?: string
  /** n8n returns "local_assinatura", frontend alias "local_data" */
  local_assinatura?: string
  local_data?: string
}

// ── Gerar Minuta PDF via AI (n8n webhook) ────────────────────────────────────

export interface GerarMinutaPayload {
  titulo: string
  objeto: string
  descricao_escopo?: string
  contraparte: string
  contraparte_cnpj?: string
  contraparte_email?: string
  contraparte_telefone?: string
  valor?: number
  forma_pagamento?: string
  prazo_meses?: number
  data_inicio_prevista?: string
  data_fim_prevista?: string
  indice_reajuste?: string
  tipo_contrato?: string
  categoria_contrato?: string
  obra_nome?: string
  centro_custo?: string
  justificativa?: string
  melhorias: MelhoriaMinuta
}

export function useGerarMinutaPDF() {
  return useMutation<
    { success: boolean; minuta_texto: MinutaTextoGerado; titulo: string; parse_fallback?: boolean },
    Error,
    GerarMinutaPayload
  >({
    mutationFn: async (payload) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 120_000) // 2min timeout
      try {
        const res = await fetch(`${N8N_BASE}/contratos/gerar-minuta-pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`Erro ao gerar minuta: ${res.status}`)
        return res.json()
      } finally {
        clearTimeout(timeout)
      }
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
      // 1. Call n8n webhook for AI analysis
      const res = await fetch(`${N8N_BASE}/contratos/analisar-minuta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Erro na analise: ${res.status}`)
      const result = await res.json()

      // 2. Sanitize AI text to fix encoding issues (unicode escapes, HTML entities)
      if (result.success && result.analise) {
        const a = result.analise
        if (typeof a.resumo === 'string') a.resumo = sanitizeAiText(a.resumo)
        if (a.riscos) a.riscos = a.riscos.map((r: Record<string, unknown>) => ({
          ...r,
          descricao: typeof r.descricao === 'string' ? sanitizeAiText(r.descricao) : r.descricao,
          mitigacao: typeof r.mitigacao === 'string' ? sanitizeAiText(r.mitigacao) : r.mitigacao,
        }))
        if (a.sugestoes) a.sugestoes = a.sugestoes.map((s: Record<string, unknown>) => ({
          ...s,
          descricao: typeof s.descricao === 'string' ? sanitizeAiText(s.descricao) : s.descricao,
          justificativa: typeof s.justificativa === 'string' ? sanitizeAiText(s.justificativa) : s.justificativa,
        }))
        if (a.oportunidades) a.oportunidades = a.oportunidades.map((o: Record<string, unknown>) => ({
          ...o,
          descricao: typeof o.descricao === 'string' ? sanitizeAiText(o.descricao) : o.descricao,
        }))
        if (a.clausulas_analisadas) a.clausulas_analisadas = a.clausulas_analisadas.map((c: Record<string, unknown>) => ({
          ...c,
          texto_melhorado: typeof c.texto_melhorado === 'string' ? sanitizeAiText(c.texto_melhorado) : c.texto_melhorado,
          justificativa: typeof c.justificativa === 'string' ? sanitizeAiText(c.justificativa) : c.justificativa,
        }))

        // 3. Save sanitized analysis result to Supabase
        await supabase
          .from('con_minutas')
          .update({
            ai_analise: a,
            ai_analisado_em: new Date().toISOString(),
          })
          .eq('id', payload.minuta_id)
      }

      return result
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['con-minutas', vars.solicitacao_id] })
    },
  })
}

// ── Assinaturas (Certisign) ─────────────────────────────────────────

export function useAssinaturas(solicitacaoId?: string) {
  return useQuery<Assinatura[]>({
    queryKey: ['con-assinaturas', solicitacaoId],
    enabled: !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_assinaturas')
        .select('*')
        .eq('solicitacao_id', solicitacaoId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as Assinatura[]
    },
  })
}

export function useAssinaturasAll() {
  return useQuery<Assinatura[]>({
    queryKey: ['con-assinaturas-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_assinaturas')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as Assinatura[]
    },
  })
}

export function useEnviarAssinatura() {
  const qc = useQueryClient()
  return useMutation<EnviarAssinaturaResponse, Error, EnviarAssinaturaPayload>({
    mutationFn: async (payload) => {
      let envelope_id = ''
      let n8nOk = false

      // 1) Tentar enviar via n8n/Certisign (não-bloqueante se falhar)
      try {
        const res = await fetch(`${N8N_BASE}/certisign-enviar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            callback_url: `${N8N_BASE}/certisign-callback`,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          envelope_id = data.envelope_id ?? ''
          n8nOk = true
        } else {
          console.warn('[Certisign] Webhook retornou erro:', res.status)
        }
      } catch (err) {
        console.warn('[Certisign] Webhook indisponivel, criando registro local:', err)
      }

      // 2) Criar registro con_assinaturas no Supabase (garante rastreabilidade)
      const { data: assinatura, error: insErr } = await supabase
        .from('con_assinaturas')
        .insert({
          solicitacao_id: payload.solicitacao_id,
          tipo_assinatura: payload.tipo_assinatura,
          status: n8nOk ? 'enviado' : 'pendente',
          envelope_id: envelope_id || null,
          signatarios: payload.signatarios,
          enviado_em: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (insErr) throw new Error(`Erro ao registrar assinatura: ${insErr.message}`)

      return {
        assinatura_id: assinatura?.id ?? '',
        envelope_id,
        status: 'enviado' as const,
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['con-assinaturas', vars.solicitacao_id] })
      qc.invalidateQueries({ queryKey: ['con-assinaturas-all'] })
      qc.invalidateQueries({ queryKey: ['con-solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['con-solicitacao', vars.solicitacao_id] })
    },
  })
}
