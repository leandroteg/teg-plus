import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AprovacaoPendente, AprovacaoHistorico, TipoAprovacao } from '../types'
import { supabase } from '../services/supabase'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import type { Perfil } from '../contexts/AuthContext'
// Tabelas: apr_aprovacoes (modulo Aprovacoes -- AprovAi)
// NOTE: apr_aprovacoes.entidade_id NAO tem FK para cmp_requisicoes (design generico).
// Por isso NAO usamos PostgREST join -- fazemos duas queries separadas.
const TABLE_APR = 'apr_aprovacoes'
const TABLE_REQ = 'cmp_requisicoes'

// Mapeamento modulo apr → chave modulos do perfil
const MODULO_MAP: Record<string, string> = {
  cmp: 'compras',
  fin: 'financeiro',
  con: 'contratos',
  log: 'logistica',
  est: 'estoque',
  fro: 'frotas',
  fis: 'fiscal',
}

// Filtra aprovações baseado no perfil do usuário
function filtrarPorPermissao(
  items: AprovacaoPendente[],
  perfil: Perfil | null,
  hasModule: (mod: string) => boolean
): AprovacaoPendente[] {
  if (!perfil) return []
  // Administrador vê tudo
  const role = String(perfil.role ?? '').toLowerCase()
  const papelGlobal = String(perfil.papel_global ?? '').toLowerCase()
  if (role === 'administrador' || role === 'admin' || papelGlobal === 'ceo') return items
  // Visitante não vê nada
  if (role === 'visitante') return []

  const modulosUsuario = perfil.modulos ?? {}
  const email = perfil.email?.toLowerCase() ?? ''

  return items.filter(a => {
    const apr = a as unknown as Record<string, unknown>
    const modulo = (apr.modulo as string) ?? ''
    const aprovadorEmail = ((apr.aprovador_email as string) ?? '').toLowerCase()
    if (aprovadorEmail && aprovadorEmail === email) return true

    // Requisitante: só vê aprovações endereçadas a ele
    if (papelGlobal === 'requisitante' || papelGlobal === 'equipe' || role === 'requisitante') {
      return aprovadorEmail === email
    }

    // Gestor/Diretor: vê aprovações dos módulos que tem acesso
    const moduloKey = MODULO_MAP[modulo] ?? modulo
    if (!moduloKey) return true // sem módulo definido → mostra
    return hasModule(moduloKey) || modulosUsuario[moduloKey] === true
  })
}

// ── Aprovacoes Pendentes (multi-tipo) ──────────────────────────────────────────

