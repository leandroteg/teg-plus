import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  EstBase, EstItem, EstSaldo, EstMovimentacao, EstSolicitacao,
  EstInventario, EstInventarioItem, EstoqueKPIs, NovaMovimentacaoPayload,
} from '../types/estoque'

// ── Bases ─────────────────────────────────────────────────────────────────────
export function useBases() {
  return useQuery<EstBase[]>({
    queryKey: ['est-bases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_bases')
        .select('*')
        .eq('ativa', true)
        .order('nome')
      if (error) return []
      return (data ?? []) as EstBase[]
    },
  })
}

// ── Itens ─────────────────────────────────────────────────────────────────────
export function useEstoqueItens(filtros?: { categoria?: string; curva?: string; ativo?: boolean }) {
  return useQuery<EstItem[]>({
    queryKey: ['est-itens', filtros],
    queryFn: async () => {
      let q = supabase
        .from('est_itens')
        .select('*')
        .order('descricao')

      if (filtros?.categoria) q = q.eq('categoria', filtros.categoria)
      if (filtros?.curva)     q = q.eq('curva_abc', filtros.curva)
      if (filtros?.ativo !== undefined) q = q.eq('ativo', filtros.ativo)
      else q = q.eq('ativo', true)

      const { data, error } = await q
      if (error) return []
      return (data ?? []) as EstItem[]
    },
  })
}

export function useEstoqueItem(id: string | undefined) {
  return useQuery<EstItem | null>({
    queryKey: ['est-item', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_itens')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) return null
      return data as EstItem
    },
  })
}

export function useSalvarItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<EstItem> & { id?: string }) => {
      const { id, ...rest } = payload
      if (id) {
        const { error } = await supabase.from('est_itens').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('est_itens').insert(rest)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['est-itens'] }),
  })
}

// ── Saldos ────────────────────────────────────────────────────────────────────
export function useSaldos(baseId?: string) {
  return useQuery<EstSaldo[]>({
    queryKey: ['est-saldos', baseId],
    queryFn: async () => {
      let q = supabase
        .from('est_saldos')
        .select(`
          *,
          item:est_itens(codigo, descricao, unidade, curva_abc, estoque_minimo, ponto_reposicao),
          base:est_bases(codigo, nome)
        `)
        .order('atualizado_em', { ascending: false })

      if (baseId) q = q.eq('base_id', baseId)

      const { data, error } = await q
      if (error) return []
      return (data ?? []) as EstSaldo[]
    },
    refetchInterval: 60_000,
  })
}

export function useSaldosAbaixoMinimo() {
  return useQuery<EstSaldo[]>({
    queryKey: ['est-saldos-alerta'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_saldos')
        .select(`
          *,
          item:est_itens(codigo, descricao, unidade, curva_abc, estoque_minimo, ponto_reposicao),
          base:est_bases(codigo, nome)
        `)
      if (error) return []
      // Filtra no client: saldo <= ponto_reposicao do item
      return (data ?? []).filter(
        (s: any) => s.item && s.saldo <= (s.item.ponto_reposicao ?? s.item.estoque_minimo)
      ) as EstSaldo[]
    },
  })
}

// ── Movimentações ─────────────────────────────────────────────────────────────
export function useMovimentacoes(filtros?: {
  item_id?: string
  base_id?: string
  tipo?: string
  obra?: string
  page?: number
}) {
  const limit = 50
  const offset = ((filtros?.page ?? 1) - 1) * limit

  return useQuery<EstMovimentacao[]>({
    queryKey: ['est-movimentacoes', filtros],
    queryFn: async () => {
      let q = supabase
        .from('est_movimentacoes')
        .select(`
          *,
          item:est_itens(codigo, descricao, unidade),
          base:est_bases(codigo, nome)
        `)
        .order('criado_em', { ascending: false })
        .range(offset, offset + limit - 1)

      if (filtros?.item_id) q = q.eq('item_id', filtros.item_id)
      if (filtros?.base_id) q = q.eq('base_id', filtros.base_id)
      if (filtros?.tipo)    q = q.eq('tipo', filtros.tipo)
      if (filtros?.obra)    q = q.ilike('obra_nome', `%${filtros.obra}%`)

      const { data, error } = await q
      if (error) return []
      return (data ?? []) as EstMovimentacao[]
    },
  })
}

