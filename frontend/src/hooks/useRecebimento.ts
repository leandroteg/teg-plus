import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { EstBase, CmpRecebimento, RecebimentoItemForm } from '../types/estoque'

// ── Fetch items from the requisição linked to the PO ─────────────────────────

interface RequisicaoItemRow {
  id: string
  descricao: string
  quantidade: number
  unidade: string
  valor_unitario_estimado: number
  est_item_id?: string
  est_item_codigo?: string
  destino_operacional?: 'estoque' | 'patrimonio' | 'nenhum'
}

export function useItensRequisicao(requisicaoId?: string) {
  return useQuery<RequisicaoItemRow[]>({
    queryKey: ['requisicao-itens', requisicaoId],
    queryFn: async () => {
      if (!requisicaoId) return []

      // Fetch requisição items with catalog link fields
      const { data, error } = await supabase
        .from('cmp_requisicao_itens')
        .select(`
          id, descricao, quantidade, unidade, valor_unitario_estimado,
          est_item_id, est_item_codigo, destino_operacional,
          item_estoque_id
        `)
        .eq('requisicao_id', requisicaoId)
        .order('created_at')
      if (error) throw error

      // Normalize rows — use est_item_id or item_estoque_id
      const rows = (data ?? []).map((row: any) => ({
        id: row.id,
        descricao: row.descricao,
        quantidade: row.quantidade,
        unidade: row.unidade,
        valor_unitario_estimado: row.valor_unitario_estimado,
        est_item_id: row.est_item_id ?? row.item_estoque_id ?? undefined,
        est_item_codigo: row.est_item_codigo ?? undefined,
        destino_operacional: row.destino_operacional ?? undefined,
      } as RequisicaoItemRow))

      // For items without a catalog link, try auto-match by exact description
      const unlinked = rows.filter(r => !r.est_item_id)
      if (unlinked.length > 0) {
        const descs = unlinked.map(r => r.descricao)
        const { data: matches } = await supabase
          .from('est_itens')
          .select('id, descricao, destino_operacional')
          .in('descricao', descs)
          .eq('ativo', true)
        if (matches && matches.length > 0) {
          const byDesc = new Map(matches.map((m: any) => [m.descricao, m]))
          for (const row of rows) {
            if (!row.est_item_id) {
              const match = byDesc.get(row.descricao)
              if (match) {
                row.est_item_id = match.id
                row.destino_operacional = match.destino_operacional
              }
            }
          }
        }
      }

      return rows
    },
    enabled: !!requisicaoId,
    staleTime: 60_000,
  })
}

// ── Fetch active bases for dropdown ──────────────────────────────────────────

export function useBases() {
  return useQuery<Pick<EstBase, 'id' | 'codigo' | 'nome'>[]>({
    queryKey: ['est-bases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_bases')
        .select('id, codigo, nome')
        .eq('ativa', true)
        .order('nome')
      if (error) throw error
      return (data ?? []) as Pick<EstBase, 'id' | 'codigo' | 'nome'>[]
    },
    staleTime: 300_000,
  })
}

// ── Fetch existing recebimentos for a PO ─────────────────────────────────────

export function useRecebimentosPedido(pedidoId?: string) {
  return useQuery<CmpRecebimento[]>({
    queryKey: ['recebimentos', pedidoId],
    queryFn: async () => {
      if (!pedidoId) return []
      const { data, error } = await supabase
        .from('cmp_recebimentos')
        .select(`
          id, pedido_id, base_id, recebido_por,
          nf_numero, nf_chave, data_recebimento, observacao, created_at,
          base:est_bases(codigo, nome),
          itens:cmp_recebimento_itens(
            id, descricao, quantidade_esperada, quantidade_recebida,
            valor_unitario, tipo_destino
          )
        `)
        .eq('pedido_id', pedidoId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as CmpRecebimento[]
    },
    enabled: !!pedidoId,
    staleTime: 30_000,
  })
}

// ── Create recebimento + items (trigger handles est/pat) ─────────────────────

export interface CriarRecebimentoPayload {
  pedidoId: string
  baseId?: string
  nfNumero?: string
  nfChave?: string
  dataRecebimento: string
  observacao?: string
  itens: RecebimentoItemForm[]
}

export function useCriarRecebimento() {
  const qc = useQueryClient()
  const { perfil } = useAuth()

  return useMutation({
    mutationFn: async (payload: CriarRecebimentoPayload) => {
      const {
        pedidoId, baseId, nfNumero, nfChave,
        dataRecebimento, observacao, itens,
      } = payload

      if (!perfil?.id) {
        throw new Error('Perfil do usuario nao carregado para registrar o recebimento.')
      }

      // 1. Create recebimento header
      const { data: rec, error: recErr } = await supabase
        .from('cmp_recebimentos')
        .insert({
          pedido_id: pedidoId,
          base_id: baseId || null,
          recebido_por: perfil.id,
          nf_numero: nfNumero || null,
          nf_chave: nfChave || null,
          data_recebimento: dataRecebimento,
          observacao: observacao || null,
        })
        .select('id')
        .single()

      if (recErr) throw recErr

      // 2. Insert items (trigger fn_processar_recebimento_item handles est/pat)
      const itensToInsert = itens
        .filter(i => i.quantidade_recebida > 0)
        .map(i => ({
          recebimento_id: rec.id,
          requisicao_item_id: i.requisicao_item_id || null,
          item_estoque_id: i.item_estoque_id || null,
          descricao: i.descricao,
          quantidade_esperada: i.quantidade_esperada,
          quantidade_recebida: i.quantidade_recebida,
          valor_unitario: i.valor_unitario,
          lote: i.lote || null,
          numero_serie: i.numero_serie || null,
          data_validade: i.data_validade || null,
          tipo_destino: i.tipo_destino,
          justificativa_destino: i.justificativa_destino || null,
        }))

      if (itensToInsert.length === 0) {
        throw new Error('Nenhum item com quantidade recebida.')
      }

      const { error: itensErr } = await supabase
        .from('cmp_recebimento_itens')
        .insert(itensToInsert)

      if (itensErr) throw itensErr

      return rec
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      qc.invalidateQueries({ queryKey: ['recebimentos'] })
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      // Estoque + Patrimonial caches
      qc.invalidateQueries({ queryKey: ['est-movimentacoes'] })
      qc.invalidateQueries({ queryKey: ['est-saldos'] })
      qc.invalidateQueries({ queryKey: ['pat-imobilizados'] })
    },
  })
}
