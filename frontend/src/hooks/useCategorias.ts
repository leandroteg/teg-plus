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
          validador_tecnico_id, alcada1_aprovador_id, alcada2_aprovador_id,
          cotacoes_regras, politica_resumo, tipo
        `)
        .eq('ativo', true)
        .order('nome')

      if (error) throw error
      const cats = (data ?? []) as CategoriaMaterial[]

      // Resolve nomes dos aprovadores de alcada (FK -> sys_perfis) num lookup unico
      const ids = Array.from(new Set(
        cats.flatMap(c => [c.validador_tecnico_id, c.alcada1_aprovador_id, c.alcada2_aprovador_id]).filter(Boolean) as string[],
      ))
      if (ids.length > 0) {
        const { data: perfis } = await supabase
          .from('sys_perfis')
          .select('id, nome')
          .in('id', ids)
        const nomePorId = new Map((perfis ?? []).map(p => [p.id as string, p.nome as string]))
        for (const c of cats) {
          c.validador_tecnico_nome = c.validador_tecnico_id ? (nomePorId.get(c.validador_tecnico_id) ?? null) : null
          c.alcada1_aprovador_nome = c.alcada1_aprovador_id ? (nomePorId.get(c.alcada1_aprovador_id) ?? null) : null
          c.alcada2_aprovador_nome = c.alcada2_aprovador_id ? (nomePorId.get(c.alcada2_aprovador_id) ?? null) : null
        }
      }
      return cats
    },
    staleTime: 5 * 60_000,   // 5 min (categorias mudam raramente)
    retry: 2,
  })
}
