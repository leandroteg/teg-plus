/**
 * useOmieApi.ts
 * Hooks React Query para integração direta com a API Omie.
 *
 * Coberturas:
 *   - Credenciais: lê omie_app_key / omie_app_secret do sys_config
 *   - Conexão: testar API diretamente (sem n8n)
 *   - Remessas: incluir CPs no Omie, sincronizar status de pagamento
 *   - Tesouraria: contas correntes, lançamentos/extrato
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import {
  omieApi,
  toOmieDate,
  fromOmieDate,
  mapOmieStatus,
  type OmieCredentials,
  type OmieContaCorrente,
  type OmieLancamento,
} from '../lib/omieApi'

// ── Credenciais ───────────────────────────────────────────────────────────────

/** Lê APP_KEY e APP_SECRET do sys_config e os retorna como OmieCredentials */
export function useOmieCredentials() {
  return useQuery<OmieCredentials | null>({
    queryKey: ['omie-credentials'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sys_config')
        .select('chave, valor')
        .in('chave', ['omie_app_key', 'omie_app_secret', 'omie_enabled'])
      if (!data) return null
      const map: Record<string, string> = {}
      data.forEach(row => { map[row.chave] = row.valor ?? '' })
      if (map['omie_enabled'] !== 'true') return null
      const appKey = map['omie_app_key'] ?? ''
      const appSecret = map['omie_app_secret'] ?? ''
      if (!appKey || !appSecret) return null
      return { appKey, appSecret }
    },
    staleTime: 5 * 60_000,
    retry: false,
  })
}

// ── Teste de conexão direta ───────────────────────────────────────────────────

/** Testa a conexão diretamente com a API Omie (sem n8n) */
export function useOmieTestarConexao() {
  return useMutation({
    mutationFn: async (credentials: OmieCredentials) => {
      return omieApi.testarConexao(credentials)
    },
  })
}

// ── Contas Correntes (Tesouraria) ─────────────────────────────────────────────

/** Lista todas as contas correntes ativas do Omie */
export function useOmieContasCorrentes(credentials: OmieCredentials | null | undefined) {
  return useQuery<OmieContaCorrente[]>({
    queryKey: ['omie-contas-correntes'],
    queryFn: async () => {
      if (!credentials) return []
      const res = await omieApi.listarContasCorrentes(credentials, 1, 100)
      // filtra contas inativas
      return (res.lista_conta_corrente ?? []).filter(c => c.cInativa !== 'S')
    },
    enabled: !!credentials,
    staleTime: 2 * 60_000,
    retry: 1,
  })
}

/** Sincroniza o saldo de uma conta Omie com a conta bancária interna */
export function useSincronizarSaldoContaOmie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      contaInternaId,
      nCodCC,
      saldo,
    }: {
      contaInternaId: string
      nCodCC: number
      saldo: number
    }) => {
      const { error } = await supabase
        .from('fin_contas_bancarias')
        .update({
          saldo_atual: saldo,
          saldo_atualizado_em: new Date().toISOString(),
          omie_conta_id: nCodCC,
        })
        .eq('id', contaInternaId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-bancarias'] })
      qc.invalidateQueries({ queryKey: ['tesouraria-dashboard'] })
    },
  })
}

// ── Lançamentos / Extrato ─────────────────────────────────────────────────────

/** Lista lançamentos financeiros de uma conta corrente Omie */
export function useOmieLancamentos(
  credentials: OmieCredentials | null | undefined,
  opts: { nCodCC?: number; dataInicio?: string; dataFim?: string } = {},
) {
  const { nCodCC, dataInicio, dataFim } = opts
  return useQuery<OmieLancamento[]>({
    queryKey: ['omie-lancamentos', nCodCC, dataInicio, dataFim],
    queryFn: async () => {
      if (!credentials) return []
      const res = await omieApi.listarLancamentos(credentials, {
        nCodCC,
        dataInicio,
        dataFim,
        registros: 200,
      })
      return res.lancamentos ?? []
    },
    enabled: !!credentials,
    staleTime: 60_000,
    retry: 1,
  })
}

