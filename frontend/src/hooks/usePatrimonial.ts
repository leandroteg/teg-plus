import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  PatImobilizado, PatMovimentacao, PatTermoResponsabilidade,
  PatDepreciacao, PatrimonialKPIs,
} from '../types/estoque'

// ── Imobilizados ─────────────────────────────────────────────────────────────
export function useImobilizados(filtros?: { status?: string; categoria?: string; base_id?: string }) {
  return useQuery<PatImobilizado[]>({
    queryKey: ['pat-imobilizados', filtros],
    queryFn: async () => {
      let q = supabase
        .from('pat_imobilizados')
        .select('*')
        .order('numero_patrimonio')

      if (filtros?.status)    q = q.eq('status', filtros.status)
      if (filtros?.categoria) q = q.eq('categoria', filtros.categoria)
      if (filtros?.base_id)   q = q.eq('base_id', filtros.base_id)

      const { data, error } = await q
      if (error) return []
      return (data ?? []).map((d: any) => ({
        ...d,
        depreciacao_acumulada: d.valor_aquisicao - (d.valor_atual ?? d.valor_aquisicao),
        percentual_depreciado: d.valor_aquisicao > 0
          ? Math.round(((d.valor_aquisicao - (d.valor_atual ?? d.valor_aquisicao)) / d.valor_aquisicao) * 100)
          : 0,
      })) as PatImobilizado[]
    },
  })
}

export function useImobilizado(id: string | undefined) {
  return useQuery<PatImobilizado | null>({
    queryKey: ['pat-imobilizado', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pat_imobilizados')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) return null
      return data as PatImobilizado
    },
  })
}

export function useSalvarImobilizado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PatImobilizado> & { id?: string }) => {
      const { id, depreciacao_acumulada, percentual_depreciado, ...rest } = payload
      if (id) {
        const { error } = await supabase.from('pat_imobilizados').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('pat_imobilizados').insert({
          ...rest,
          valor_atual: rest.valor_aquisicao, // começa igual ao valor de aquisição
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pat-imobilizados'] })
      qc.invalidateQueries({ queryKey: ['pat-imobilizado'] })
      qc.invalidateQueries({ queryKey: ['pat-kpis'] })
    },
  })
}

export function useBaixarImobilizado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      motivo_baixa,
      laudo_baixa_url,
    }: { id: string; motivo_baixa: string; laudo_baixa_url?: string }) => {
      const { error } = await supabase
        .from('pat_imobilizados')
        .update({
          status: 'baixado',
          baixado_em: new Date().toISOString(),
          motivo_baixa,
          laudo_baixa_url,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pat-imobilizados'] })
      qc.invalidateQueries({ queryKey: ['pat-kpis'] })
    },
  })
}

// ── Movimentações ─────────────────────────────────────────────────────────────
export function useMovimentacoesPatrimonial(imobilizado_id?: string) {
  return useQuery<PatMovimentacao[]>({
    queryKey: ['pat-movimentacoes', imobilizado_id],
    queryFn: async () => {
      let q = supabase
        .from('pat_movimentacoes')
        .select(`
          *,
          imobilizado:pat_imobilizados(numero_patrimonio, descricao, categoria)
        `)
        .order('criado_em', { ascending: false })

      if (imobilizado_id) q = q.eq('imobilizado_id', imobilizado_id)

      const { data, error } = await q
      if (error) return []
      return (data ?? []) as PatMovimentacao[]
    },
  })
}

export function useRegistrarMovimentacaoPatrimonial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<PatMovimentacao, 'id' | 'confirmado' | 'criado_em' | 'imobilizado'>) => {
      const { error } = await supabase.from('pat_movimentacoes').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pat-movimentacoes'] })
      qc.invalidateQueries({ queryKey: ['pat-imobilizados'] })
    },
  })
}

export function useConfirmarMovimentacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, confirmado_por }: { id: string; confirmado_por: string }) => {
      const { error } = await supabase
        .from('pat_movimentacoes')
        .update({ confirmado: true, confirmado_por, confirmado_em: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pat-movimentacoes'] }),
  })
}

// ── Termos de Responsabilidade ────────────────────────────────────────────────
export function useTermosResponsabilidade(imobilizado_id?: string) {
  return useQuery<PatTermoResponsabilidade[]>({
    queryKey: ['pat-termos', imobilizado_id],
    queryFn: async () => {
      let q = supabase
        .from('pat_termos_responsabilidade')
        .select('*')
        .order('criado_em', { ascending: false })

      if (imobilizado_id) q = q.eq('imobilizado_id', imobilizado_id)

      const { data, error } = await q
      if (error) return []
      return (data ?? []) as PatTermoResponsabilidade[]
    },
  })
}

