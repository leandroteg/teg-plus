import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

/**
 * Gera o proximo codigo sequencial para uma tabela.
 * Ex: prefix="CC", tabela ja tem CC-001, CC-002 → retorna "CC-003"
 */
export function useNextCode(table: string, prefix: string, enabled = true) {
  return useQuery<string>({
    queryKey: ['next-code', table, prefix],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from(table)
        .select('codigo')
        .like('codigo', `${prefix}-%`)
        .order('codigo', { ascending: false })
        .limit(1)

      if (!data || data.length === 0) return `${prefix}-001`

      const lastCode = data[0].codigo as string
      const numPart = lastCode.replace(`${prefix}-`, '')
      const nextNum = (parseInt(numPart, 10) || 0) + 1
      return `${prefix}-${String(nextNum).padStart(3, '0')}`
    },
    staleTime: 5000, // Refresh apos 5s para pegar novos registros
  })
}

/**
 * Busca valores distintos em uma coluna para autocomplete.
 * Retorna ate 8 sugestoes que contenham o query (ILIKE).
 */
export function useSmartSearch(table: string, column: string, query: string) {
  const trimmed = query.trim()
  return useQuery<string[]>({
    queryKey: ['smart-search', table, column, trimmed],
    enabled: trimmed.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from(table)
        .select(column)
        .ilike(column, `%${trimmed}%`)
        .order(column)
        .limit(8)

      if (!data) return []
      // Deduplica e retorna somente strings
      const seen = new Set<string>()
      return data
        .map((row: any) => String(row[column] ?? ''))
        .filter((v: string) => {
          if (!v || seen.has(v.toLowerCase())) return false
          seen.add(v.toLowerCase())
          return true
        })
    },
    staleTime: 10000,
  })
}