// ── Remessas: Incluir CPs no Omie ─────────────────────────────────────────────

export interface CPParaRemessa {
  id: string
  fornecedor_id: string | null
  fornecedor_nome: string
  valor_original: number
  data_vencimento: string
  data_emissao: string
  numero_documento: string | null
  descricao: string | null
  omie_cp_id?: number | null
}

export interface ResultadoRemessa {
  cpId: string
  omieId: number | null
  status: 'incluido' | 'ja_existe' | 'erro'
  mensagem?: string
}

/**
 * Envia um lote de CPs para o Omie como ContasPagar.
 * - Para cada CP, busca o código do fornecedor no Omie (via omie_fornecedor_id salvo no cmp_fornecedores)
 * - Chama IncluirContaPagar na Omie API
 * - Salva nCodCP em fin_contas_pagar.omie_cp_id
 * - Atualiza remessa_status = 'enviada'
 */
export function useOmieEnviarRemessa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      credentials,
      cps,
    }: {
      credentials: OmieCredentials
      cps: CPParaRemessa[]
    }): Promise<ResultadoRemessa[]> => {
      const resultados: ResultadoRemessa[] = []

      for (const cp of cps) {
        // CP já enviada ao Omie — pula
        if (cp.omie_cp_id) {
          resultados.push({ cpId: cp.id, omieId: cp.omie_cp_id, status: 'ja_existe' })
          continue
        }

        try {
          // Busca código Omie do fornecedor
          const { data: forn } = await supabase
            .from('cmp_fornecedores')
            .select('omie_fornecedor_id')
            .eq('id', cp.fornecedor_id ?? '')
            .maybeSingle()

          const nCodFornecedor = forn?.omie_fornecedor_id ?? 0

          const res = await omieApi.incluirContaPagar(credentials, {
            nCodFornecedor,
            cNumDocumento: cp.numero_documento ?? `TEG-${cp.id.slice(0, 8).toUpperCase()}`,
            dDtEmissao: toOmieDate(cp.data_emissao),
            dDtVenc: toOmieDate(cp.data_vencimento),
            nValorDocumento: cp.valor_original,
            cObservacao: cp.descricao ?? `CP TEG+ ${cp.id}`,
          })

          // Salva o ID Omie e marca como enviada
          await supabase
            .from('fin_contas_pagar')
            .update({
              omie_cp_id: res.nCodCP,
              remessa_status: 'enviada',
              remessa_enviada_em: new Date().toISOString(),
              remessa_id: String(res.nCodCP),
            })
            .eq('id', cp.id)

          resultados.push({ cpId: cp.id, omieId: res.nCodCP, status: 'incluido' })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erro desconhecido'
          await supabase
            .from('fin_contas_pagar')
            .update({ remessa_status: 'erro', remessa_erro: msg })
            .eq('id', cp.id)
          resultados.push({ cpId: cp.id, omieId: null, status: 'erro', mensagem: msg })
        }
      }

      return resultados
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['cps-para-pagamento'] })
    },
  })
}

// ── Remessas: Atualizar status do Omie → TEG+ ─────────────────────────────────

export interface ResultadoAtualizacao {
  cpId: string
  omieId: number
  situacaoOmie: string
  novoStatus: string
  atualizado: boolean
}

/**
 * Consulta o Omie para cada CP com remessa_status='enviada' e
 * atualiza o status interno (pago, cancelado, processando).
 */