export function useCriarTermo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<PatTermoResponsabilidade, 'id' | 'assinado' | 'criado_em'>) => {
      const { error } = await supabase.from('pat_termos_responsabilidade').insert({
        ...payload,
        assinado: false,
      })
      if (error) throw error
      // Atualiza responsável no imobilizado
      await supabase
        .from('pat_imobilizados')
        .update({ responsavel_nome: payload.responsavel_nome, responsavel_id: payload.responsavel_id })
        .eq('id', payload.imobilizado_id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pat-termos'] })
      qc.invalidateQueries({ queryKey: ['pat-imobilizados'] })
    },
  })
}

// ── Depreciações ──────────────────────────────────────────────────────────────
export function useDepreciacoes(imobilizado_id?: string) {
  return useQuery<PatDepreciacao[]>({
    queryKey: ['pat-depreciacoes', imobilizado_id],
    queryFn: async () => {
      let q = supabase
        .from('pat_depreciacoes')
        .select('*')
        .order('competencia', { ascending: false })

      if (imobilizado_id) q = q.eq('imobilizado_id', imobilizado_id)

      const { data, error } = await q
      if (error) return []
      return (data ?? []) as PatDepreciacao[]
    },
  })
}

export function useCalcularDepreciacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (competencia: string) => {
      // Busca todos os imobilizados ativos com depreciação > 0
      const { data: imobs } = await supabase
        .from('pat_imobilizados')
        .select('id, valor_atual, valor_aquisicao, taxa_depreciacao_anual, valor_residual')
        .in('status', ['ativo', 'em_manutencao', 'cedido'])

      if (!imobs || imobs.length === 0) return

      const registros: { imobilizado_id: any; competencia: string; valor_depreciacao: number; valor_anterior: any; valor_apos: number }[] = []
      const updates: { id: any; valor_atual: number }[] = []

      for (const imob of imobs as any[]) {
        const mensal = (imob.valor_aquisicao * imob.taxa_depreciacao_anual) / 100 / 12
        const valor_atual = imob.valor_atual ?? imob.valor_aquisicao
        const novo_valor = Math.max(imob.valor_residual ?? 0, valor_atual - mensal)
        const depreciacao_real = valor_atual - novo_valor

        if (depreciacao_real <= 0) continue

        registros.push({
          imobilizado_id: imob.id,
          competencia,
          valor_depreciacao: depreciacao_real,
          valor_anterior: valor_atual,
          valor_apos: novo_valor,
        })
        updates.push({ id: imob.id, valor_atual: novo_valor })
      }

      if (registros.length > 0) {
        await supabase.from('pat_depreciacoes').upsert(registros, { onConflict: 'imobilizado_id,competencia' })
        for (const u of updates) {
          await supabase.from('pat_imobilizados').update({ valor_atual: u.valor_atual }).eq('id', u.id)
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pat-depreciacoes'] })
      qc.invalidateQueries({ queryKey: ['pat-imobilizados'] })
      qc.invalidateQueries({ queryKey: ['pat-kpis'] })
    },
  })
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
export function usePatrimonialKPIs() {
  return useQuery<PatrimonialKPIs>({
    queryKey: ['pat-kpis'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pat_imobilizados')
        .select('status, valor_aquisicao, valor_atual, taxa_depreciacao_anual')

      const imobs = (data ?? []) as any[]
      const ativos = imobs.filter(i => i.status !== 'baixado')

      const valor_bruto  = ativos.reduce((a, i) => a + (i.valor_aquisicao ?? 0), 0)
      const valor_liquido = ativos.reduce((a, i) => a + (i.valor_atual ?? i.valor_aquisicao ?? 0), 0)
      // FIX: usa taxa individual ao invés de 20% fixo (BACKUP: era * 0.2 / 12)
      const depre_mensal  = ativos.reduce((a, i) => {
        const taxa = (i.taxa_depreciacao_anual ?? 20) / 100
        return a + ((i.valor_aquisicao ?? 0) * taxa / 12)
      }, 0)

      const { count: termos_pendentes } = await supabase
        .from('pat_termos_responsabilidade')
        .select('id', { count: 'exact' })
        .eq('assinado', false)

      return {
        total_imobilizados: ativos.length,
        valor_total_bruto: valor_bruto,
        valor_total_liquido: valor_liquido,
        depreciacao_mensal: depre_mensal,
        imobilizados_em_manutencao: imobs.filter(i => i.status === 'em_manutencao').length,
        imobilizados_cedidos: imobs.filter(i => i.status === 'cedido').length,
        imobilizados_depreciados: ativos.filter(i => (i.valor_atual ?? i.valor_aquisicao) <= 0.01).length,
        termos_pendentes: termos_pendentes ?? 0,
      }
    },
  })
}
