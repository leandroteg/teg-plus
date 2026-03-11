import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AprovacaoPendente, AprovacaoHistorico, TipoAprovacao } from '../types'
import { supabase } from '../services/supabase'
import { api } from '../services/api'
import { syncCPsParaAprovacao } from './useFinanceiro'

// Tabelas: apr_aprovacoes (modulo Aprovacoes -- AprovAi)
// NOTE: apr_aprovacoes.entidade_id NAO tem FK para cmp_requisicoes (design generico).
// Por isso NAO usamos PostgREST join -- fazemos duas queries separadas.
const TABLE_APR = 'apr_aprovacoes'
const TABLE_REQ = 'cmp_requisicoes'

// ── Aprovacoes Pendentes (multi-tipo) ──────────────────────────────────────────

export function useAprovacoesPendentes(tipo?: TipoAprovacao) {
  return useQuery<AprovacaoPendente[]>({
    queryKey: ['aprovacoes-pendentes', tipo],
    queryFn: async () => {
      // 0. Sync: garante que CPs aguardando_aprovacao tenham apr_aprovacoes
      try { await syncCPsParaAprovacao() } catch { /* non-critical */ }

      // 1. Busca aprovacoes pendentes — filtra por tipo se fornecido
      let query = supabase
        .from(TABLE_APR)
        .select('id, entidade_id, entidade_numero, modulo, tipo_aprovacao, aprovador_nome, aprovador_email, nivel, status, observacao, token, data_limite, created_at')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false })

      if (tipo) {
        query = query.eq('tipo_aprovacao', tipo)
      }

      const { data: aprData, error: aprError } = await query

      if (aprError) throw aprError
      if (!aprData || aprData.length === 0) return []

      // 2. Busca as requisicoes relacionadas pelos IDs (somente para tipo requisicao_compra / cotacao)
      const cmpIds = aprData
        .filter(a => a.modulo === 'cmp' || !a.modulo)
        .map(a => a.entidade_id)
        .filter(Boolean)

      let reqMap = new Map<string, Record<string, unknown>>()

      if (cmpIds.length > 0) {
        const { data: reqData } = await supabase
          .from(TABLE_REQ)
          .select('id, numero, solicitante_nome, obra_nome, descricao, valor_estimado, urgencia, status, alcada_nivel, categoria, created_at')
          .in('id', cmpIds)
        reqMap = new Map((reqData ?? []).map(r => [r.id, r]))
      }

      // 3. Busca dados de cotacao para cotacao_resumo (fornecedor vencedor, valor, total cotados)
      const cotMap = new Map<string, {
        fornecedor_nome: string
        valor: number
        prazo_dias: number
        total_cotados: number
      }>()

      if (cmpIds.length > 0) {
        const { data: cotData } = await supabase
          .from('cmp_cotacoes')
          .select('requisicao_id, fornecedor_selecionado_nome, valor_selecionado, fornecedores:cmp_cotacao_fornecedores!cotacao_id(id, prazo_entrega_dias)')
          .in('requisicao_id', cmpIds)
          .eq('status', 'concluida')

        for (const c of cotData ?? []) {
          const cot = c as Record<string, unknown>
          const fornecedores = (cot.fornecedores ?? []) as { id: string; prazo_entrega_dias?: number }[]
          const selecionado = fornecedores.find(() => true)
          cotMap.set(cot.requisicao_id as string, {
            fornecedor_nome: (cot.fornecedor_selecionado_nome as string) ?? 'N/A',
            valor: (cot.valor_selecionado as number) ?? 0,
            prazo_dias: selecionado?.prazo_entrega_dias ?? 0,
            total_cotados: fornecedores.length,
          })
        }
      }

      // 4. Busca dados de contratos (minuta_contratual)
      const conIds = aprData
        .filter(a => a.tipo_aprovacao === 'minuta_contratual')
        .map(a => a.entidade_id)
        .filter(Boolean)

      const conMap = new Map<string, Record<string, unknown>>()
      const minutaMap = new Map<string, Record<string, unknown>>()
      if (conIds.length > 0) {
        const { data: conData } = await supabase
          .from('con_solicitacoes')
          .select('id, numero, objeto, contraparte_nome, valor_estimado, tipo_contrato, etapa_atual')
          .in('id', conIds)
        for (const c of conData ?? []) {
          conMap.set(c.id, c)
        }

        // Busca minuta mais recente de cada solicitacao (com PDF + analise AI)
        const { data: minutaData } = await supabase
          .from('con_minutas')
          .select('id, solicitacao_id, titulo, arquivo_url, arquivo_nome, ai_analise, status')
          .in('solicitacao_id', conIds)
          .order('created_at', { ascending: false })
        for (const m of minutaData ?? []) {
          // Guarda apenas a mais recente por solicitacao
          if (!minutaMap.has(m.solicitacao_id)) {
            minutaMap.set(m.solicitacao_id, m)
          }
        }
      }

      // 5. Busca dados de financeiro (autorizacao_pagamento)
      const finIds = aprData
        .filter(a => a.tipo_aprovacao === 'autorizacao_pagamento')
        .map(a => a.entidade_id)
        .filter(Boolean)

      const finMap = new Map<string, Record<string, unknown>>()
      if (finIds.length > 0) {
        const { data: finData } = await supabase
          .from('fin_contas_pagar')
          .select('id, fornecedor_nome, valor_original, valor_pago, numero_documento, descricao, data_vencimento, data_emissao, centro_custo, classe_financeira, natureza, forma_pagamento, status')
          .in('id', finIds)
        for (const f of finData ?? []) {
          finMap.set(f.id, f)
        }
      }

      // 6. Mescla aprovacoes com dados da requisicao/contrato/CP + cotacao
      return aprData
        .map(a => {
          let requisicao: Record<string, unknown>
          const req = reqMap.get(a.entidade_id)

          if (req) {
            requisicao = req
          } else if (a.tipo_aprovacao === 'minuta_contratual') {
            const con = conMap.get(a.entidade_id)
            const minuta = minutaMap.get(a.entidade_id)
            const aiAnalise = minuta?.ai_analise as Record<string, unknown> | null

            // Parse resumo: can be string or stringified JSON
            let aiResumo: string | null = null
            const rawResumo = aiAnalise?.resumo
            if (typeof rawResumo === 'string') {
              if (rawResumo.startsWith('{')) {
                try {
                  const parsed = JSON.parse(rawResumo)
                  aiResumo = typeof parsed.resumo === 'string' ? parsed.resumo : null
                } catch { aiResumo = rawResumo.length > 200 ? null : rawResumo }
              } else {
                aiResumo = rawResumo
              }
            }

            requisicao = {
              id: a.entidade_id,
              numero: con?.numero ?? a.entidade_numero ?? 'N/A',
              solicitante_nome: (con?.contraparte_nome as string) ?? '',
              obra_nome: '',
              descricao: `Minuta Contratual — ${(con?.objeto as string) ?? ''} — ${(con?.contraparte_nome as string) ?? ''}`,
              valor_estimado: (con?.valor_estimado as number) ?? 0,
              urgencia: 'normal',
              status: 'em_aprovacao',
              alcada_nivel: a.nivel,
              created_at: a.created_at,
            }

            // Attach minuta_resumo at the top-level for AprovAi card
            ;(a as Record<string, unknown>)._minuta_resumo = {
              objeto: (con?.objeto as string) ?? '',
              contraparte: (con?.contraparte_nome as string) ?? '',
              tipo_contrato: (con?.tipo_contrato as string) ?? '',
              vigencia_inicio: '',
              vigencia_fim: '',
              valor_estimado: Number(con?.valor_estimado) || 0,
              minuta_titulo: (minuta?.titulo as string) ?? '',
              arquivo_url: (minuta?.arquivo_url as string) ?? '',
              arquivo_nome: (minuta?.arquivo_nome as string) ?? '',
              ai_resumo: aiResumo,
              ai_score: typeof aiAnalise?.score === 'number' ? aiAnalise.score : null,
            }
          } else if (a.tipo_aprovacao === 'autorizacao_pagamento') {
            const fin = finMap.get(a.entidade_id)
            requisicao = {
              id: a.entidade_id,
              numero: fin?.numero_documento ?? a.entidade_numero ?? 'N/A',
              solicitante_nome: (fin?.fornecedor_nome as string) ?? '',
              obra_nome: (fin?.centro_custo as string) ?? '',
              descricao: `Autorizacao Pagamento — ${(fin?.fornecedor_nome as string) ?? ''} — ${(fin?.descricao as string) ?? ''}`,
              valor_estimado: (fin?.valor_original as number) ?? 0,
              urgencia: 'normal',
              status: 'em_aprovacao',
              alcada_nivel: a.nivel,
              created_at: a.created_at,
            }
            // Issue #35: Attach enriched payment details for AprovAi card
            if (fin) {
              ;(a as Record<string, unknown>)._pagamento_detalhes = {
                fornecedor_nome: (fin.fornecedor_nome as string) ?? '',
                valor_original: (fin.valor_original as number) ?? 0,
                valor_pago: (fin.valor_pago as number) ?? 0,
                numero_documento: (fin.numero_documento as string) ?? '',
                descricao: (fin.descricao as string) ?? '',
                data_vencimento: (fin.data_vencimento as string) ?? '',
                data_emissao: (fin.data_emissao as string) ?? '',
                centro_custo: (fin.centro_custo as string) ?? '',
                classe_financeira: (fin.classe_financeira as string) ?? '',
                natureza: (fin.natureza as string) ?? '',
                forma_pagamento: (fin.forma_pagamento as string) ?? '',
                status_cp: (fin.status as string) ?? '',
              }
            }
          } else {
            requisicao = {
              id: a.entidade_id,
              numero: a.entidade_numero || 'N/A',
              solicitante_nome: a.aprovador_nome,
              obra_nome: '',
              descricao: `Aprovacao ${a.tipo_aprovacao?.replace(/_/g, ' ') ?? 'pendente'}`,
              valor_estimado: 0,
              urgencia: 'normal',
              status: 'em_aprovacao',
              alcada_nivel: a.nivel,
              created_at: a.created_at,
            }
          }

          const minutaResumo = (a as Record<string, unknown>)._minuta_resumo as AprovacaoPendente['minuta_resumo']
          delete (a as Record<string, unknown>)._minuta_resumo
          const pagamentoDetalhes = (a as Record<string, unknown>)._pagamento_detalhes as AprovacaoPendente['pagamento_detalhes']
          delete (a as Record<string, unknown>)._pagamento_detalhes

          return {
            ...a,
            requisicao_id: a.entidade_id,
            tipo_aprovacao: a.tipo_aprovacao || 'requisicao_compra',
            modulo: a.modulo || 'cmp',
            requisicao,
            cotacao_resumo: cotMap.get(a.entidade_id) ?? undefined,
            minuta_resumo: minutaResumo ?? undefined,
            pagamento_detalhes: pagamentoDetalhes ?? undefined,
          } as unknown as AprovacaoPendente
        })
        .filter((a): a is AprovacaoPendente => a !== null)
    },
    refetchInterval: 15_000,
    refetchOnMount: 'always',
    retry: 1,
    staleTime: 10_000,
  })
}