export function useOmieAtualizarRemessas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      credentials,
      cpIds,
    }: {
      credentials: OmieCredentials
      cpIds?: string[]   // se undefined, busca todos com status=enviada ou processando
    }): Promise<ResultadoAtualizacao[]> => {

      // Busca CPs pendentes de atualização
      let query = supabase
        .from('fin_contas_pagar')
        .select('id, omie_cp_id, remessa_status')
        .in('remessa_status', ['enviada', 'processando'])
        .not('omie_cp_id', 'is', null)

      if (cpIds?.length) query = query.in('id', cpIds)

      const { data: cps, error } = await query
      if (error) throw error
      if (!cps?.length) return []

      const resultados: ResultadoAtualizacao[] = []

      for (const cp of cps) {
        if (!cp.omie_cp_id) continue
        try {
          const omieCP = await omieApi.consultarContaPagar(credentials, cp.omie_cp_id)
          const situacao = omieCP.status?.cSituacao ?? omieCP.cabecalho?.cStatus ?? ''
          const novoRemessaStatus = mapOmieStatus(situacao)

          const updates: Record<string, unknown> = {
            remessa_status: novoRemessaStatus,
            remessa_sync_em: new Date().toISOString(),
          }

          // Se pago → atualiza valor pago e data de pagamento
          if (novoRemessaStatus === 'confirmada') {
            updates.status = 'pago'
            if (omieCP.cabecalho.dDtPagamento) {
              updates.data_pagamento = fromOmieDate(omieCP.cabecalho.dDtPagamento)
            }
            if (omieCP.cabecalho.nValorPago) {
              updates.valor_pago = omieCP.cabecalho.nValorPago
            }
          }

          if (novoRemessaStatus === 'cancelado') {
            updates.status = 'cancelado'
          }

          await supabase.from('fin_contas_pagar').update(updates).eq('id', cp.id)

          resultados.push({
            cpId: cp.id,
            omieId: cp.omie_cp_id,
            situacaoOmie: situacao,
            novoStatus: String(updates.status ?? cp.remessa_status),
            atualizado: true,
          })
        } catch {
          resultados.push({
            cpId: cp.id,
            omieId: cp.omie_cp_id,
            situacaoOmie: 'erro_consulta',
            novoStatus: cp.remessa_status ?? '',
            atualizado: false,
          })
        }
      }

      return resultados
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['cps-para-pagamento'] })
    },
  })
}

// ── Sync de CPs Omie → TEG+ (importação) ──────────────────────────────────────

export interface SyncContasPagarResult {
  total: number
  novas: number
  atualizadas: number
  erros: number
}

/**
 * Lista todas as CPs abertas no Omie e sincroniza com fin_contas_pagar.
 * Usa omie_cp_id como chave de deduplicação.
 */
export function useOmieSyncContasPagar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (credentials: OmieCredentials): Promise<SyncContasPagarResult> => {
      let pagina = 1
      let totalPaginas = 1
      let novas = 0
      let atualizadas = 0
      let erros = 0
      let total = 0

      do {
        const res = await omieApi.listarContasPagar(credentials, {
          pagina,
          registros: 50,
          status: 'ABERTO',
        })
        totalPaginas = res.nTotPaginas
        total += res.nRegistros

        for (const cp of res.conta_pagar_cadastro ?? []) {
          const cab = cp.cabecalho
          try {
            const { data: existing } = await supabase
              .from('fin_contas_pagar')
              .select('id')
              .eq('omie_cp_id', cab.nCodCP)
              .maybeSingle()

            const payload = {
              omie_cp_id: cab.nCodCP,
              fornecedor_nome: cab.cFornecedor ?? 'Omie',
              valor_original: cab.nValorDocumento,
              data_vencimento: fromOmieDate(cab.dDtVenc),
              data_emissao: fromOmieDate(cab.dDtEmissao),
              numero_documento: cab.cNumDocumento,
              descricao: cab.cObservacao ?? null,
              status: 'confirmado' as const,
              remessa_status: 'enviada' as const,
              remessa_id: String(cab.nCodCP),
            }

            if (existing?.id) {
              await supabase.from('fin_contas_pagar').update(payload).eq('id', existing.id)
              atualizadas++
            } else {
              await supabase.from('fin_contas_pagar').insert({ ...payload, origem: 'manual' })
              novas++
            }
          } catch {
            erros++
          }
        }

        // Registra log do sync
        await supabase.from('fin_sync_log').insert({
          dominio: 'contas_pagar',
          status: 'success',
          registros: total,
          mensagem: `Sync Omie: ${novas} novas, ${atualizadas} atualizadas`,
          executado_por: 'omie_direto',
        })

        pagina++
      } while (pagina <= totalPaginas)

      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['sync-log', 'contas_pagar'] })

      return { total, novas, atualizadas, erros }
    },
  })
}
