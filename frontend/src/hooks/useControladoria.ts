import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  CtrlOrcamento,
  CtrlOrcamentoLinha,
  CtrlDRE,
  CtrlKPISnapshot,
  CtrlCenario,
  CtrlAlertaDesvio,
  CtrlIndicadorProducao,
} from '../types/controladoria'

// ── Orcamentos ────────────────────────────────────────────────────────────────

export function useOrcamentos(filters?: { obra_id?: string; status?: string }) {
  return useQuery<CtrlOrcamento[]>({
    queryKey: ['ctrl-orcamentos', filters],
    queryFn: async () => {
      let q = supabase
        .from('ctrl_orcamentos')
        .select('*, obra:sys_obras!obra_id(id, nome)')
        .order('ano', { ascending: false })
      if (filters?.obra_id) q = q.eq('obra_id', filters.obra_id)
      if (filters?.status) q = q.eq('status', filters.status)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as CtrlOrcamento[]
    },
  })
}

export function useOrcamento(id?: string) {
  return useQuery<CtrlOrcamento | null>({
    queryKey: ['ctrl-orcamento', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('ctrl_orcamentos')
        .select('*, obra:sys_obras!obra_id(id, nome)')
        .eq('id', id)
        .single()
      if (error) return null
      return data as CtrlOrcamento
    },
    enabled: !!id,
  })
}

export function useOrcamentoLinhas(orcamentoId?: string) {
  return useQuery<CtrlOrcamentoLinha[]>({
    queryKey: ['ctrl-orcamento-linhas', orcamentoId],
    queryFn: async () => {
      if (!orcamentoId) return []
      const { data, error } = await supabase
        .from('ctrl_orcamento_linhas')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .order('categoria')
        .order('mes', { ascending: true })
      if (error) return []
      return (data ?? []) as CtrlOrcamentoLinha[]
    },
    enabled: !!orcamentoId,
  })
}

export function useSalvarOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orcamento: Partial<CtrlOrcamento> & { obra_id: string; ano: number }) => {
      const { error } = await supabase
        .from('ctrl_orcamentos')
        .upsert(orcamento, { onConflict: 'id' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ctrl-orcamentos'] })
      qc.invalidateQueries({ queryKey: ['ctrl-orcamento'] })
    },
  })
}

// ── DRE ───────────────────────────────────────────────────────────────────────

export function useDRE(filters?: { obra_id?: string; ano?: number }) {
  return useQuery<CtrlDRE[]>({
    queryKey: ['ctrl-dre', filters],
    queryFn: async () => {
      let q = supabase
        .from('ctrl_dre')
        .select('*, obra:sys_obras!obra_id(id, nome)')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
      if (filters?.obra_id) q = q.eq('obra_id', filters.obra_id)
      if (filters?.ano) q = q.eq('ano', filters.ano)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as CtrlDRE[]
    },
  })
}

export function useDREConsolidado() {
  return useQuery<Record<string, unknown>[]>({
    queryKey: ['ctrl-dre-consolidado'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_ctrl_dre_consolidado')
        .select('*')
      if (error) return []
      return (data ?? []) as Record<string, unknown>[]
    },
  })
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

export function useKPIs(filters?: { obra_id?: string; tipo?: string }) {
  return useQuery<CtrlKPISnapshot[]>({
    queryKey: ['ctrl-kpis', filters],
    queryFn: async () => {
      let q = supabase
        .from('ctrl_kpis_snapshot')
        .select('*')
        .order('data_snapshot', { ascending: false })
      if (filters?.obra_id) q = q.eq('obra_id', filters.obra_id)
      if (filters?.tipo) q = q.eq('tipo', filters.tipo)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as CtrlKPISnapshot[]
    },
  })
}

// ── Cenarios ──────────────────────────────────────────────────────────────────

export function useCenarios(obraId?: string) {
  return useQuery<CtrlCenario[]>({
    queryKey: ['ctrl-cenarios', obraId],
    queryFn: async () => {
      let q = supabase
        .from('ctrl_cenarios')
        .select('*, obra:sys_obras!obra_id(id, nome)')
        .order('created_at', { ascending: false })
      if (obraId) q = q.eq('obra_id', obraId)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as CtrlCenario[]
    },
  })
}

export function useSalvarCenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cenario: Partial<CtrlCenario> & { nome: string; tipo: string }) => {
      const { error } = await supabase
        .from('ctrl_cenarios')
        .upsert(cenario, { onConflict: 'id' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ctrl-cenarios'] })
    },
  })
}

// ── Alertas de Desvio ─────────────────────────────────────────────────────────