// ── Historico de Aprovacoes ────────────────────────────────────────────────────

export interface HistoricoFiltros {
  tipo?: TipoAprovacao | TipoAprovacao[]
  periodo?: '7d' | '30d' | '90d' | 'todos'
  decisao?: 'aprovada' | 'rejeitada'
}

export function useHistoricoAprovacoes(filtros?: HistoricoFiltros) {
  return useQuery<AprovacaoHistorico[]>({
    queryKey: ['aprovacoes-historico', filtros],
    queryFn: async () => {
      let query = supabase
        .from(TABLE_APR)
        .select('id, modulo, tipo_aprovacao, entidade_id, entidade_numero, aprovador_nome, aprovador_email, nivel, status, observacao, data_decisao, created_at')
        .neq('status', 'pendente')
        .order('data_decisao', { ascending: false })
        .limit(200)

      // Filtro por tipo(s)
      if (filtros?.tipo) {
        if (Array.isArray(filtros.tipo)) {
          if (filtros.tipo.length > 0) {
            query = query.in('tipo_aprovacao', filtros.tipo)
          }
        } else {
          query = query.eq('tipo_aprovacao', filtros.tipo)
        }
      }

      // Filtro por decisao
      if (filtros?.decisao) {
        query = query.eq('status', filtros.decisao)
      }

      // Filtro por periodo
      if (filtros?.periodo && filtros.periodo !== 'todos') {
        const days = filtros.periodo === '7d' ? 7 : filtros.periodo === '30d' ? 30 : 90
        const since = new Date()
        since.setDate(since.getDate() - days)
        query = query.gte('created_at', since.toISOString())
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []).map(d => ({
        ...d,
        tipo_aprovacao: d.tipo_aprovacao || 'requisicao_compra',
      })) as AprovacaoHistorico[]
    },
    staleTime: 30_000,
    retry: 1,
  })
}

