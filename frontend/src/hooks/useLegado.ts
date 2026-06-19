// ─────────────────────────────────────────────────────────────────────────────
// hooks/useLegado.ts — Relatórios Legado (Controladoria)
// Lê a view agregada vw_legado_resumo (custos históricos TOTVS/NIBO).
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

export interface LegadoResumo {
  ano: number | null
  mes: number | null
  competencia: string | null
  polo: string | null
  pmo_projeto_id: string | null
  obra_id: string | null
  obra_nome: string | null
  tipo_cc: string | null
  grupo_dre: string | null
  natureza_dre: string | null
  classe_id: string | null
  classe_desc: string | null
  centro_custo_id: string | null
  centro_custo_desc: string | null
  qtd: number
  valor: number
}

// Busca paginada (a view passa de 1000 linhas).
export function useLegadoResumo() {
  return useQuery<LegadoResumo[]>({
    queryKey: ['legado-resumo'],
    queryFn: async () => {
      const out: LegadoResumo[] = []
      const size = 1000
      let from = 0
      for (;;) {
        const { data, error } = await supabase
          .from('vw_legado_resumo')
          .select('*')
          .range(from, from + size - 1)
        if (error) throw error
        const batch = (data ?? []) as LegadoResumo[]
        out.push(...batch)
        if (batch.length < size) break
        from += size
      }
      return out.map(r => ({ ...r, valor: Number(r.valor) || 0, qtd: Number(r.qtd) || 0 }))
    },
    staleTime: 10 * 60 * 1000,
  })
}
