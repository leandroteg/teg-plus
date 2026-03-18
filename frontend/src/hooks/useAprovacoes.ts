import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AprovacaoPendente, AprovacaoHistorico, TipoAprovacao, CotacaoFornecedor, ItemSelecionado } from '../types'
import { supabase } from '../services/supabase'
import { api } from '../services/api'
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
      try {
      // Aprovações de pagamento são criadas APENAS via Lotes (useEnviarLoteAprovacao)
      // Não há mais sync automático de CPs individuais.

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
        cotacao_id?: string
        fornecedores?: CotacaoFornecedor[]
      }>()

      if (cmpIds.length > 0) {
        const { data: cotData } = await supabase
          .from('cmp_cotacoes')
          .select('id, requisicao_id, fornecedor_selecionado_nome, valor_selecionado, fornecedores:cmp_cotacao_fornecedores!cotacao_id(*)')
          .in('requisicao_id', cmpIds)
          .eq('status', 'concluida')

        for (const c of cotData ?? []) {
          const cot = c as Record<string, unknown>
          const fornecedores = (cot.fornecedores ?? []) as CotacaoFornecedor[]
          const selecionado = fornecedores.find(f => f.selecionado) ?? fornecedores[0]
          cotMap.set(cot.requisicao_id as string, {
            fornecedor_nome: (cot.fornecedor_selecionado_nome as string) ?? 'N/A',
            valor: (cot.valor_selecionado as number) ?? 0,
            prazo_dias: selecionado?.prazo_entrega_dias ?? 0,
            total_cotados: fornecedores.length,
            cotacao_id: cot.id as string,
            fornecedores,
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
      const resumoMap = new Map<string, Record<string, unknown>>()
      if (conIds.length > 0) {
        const { data: conData } = await supabase
          .from('con_solicitacoes')
          .select('id, numero, objeto, contraparte_nome, valor_estimado, tipo_contrato, etapa_atual')
          .in('id', conIds)
        for (const c of conData ?? []) {
          conMap.set(c.id, c)
        }

        // Busca minuta mais recente de cada solicitacao (com PDF)
        const { data: minutaData } = await supabase
          .from('con_minutas')
          .select('id, solicitacao_id, titulo, arquivo_url, arquivo_nome, status')
          .in('solicitacao_id', conIds)
          .order('created_at', { ascending: false })
        for (const m of minutaData ?? []) {
          // Guarda apenas a mais recente por solicitacao
          if (!minutaMap.has(m.solicitacao_id)) {
            minutaMap.set(m.solicitacao_id, m)
          }
        }

        // Busca resumo executivo mais recente de cada solicitacao
        // Issue #44: aprovacao deve exibir o resumo executivo, nao a analise antiga da minuta
        const { data: resumoData } = await supabase
          .from('con_resumos_executivos')
          .select('id, solicitacao_id, titulo, objeto_resumo, partes_envolvidas, valor_total, vigencia, riscos, oportunidades, recomendacao, status')
          .in('solicitacao_id', conIds)
          .order('created_at', { ascending: false })
        for (const r of resumoData ?? []) {
          if (!resumoMap.has(r.solicitacao_id as string)) {
            resumoMap.set(r.solicitacao_id as string, r)
          }
        }
      }

      // 5. Busca dados de financeiro (autorizacao_pagamento)
      const finIds = aprData
        .filter(a => a.tipo_aprovacao === 'autorizacao_pagamento')
        .map(a => a.entidade_id)
        .filter(Boolean)

      const finMap = new Map<string, Record<string, unknown>>()
      const loteMap = new Map<string, Record<string, unknown>>()
      const loteItensMap = new Map<string, Record<string, unknown>[]>()
      const rcMap = new Map<string, Record<string, unknown>>()
      const pedAnexosMap = new Map<string, Record<string, unknown>[]>()
      const docMap = new Map<string, Record<string, unknown>[]>()
      const pedMap = new Map<string, Record<string, unknown>>()
      const cotMap2 = new Map<string, Record<string, unknown>>()
      const aprByEntity = new Map<string, Record<string, unknown>[]>()
      if (finIds.length > 0) {
        const { data: finData } = await supabase
          .from('fin_contas_pagar')
          .select('id, fornecedor_nome, valor_original, valor_pago, numero_documento, descricao, data_vencimento, data_emissao, centro_custo, classe_financeira, natureza, forma_pagamento, status')
          .in('id', finIds)
        for (const f of finData ?? []) {
          finMap.set(f.id, f)
        }

        const loteIds = finIds.filter(id => !finMap.has(id))
        if (loteIds.length > 0) {
          const { data: loteData } = await supabase
            .from('fin_lotes_pagamento')
            .select('id, numero_lote, valor_total, qtd_itens, created_at, status')
            .in('id', loteIds)
          for (const lote of loteData ?? []) {
            loteMap.set(lote.id, lote)
          }

          const { data: loteItens } = await supabase
            .from('fin_lote_itens')
            .select(`
              id,
              lote_id,
              decisao,
              decidido_por,
              decidido_em,
              observacao,
              created_at,
              cp:fin_contas_pagar!cp_id(
                id,
                fornecedor_nome,
                valor_original,
                valor_pago,
                numero_documento,
                descricao,
                data_vencimento,
                data_emissao,
                centro_custo,
                classe_financeira,
                natureza,
                forma_pagamento,
                status,
                requisicao_id,
                pedido_id,
                created_at
              )
            `)
            .in('lote_id', loteIds)

          // 5b. Buscar dados de requisição + anexos (não-crítico, falha silenciosa)
          const cpIds = (loteItens ?? [])
            .map(item => (item.cp as Record<string, unknown> | null)?.id as string)
            .filter(Boolean)
          const reqIds = (loteItens ?? [])
            .map(item => (item.cp as Record<string, unknown> | null)?.requisicao_id as string)
            .filter(Boolean)
          const pedidoIds = (loteItens ?? [])
            .map(item => (item.cp as Record<string, unknown> | null)?.pedido_id as string)
            .filter(Boolean)

          try {
            if (reqIds.length > 0) {
              const { data: rcData } = await supabase
                .from('cmp_requisicoes')
                .select('id, numero, descricao, justificativa, solicitante_nome, created_at')
                .in('id', [...new Set(reqIds)])
              for (const rc of rcData ?? []) rcMap.set(rc.id, rc)
            }
          } catch { /* requisição data is optional */ }

          try {
            if (pedidoIds.length > 0) {
              const { data: anexosData } = await supabase
                .from('cmp_pedidos_anexos')
                .select('pedido_id, nome_arquivo, url, tipo, mime_type, uploaded_at, uploaded_by_nome')
                .in('pedido_id', [...new Set(pedidoIds)])
              for (const a of anexosData ?? []) {
                const pid = a.pedido_id as string
                const arr = pedAnexosMap.get(pid) ?? []
                arr.push(a)
                pedAnexosMap.set(pid, arr)
              }
            }
          } catch { /* anexos data is optional */ }

          try {
            if (cpIds.length > 0) {
              const { data: docsData } = await supabase
                .from('fin_documentos')
                .select('entity_id, nome_arquivo, arquivo_url, tipo, mime_type, uploaded_at')
                .eq('entity_type', 'cp')
                .in('entity_id', [...new Set(cpIds)])
              for (const d of docsData ?? []) {
                const eid = d.entity_id as string
                const arr = docMap.get(eid) ?? []
                arr.push(d)
                docMap.set(eid, arr)
              }
            }
          } catch { /* docs data is optional */ }

          // Fetch timeline data
          try {
            if (pedidoIds.length > 0) {
              const { data: pedData } = await supabase
                .from('cmp_pedidos')
                .select('id, numero_pedido, created_at, status, fornecedor_nome')
                .in('id', [...new Set(pedidoIds)])
              for (const p of pedData ?? []) pedMap.set(p.id, p)
            }
          } catch { /* optional */ }

          try {
            if (reqIds.length > 0) {
              const { data: cotData } = await supabase
                .from('cmp_cotacoes')
                .select('id, requisicao_id, status, data_conclusao, fornecedor_selecionado_nome, valor_selecionado')
                .in('requisicao_id', [...new Set(reqIds)])
              for (const c of cotData ?? []) cotMap2.set(c.requisicao_id as string, c)
            }
          } catch { /* optional */ }

          try {
            const allEntityIds = [...new Set([...reqIds, ...loteIds])]
            if (allEntityIds.length > 0) {
              const { data: aprHistData } = await supabase
                .from('apr_aprovacoes')
                .select('entidade_id, tipo_aprovacao, aprovador_nome, status, data_decisao, observacao, nivel, created_at')
                .in('entidade_id', allEntityIds)
                .neq('status', 'pendente')
              for (const a of aprHistData ?? []) {
                const eid = a.entidade_id as string
                const arr = aprByEntity.get(eid) ?? []
                arr.push(a)
                aprByEntity.set(eid, arr)
              }
            }
          } catch { /* optional */ }

          for (const item of loteItens ?? []) {
            const loteId = item.lote_id as string | undefined
            if (!loteId) continue
            const current = loteItensMap.get(loteId) ?? []
            current.push(item as Record<string, unknown>)
            loteItensMap.set(loteId, current)
          }
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
            const resumoExec = resumoMap.get(a.entidade_id)

            // Issue #44: Usar resumo executivo (nao analise antiga da minuta)
            // Issue #43: Formatar como texto estruturado com secoes claras
            let aiResumo: string | null = null
            if (resumoExec) {
              const sections: string[] = []
              if (resumoExec.objeto_resumo) {
                sections.push(`OBJETO\n${resumoExec.objeto_resumo as string}`)
              }
              const partes = resumoExec.partes_envolvidas as string | null
              if (partes) {
                sections.push(`PARTES ENVOLVIDAS\n${partes}`)
              }
              const vigencia = resumoExec.vigencia as string | null
              if (vigencia) {
                sections.push(`VIGENCIA\n${vigencia}`)
              }
              const riscos = resumoExec.riscos as Array<{ descricao: string; nivel?: string }> | null
              if (riscos && riscos.length > 0) {
                sections.push(`RISCOS\n${riscos.map(r => `• [${(r.nivel ?? 'medio').toUpperCase()}] ${r.descricao}`).join('\n')}`)
              }
              const oportunidades = resumoExec.oportunidades as Array<{ descricao: string }> | null
              if (oportunidades && oportunidades.length > 0) {
                sections.push(`OPORTUNIDADES\n${oportunidades.map(o => `• ${o.descricao}`).join('\n')}`)
              }
              if (resumoExec.recomendacao) {
                sections.push(`RECOMENDACAO\n${resumoExec.recomendacao as string}`)
              }
              aiResumo = sections.join('\n\n') || null
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
            // Usa dados do resumo executivo quando disponivel, com fallback para dados da solicitacao
            const resumoValor = resumoExec?.valor_total as number | undefined
            ;(a as Record<string, unknown>)._minuta_resumo = {
              objeto: (resumoExec?.objeto_resumo as string) ?? (con?.objeto as string) ?? '',
              contraparte: (con?.contraparte_nome as string) ?? '',
              tipo_contrato: (con?.tipo_contrato as string) ?? '',
              vigencia_inicio: '',
              vigencia_fim: '',
              valor_estimado: resumoValor ?? (Number(con?.valor_estimado) || 0),
              minuta_titulo: (resumoExec?.titulo as string) ?? (minuta?.titulo as string) ?? '',
              arquivo_url: (minuta?.arquivo_url as string) ?? '',
              arquivo_nome: (minuta?.arquivo_nome as string) ?? '',
              ai_resumo: aiResumo,
              ai_score: null,
            }
          } else if (a.tipo_aprovacao === 'autorizacao_pagamento') {
            const fin = finMap.get(a.entidade_id)
            const lote = loteMap.get(a.entidade_id)
            const loteItens = loteItensMap.get(a.entidade_id) ?? []
            const loteCps = loteItens
              .map(item => item.cp as Record<string, unknown> | null)
              .filter((cp): cp is Record<string, unknown> => !!cp)
            const fornecedores = Array.from(new Set(loteCps.map(cp => (cp.fornecedor_nome as string) || '').filter(Boolean)))
            const fornecedorResumo = fornecedores.length === 0
              ? ''
              : fornecedores.length === 1
                ? fornecedores[0]
                : `${fornecedores[0]} + ${fornecedores.length - 1}`
            requisicao = {
              id: a.entidade_id,
              numero: (lote?.numero_lote as string) ?? (fin?.numero_documento as string) ?? a.entidade_numero ?? 'N/A',
              solicitante_nome: (fin?.fornecedor_nome as string) ?? fornecedorResumo,
              obra_nome: (fin?.centro_custo as string) ?? '',
              descricao: `Autorizacao Pagamento — ${(fin?.fornecedor_nome as string) ?? ''} — ${(fin?.descricao as string) ?? ''}`,
              valor_estimado: (lote?.valor_total as number) ?? (fin?.valor_original as number) ?? 0,
              urgencia: 'normal',
              status: 'em_aprovacao',
              alcada_nivel: a.nivel,
              created_at: a.created_at,
            }
            if (lote) {
              ;(a as Record<string, unknown>)._pagamento_detalhes = {
                is_lote: true,
                lote_numero: (lote.numero_lote as string) ?? '',
                lote_data: (lote.created_at as string) ?? '',
                qtd_itens: (lote.qtd_itens as number) ?? loteItens.length,
                aprovados: loteItens.filter(item => item.decisao === 'aprovado').length,
                excluidos: loteItens.filter(item => item.decisao === 'rejeitado').length,
                resumo_fornecedores: fornecedorResumo,
                fornecedor_nome: fornecedorResumo || 'Lote de Pagamento',
                valor_original: (lote.valor_total as number) ?? 0,
                valor_pago: 0,
                numero_documento: (lote.numero_lote as string) ?? '',
                descricao: `Lote de pagamento com ${(lote.qtd_itens as number) ?? loteItens.length} itens`,
                data_vencimento: '',
                data_emissao: (lote.created_at as string) ?? '',
                centro_custo: '',
                classe_financeira: '',
                natureza: '',
                forma_pagamento: '',
                status_cp: (lote.status as string) ?? '',
                itens: loteItens.map(item => {
                  const cp = item.cp as Record<string, unknown> | null
                  const cpId = (cp?.id as string) ?? ''
                  const rcId = (cp?.requisicao_id as string) ?? ''
                  const pedId = (cp?.pedido_id as string) ?? ''
                  const rc = rcId ? rcMap.get(rcId) : undefined
                  // Merge anexos from pedido + fin_documentos
                  const pedAnexos = pedId ? (pedAnexosMap.get(pedId) ?? []) : []
                  const finDocs = cpId ? (docMap.get(cpId) ?? []) : []
                  const anexos = [
                    ...pedAnexos.map(a => ({
                      nome: (a.nome_arquivo as string) ?? '',
                      url: (a.url as string) ?? '',
                      tipo: (a.tipo as string) ?? 'outro',
                      mime_type: (a.mime_type as string) ?? '',
                    })),
                    ...finDocs.map(d => ({
                      nome: (d.nome_arquivo as string) ?? '',
                      url: (d.arquivo_url as string) ?? '',
                      tipo: (d.tipo as string) ?? 'outro',
                      mime_type: (d.mime_type as string) ?? '',
                    })),
                  ]
                  return {
                    id: cpId || (item.id as string),
                    fornecedor_nome: (cp?.fornecedor_nome as string) ?? '',
                    numero_documento: (cp?.numero_documento as string) ?? '',
                    descricao: (cp?.descricao as string) ?? '',
                    valor_original: (cp?.valor_original as number) ?? 0,
                    data_vencimento: (cp?.data_vencimento as string) ?? '',
                    decisao: (item.decisao as string) ?? 'pendente',
                    requisicao_numero: (rc?.numero as string) ?? undefined,
                    requisicao_descricao: (rc?.descricao as string) ?? undefined,
                    requisicao_justificativa: (rc?.justificativa as string) ?? undefined,
                    solicitante_nome: (rc?.solicitante_nome as string) ?? undefined,
                    anexos: anexos.length > 0 ? anexos : undefined,
                    decisao_por: (item.decidido_por as string) ?? undefined,
                    decisao_em: (item.decidido_em as string) ?? undefined,
                    decisao_obs: (item.observacao as string) ?? undefined,
                    pedido_id: pedId || undefined,
                    created_at: (item.created_at as string) ?? undefined,
                    timeline: (() => {
                      const events: { tipo: string, label: string, ator?: string, data: string, obs?: string, status?: string, nivel?: number }[] = []

                      // RC criada
                      if (rc?.created_at) events.push({ tipo: 'rc_criada', label: `RC ${(rc.numero as string) ?? ''} criada`, ator: (rc.solicitante_nome as string) ?? undefined, data: (rc.created_at as string) })

                      // Aprovações da RC (Validação Técnica) — filtrar inserts automáticos (diff < 1s)
                      const rcAprs = rcId ? (aprByEntity.get(rcId) ?? []).filter(a => {
                        if ((a.tipo_aprovacao as string) !== 'requisicao_compra') return false
                        const created = new Date(a.created_at as string).getTime()
                        const decided = new Date(a.data_decisao as string).getTime()
                        return (decided - created) > 1000 // só registros com diff > 1s (decisão real)
                      }) : []
                      for (const apr of rcAprs) events.push({ tipo: 'aprovacao', label: 'Validação Técnica', ator: (apr.aprovador_nome as string) ?? undefined, data: (apr.data_decisao as string) ?? '', status: (apr.status as string), nivel: (apr.nivel as number) })

                      // Cotação concluída
                      const cot = rcId ? cotMap2.get(rcId) : undefined
                      if (cot?.data_conclusao) events.push({ tipo: 'cotacao_aprovada', label: `Cotação concluída — ${(cot.fornecedor_selecionado_nome as string) ?? ''}`, data: (cot.data_conclusao as string) })

                      // Aprovações da cotação (Aprovação de Compra) — filtrar inserts automáticos
                      const cotAprs = rcId ? (aprByEntity.get(rcId) ?? []).filter(a => {
                        if ((a.tipo_aprovacao as string) !== 'cotacao') return false
                        const created = new Date(a.created_at as string).getTime()
                        const decided = new Date(a.data_decisao as string).getTime()
                        return (decided - created) > 1000
                      }) : []
                      for (const apr of cotAprs) events.push({ tipo: 'aprovacao', label: 'Aprovação de Compra', ator: (apr.aprovador_nome as string) ?? undefined, data: (apr.data_decisao as string) ?? '', status: (apr.status as string), nivel: (apr.nivel as number) })

                      // Pedido emitido
                      const ped = pedId ? pedMap.get(pedId) : undefined
                      if (ped?.created_at) events.push({ tipo: 'pedido_emitido', label: `Pedido ${(ped.numero_pedido as string) ?? ''} emitido`, data: (ped.created_at as string) })

                      // CP criada
                      if (cp?.created_at) events.push({ tipo: 'cp_criada', label: 'CP criada', data: (cp.created_at as string) })

                      // Incluído no lote
                      if (item.created_at) events.push({ tipo: 'lote_incluido', label: 'Incluído no lote', data: (item.created_at as string) })

                      // Decisão do item
                      if (item.decidido_por) events.push({ tipo: 'aprovacao', label: (item.decisao as string) === 'aprovado' ? 'Item aprovado' : 'Item rejeitado', ator: (item.decidido_por as string), data: (item.decidido_em as string) ?? '', obs: (item.observacao as string) ?? undefined, status: (item.decisao as string) })

                      // Sort chronologically (oldest first for timeline)
                      events.sort((a, b) => new Date(a.data || 0).getTime() - new Date(b.data || 0).getTime())
                      return events.length > 0 ? events : undefined
                    })(),
                  }
                }),
              }
            } else if (fin) {
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
            entidade_numero: loteMap.has(a.entidade_id)
              ? `${(loteMap.get(a.entidade_id)?.numero_lote as string) ?? a.entidade_numero ?? 'Lote'} • ${new Date((loteMap.get(a.entidade_id)?.created_at as string) ?? a.created_at).toLocaleDateString('pt-BR')} • ${((loteMap.get(a.entidade_id)?.valor_total as number) ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
              : a.entidade_numero,
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
      } catch (err) {
        console.error('[AprovAI] useAprovacoesPendentes error:', err)
        throw err
      }
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
  decisao: 'aprovada' | 'rejeitada' | 'esclarecimento'
  observacao?: string
  aprovadorNome: string
  aprovadorEmail: string
  selectedItemIds?: string[]
  /** Para aprovação de cotação: itens selecionados por fornecedor (aprovação parcial) */
  itens_selecionados?: ItemSelecionado[]
  /** ID da cotação — necessário para salvar itens_selecionados */
  cotacaoId?: string
}

export function useDecisaoGenerica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: DecisaoGenericaPayload) => {
      const {
        aprovacaoId, entidadeId, tipoAprovacao, decisao, observacao, aprovadorNome, selectedItemIds,
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
        if (tipoAprovacao === 'cotacao') {
          // Atualiza RC com status de cotação aprovada/rejeitada
          const novoStatus = decisao === 'aprovada' ? 'cotacao_aprovada' : 'cotacao_rejeitada'
          await supabase
            .from('cmp_requisicoes')
            .update({ status: novoStatus })
            .eq('id', entidadeId)

          // Salva itens selecionados na cotação (aprovação parcial por item)
          if (decisao === 'aprovada' && payload.itens_selecionados && payload.cotacaoId) {
            await supabase
              .from('cmp_cotacoes')
              .update({ itens_selecionados: payload.itens_selecionados })
              .eq('id', payload.cotacaoId)
          } else if (decisao === 'aprovada' && payload.itens_selecionados && !payload.cotacaoId) {
            // Fallback: busca cotação pelo requisicao_id
            const { data: cotacoes } = await supabase
              .from('cmp_cotacoes')
              .select('id')
              .eq('requisicao_id', entidadeId)
              .eq('status', 'concluida')
              .limit(1)
            if (cotacoes?.[0]?.id) {
              await supabase
                .from('cmp_cotacoes')
                .update({ itens_selecionados: payload.itens_selecionados })
                .eq('id', cotacoes[0].id)
            }
          }
        } else if (tipoAprovacao === 'minuta_contratual') {
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
          const decisionAt = new Date().toISOString()

          // Fluxo novo: a aprovacao de pagamento pode apontar para um lote.
          const { data: lote } = await supabase
            .from('fin_lotes_pagamento')
            .select('id')
            .eq('id', entidadeId)
            .maybeSingle()

          if (lote?.id) {
            if (decisao === 'esclarecimento') {
              await supabase
                .from('fin_lote_itens')
                .update({
                  decisao: 'pendente',
                  decidido_por: null,
                  decidido_em: null,
                  observacao: observacao || null,
                })
                .eq('lote_id', entidadeId)

              await supabase
                .from('fin_lotes_pagamento')
                .update({
                  status: 'montando',
                  observacao: observacao || null,
                  updated_at: decisionAt,
                })
                .eq('id', entidadeId)

              await supabase
                .from('fin_contas_pagar')
                .update({
                  status: 'em_lote',
                  updated_at: decisionAt,
                })
                .eq('lote_id', entidadeId)
                .not('status', 'in', '(cancelado,pago,conciliado)')
            } else {
              const { data: loteItens } = await supabase
                .from('fin_lote_itens')
                .select('id, cp_id, valor, decisao')
                .eq('lote_id', entidadeId)

              const itensAtuais = loteItens ?? []
              const pendingItems = itensAtuais.filter(item => item.decisao === 'pendente')
              const selectedSet = new Set(selectedItemIds ?? pendingItems.map(item => item.cp_id))

              if (decisao === 'aprovada' && pendingItems.length > 0) {
                const aprovados = pendingItems.filter(item => selectedSet.has(item.cp_id))
                const excluidos = pendingItems.filter(item => !selectedSet.has(item.cp_id))

                if (aprovados.length === 0) {
                  throw new Error('Selecione ao menos um item para aprovar o lote.')
                }

                await supabase
                  .from('fin_lote_itens')
                  .update({
                    decisao: 'aprovado',
                    decidido_por: aprovadorNome,
                    decidido_em: decisionAt,
                    observacao: observacao || null,
                  })
                  .in('id', aprovados.map(item => item.id))

                await supabase
                  .from('fin_contas_pagar')
                  .update({
                    status: 'aprovado_pgto',
                    aprovado_por: aprovadorNome,
                    aprovado_em: decisionAt,
                    updated_at: decisionAt,
                  })
                  .in('id', aprovados.map(item => item.cp_id))

                if (excluidos.length > 0) {
                  const { data: numData } = await supabase.rpc('generate_numero_lote')
                  const numeroLote = (numData as string) || `LP-${Date.now()}`
                  const valorNovoLote = excluidos.reduce((sum, item) => sum + (item.valor ?? 0), 0)

                  const { data: novoLote, error: novoLoteErr } = await supabase
                    .from('fin_lotes_pagamento')
                    .insert({
                      numero_lote: numeroLote,
                      criado_por: aprovadorNome,
                      valor_total: valorNovoLote,
                      qtd_itens: excluidos.length,
                      status: 'montando',
                      observacao: `Itens retornados da aprovação parcial do lote ${entidadeId}`,
                    })
                    .select()
                    .single()

                  if (novoLoteErr) throw novoLoteErr

                  const novosItens = excluidos.map(item => ({
                    lote_id: novoLote.id,
                    cp_id: item.cp_id,
                    valor: item.valor ?? 0,
                    decisao: 'pendente',
                  }))

                  const { error: novosItensErr } = await supabase
                    .from('fin_lote_itens')
                    .insert(novosItens)
                  if (novosItensErr) throw novosItensErr

                  await supabase
                    .from('fin_contas_pagar')
                    .update({
                      lote_id: novoLote.id,
                      status: 'em_lote',
                      updated_at: decisionAt,
                    })
                    .in('id', excluidos.map(item => item.cp_id))

                  await supabase
                    .from('fin_lote_itens')
                    .delete()
                    .in('id', excluidos.map(item => item.id))
                }

                const { data: approvedItens } = await supabase
                  .from('fin_lote_itens')
                  .select('valor')
                  .eq('lote_id', entidadeId)

                const valorAprovado = (approvedItens ?? []).reduce((sum, item) => sum + (item.valor as number ?? 0), 0)

                await supabase
                  .from('fin_lotes_pagamento')
                  .update({
                    status: 'aprovado',
                    qtd_itens: approvedItens?.length ?? aprovados.length,
                    valor_total: valorAprovado,
                    observacao: excluidos.length > 0
                      ? `Aprovação parcial por ${aprovadorNome}${observacao ? ` • ${observacao}` : ''}`
                      : observacao || null,
                    updated_at: decisionAt,
                  })
                  .eq('id', entidadeId)
              } else {
                const decisaoItem = decisao === 'aprovada' ? 'aprovado' : 'rejeitado'

                await supabase
                  .from('fin_lote_itens')
                  .update({
                    decisao: decisaoItem,
                    decidido_por: aprovadorNome,
                    decidido_em: decisionAt,
                    observacao: observacao || null,
                  })
                  .eq('lote_id', entidadeId)
                  .eq('decisao', 'pendente')

                await supabase.rpc('rpc_resolver_lote_status', { p_lote_id: entidadeId })
              }
            }

            if (decisao === 'rejeitada') {
              await supabase
                .from('fin_lotes_pagamento')
                .update({
                  status: 'cancelado',
                  updated_at: decisionAt,
                })
                .eq('id', entidadeId)
            }
          } else if (decisao === 'aprovada') {
            await supabase
              .from('fin_contas_pagar')
              .update({
                status: 'aprovado_pgto',
                aprovado_por: aprovadorNome,
                aprovado_em: decisionAt,
              })
              .eq('id', entidadeId)
          } else if (decisao === 'rejeitada') {
            await supabase
              .from('fin_contas_pagar')
              .update({ status: 'cancelado' })
              .eq('id', entidadeId)
          } else {
            await supabase
              .from('fin_contas_pagar')
              .update({
                status: 'confirmado',
                updated_at: decisionAt,
              })
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
      qc.invalidateQueries({ queryKey: ['cotacoes'] })
      qc.invalidateQueries({ queryKey: ['cotacao'] })
      qc.invalidateQueries({ queryKey: ['cotacao-req'] })
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['requisicao'] })
      qc.invalidateQueries({ queryKey: ['lotes-pagamento'] })
      qc.invalidateQueries({ queryKey: ['lote-detalhe'] })
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