// ── KPIs de Aprovacoes ─────────────────────────────────────────────────────────

export interface AprovacaoKPIs {
  totalPendentes: number
  aprovadasHoje: number
  rejeitadasHoje: number
  tempoMedioHoras: number
}

export function useAprovacaoKPIs() {
  return useQuery<AprovacaoKPIs>({
    queryKey: ['aprovacoes-kpis'],
    queryFn: async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString()

      // Pendentes
      const { count: totalPendentes } = await supabase
        .from(TABLE_APR)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente')

      // Aprovadas hoje
      const { count: aprovadasHoje } = await supabase
        .from(TABLE_APR)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'aprovada')
        .gte('data_decisao', todayISO)

      // Rejeitadas hoje
      const { count: rejeitadasHoje } = await supabase
        .from(TABLE_APR)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'rejeitada')
        .gte('data_decisao', todayISO)

      // Tempo medio: ultimas 50 aprovacoes com data_decisao
      const { data: recentes } = await supabase
        .from(TABLE_APR)
        .select('created_at, data_decisao')
        .neq('status', 'pendente')
        .not('data_decisao', 'is', null)
        .order('data_decisao', { ascending: false })
        .limit(50)

      let tempoMedioHoras = 0
      if (recentes && recentes.length > 0) {
        const diffs = recentes
          .filter(r => r.data_decisao && r.created_at)
          .map(r => new Date(r.data_decisao!).getTime() - new Date(r.created_at).getTime())
          .filter(d => d > 0)
        if (diffs.length > 0) {
          tempoMedioHoras = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length / 3600000 * 10) / 10
        }
      }

      return {
        totalPendentes: totalPendentes ?? 0,
        aprovadasHoje: aprovadasHoje ?? 0,
        rejeitadasHoje: rejeitadasHoje ?? 0,
        tempoMedioHoras,
      }
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