export function useAlertasDesvio(filters?: { obra_id?: string; severidade?: string; resolvido?: boolean }) {
  return useQuery<CtrlAlertaDesvio[]>({
    queryKey: ['ctrl-alertas', filters],
    queryFn: async () => {
      let q = supabase
        .from('ctrl_alertas_desvio')
        .select('*, obra:sys_obras!obra_id(id, nome)')
        .order('created_at', { ascending: false })
      if (filters?.obra_id) q = q.eq('obra_id', filters.obra_id)
      if (filters?.severidade) q = q.eq('severidade', filters.severidade)
      if (filters?.resolvido !== undefined) q = q.eq('resolvido', filters.resolvido)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as CtrlAlertaDesvio[]
    },
  })
}

export function useMarcarAlertaLido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ctrl_alertas_desvio')
        .update({ lido: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ctrl-alertas'] })
    },
  })
}

// ── Plano Orcamentario ───────────────────────────────────────────────────────

export interface PlanoOrcamentarioRow {
  categoria: string
  tri1_planejado: number
  tri1_realizado: number
  tri2_planejado: number
  tri2_realizado: number
  tri3_planejado: number
  tri3_realizado: number
  tri4_planejado: number
  tri4_realizado: number
  total_planejado: number
  total_realizado: number
}

export function usePlanoOrcamentario(ano: number) {
  return useQuery<PlanoOrcamentarioRow[]>({
    queryKey: ['ctrl-plano-orcamentario', ano],
    queryFn: async () => {
      // Fetch all orcamento_ids for the given year
      const { data: orcamentos, error: orcErr } = await supabase
        .from('ctrl_orcamentos')
        .select('id')
        .eq('ano', ano)
      if (orcErr || !orcamentos?.length) return []

      const ids = orcamentos.map(o => o.id)
      const { data: linhas, error: linErr } = await supabase
        .from('ctrl_orcamento_linhas')
        .select('categoria, mes, valor_planejado, valor_realizado')
        .in('orcamento_id', ids)
      if (linErr || !linhas?.length) return []

      // Group by categoria → quarter
      const map = new Map<string, PlanoOrcamentarioRow>()
      for (const l of linhas) {
        if (!map.has(l.categoria)) {
          map.set(l.categoria, {
            categoria: l.categoria,
            tri1_planejado: 0, tri1_realizado: 0,
            tri2_planejado: 0, tri2_realizado: 0,
            tri3_planejado: 0, tri3_realizado: 0,
            tri4_planejado: 0, tri4_realizado: 0,
            total_planejado: 0, total_realizado: 0,
          })
        }
        const row = map.get(l.categoria)!
        const m = l.mes as number
        const vp = (l.valor_planejado ?? 0) as number
        const vr = (l.valor_realizado ?? 0) as number
        if (m >= 1 && m <= 3) { row.tri1_planejado += vp; row.tri1_realizado += vr }
        else if (m >= 4 && m <= 6) { row.tri2_planejado += vp; row.tri2_realizado += vr }
        else if (m >= 7 && m <= 9) { row.tri3_planejado += vp; row.tri3_realizado += vr }
        else if (m >= 10 && m <= 12) { row.tri4_planejado += vp; row.tri4_realizado += vr }
        row.total_planejado += vp
        row.total_realizado += vr
      }
      return Array.from(map.values())
    },
  })
}

// ── Controle Orcamentario (Orcado vs Realizado) ──────────────────────────────

export interface ControleOrcamentarioRow {
  categoria: string
  premissa: string
  valor_orcado: number
  valor_realizado: number
  variacao: number
  desvio_explicacao: string
  plano_acao: string
}

export function useControleOrcamentario(ano: number, mes: number) {
  return useQuery<ControleOrcamentarioRow[]>({
    queryKey: ['ctrl-controle-orcamentario', ano, mes],
    queryFn: async () => {
      // Fetch all orcamento_ids for the given year
      const { data: orcamentos, error: orcErr } = await supabase
        .from('ctrl_orcamentos')
        .select('id')
        .eq('ano', ano)
      if (orcErr || !orcamentos?.length) return []

      const ids = orcamentos.map(o => o.id)
      const { data: linhas, error: linErr } = await supabase
        .from('ctrl_orcamento_linhas')
        .select('categoria, mes, valor_planejado, valor_realizado, premissa, desvio_explicacao, plano_acao')
        .in('orcamento_id', ids)
        .eq('mes', mes)
      if (linErr || !linhas?.length) return []

      // Aggregate by categoria for the selected month
      const map = new Map<string, ControleOrcamentarioRow>()
      for (const l of linhas) {
        const key = l.categoria as string
        if (!map.has(key)) {
          map.set(key, {
            categoria: key,
            premissa: (l.premissa as string) ?? '',
            valor_orcado: 0,
            valor_realizado: 0,
            variacao: 0,
            desvio_explicacao: (l.desvio_explicacao as string) ?? '',
            plano_acao: (l.plano_acao as string) ?? '',
          })
        }
        const row = map.get(key)!
        row.valor_orcado += (l.valor_planejado ?? 0) as number
        row.valor_realizado += (l.valor_realizado ?? 0) as number
        // Keep last non-empty text fields
        if (l.premissa) row.premissa = l.premissa as string
        if (l.desvio_explicacao) row.desvio_explicacao = l.desvio_explicacao as string
        if (l.plano_acao) row.plano_acao = l.plano_acao as string
      }

      // Compute variacao
      for (const row of map.values()) {
        row.variacao = row.valor_orcado - row.valor_realizado
      }

      return Array.from(map.values())
    },
  })
}

