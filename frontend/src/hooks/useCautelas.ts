import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  Cautela, CautelaItem, CautelaFavorito, CautelaTemplate,
  NovaCautelaPayload, StatusCautela, CautelaKPIs,
} from '../types/cautela'

// ── List cautelas ───────────────────────────────────────────────────────────
export function useCautelas(filtros?: { status?: StatusCautela; solicitante_id?: string }) {
  return useQuery<Cautela[]>({
    queryKey: ['est-cautelas', filtros],
    queryFn: async () => {
      let q = supabase
        .from('est_cautelas')
        .select(`
          *,
          itens:est_cautela_itens(*, item:est_itens(codigo, descricao, unidade))
        `)
        .order('criado_em', { ascending: false })

      if (filtros?.status) q = q.eq('status', filtros.status)
      if (filtros?.solicitante_id) q = q.eq('solicitante_id', filtros.solicitante_id)

      const { data, error } = await q
      if (error) return []
      return (data ?? []) as Cautela[]
    },
    staleTime: 30_000,
  })
}

// ── Single cautela with items ───────────────────────────────────────────────
export function useCautela(id: string | undefined) {
  return useQuery<Cautela | null>({
    queryKey: ['est-cautela', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_cautelas')
        .select(`
          *,
          itens:est_cautela_itens(*, item:est_itens(codigo, descricao, unidade))
        `)
        .eq('id', id!)
        .single()
      if (error) return null
      return data as Cautela
    },
  })
}

// ── My cautelas (current user) ──────────────────────────────────────────────
export function useMinhasCautelas(userId: string | undefined) {
  return useQuery<Cautela[]>({
    queryKey: ['est-cautelas-minhas', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_cautelas')
        .select(`
          *,
          itens:est_cautela_itens(*, item:est_itens(codigo, descricao, unidade))
        `)
        .eq('solicitante_id', userId!)
        .in('status', ['retirada', 'parcial_devolvida', 'em_separacao', 'aprovada', 'pendente_aprovacao', 'rascunho'])
        .order('criado_em', { ascending: false })
      if (error) return []
      return (data ?? []) as Cautela[]
    },
    staleTime: 30_000,
  })
}

// ── Create cautela ──────────────────────────────────────────────────────────
export function useCriarCautela() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: NovaCautelaPayload) => {
      const { itens, ...cautela } = payload
      const { data, error } = await supabase
        .from('est_cautelas')
        .insert(cautela)
        .select('id')
        .single()
      if (error) throw error

      if (itens.length > 0) {
        const { error: eItens } = await supabase
          .from('est_cautela_itens')
          .insert(itens.map(i => ({ ...i, cautela_id: data.id })))
        if (eItens) throw eItens
      }
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-cautelas'] })
      qc.invalidateQueries({ queryKey: ['est-cautelas-minhas'] })
      qc.invalidateQueries({ queryKey: ['est-cautela-kpis'] })
    },
  })
}

// ── Update cautela status ───────────────────────────────────────────────────
export function useAtualizarCautela() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: StatusCautela; aprovador_id?: string; aprovador_nome?: string; motivo_rejeicao?: string }) => {
      const { error } = await supabase
        .from('est_cautelas')
        .update({
          ...updates,
          atualizado_em: new Date().toISOString(),
          ...(updates.aprovador_id ? { aprovado_em: new Date().toISOString() } : {}),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-cautelas'] })
      qc.invalidateQueries({ queryKey: ['est-cautelas-minhas'] })
      qc.invalidateQueries({ queryKey: ['est-cautela'] })
      qc.invalidateQueries({ queryKey: ['est-cautela-kpis'] })
    },
  })
}

// ── Return items (partial/full) ─────────────────────────────────────────────
export function useDevolverItens() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cautela_id, itens }: {
      cautela_id: string
      itens: Array<{ id: string; quantidade_devolvida: number; condicao_devolucao?: string }>
    }) => {
      for (const item of itens) {
        const { error } = await supabase
          .from('est_cautela_itens')
          .update({
            quantidade_devolvida: item.quantidade_devolvida,
            condicao_devolucao: item.condicao_devolucao,
          })
          .eq('id', item.id)
        if (error) throw error
      }
      // Check if all returned → update cautela status
      const { data: allItems } = await supabase
        .from('est_cautela_itens')
        .select('quantidade, quantidade_devolvida')
        .eq('cautela_id', cautela_id)

      const allReturned = (allItems ?? []).every(
        (i: any) => (i.quantidade_devolvida ?? 0) >= i.quantidade
      )

      const { error } = await supabase
        .from('est_cautelas')
        .update({
          status: allReturned ? 'devolvida' : 'parcial_devolvida',
          ...(allReturned ? { data_devolucao_real: new Date().toISOString() } : {}),
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', cautela_id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-cautelas'] })
      qc.invalidateQueries({ queryKey: ['est-cautelas-minhas'] })
      qc.invalidateQueries({ queryKey: ['est-cautela'] })
      qc.invalidateQueries({ queryKey: ['est-cautela-kpis'] })
    },
  })
}

// ── User favorites ──────────────────────────────────────────────────────────
export function useCautelaFavoritos(userId: string | undefined) {
  return useQuery<CautelaFavorito[]>({
    queryKey: ['est-cautela-favoritos', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_cautela_favoritos')
        .select('*, item:est_itens(codigo, descricao, unidade)')
        .eq('usuario_id', userId!)
        .order('frequencia', { ascending: false })
      if (error) return []
      return (data ?? []) as CautelaFavorito[]
    },
  })
}

// ── Templates ───────────────────────────────────────────────────────────────
export function useCautelaTemplates() {
  return useQuery<CautelaTemplate[]>({
    queryKey: ['est-cautela-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_cautela_templates')
        .select('*')
        .eq('ativo', true)
        .order('nome')
      if (error) return []
      return (data ?? []) as CautelaTemplate[]
    },
  })
}

// ── KPIs ────────────────────────────────────────────────────────────────────
export function useCautelaKPIs(userId: string | undefined) {
  return useQuery<CautelaKPIs>({
    queryKey: ['est-cautela-kpis', userId],
    enabled: !!userId,
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]

      // Cautelas ativas do usuario
      const { data: minhas } = await supabase
        .from('est_cautelas')
        .select('id, status, data_devolucao_prevista')
        .eq('solicitante_id', userId!)
        .in('status', ['retirada', 'parcial_devolvida'])

      const ativas = minhas ?? []
      const vencidas = ativas.filter(c =>
        c.data_devolucao_prevista && c.data_devolucao_prevista < today
      ).length
      const devolverHoje = ativas.filter(c =>
        c.data_devolucao_prevista === today
      ).length

      return {
        itens_comigo: ativas.length,
        vencidas,
        devolver_hoje: devolverHoje,
      }
    },
    refetchInterval: 60_000,
  })
}
