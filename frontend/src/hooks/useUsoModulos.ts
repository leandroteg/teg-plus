import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { ModuloDetalhePayload, UsoInsights, UsoModulosPayload } from '../types/usoModulos'

export type PeriodoDias = 7 | 30 | 90

export function useUsoModulos(dias: PeriodoDias) {
  return useQuery({
    queryKey: ['uso-modulos', dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_uso_modulos', { p_dias: dias })
      if (error) throw error
      return data as UsoModulosPayload
    },
    staleTime: 60_000,
  })
}

export function useUsoModuloDetalhe(modulo: string | null, dias: PeriodoDias) {
  return useQuery({
    queryKey: ['uso-modulo-detalhe', modulo, dias],
    enabled: Boolean(modulo),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_uso_modulo_detalhe', {
        p_modulo: modulo,
        p_dias: dias,
      })
      if (error) throw error
      return data as ModuloDetalhePayload
    },
    staleTime: 60_000,
  })
}

// Metas de adoção por módulo (sys_uso_metas, RLS admin-only)
export function useUsoMetas() {
  return useQuery({
    queryKey: ['uso-metas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sys_uso_metas').select('modulo, meta_pct')
      if (error) throw error
      const out: Record<string, number> = {}
      for (const m of data ?? []) out[m.modulo] = m.meta_pct
      return out
    },
    staleTime: 60_000,
  })
}

// Última análise de IA em cache para o período (sys_uso_insights, RLS admin).
// pollMs: quando uma análise assíncrona (SuperTEG) está em andamento, o painel
// passa um intervalo para revalidar até o callback gravar o resultado.
export function useUltimaAnalise(dias: PeriodoDias, pollMs: number | false = false) {
  return useQuery({
    queryKey: ['uso-insights', dias],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_uso_insights')
        .select('payload, modelo, created_at')
        .eq('periodo_dias', dias)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
        ? { analise: data.payload as UsoInsights, modelo: data.modelo as string | null, gerado_em: data.created_at as string }
        : null
    },
    staleTime: 60_000,
    refetchInterval: pollMs,
  })
}

export interface GerarAnaliseResposta {
  ok: boolean
  sincrono?: boolean
  processando?: boolean
  run_id?: string
  analise?: UsoInsights
  gerado_em?: string
}

// Solicita uma nova análise ao SuperTEG (Claude na VPS) via edge function/n8n.
// Resposta pode ser síncrona ({ analise }) ou assíncrona ({ processando: true }).
export function useGerarAnalise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dias: PeriodoDias) => {
      const { data, error } = await supabase.functions.invoke('uso-modulos-insights', {
        body: { dias },
      })
      if (error) throw error
      if (!data?.ok) throw new Error(data?.motivo ?? 'Falha ao solicitar a análise.')
      return data as GerarAnaliseResposta
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['uso-insights'] }),
  })
}

export function useSalvarMeta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ modulo, metaPct }: { modulo: string; metaPct: number | null }) => {
      if (metaPct == null) {
        const { error } = await supabase.from('sys_uso_metas').delete().eq('modulo', modulo)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('sys_uso_metas')
          .upsert({ modulo, meta_pct: metaPct, updated_at: new Date().toISOString() })
        if (error) throw error
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['uso-metas'] }),
  })
}