// ── Views ─────────────────────────────────────────────────────────────────────

export function useCustoPorObra() {
  return useQuery<Record<string, unknown>[]>({
    queryKey: ['ctrl-custo-por-obra'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_ctrl_custo_por_obra')
        .select('*')
      if (error) return []
      return (data ?? []) as Record<string, unknown>[]
    },
  })
}

// ── Indicadores de Produção ──────────────────────────────────────────────────

export function useIndicadoresProducao(mes: string) {
  return useQuery<CtrlIndicadorProducao[]>({
    queryKey: ['ctrl-indicadores-producao', mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ctrl_indicadores_producao')
        .select('*')
        .eq('mes', mes)
        .order('tipo_indicador')
        .order('categoria')
      if (error) return []
      return (data ?? []) as CtrlIndicadorProducao[]
    },
  })
}

// ── Painel Resumo (DRE aggregation for summary cards) ────────────────────────

export interface PainelResumo {
  total_entradas: number
  total_saidas: number
  saldo: number
  pct_saidas_entradas: number
  margem_operacional: number
  folha_valor: number
  folha_qtd_clt: number
  folha_pct_faturamento: number
  folha_custo_medio: number
  folha_desvio_orcado: number
}

export function usePainelResumo(ano: number, mes: number) {
  return useQuery<PainelResumo>({
    queryKey: ['ctrl-painel-resumo', ano, mes],
    queryFn: async () => {
      // Fetch DRE rows for the year up to the selected month
      const { data: dreRows, error: dreErr } = await supabase
        .from('ctrl_dre')
        .select('receita_medida, custo_total, custo_mao_obra')
        .eq('ano', ano)
        .lte('mes', mes)
      if (dreErr || !dreRows?.length) {
        return {
          total_entradas: 0,
          total_saidas: 0,
          saldo: 0,
          pct_saidas_entradas: 0,
          margem_operacional: 0,
          folha_valor: 0,
          folha_qtd_clt: 0,
          folha_pct_faturamento: 0,
          folha_custo_medio: 0,
          folha_desvio_orcado: 0,
        }
      }

      const entradas = dreRows.reduce((s, r) => s + ((r.receita_medida as number) ?? 0), 0)
      const saidas = dreRows.reduce((s, r) => s + ((r.custo_total as number) ?? 0), 0)
      const folha = dreRows.reduce((s, r) => s + ((r.custo_mao_obra as number) ?? 0), 0)
      const saldo = entradas - saidas

      // Fetch orcamento for desvio calc
      const { data: orcamentos } = await supabase
        .from('ctrl_orcamentos')
        .select('id')
        .eq('ano', ano)
      const ids = orcamentos?.map(o => o.id) ?? []
      let folhaOrcada = 0
      if (ids.length) {
        const { data: linhas } = await supabase
          .from('ctrl_orcamento_linhas')
          .select('valor_planejado')
          .in('orcamento_id', ids)
          .eq('categoria', 'Mão de Obra Direta')
          .lte('mes', mes)
        folhaOrcada = linhas?.reduce((s, r) => s + ((r.valor_planejado as number) ?? 0), 0) ?? 0
      }

      return {
        total_entradas: entradas,
        total_saidas: saidas,
        saldo,
        pct_saidas_entradas: entradas > 0 ? (saidas / entradas) * 100 : 0,
        margem_operacional: entradas > 0 ? (saldo / entradas) * 100 : 0,
        folha_valor: folha,
        folha_qtd_clt: 278, // TODO: integrate with RH module
        folha_pct_faturamento: entradas > 0 ? (folha / entradas) * 100 : 0,
        folha_custo_medio: 278 > 0 ? folha / 278 : 0,
        folha_desvio_orcado: folha - folhaOrcada,
      }
    },
  })
}