export function useAprovacoesPendentes(tipo?: TipoAprovacao) {
  const { perfil, hasModule } = useAuth()
  return useQuery<AprovacaoPendente[]>({
    queryKey: ['aprovacoes-pendentes', tipo, perfil?.role, perfil?.papel_global, perfil?.email],
    queryFn: async () => {
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
        try {
          const { data: reqData } = await supabase
            .from(TABLE_REQ)
            .select('id, numero, solicitante_nome, obra_nome, descricao, valor_estimado, urgencia, status, alcada_nivel, categoria, created_at')
            .in('id', cmpIds)
          reqMap = new Map((reqData ?? []).map(r => [r.id, r]))
        } catch { /* requisicoes enrichment failed — continue without */ }
      }

      // 3. Busca dados de cotacao para cotacao_resumo (fornecedor vencedor, valor, total cotados)
      const cotMap = new Map<string, {
        fornecedor_nome: string
        valor: number
        prazo_dias: number
        total_cotados: number
      }>()

      if (cmpIds.length > 0) {
        try {
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
        } catch { /* cotacoes enrichment failed — continue without */ }
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
        try {
          const { data: conData } = await supabase
            .from('con_solicitacoes')
            .select('id, numero, objeto, contraparte_nome, valor_estimado, tipo_contrato, etapa_atual')
            .in('id', conIds)
          for (const c of conData ?? []) {
            conMap.set(c.id, c)
          }
        } catch { /* contratos enrichment failed */ }

        try {
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
        } catch { /* minutas enrichment failed */ }

        try {
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
        } catch { /* resumos enrichment failed */ }
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
      if (finIds.length > 0) {
        try {
          const { data: finData } = await supabase
            .from('fin_contas_pagar')
            .select('id, fornecedor_nome, valor_original, valor_pago, numero_documento, descricao, data_vencimento, data_emissao, centro_custo, classe_financeira, natureza, forma_pagamento, status')
            .in('id', finIds)
          for (const f of finData ?? []) {
            finMap.set(f.id, f)
          }
        } catch { /* fin_contas_pagar enrichment failed */ }

        const loteIds = finIds.filter(id => !finMap.has(id))
        if (loteIds.length > 0) {
          try {
            const { data: loteData } = await supabase
              .from('fin_lotes_pagamento')
              .select('id, numero_lote, valor_total, qtd_itens, created_at, status')
              .in('id', loteIds)
            for (const lote of loteData ?? []) {
              loteMap.set(lote.id, lote)
            }
          } catch { /* lotes enrichment failed */ }

          let loteItens: Record<string, unknown>[] = []
          const rcMap = new Map<string, Record<string, unknown>>()
          const pedAnexosMap = new Map<string, Record<string, unknown>[]>()
          const docMap = new Map<string, Record<string, unknown>[]>()

          try {
            const { data: loteItensData } = await supabase
              .from('fin_lote_itens')
              .select(`
                id,
                lote_id,
                decisao,
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
                  pedido_id
                )
              `)
              .in('lote_id', loteIds)
            loteItens = (loteItensData ?? []) as Record<string, unknown>[]
          } catch { /* fin_lote_itens enrichment failed */ }

          if (loteItens.length > 0) {
            // 5b. Buscar dados de requisição para cada CP
            const cpIds = loteItens
              .map(item => (item.cp as Record<string, unknown> | null)?.id as string)
              .filter(Boolean)
            const reqIds = loteItens
              .map(item => (item.cp as Record<string, unknown> | null)?.requisicao_id as string)
              .filter(Boolean)
            const pedidoIds = loteItens
              .map(item => (item.cp as Record<string, unknown> | null)?.pedido_id as string)
              .filter(Boolean)

            // Map: requisicao_id -> { numero, descricao, justificativa, solicitante_nome }
            if (reqIds.length > 0) {
              try {
                const { data: rcData } = await supabase
                  .from('cmp_requisicoes')
                  .select('id, numero, descricao, justificativa, solicitante_nome')
                  .in('id', [...new Set(reqIds)])
                for (const rc of rcData ?? []) rcMap.set(rc.id, rc)
              } catch { /* requisicoes for lote enrichment failed */ }
            }

            // Map: pedido_id -> anexos[]
            if (pedidoIds.length > 0) {
              try {
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
              } catch { /* pedidos anexos enrichment failed */ }
            }

            // Map: cp_id -> fin_documentos[]
            if (cpIds.length > 0) {
              try {
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
              } catch { /* fin_documentos enrichment failed */ }
            }
          }

          for (const item of loteItens) {
            const loteId = item.lote_id as string | undefined
            if (!loteId) continue
            const current = loteItensMap.get(loteId) ?? []
            current.push(item)
            loteItensMap.set(loteId, current)
          }
        }
      }

      // 5b. Busca dados de transporte (aprovacao_transporte)
      // entidade_id pode apontar para log_solicitacoes (individual) ou log_viagens (consolidada)
      const logIds = aprData
        .filter(a => a.tipo_aprovacao === 'aprovacao_transporte')
        .map(a => a.entidade_id)
        .filter(Boolean)

      const logMap = new Map<string, Record<string, unknown>>()
      const viagemMap = new Map<string, Record<string, unknown>>()
      const viagemSolsMap = new Map<string, Record<string, unknown>[]>()

      if (logIds.length > 0) {
        try {
          // Tenta buscar como solicitações individuais
          const { data: logData } = await supabase
            .from('log_solicitacoes')
            .select('id, numero, tipo, origem, destino, data_desejada, data_prevista_saida, modal, motorista_nome, motorista_telefone, veiculo_placa, custo_estimado, descricao, solicitante_nome, obra_nome, centro_custo, oc_numero, urgente, justificativa_urgencia, peso_total_kg, volumes_total, carga_especial, observacoes_carga, distancia_km, tempo_estimado_h, viagem_id, restricoes_seguranca')
            .in('id', logIds)
          for (const l of logData ?? []) {
            logMap.set(l.id, l)
          }
        } catch { /* sol enrichment failed */ }

        // IDs não encontrados em log_solicitacoes → podem ser viagens
        const notFoundIds = logIds.filter(id => !logMap.has(id))
        if (notFoundIds.length > 0) {
          try {
            const { data: viagemData } = await supabase
              .from('log_viagens')
              .select('id, numero, status, modal, veiculo_placa, motorista_nome, motorista_telefone, origem_principal, destino_final, distancia_total_km, tempo_estimado_h, qtd_paradas, custo_total, data_prevista_saida, criado_em')
              .in('id', notFoundIds)
            for (const v of viagemData ?? []) {
              viagemMap.set(v.id, v)
            }

            // Buscar solicitações vinculadas a cada viagem (com todos os detalhes relevantes)
            if (viagemData && viagemData.length > 0) {
              const vIds = viagemData.map(v => v.id)
              const { data: solsData } = await supabase
                .from('log_solicitacoes')
                .select('id, numero, tipo, origem, destino, obra_nome, centro_custo, solicitante_nome, descricao, urgente, peso_total_kg, volumes_total, data_desejada, viagem_id, ordem_na_viagem, custo_rateado, distancia_km, tempo_estimado_h, carga_especial, observacoes_carga, oc_numero')
                .in('viagem_id', vIds)
                .order('ordem_na_viagem', { ascending: true })
              for (const s of solsData ?? []) {
                const vId = s.viagem_id as string
                const arr = viagemSolsMap.get(vId) || []
                arr.push(s)
                viagemSolsMap.set(vId, arr)
              }
            }
          } catch { /* viagem enrichment failed */ }
        }
      }

      const despIds = aprData
        .filter(a => a.tipo_aprovacao === 'solicitacao_adiantamento')
        .map(a => a.entidade_id)
        .filter(Boolean)

      const despMap = new Map<string, Record<string, unknown>>()
      if (despIds.length > 0) {
        try {
          const { data: despData } = await supabase
            .from('desp_adiantamentos')
            .select('id, numero, solicitante_nome, favorecido_nome, centro_custo, finalidade, justificativa, valor_solicitado, data_limite_prestacao, status, created_at')
            .in('id', despIds)
          for (const item of despData ?? []) {
            despMap.set(item.id, item)
          }
        } catch { /* despesas enrichment failed */ }
      }

      // 6. Mescla aprovacoes com dados da requisicao/contrato/CP + cotacao
      const result = aprData
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
          } else if (a.tipo_aprovacao === 'solicitacao_adiantamento') {
            const desp = despMap.get(a.entidade_id)
            requisicao = {
              id: a.entidade_id,
              numero: (desp?.numero as string) ?? a.entidade_numero ?? 'N/A',
              solicitante_nome: (desp?.solicitante_nome as string) ?? '',
              obra_nome: (desp?.centro_custo as string) ?? '',
              descricao: (desp?.finalidade as string) ?? 'Solicitação de adiantamento',
              justificativa: (desp?.justificativa as string) ?? undefined,
              valor_estimado: Number(desp?.valor_solicitado ?? 0),
              urgencia: 'normal',
              status: 'em_aprovacao',
              alcada_nivel: a.nivel,
              created_at: (desp?.created_at as string) ?? a.created_at,
            }
          } else if (a.tipo_aprovacao === 'aprovacao_transporte') {
            const log = logMap.get(a.entidade_id)
            const viagem = viagemMap.get(a.entidade_id)
            const viagemSols = viagemSolsMap.get(a.entidade_id)

            if (viagem) {
              // Aprovação de viagem (consolidada — múltiplas solicitações)
              const sols = viagemSols ?? []
              const pesoTotal = sols.reduce((acc, s) => acc + ((s.peso_total_kg as number) || 0), 0)
              const volumesTotal = sols.reduce((acc, s) => acc + ((s.volumes_total as number) || 0), 0)
              const temCargaEspecial = sols.some(s => s.carga_especial)
              const obrasUnicas = [...new Set(sols.map(s => s.obra_nome).filter(Boolean))]

              requisicao = {
                id: a.entidade_id,
                numero: (viagem.numero as string) ?? a.entidade_numero ?? 'N/A',
                solicitante_nome: '',
                obra_nome: obrasUnicas.join(', '),
                descricao: `Viagem ${(viagem.numero as string)}: ${(viagem.origem_principal as string) ?? ''} → ${(viagem.destino_final as string) ?? ''} (${(viagem.qtd_paradas as number) ?? 0} paradas)`,
                valor_estimado: (viagem.custo_total as number) ?? 0,
                urgencia: sols.some(s => s.urgente) ? 'critica' : 'normal',
                status: 'em_aprovacao',
                alcada_nivel: a.nivel,
                created_at: a.created_at,
              }
              ;(a as Record<string, unknown>)._transporte_detalhes = {
                origem: (viagem.origem_principal as string) ?? '',
                destino: (viagem.destino_final as string) ?? '',
                tipo: 'viagem',
                data_desejada: (viagem.data_prevista_saida as string) ?? undefined,
                modal: (viagem.modal as string) ?? undefined,
                motorista_nome: (viagem.motorista_nome as string) ?? undefined,
                motorista_telefone: (viagem.motorista_telefone as string) ?? undefined,
                veiculo_placa: (viagem.veiculo_placa as string) ?? undefined,
                custo_estimado: (viagem.custo_total as number) ?? undefined,
                urgente: sols.some(s => s.urgente),
                peso_total_kg: pesoTotal || undefined,
                volumes_total: volumesTotal || undefined,
                carga_especial: temCargaEspecial,
                // Campos extras de viagem
                is_viagem: true,
                viagem_numero: (viagem.numero as string) ?? '',
                qtd_paradas: (viagem.qtd_paradas as number) ?? 0,
                distancia_total_km: (viagem.distancia_total_km as number) ?? undefined,
                tempo_estimado_h: (viagem.tempo_estimado_h as number) ?? undefined,
                solicitacoes: sols,
              }
            } else if (log) {
              // Aprovação individual (solicitação solo, sem viagem)
              requisicao = {
                id: a.entidade_id,
                numero: (log.numero as string) ?? a.entidade_numero ?? 'N/A',
                solicitante_nome: (log.solicitante_nome as string) ?? '',
                obra_nome: (log.obra_nome as string) ?? '',
                descricao: `Transporte: ${(log.origem as string) ?? ''} → ${(log.destino as string) ?? ''}`,
                valor_estimado: (log.custo_estimado as number) ?? 0,
                urgencia: (log.urgente as boolean) ? 'critica' : 'normal',
                status: 'em_aprovacao',
                alcada_nivel: a.nivel,
                created_at: a.created_at,
              }
              ;(a as Record<string, unknown>)._transporte_detalhes = {
                origem: (log.origem as string) ?? '',
                destino: (log.destino as string) ?? '',
                tipo: (log.tipo as string) ?? '',
                data_desejada: (log.data_prevista_saida as string) ?? (log.data_desejada as string) ?? undefined,
                modal: (log.modal as string) ?? undefined,
                motorista_nome: (log.motorista_nome as string) ?? undefined,
                motorista_telefone: (log.motorista_telefone as string) ?? undefined,
                veiculo_placa: (log.veiculo_placa as string) ?? undefined,
                custo_estimado: (log.custo_estimado as number) ?? undefined,
                descricao: (log.descricao as string) ?? undefined,
                solicitante_nome: (log.solicitante_nome as string) ?? undefined,
                obra_nome: (log.obra_nome as string) ?? undefined,
                centro_custo: (log.centro_custo as string) ?? undefined,
                oc_numero: (log.oc_numero as string) ?? undefined,
                urgente: (log.urgente as boolean) ?? undefined,
                justificativa_urgencia: (log.justificativa_urgencia as string) ?? undefined,
                peso_total_kg: (log.peso_total_kg as number) ?? undefined,
                volumes_total: (log.volumes_total as number) ?? undefined,
                carga_especial: (log.carga_especial as boolean) ?? undefined,
                observacoes_carga: (log.observacoes_carga as string) ?? undefined,
                restricoes_seguranca: (log.restricoes_seguranca as string) ?? undefined,
                distancia_total_km: (log.distancia_km as number) ?? undefined,
                tempo_estimado_h: (log.tempo_estimado_h as number) ?? undefined,
                is_viagem: false,
              }
            } else {
              requisicao = {
                id: a.entidade_id,
                numero: a.entidade_numero ?? 'N/A',
                solicitante_nome: '',
                obra_nome: '',
                descricao: `Transporte ${a.entidade_numero ?? ''}`,
                valor_estimado: 0,
                urgencia: 'normal',
                status: 'em_aprovacao',
                alcada_nivel: a.nivel,
                created_at: a.created_at,
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
          const transporteDetalhes = (a as Record<string, unknown>)._transporte_detalhes as AprovacaoPendente['transporte_detalhes']
          delete (a as Record<string, unknown>)._transporte_detalhes

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
            transporte_detalhes: transporteDetalhes ?? undefined,
          } as unknown as AprovacaoPendente
        })
        .filter((a): a is AprovacaoPendente => a !== null)

      // Filtra por permissão do usuário logado
      return filtrarPorPermissao(result, perfil, hasModule)
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

      // Pendentes (try-catch para 503 intermitentes)
      let totalPendentes = 0
      let aprovadasHoje = 0
      let rejeitadasHoje = 0
      try {
        const [pend, aprov, rej] = await Promise.all([
          supabase.from(TABLE_APR).select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
          supabase.from(TABLE_APR).select('id', { count: 'exact', head: true }).eq('status', 'aprovada').gte('data_decisao', todayISO),
          supabase.from(TABLE_APR).select('id', { count: 'exact', head: true }).eq('status', 'rejeitada').gte('data_decisao', todayISO),
        ])
        totalPendentes = pend.count ?? 0
        aprovadasHoje = aprov.count ?? 0
        rejeitadasHoje = rej.count ?? 0
      } catch { /* silent — KPIs are non-critical */ }

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
        } else if (tipoAprovacao === 'solicitacao_adiantamento') {
          const now = new Date().toISOString()
          const hoje = new Date().toISOString().split('T')[0]

          if (decisao === 'aprovada') {
            const { data: adiantamento } = await supabase
              .from('desp_adiantamentos')
              .select('id, numero, solicitante_nome, favorecido_nome, centro_custo, classe_financeira, valor_solicitado, finalidade, justificativa, fin_conta_pagar_id')
              .eq('id', entidadeId)
              .maybeSingle()

            let contaPagarId = (adiantamento?.fin_conta_pagar_id as string | null) ?? null

            if (!contaPagarId) {
              const { data: cp, error: cpError } = await supabase
                .from('fin_contas_pagar')
                .insert({
                  fornecedor_nome: (adiantamento?.favorecido_nome as string) ?? 'Colaborador',
                  origem: 'manual',
                  valor_original: Number(adiantamento?.valor_solicitado ?? 0),
                  valor_pago: 0,
                  data_emissao: hoje,
                  data_vencimento: hoje,
                  data_vencimento_orig: hoje,
                  centro_custo: (adiantamento?.centro_custo as string) ?? null,
                  classe_financeira: (adiantamento?.classe_financeira as string) ?? null,
                  natureza: 'adiantamento_colaborador',
                  numero_documento: (adiantamento?.numero as string) ?? entidadeId,
                  status: 'confirmado',
                  descricao: `Adiantamento - ${(adiantamento?.finalidade as string) ?? ''}`.trim(),
                  observacoes: [
                    'Adiantamento de despesas aprovado pelo gestor.',
                    adiantamento?.solicitante_nome ? `Solicitante: ${adiantamento.solicitante_nome as string}` : null,
                    adiantamento?.justificativa ? `Justificativa: ${adiantamento.justificativa as string}` : null,
                  ].filter(Boolean).join(' | '),
                })
                .select('id')
                .single()

              if (cpError) throw cpError
              contaPagarId = cp?.id ?? null
            }

            await supabase
              .from('desp_adiantamentos')
              .update({
                status: 'aprovado',
                valor_aprovado: Number(adiantamento?.valor_solicitado ?? 0),
                fin_conta_pagar_id: contaPagarId,
                aprovado_por: aprovadorNome,
                aprovado_em: now,
                updated_at: now,
              })
              .eq('id', entidadeId)
          } else {
            await supabase
              .from('desp_adiantamentos')
              .update({
                status: 'rejeitado',
                updated_at: now,
              })
              .eq('id', entidadeId)
          }
        } else if (tipoAprovacao === 'aprovacao_transporte') {
          const now = new Date().toISOString()

          // Detectar se entidade_id é uma viagem ou solicitação individual
          const { data: viagemCheck } = await supabase
            .from('log_viagens')
            .select('id')
            .eq('id', entidadeId)
            .maybeSingle()

          if (viagemCheck) {
            // Aprovação de viagem → atualizar viagem + todas as solicitações vinculadas
            if (decisao === 'aprovada') {
              await supabase.from('log_viagens').update({
                status: 'aprovada', aprovado_por: aprovadorNome, aprovado_em: now, updated_at: now,
              }).eq('id', entidadeId)
              await supabase.from('log_solicitacoes').update({
                status: 'aprovado', aprovado_por: aprovadorNome, aprovado_em: now, updated_at: now,
              }).eq('viagem_id', entidadeId)
            } else if (decisao === 'rejeitada') {
              await supabase.from('log_viagens').update({
                status: 'cancelada', updated_at: now,
              }).eq('id', entidadeId)
              await supabase.from('log_solicitacoes').update({
                status: 'recusado', motivo_reprovacao: observacao || 'Reprovado', updated_at: now,
              }).eq('viagem_id', entidadeId)
            } else {
              // Esclarecimento → volta viagem e solicitações para planejada/planejado
              await supabase.from('log_viagens').update({
                status: 'planejada', updated_at: now,
              }).eq('id', entidadeId)
              await supabase.from('log_solicitacoes').update({
                status: 'planejado', updated_at: now,
              }).eq('viagem_id', entidadeId)
            }
          } else {
            // Aprovação individual (solicitação solo)
            if (decisao === 'aprovada') {
              await supabase.from('log_solicitacoes').update({
                status: 'aprovado', aprovado_por: aprovadorNome, aprovado_em: now, updated_at: now,
              }).eq('id', entidadeId)
            } else if (decisao === 'rejeitada') {
              await supabase.from('log_solicitacoes').update({
                status: 'recusado', motivo_reprovacao: observacao || 'Reprovado', updated_at: now,
              }).eq('id', entidadeId)
            } else {
              await supabase.from('log_solicitacoes').update({
                status: 'planejado', updated_at: now,
              }).eq('id', entidadeId)
            }
          }
        } else if (tipoAprovacao === 'cotacao') {
          // Avanca status da requisicao de cotacao_enviada → cotacao_aprovada/rejeitada
          if (decisao === 'aprovada') {
            await supabase
              .from('cmp_requisicoes')
              .update({ status: 'cotacao_aprovada' })
              .eq('id', entidadeId)
          } else if (decisao === 'rejeitada') {
            await supabase
              .from('cmp_requisicoes')
              .update({ status: 'cotacao_rejeitada' })
              .eq('id', entidadeId)
          } else {
            // esclarecimento
            await supabase
              .from('cmp_requisicoes')
              .update({ status: 'em_esclarecimento' })
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
      qc.invalidateQueries({ queryKey: ['despesas-adiantamentos'] })
      qc.invalidateQueries({ queryKey: ['lotes-pagamento'] })
      qc.invalidateQueries({ queryKey: ['lote-detalhe'] })
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['log_viagens'] })
      qc.invalidateQueries({ queryKey: ['cotacoes'] })
      qc.invalidateQueries({ queryKey: ['cotacao'] })
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['requisicao'] })
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
