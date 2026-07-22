import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { UsoModulosPayload } from '../types/usoModulos'

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