export function useRegistrarMovimentacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: NovaMovimentacaoPayload) => {
      const { error } = await supabase
        .from('est_movimentacoes')
        .insert({
          ...payload,
          valor_unitario: payload.valor_unitario ?? 0,
        })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-movimentacoes'] })
      qc.invalidateQueries({ queryKey: ['est-saldos'] })
      qc.invalidateQueries({ queryKey: ['est-saldos-alerta'] })
      qc.invalidateQueries({ queryKey: ['est-kpis'] })
    },
  })
}

// ── Solicitações ──────────────────────────────────────────────────────────────
export function useSolicitacoes(status?: StatusSolicitacao) {
  return useQuery<EstSolicitacao[]>({
    queryKey: ['est-solicitacoes', status],
    queryFn: async () => {
      let q = supabase
        .from('est_solicitacoes')
        .select(`*, itens:est_solicitacao_itens(*, item:est_itens(codigo, descricao, unidade))`)
        .order('criado_em', { ascending: false })

      if (status) q = q.eq('status', status)

      const { data, error } = await q
      if (error) return []
      return (data ?? []) as EstSolicitacao[]
    },
  })
}

type StatusSolicitacao = 'aberta' | 'aprovada' | 'em_separacao' | 'atendida' | 'parcial' | 'cancelada'

export function useCriarSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      solicitante_nome: string
      obra_nome: string
      centro_custo?: string
      urgencia: string
      observacao?: string
      itens: { item_id?: string; descricao_livre?: string; quantidade: number; unidade?: string }[]
    }) => {
      const { itens, ...solicitacao } = payload
      const { data, error } = await supabase
        .from('est_solicitacoes')
        .insert(solicitacao)
        .select('id')
        .single()
      if (error) throw error

      if (itens.length > 0) {
        const { error: eItens } = await supabase
          .from('est_solicitacao_itens')
          .insert(itens.map(i => ({ ...i, solicitacao_id: data.id })))
        if (eItens) throw eItens
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['est-solicitacoes'] }),
  })
}

export function useAtualizarSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, aprovado_por }: { id: string; status: StatusSolicitacao; aprovado_por?: string }) => {
      const { error } = await supabase
        .from('est_solicitacoes')
        .update({
          status,
          ...(aprovado_por ? { aprovado_por, aprovado_em: new Date().toISOString() } : {}),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['est-solicitacoes'] }),
  })
}

// ── Inventários ───────────────────────────────────────────────────────────────
export function useInventarios() {
  return useQuery<EstInventario[]>({
    queryKey: ['est-inventarios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_inventarios')
        .select('*, base:est_bases(codigo, nome)')
        .order('criado_em', { ascending: false })
      if (error) return []
      return (data ?? []) as EstInventario[]
    },
  })
}

export function useInventario(id: string | undefined) {
  return useQuery<EstInventario | null>({
    queryKey: ['est-inventario', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_inventarios')
        .select(`
          *,
          base:est_bases(codigo, nome),
          itens:est_inventario_itens(*, item:est_itens(codigo, descricao, unidade, curva_abc))
        `)
        .eq('id', id!)
        .single()
      if (error) return null
      return data as EstInventario
    },
  })
}