// ── Processar aprovacao via token (link externo) ──────────────────────────────

export function useProcessarAprovacaoAi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { token: string; decisao: 'aprovada' | 'rejeitada'; observacao?: string }) =>
      api.processarAprovacao(vars.token, vars.decisao, vars.observacao),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-historico'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-kpis'] })
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ── Decisao generica (admin): cotacao, autorizacao_pagamento, minuta_contratual ──

export interface DecisaoGenericaPayload {
  aprovacaoId: string
  entidadeId: string
  entidadeNumero?: string
  tipoAprovacao: TipoAprovacao
  modulo: string
  nivel: number
  decisao: 'aprovada' | 'rejeitada'
  observacao?: string
  aprovadorNome: string
  aprovadorEmail: string
}

export function useDecisaoGenerica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: DecisaoGenericaPayload) => {
      const {
        aprovacaoId, entidadeId, tipoAprovacao, decisao, observacao, aprovadorNome,
      } = payload

      // 1. Update the specific aprovacao record
      const { error: updateError } = await supabase
        .from(TABLE_APR)
        .update({
          status: decisao,
          observacao: observacao || null,
          data_decisao: new Date().toISOString(),
        })
        .eq('id', aprovacaoId)

      if (updateError) throw updateError

      // 2. Also resolve any other pending aprovacoes for the same entity
      await supabase
        .from(TABLE_APR)
        .update({
          status: decisao,
          data_decisao: new Date().toISOString(),
        })
        .eq('entidade_id', entidadeId)
        .eq('status', 'pendente')
        .neq('id', aprovacaoId)

      // 3. Atualizar entidade fonte conforme tipo de aprovacao
      try {
        if (tipoAprovacao === 'minuta_contratual') {
          // Avanca etapa da solicitacao de contrato
          const nextEtapa = decisao === 'aprovada' ? 'enviar_assinatura' : 'preparar_minuta'
          await supabase
            .from('con_solicitacoes')
            .update({
              etapa_atual: nextEtapa,
              status: decisao === 'rejeitada' ? 'em_andamento' : 'em_andamento',
              updated_at: new Date().toISOString(),
            })
            .eq('id', entidadeId)

          // Registra historico
          await supabase
            .from('con_solicitacao_historico')
            .insert({
              solicitacao_id: entidadeId,
              etapa_de: 'aprovacao_diretoria',
              etapa_para: nextEtapa,
              observacao: decisao === 'aprovada'
                ? `Aprovado por ${aprovadorNome}`
                : `Rejeitado por ${aprovadorNome}: ${observacao ?? ''}`,
            })
        } else if (tipoAprovacao === 'autorizacao_pagamento') {
          // Atualiza status da CP
          if (decisao === 'aprovada') {
            await supabase
              .from('fin_contas_pagar')
              .update({
                status: 'aprovado_pgto',
                aprovado_por: aprovadorNome,
                aprovado_em: new Date().toISOString(),
              })
              .eq('id', entidadeId)
          } else {
            await supabase
              .from('fin_contas_pagar')
              .update({ status: 'cancelado' })
              .eq('id', entidadeId)
          }
        }
      } catch (e) {
        console.warn('Aviso: entidade fonte nao atualizada:', e)
      }

      return { decisao }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-historico'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-kpis'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['con-solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['con-solicitacoes-dashboard'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}

// ── Decisao centralizada (admin): atualiza RC + cria registro apr_aprovacoes ──

export interface DecisaoPayload {
  requisicaoId: string
  decisao: 'aprovada' | 'rejeitada' | 'esclarecimento'
  observacao?: string
  requisicaoNumero: string
  alcadaNivel: number
  aprovadorNome: string
  aprovadorEmail: string
  categoria?: string       // para resolver comprador automaticamente
  currentStatus?: string   // para decisao contextual (tecnica vs financeira)
}

export function useDecisaoRequisicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: DecisaoPayload) => {
      const {
        requisicaoId, decisao, observacao,
        requisicaoNumero, alcadaNivel, aprovadorNome, aprovadorEmail,
        categoria, currentStatus,
      } = payload

      // 1. Update cmp_requisicoes status
      const updates: Record<string, unknown> = {}
      const isFinancialApproval = currentStatus === 'cotacao_enviada'

      if (decisao === 'aprovada') {
        updates.data_aprovacao = new Date().toISOString()

        if (isFinancialApproval) {
          updates.status = 'cotacao_aprovada'
        } else {
          updates.status = 'em_cotacao'
        }
      } else if (decisao === 'rejeitada') {
        updates.status = isFinancialApproval ? 'cotacao_rejeitada' : 'rejeitada'
      } else if (decisao === 'esclarecimento') {
        updates.status = 'em_esclarecimento'
        updates.esclarecimento_msg = observacao || 'Esclarecimento solicitado'
        updates.esclarecimento_por = aprovadorNome
        updates.esclarecimento_em = new Date().toISOString()
      }

      const { error: reqError } = await supabase
        .from(TABLE_REQ)
        .update(updates)
        .eq('id', requisicaoId)

      if (reqError) throw reqError

      // 2. Create apr_aprovacoes record (audit trail + feeds AprovAi)
      const aprStatus = decisao === 'aprovada' ? 'aprovada'
                      : decisao === 'rejeitada' ? 'rejeitada'
                      : 'esclarecimento'

      const { error: aprError } = await supabase
        .from(TABLE_APR)
        .insert({
          modulo: 'cmp',
          tipo_aprovacao: 'requisicao_compra',
          entidade_id: requisicaoId,
          entidade_numero: requisicaoNumero,
          aprovador_nome: aprovadorNome,
          aprovador_email: aprovadorEmail,
          nivel: alcadaNivel,
          status: aprStatus,
          observacao: observacao || null,
          data_decisao: new Date().toISOString(),
        })

      // Non-critical: log warning but don't throw
      if (aprError) console.warn('Aviso: apr_aprovacoes nao inserido:', aprError.message)

      // 2b. Marca aprovacoes pendentes anteriores como resolvidas
      await supabase
        .from(TABLE_APR)
        .update({ status: aprStatus, data_decisao: new Date().toISOString() })
        .eq('entidade_id', requisicaoId)
        .eq('modulo', 'cmp')
        .eq('status', 'pendente')

      // 3. Auto-criar cotacao quando aprovacao tecnica e concedida
      if (decisao === 'aprovada' && !isFinancialApproval) {
        try {
          let compradorId: string | null = null
          if (categoria) {
            const { data: compradores } = await supabase
              .from('cmp_compradores')
              .select('id, categorias')
            const match = compradores?.find(
              (c: { id: string; categorias: string[] }) =>
                c.categorias?.includes(categoria)
            )
            compradorId = match?.id ?? null
          }

          const dataLimite = new Date()
          dataLimite.setDate(dataLimite.getDate() + 5)

          await supabase.from('cmp_cotacoes').insert({
            requisicao_id: requisicaoId,
            comprador_id: compradorId,
            status: 'pendente',
            data_limite: dataLimite.toISOString(),
          })
        } catch (e) {
          console.warn('Aviso: cotacao nao criada automaticamente:', e)
        }
      }

      return { decisao }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['requisicao'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-historico'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-kpis'] })
      qc.invalidateQueries({ queryKey: ['cotacoes'] })
      qc.invalidateQueries({ queryKey: ['cotacao'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
