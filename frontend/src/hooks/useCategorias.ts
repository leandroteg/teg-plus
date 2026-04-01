import { useQuery } from '@tanstack/react-query'
import type { CategoriaMaterial } from '../types'
import { supabase } from '../services/supabase'

export function useCategorias() {
  return useQuery<CategoriaMaterial[]>({
    queryKey: ['categorias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cmp_categorias')
        .select(`
          id, codigo, nome, keywords, cor, icone,
          comprador_nome, alcada1_aprovador, alcada1_limite,
          cotacoes_regras, politica_resumo, tipo
        `)
        .eq('ativo', true)
        .order('nome')

      if (error) throw error
      return (data ?? []) as CategoriaMaterial[]
    },
    staleTime: 5 * 60_000,   // 5 min (categorias mudam raramente)
    retry: 2,
  })
}
