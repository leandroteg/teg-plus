import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { ModuloDetalhePayload, UsoModulosPayload } from '../types/usoModulos'

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
