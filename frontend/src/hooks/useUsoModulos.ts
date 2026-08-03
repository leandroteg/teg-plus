import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { ModuloDetalhePayload, UsoModulosPayload, UsoPorUsuarioPeriodoPayload } from '../types/usoModulos'

export type PeriodoDias = 7 | 30 | 90

// excluirAdmins: quando true, as RPCs descartam acessos/ações dos perfis
// 'administrador' e os tiram da base de usuários (denominador da adoção).
export function useUsoModulos(dias: PeriodoDias, excluirAdmins = false) {
  return useQuery({
    queryKey: ['uso-modulos', dias, excluirAdmins],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_uso_modulos', {
        p_dias: dias,
        p_excluir_admins: excluirAdmins,
      })
      if (error) throw error
      return data as UsoModulosPayload
    },
    staleTime: 60_000,
  })
}

// Tabela "Uso por usuário" com período independente do filtro geral da página
// (inicio/fim em 'YYYY-MM-DD', interpretados no fuso America/Sao_Paulo)
export function useUsoPorUsuario(inicio: string, fim: string, excluirAdmins = false) {
  return useQuery({
    queryKey: ['uso-por-usuario', inicio, fim, excluirAdmins],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_uso_por_usuario', {
        p_inicio: inicio,
        p_fim: fim,
        p_excluir_admins: excluirAdmins,
      })
      if (error) throw error
      return data as UsoPorUsuarioPeriodoPayload
    },
    staleTime: 60_000,
  })
}

export function useUsoModuloDetalhe(modulo: string | null, dias: PeriodoDias, excluirAdmins = false) {
  return useQuery({
    queryKey: ['uso-modulo-detalhe', modulo, dias, excluirAdmins],
    enabled: Boolean(modulo),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_uso_modulo_detalhe', {
        p_modulo: modulo,
        p_dias: dias,
        p_excluir_admins: excluirAdmins,
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
