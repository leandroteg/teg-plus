import { useQuery } from '@tanstack/react-query'
import type { DashboardData } from '../types'
import { supabase } from '../services/supabase'

export function useDashboard(periodo = 'mes', obraId?: string) {
  return useQuery<DashboardData>({
    queryKey: ['dashboard', periodo, obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_dashboard_compras', {
          p_periodo: periodo,
          p_obra_id: obraId ?? null,
        })
      if (error) throw error
      return data as DashboardData
    },
    refetchInterval: 30_000,
  })
}