export function useAbrirInventario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      tipo: 'ciclico' | 'periodico' | 'surpresa'
      base_id?: string
      curva_filtro?: 'A' | 'B' | 'C'
      responsavel: string
    }) => {
      // 1. Criar sessão
      const { data: inv, error } = await supabase
        .from('est_inventarios')
        .insert(payload)
        .select('id')
        .single()
      if (error) throw error

      // 2. Popular itens com saldo atual
      const { data: saldos } = await supabase
        .from('est_saldos')
        .select('item_id, base_id, saldo')
        .eq(payload.base_id ? 'base_id' : 'id', payload.base_id ?? '%')

      if (saldos && saldos.length > 0) {
        const itensInv = saldos.map((s: any) => ({
          inventario_id: inv.id,
          item_id: s.item_id,
          base_id: s.base_id,
          saldo_sistema: s.saldo,
        }))
        await supabase.from('est_inventario_itens').insert(itensInv)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['est-inventarios'] }),
  })
}

export function useSalvarContagem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      saldo_contado,
      contado_por,
      observacao,
    }: {
      id: string
      saldo_contado: number
      contado_por?: string
      observacao?: string
    }) => {
      const { error } = await supabase
        .from('est_inventario_itens')
        .update({
          saldo_contado,
          contado_por,
          observacao,
          contado_em: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['est-inventario'] })
    },
  })
}

export function useConcluirInventario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ inventario_id, aprovado_por }: { inventario_id: string; aprovado_por: string }) => {
      // Calcular acurácia
      const { data: itens } = await supabase
        .from('est_inventario_itens')
        .select('saldo_sistema, saldo_contado')
        .eq('inventario_id', inventario_id)

      const total = itens?.length ?? 0
      const sem_divergencia = itens?.filter((i: any) =>
        Math.abs((i.saldo_contado ?? 0) - (i.saldo_sistema ?? 0)) < 0.001
      ).length ?? 0
      const acuracia = total > 0 ? (sem_divergencia / total) * 100 : 100

      const { error } = await supabase
        .from('est_inventarios')
        .update({
          status: 'concluido',
          data_conclusao: new Date().toISOString().split('T')[0],
          aprovado_por,
          acuracia: Math.round(acuracia * 100) / 100,
        })
        .eq('id', inventario_id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-inventarios'] })
      qc.invalidateQueries({ queryKey: ['est-inventario'] })
      qc.invalidateQueries({ queryKey: ['est-kpis'] })
    },
  })
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
export function useEstoqueKPIs() {
  return useQuery<EstoqueKPIs>({
    queryKey: ['est-kpis'],
    queryFn: async () => {
      const [itensRes, saldosRes, movsRes, solRes, invRes] = await Promise.all([
        supabase.from('est_itens').select('id', { count: 'exact' }).eq('ativo', true),
        supabase.from('est_saldos').select('saldo, saldo_reservado, item:est_itens(estoque_minimo, ponto_reposicao, valor_medio, curva_abc)'),
        supabase.from('est_movimentacoes').select('id', { count: 'exact' })
          .gte('criado_em', new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from('est_solicitacoes').select('id', { count: 'exact' }).in('status', ['aberta', 'aprovada', 'em_separacao']),
        supabase.from('est_inventarios').select('acuracia').eq('status', 'concluido').order('criado_em', { ascending: false }).limit(1),
      ])

      const saldos = (saldosRes.data ?? []) as any[]
      const noventa_dias_atras = new Date(Date.now() - 90 * 86400000).toISOString()

      // Itens abaixo do mínimo
      const abaixo = saldos.filter(s => s.item && s.saldo <= (s.item.ponto_reposicao ?? s.item.estoque_minimo)).length

      // Valor total em estoque
      const valor_total = saldos.reduce((acc, s) => acc + (s.saldo * (s.item?.valor_medio ?? 0)), 0)

      return {
        total_itens: itensRes.count ?? 0,
        itens_abaixo_minimo: abaixo,
        itens_parados: 0, // simplificado
        valor_estoque_total: valor_total,
        movimentacoes_mes: movsRes.count ?? 0,
        taxa_ruptura: 0,
        acuracia_ultimo_inventario: invRes.data?.[0]?.acuracia ?? undefined,
        solicitacoes_abertas: solRes.count ?? 0,
      }
    },
    refetchInterval: 60_000,
  })
}
