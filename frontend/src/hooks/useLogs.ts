// ─────────────────────────────────────────────────────────────────────────────
// hooks/useLogs.ts
// Auditoria de negócio: lê a tabela sys_log_atividades (populada por triggers no
// Postgres) com filtros e paginação no servidor. Usado pela tela /admin/logs.
// ─────────────────────────────────────────────────────────────────────────────
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

/** Tamanho de página buscado do servidor a cada rolagem. */
export const LOGS_PAGE_SIZE = 40

export type LogTipo = 'INSERT' | 'UPDATE' | 'DELETE'

export interface LogAtividade {
  id: string
  modulo: string
  entidade_tipo: string | null
  entidade_id: string | null
  tipo: LogTipo | string
  descricao: string | null
  usuario_id: string | null
  usuario_nome: string | null
  dados: {
    operation?: string
    origem?: 'usuario' | 'sistema'
    campos_alterados?: string[] | null
    old?: Record<string, unknown> | null
    new?: Record<string, unknown> | null
  } | null
  created_at: string
}

export interface LogsFiltro {
  /** Prefixo do módulo, ex: 'fin', 'con', 'sys' (vazio = todos) */
  modulo?: string
  /** INSERT | UPDATE | DELETE (vazio = todos) */
  tipo?: string
  /** id do usuário (vazio = todos) */
  usuarioId?: string
  /** busca por nome do usuário / entidade */
  busca?: string
  /** ISO date (inclusive) — início do intervalo */
  de?: string
  /** ISO date (inclusive) — fim do intervalo */
  ate?: string
}

/**
 * Lista paginada de logs de auditoria (mais recentes primeiro), com filtros
 * aplicados no servidor. Usa useInfiniteQuery + range() para escalar bem mesmo
 * com dezenas de milhares de registros.
 */
export function useLogs(filtro: LogsFiltro) {
  return useInfiniteQuery({
    queryKey: ['sys_log_atividades', filtro],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = pageParam * LOGS_PAGE_SIZE
      const to = from + LOGS_PAGE_SIZE - 1

      let q = supabase
        .from('sys_log_atividades')
        .select(
          'id, modulo, entidade_tipo, entidade_id, tipo, descricao, usuario_id, usuario_nome, dados, created_at',
        )
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filtro.modulo) q = q.eq('modulo', filtro.modulo)
      if (filtro.tipo) q = q.eq('tipo', filtro.tipo)
      if (filtro.usuarioId) q = q.eq('usuario_id', filtro.usuarioId)
      if (filtro.de) q = q.gte('created_at', filtro.de)
      if (filtro.ate) q = q.lte('created_at', `${filtro.ate}T23:59:59.999Z`)
      if (filtro.busca?.trim()) {
        const termo = `%${filtro.busca.trim()}%`
        // busca no nome do usuário ou no tipo de entidade
        q = q.or(`usuario_nome.ilike.${termo},entidade_tipo.ilike.${termo}`)
      }

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as LogAtividade[]
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < LOGS_PAGE_SIZE ? undefined : allPages.length,
    staleTime: 30 * 1000,
  })
}

/**
 * Lista de módulos distintos presentes nos logs, para popular o filtro.
 * (Consulta leve via RPC, cacheada por mais tempo.)
 */
export function useLogModulos() {
  return useQuery({
    queryKey: ['sys_log_atividades_modulos'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('log_modulos_distintos')
      // Fallback: se a RPC não existir, deriva de uma amostra recente.
      if (error) {
        const { data: sample } = await supabase
          .from('sys_log_atividades')
          .select('modulo')
          .order('created_at', { ascending: false })
          .limit(1000)
        const set = new Set((sample ?? []).map((r: { modulo: string }) => r.modulo))
        return Array.from(set).sort()
      }
      return ((data ?? []) as { modulo: string }[]).map((r) => r.modulo).sort()
    },
    staleTime: 10 * 60 * 1000,
  })
}

/** Lista de usuários que aparecem nos logs, para popular o filtro. */
export function useLogUsuarios() {
  return useQuery({
    queryKey: ['sys_perfis_para_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_perfis')
        .select('id, nome')
        .order('nome')
      if (error) throw error
      return (data ?? []) as { id: string; nome: string }[]
    },
    staleTime: 10 * 60 * 1000,
  })
}
