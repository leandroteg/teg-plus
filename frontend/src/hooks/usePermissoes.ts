/**
 * Hook de permissões granulares (RBAC)
 *
 * Fase 1: Carrega permissões do role do usuário + overrides individuais.
 * Mantém backward compat com perfil.modulos e perfil.role.
 *
 * Uso:
 *   const { temPermissao, permissoesDoModulo } = usePermissoes()
 *   if (temPermissao('compras', 'aprovar')) { ... }
 *   if (temPermissao('financeiro', 'criar', { valor: 100000 })) { ... }
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

export interface RolePermissao {
  modulo: string
  acao: string
  condicao: Record<string, unknown> | null
}

export interface SysRole {
  id: string
  nome: string
  descricao: string | null
  alcada_nivel: number
  is_system: boolean
  cor: string
  icone: string
}

export interface PerfilPermissaoOverride {
  modulo: string
  acao: string
  concedido: boolean
  condicao: Record<string, unknown> | null
}

// ── Fetch all roles ──────────────────────────────────────────────────────────

export function useRoles() {
  return useQuery({
    queryKey: ['sys_roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_roles')
        .select('*')
        .order('alcada_nivel', { ascending: false })
      if (error) throw error
      return data as SysRole[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ── Fetch role permissions ──────────────────────────────────────────────────

export function useRolePermissoes(roleId: string | null | undefined) {
  return useQuery({
    queryKey: ['sys_role_permissoes', roleId],
    queryFn: async () => {
      if (!roleId) return []
      const { data, error } = await supabase
        .from('sys_role_permissoes')
        .select('modulo, acao, condicao')
        .eq('role_id', roleId)
      if (error) throw error
      return data as RolePermissao[]
    },
    enabled: !!roleId,
    staleTime: 5 * 60 * 1000,
  })
}

// ── Fetch profile permission overrides ──────────────────────────────────────

export function usePerfilPermissoes(perfilId: string | null | undefined) {
  return useQuery({
    queryKey: ['sys_perfil_permissoes', perfilId],
    queryFn: async () => {
      if (!perfilId) return []
      const { data, error } = await supabase
        .from('sys_perfil_permissoes')
        .select('modulo, acao, concedido, condicao')
        .eq('perfil_id', perfilId)
      if (error) throw error
      return data as PerfilPermissaoOverride[]
    },
    enabled: !!perfilId,
    staleTime: 5 * 60 * 1000,
  })
}

// ── Hook principal de permissões ────────────────────────────────────────────

export function usePermissoes() {
  const { perfil, isAdmin } = useAuth()

  const roleId = perfil?.role_id
  const perfilId = perfil?.id

  const { data: rolePerms = [] } = useRolePermissoes(roleId)
  const { data: perfilOverrides = [] } = usePerfilPermissoes(perfilId)

  /**
   * Verifica se o usuário tem permissão para uma ação em um módulo.
   *
   * Lógica:
   * 1. Admin sempre pode tudo
   * 2. Verifica overrides do perfil (concedido=true/false)
   * 3. Verifica permissões do role
   * 4. Fallback: usa perfil.modulos (backward compat)
   */
  const temPermissao = (modulo: string, acao: string = 'ver', _contexto?: Record<string, unknown>): boolean => {
    // Admin bypass
    if (isAdmin) return true

    // Override individual (prevalece sobre role)
    const override = perfilOverrides.find(o => o.modulo === modulo && o.acao === acao)
    if (override) return override.concedido

    // Se tem role_id, usa permissões do role
    if (roleId && rolePerms.length > 0) {
      return rolePerms.some(p => p.modulo === modulo && p.acao === acao)
    }

    // Fallback: backward compat com perfil.modulos
    if (acao === 'ver') {
      return perfil?.modulos?.[modulo] === true
    }

    return false
  }

  /**
   * Retorna todas as ações permitidas para um módulo
   */
  const permissoesDoModulo = (modulo: string): string[] => {
    if (isAdmin) return ['ver', 'criar', 'editar', 'aprovar', 'excluir']

    const acoes = new Set<string>()

    // Do role
    rolePerms
      .filter(p => p.modulo === modulo)
      .forEach(p => acoes.add(p.acao))

    // Overrides
    perfilOverrides
      .filter(o => o.modulo === modulo)
      .forEach(o => {
        if (o.concedido) acoes.add(o.acao)
        else acoes.delete(o.acao)
      })

    // Fallback
    if (acoes.size === 0 && perfil?.modulos?.[modulo] === true) {
      acoes.add('ver')
    }

    return Array.from(acoes)
  }

  return {
    temPermissao,
    permissoesDoModulo,
    rolePerms,
    perfilOverrides,
    isReady: !!perfil,
  }
}
