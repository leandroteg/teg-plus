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
  ParcelaPlanejada,
} from '../types/contratos'
import { normalizarParcelasPlanejadas, sugerirParcelasContrato } from '../utils/contratosParcelas'

// ── Lista de Solicitacoes ────────────────────────────────────────────────────

const SELECT_SOLICITACAO = `
  *,
  obra:sys_obras!left(id, nome)
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

function readParcelasPlanejadas(dadosEtapa?: Record<string, unknown>, valorTotal?: number) {
  const raw = dadosEtapa?.parcelas_planejadas
  if (!Array.isArray(raw)) return []

  return normalizarParcelasPlanejadas(
    raw.map((item) => item as Partial<ParcelaPlanejada>),
    valorTotal,
  )
}

export function useAvancarEtapa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      solicitacaoId: string
      etapaDe: EtapaSolicitacao
      etapaPara: EtapaSolicitacao
      observacao?: string
      dadosEtapa?: Record<string, unknown>
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
          dados_etapa: payload.dadosEtapa ?? null,
        })
      if (histErr) throw histErr

      // ── Criar aprovação ao avançar para aprovacao_diretoria ──
      if (payload.etapaPara === 'aprovacao_diretoria') {
        try {
          const { data: sol } = await supabase
            .from('con_solicitacoes')
            .select('numero, objeto, valor_estimado, contraparte_nome')
            .eq('id', payload.solicitacaoId)
            .single()

          // Verificar se já existe aprovação pendente
          const { data: existing } = await supabase
            .from('apr_aprovacoes')
            .select('id')
            .eq('entidade_id', payload.solicitacaoId)
            .eq('modulo', 'con')
            .eq('status', 'pendente')
            .limit(1)

          if (!existing?.length) {
            await supabase.from('apr_aprovacoes').insert({
              modulo: 'con',
              tipo_aprovacao: 'minuta_contratual',
              entidade_id: payload.solicitacaoId,
              entidade_numero: sol?.numero ?? '',
              nivel: 2,
              status: 'pendente',
            })
          }
        } catch (aprErr) {
          console.error('Erro ao criar aprovação:', aprErr)
          // Não bloqueia o avanço de etapa
        }
      }

      // ── Criar contrato em con_contratos ao liberar execucao ──
      if (payload.etapaPara === 'concluido') {
        try {
          const { data: sol } = await supabase
            .from('con_solicitacoes')
            .select('*')
            .eq('id', payload.solicitacaoId)
            .single()

          if (sol) {
            const { data: resumo } = await supabase
              .from('con_resumos_executivos')
              .select('id, valor_total, vigencia, recomendacao')
              .eq('solicitacao_id', payload.solicitacaoId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            const today = new Date().toISOString().slice(0, 10)
            const tipoContrato = sol.tipo_contrato === 'receita' ? 'receita' : 'despesa'
            const valorContrato = Number(resumo?.valor_total ?? sol.valor_estimado ?? 0)

            const { data: contratoExistente } = await supabase
              .from('con_contratos')
              .select('id, numero, tipo_contrato, obra_id, centro_custo, classe_financeira, objeto, valor_total, data_inicio, data_fim_previsto')
              .eq('solicitacao_id', payload.solicitacaoId)
              .maybeSingle()

            let contrato = contratoExistente

            if (!contrato) {
              const { data: contratoCriado, error: contratoErr } = await supabase
                .from('con_contratos')
                .insert({
                  numero:             sol.numero,
                  tipo_contrato:      tipoContrato,
                  tipo_categoria:     sol.grupo_contrato ?? sol.categoria_contrato ?? sol.tipo_contrato,
                  fornecedor_id:      tipoContrato === 'despesa' ? (sol.contraparte_id ?? undefined) : undefined,
                  obra_id:            sol.obra_id ?? undefined,
                  objeto:             sol.objeto,
                  descricao:          sol.descricao_escopo ?? undefined,
                  valor_total:        valorContrato,
                  data_assinatura:    today,
                  data_inicio:        sol.data_inicio_prevista ?? today,
                  data_fim_previsto:  sol.data_fim_prevista ?? today,
                  centro_custo:       sol.centro_custo ?? undefined,
                  classe_financeira:  sol.classe_financeira ?? undefined,
                  indice_reajuste:    sol.indice_reajuste ?? undefined,
                  status:             'vigente',
                  solicitacao_id:     payload.solicitacaoId,
                })
                .select('id, numero, tipo_contrato, obra_id, centro_custo, classe_financeira, objeto, valor_total, data_inicio, data_fim_previsto')
                .single()

              if (contratoErr) throw contratoErr
              contrato = contratoCriado
            }

            const parcelasPlanejadas = readParcelasPlanejadas(payload.dadosEtapa, valorContrato)
            const parcelasFallback = sugerirParcelasContrato({
              solicitacao: {
                forma_pagamento: sol.forma_pagamento,
                valor_estimado: valorContrato,
                data_inicio_prevista: sol.data_inicio_prevista,
                data_fim_prevista: sol.data_fim_prevista,
                prazo_meses: sol.prazo_meses,
              },
              resumo: resumo ?? null,
            })

            const parcelasResolvidas = parcelasPlanejadas.length > 0 ? parcelasPlanejadas : parcelasFallback

            const { data: parcelasExistentes, error: parcelasExistentesErr } = await supabase
              .from('con_parcelas')
              .select('id, numero, valor, data_vencimento, fin_cp_id, fin_cr_id')
              .eq('contrato_id', contrato.id)
              .order('numero', { ascending: true })

            if (parcelasExistentesErr) throw parcelasExistentesErr

            let parcelasContrato = parcelasExistentes ?? []

            if (parcelasContrato.length === 0) {
              const { data: parcelasCriadas, error: parcelasErr } = await supabase
                .from('con_parcelas')
                .insert(parcelasResolvidas.map((parcela) => ({
                  contrato_id: contrato.id,
                  numero: parcela.numero,
                  valor: parcela.valor,
                  data_vencimento: parcela.data_vencimento,
                  status: 'previsto',
                  observacoes: `Gerada ao liberar execucao da solicitacao ${sol.numero}`,
                })))
                .select('id, numero, valor, data_vencimento, fin_cp_id, fin_cr_id')

              if (parcelasErr) throw parcelasErr
              parcelasContrato = (parcelasCriadas ?? []).sort((a, b) => a.numero - b.numero)
            }

            for (const parcela of parcelasContrato) {
              if (tipoContrato === 'despesa' && !parcela.fin_cp_id) {
                const { data: cp, error: cpErr } = await supabase
                  .from('fin_contas_pagar')
                  .insert({
                    fornecedor_id: sol.contraparte_id ?? undefined,
                    fornecedor_nome: sol.contraparte_nome,
                    valor_original: parcela.valor,
                    data_emissao: today,
                    data_vencimento: parcela.data_vencimento,
                    data_vencimento_orig: parcela.data_vencimento,
                    centro_custo: sol.centro_custo ?? contrato.centro_custo ?? undefined,
                    classe_financeira: sol.classe_financeira ?? contrato.classe_financeira ?? undefined,
                    natureza: 'contrato',
                    forma_pagamento: sol.forma_pagamento ?? undefined,
                    numero_documento: `${sol.numero}-PARC-${String(parcela.numero).padStart(2, '0')}`,
                    status: 'previsto',
                    descricao: `${sol.objeto} - Parcela ${parcela.numero}/${parcelasContrato.length}`,
                    observacoes: `Previsto gerado automaticamente ao liberar contrato ${sol.numero} para execucao`,
                  })
                  .select('id')
                  .single()

                if (cpErr) throw cpErr

                const { error: updateParcelaErr } = await supabase
                  .from('con_parcelas')
                  .update({ fin_cp_id: cp.id })
                  .eq('id', parcela.id)

                if (updateParcelaErr) throw updateParcelaErr
              }

              if (tipoContrato === 'receita' && !parcela.fin_cr_id) {
                const { data: cr, error: crErr } = await supabase
                  .from('fin_contas_receber')
                  .insert({
                    cliente_nome: sol.contraparte_nome,
                    cliente_cnpj: sol.contraparte_cnpj ?? undefined,
                    valor_original: parcela.valor,
                    data_emissao: today,
                    data_vencimento: parcela.data_vencimento,
                    centro_custo: sol.centro_custo ?? contrato.centro_custo ?? undefined,
                    classe_financeira: sol.classe_financeira ?? contrato.classe_financeira ?? undefined,
                    natureza: 'contrato',
                    status: 'previsto',
                    descricao: `${sol.objeto} - Parcela ${parcela.numero}/${parcelasContrato.length}`,
                    observacoes: `Previsto gerado automaticamente ao liberar contrato ${sol.numero} para execucao`,
                  })
                  .select('id')
                  .single()

                if (crErr) throw crErr

                const { error: updateParcelaErr } = await supabase
                  .from('con_parcelas')
                  .update({ fin_cr_id: cr.id })
                  .eq('id', parcela.id)

                if (updateParcelaErr) throw updateParcelaErr
              }
            }
          }
          // ── Atualizar requisição de origem (compra recorrente) ──
          if (sol?.requisicao_origem_id) {
            await supabase
              .from('cmp_requisicoes')
              .update({ status: 'pedido_emitido' })
              .eq('id', sol.requisicao_origem_id)
              .eq('status', 'aguardando_contrato')
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

function parseAiObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
    } catch {
      return null
    }
  }
  return typeof value === 'object' ? value as Record<string, unknown> : null
}

function normalizeMinutaAiAnalise(input: unknown): MinutaAiAnalise | null {
  let raw = parseAiObject(input)
  if (!raw) return null

  const nestedResumo = typeof raw.resumo === 'string' ? parseAiObject(raw.resumo) : null
  const shouldPromoteNestedResumo = !!nestedResumo && (
    typeof nestedResumo.score !== 'undefined' ||
    Array.isArray(nestedResumo.riscos) ||
    Array.isArray(nestedResumo.sugestoes) ||
    Array.isArray(nestedResumo.clausulas_analisadas)
  )

  if (shouldPromoteNestedResumo) {
    raw = {
      ...raw,
      ...nestedResumo,
      resumo: typeof nestedResumo.resumo === 'string' ? nestedResumo.resumo : raw.resumo,
    }
  }

  const conformidadeRaw = parseAiObject(raw.conformidade)

  const riscos = Array.isArray(raw.riscos) ? raw.riscos.map((item) => {
    const risco = parseAiObject(item) ?? {}
    return {
      titulo: typeof risco.titulo === 'string' ? sanitizeAiText(risco.titulo) : 'Risco identificado',
      severidade: (typeof risco.severidade === 'string' ? risco.severidade : 'medio') as 'baixo' | 'medio' | 'alto' | 'critico',
      descricao: typeof risco.descricao === 'string' ? sanitizeAiText(risco.descricao) : '',
      clausula_ref: typeof risco.clausula_ref === 'string' ? sanitizeAiText(risco.clausula_ref) : undefined,
      sugestao_mitigacao: typeof risco.sugestao_mitigacao === 'string'
        ? sanitizeAiText(risco.sugestao_mitigacao)
        : typeof risco.mitigacao === 'string'
          ? sanitizeAiText(risco.mitigacao)
          : undefined,
    }
  }).filter((risco) => risco.descricao) : []

  const sugestoes = Array.isArray(raw.sugestoes) ? raw.sugestoes.map((item) => {
    const sugestao = parseAiObject(item) ?? {}
    return {
      titulo: typeof sugestao.titulo === 'string' ? sanitizeAiText(sugestao.titulo) : 'Sugestao',
      prioridade: (typeof sugestao.prioridade === 'string' ? sugestao.prioridade : 'media') as 'baixa' | 'media' | 'alta',
      categoria: typeof sugestao.categoria === 'string'
        ? sugestao.categoria as 'importante' | 'recomendada' | 'opcional'
        : undefined,
      descricao: typeof sugestao.descricao === 'string' ? sanitizeAiText(sugestao.descricao) : '',
      texto_sugerido: typeof sugestao.texto_sugerido === 'string' ? sanitizeAiText(sugestao.texto_sugerido) : undefined,
      beneficio_teg: typeof sugestao.beneficio_teg === 'string'
        ? sanitizeAiText(sugestao.beneficio_teg)
        : typeof sugestao.justificativa === 'string'
          ? sanitizeAiText(sugestao.justificativa)
          : undefined,
    }
  }).filter((sugestao) => sugestao.descricao) : []

  const oportunidades = Array.isArray(raw.oportunidades) ? raw.oportunidades.map((item) => {
    const oportunidade = parseAiObject(item) ?? {}
    return {
      titulo: typeof oportunidade.titulo === 'string' ? sanitizeAiText(oportunidade.titulo) : 'Oportunidade',
      descricao: typeof oportunidade.descricao === 'string' ? sanitizeAiText(oportunidade.descricao) : '',
      impacto: typeof oportunidade.impacto === 'string'
        ? oportunidade.impacto as 'alto' | 'medio' | 'baixo'
        : undefined,
      texto_sugerido: typeof oportunidade.texto_sugerido === 'string'
        ? sanitizeAiText(oportunidade.texto_sugerido)
        : undefined,
    }
  }).filter((oportunidade) => oportunidade.descricao) : []

  const clausulas_analisadas = Array.isArray(raw.clausulas_analisadas) ? raw.clausulas_analisadas.map((item) => {
    const clausula = parseAiObject(item) ?? {}
    return {
      nome: typeof clausula.nome === 'string' ? sanitizeAiText(clausula.nome) : 'Clausula',
      status: (typeof clausula.status === 'string' ? clausula.status : 'atencao') as 'ok' | 'atencao' | 'risco' | 'ausente',
      comentario: typeof clausula.comentario === 'string'
        ? sanitizeAiText(clausula.comentario)
        : typeof clausula.observacao === 'string'
          ? sanitizeAiText(clausula.observacao)
          : typeof clausula.justificativa === 'string'
            ? sanitizeAiText(clausula.justificativa)
            : '',
    }
  }).filter((clausula) => clausula.nome || clausula.comentario) : []

  return {
    score: typeof raw.score === 'number' ? raw.score : Number(raw.score) || 70,
    resumo: typeof raw.resumo === 'string' ? sanitizeAiText(raw.resumo) : undefined,
    papel_teg: typeof raw.papel_teg === 'string'
      ? raw.papel_teg as 'contratante' | 'contratada' | 'indefinido'
      : 'indefinido',
    poder_barganha: (() => {
      const barganha = parseAiObject(raw.poder_barganha)
      if (!barganha) return undefined
      return {
        nivel: (typeof barganha.nivel === 'string' ? barganha.nivel : 'medio') as 'alto' | 'medio' | 'baixo',
        justificativa: typeof barganha.justificativa === 'string' ? sanitizeAiText(barganha.justificativa) : undefined,
      }
    })(),
    riscos,
    sugestoes,
    oportunidades,
    clausulas_analisadas,
    conformidade: conformidadeRaw ? {
      clausulas_obrigatorias: Boolean(conformidadeRaw.clausulas_obrigatorias),
      penalidades_adequadas: typeof conformidadeRaw.penalidades_adequadas === 'boolean'
        ? conformidadeRaw.penalidades_adequadas
        : Boolean(conformidadeRaw.penalidades),
      prazos_razoaveis: typeof conformidadeRaw.prazos_razoaveis === 'boolean'
        ? conformidadeRaw.prazos_razoaveis
        : Boolean(conformidadeRaw.prazos),
      garantias_previstas: typeof conformidadeRaw.garantias_previstas === 'boolean'
        ? conformidadeRaw.garantias_previstas
        : Boolean(conformidadeRaw.garantias),
      seguro_previsto: typeof conformidadeRaw.seguro_previsto === 'boolean'
        ? conformidadeRaw.seguro_previsto
        : Boolean(conformidadeRaw.seguro),
      ssma_previsto: typeof conformidadeRaw.ssma_previsto === 'boolean'
        ? conformidadeRaw.ssma_previsto
        : Boolean(conformidadeRaw.ssma),
      anticorrupcao_previsto: typeof conformidadeRaw.anticorrupcao_previsto === 'boolean'
        ? conformidadeRaw.anticorrupcao_previsto
        : Boolean(conformidadeRaw.anticorrupcao),
      reajuste_definido: typeof conformidadeRaw.reajuste_definido === 'boolean'
        ? conformidadeRaw.reajuste_definido
        : Boolean(conformidadeRaw.reajuste),
    } : undefined,
  }
}

function hasMeaningfulMinutaAiAnalise(analise: MinutaAiAnalise | null | undefined) {
  if (!analise) return false

  return (
    analise.riscos.length > 0 ||
    analise.sugestoes.length > 0 ||
    (analise.oportunidades?.length ?? 0) > 0 ||
    (analise.clausulas_analisadas?.length ?? 0) > 0
  )
}

function isFallbackMinutaAiAnalise(analise: MinutaAiAnalise | null | undefined) {
  if (!analise) return true

  const resumo = (analise.resumo ?? '').trim().toLowerCase()
  const hasOnlyFallbackResumo = !resumo || resumo === 'análise processada.' || resumo === 'analise processada.'

  return (
    analise.score === 70 &&
    analise.papel_teg === 'indefinido' &&
    !hasMeaningfulMinutaAiAnalise(analise) &&
    hasOnlyFallbackResumo
  )
}

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
        .upload(path, file, { upsert: true, contentType: file.type || 'application/pdf' })
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
  grupo_contrato?: string
  obra_nome?: string
  centro_custo?: string
  justificativa?: string
  melhorias: MelhoriaMinuta
  // Dados da empresa contratante (preenchidos automaticamente)
  contratante_razao?: string
  contratante_cnpj?: string
  contratante_endereco?: string
  contratante_cidade?: string
  contratante_uf?: string
  contratante_telefone?: string
  contratante_email?: string
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
      melhorias?: MelhoriaMinuta
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

      let analise = normalizeMinutaAiAnalise(result?.analise ?? result)

      if (isFallbackMinutaAiAnalise(analise)) {
        const { data: minutaAtual } = await supabase
          .from('con_minutas')
          .select('ai_analise')
          .eq('id', payload.minuta_id)
          .maybeSingle()

        const analiseAnterior = normalizeMinutaAiAnalise(minutaAtual?.ai_analise)
        if (hasMeaningfulMinutaAiAnalise(analiseAnterior)) {
          analise = analiseAnterior
        }
      }

      // 2. Save normalized analysis result to Supabase
      if (result.success && analise) {
        await supabase
          .from('con_minutas')
          .update({
            ai_analise: analise,
            ai_analisado_em: new Date().toISOString(),
          })
          .eq('id', payload.minuta_id)

        result.analise = analise
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
      // 1) Enviar via n8n/Certisign — o workflow já cria registro em con_assinaturas
      try {
        const res = await fetch(`${N8N_BASE}/certisign-enviar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            callback_url: `${N8N_BASE}/certisign-callback`,
          }),
        })
        const data = await res.json().catch(() => ({}))

        if (res.ok && data.status === 'enviado') {
          // n8n criou o registro — não duplicar
          return {
            assinatura_id: data.assinatura_id ?? '',
            envelope_id: data.envelope_id ?? '',
            status: 'enviado' as const,
          }
        }

        // n8n retornou erro — ele já criou registro com status 'erro'
        throw new Error(data.message || 'Falha ao enviar para Certisign')
      } catch (err) {
        if (err instanceof TypeError) {
          // Fetch falhou (n8n offline) — criar registro local como fallback
          console.warn('[Certisign] Webhook indisponível, criando registro local:', err)
          const { data: assinatura, error: insErr } = await supabase
            .from('con_assinaturas')
            .insert({
              solicitacao_id: payload.solicitacao_id,
              tipo_assinatura: payload.tipo_assinatura,
              status: 'pendente',
              envelope_id: null,
              signatarios: payload.signatarios,
              enviado_em: new Date().toISOString(),
            })
            .select('id')
            .single()

          if (insErr) throw new Error(`Erro ao registrar assinatura: ${insErr.message}`)

          return {
            assinatura_id: assinatura?.id ?? '',
            envelope_id: '',
            status: 'enviado' as const,
          }
        }
        // Erro do n8n — propagar para o usuário
        throw err
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

// ── Confirmar assinatura (manual ou Certisign) + upload cópia assinada ──────

export interface ConfirmarAssinaturaPayload {
  solicitacao_id: string
  arquivo?: File
  observacao?: string
}

export function useConfirmarAssinatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ConfirmarAssinaturaPayload) => {
      let documento_assinado_url: string | null = null

      // 1) Upload da cópia assinada (se fornecida)
      if (payload.arquivo) {
        const ts = Date.now()
        const safeName = payload.arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `assinados/${payload.solicitacao_id}/${ts}_${safeName}`

        const { error: upErr } = await supabase.storage
          .from('contratos-anexos')
          .upload(path, payload.arquivo, { upsert: false, contentType: payload.arquivo.type })
        if (upErr) throw new Error('Falha no upload do documento assinado: ' + upErr.message)

        const { data: { publicUrl } } = supabase.storage
          .from('contratos-anexos')
          .getPublicUrl(path)
        documento_assinado_url = publicUrl
      }

      // 2) Atualizar ou criar registro con_assinaturas com status 'assinado'
      const { data: existing } = await supabase
        .from('con_assinaturas')
        .select('id')
        .eq('solicitacao_id', payload.solicitacao_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existing) {
        const updatePayload: Record<string, unknown> = {
          status: 'assinado',
          concluido_em: new Date().toISOString(),
        }
        if (documento_assinado_url) updatePayload.documento_assinado_url = documento_assinado_url
        const { error } = await supabase
          .from('con_assinaturas')
          .update(updatePayload)
          .eq('id', existing.id)
        if (error) throw new Error('Erro ao atualizar assinatura: ' + error.message)
      } else {
        const { error } = await supabase
          .from('con_assinaturas')
          .insert({
            solicitacao_id: payload.solicitacao_id,
            provedor: 'manual',
            tipo_assinatura: 'eletronica',
            status: 'assinado',
            concluido_em: new Date().toISOString(),
            documento_assinado_url,
            signatarios: [],
          })
        if (error) throw new Error('Erro ao registrar assinatura: ' + error.message)
      }

      return { documento_assinado_url }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['con-assinaturas', vars.solicitacao_id] })
      qc.invalidateQueries({ queryKey: ['con-assinaturas-all'] })
      qc.invalidateQueries({ queryKey: ['con-solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['con-solicitacao', vars.solicitacao_id] })
    },
  })
}
