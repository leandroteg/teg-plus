import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

// ── Types ───────────────────────────────────────────────────────────────────────

export interface PreCadastro {
  id: string
  entidade: string
  tabela_destino: string
  dados: Record<string, unknown>
  status: 'pendente' | 'aprovado' | 'rejeitado'
  solicitado_por: string | null
  solicitante_nome: string | null
  revisado_por: string | null
  revisor_nome: string | null
  motivo_rejeicao: string | null
  created_at: string
  updated_at: string
}

const ENTITY_LABELS: Record<string, string> = {
  fornecedores: 'Fornecedor',
  empresas: 'Empresa',
  itens: 'Item',
  colaboradores: 'Colaborador',
  obras: 'Obra',
  classes_financeiras: 'Classe Financeira',
  centros_custo: 'Centro de Custo',
  grupos_financeiros: 'Grupo Financeiro',
  categorias_financeiras: 'Categoria Financeira',
}

export function getEntityLabel(entidade: string): string {
  return ENTITY_LABELS[entidade] || entidade
}

// Table mapping for insert on approve
const TABLE_MAP: Record<string, string> = {
  fornecedores: 'cmp_fornecedores',
  empresas: 'sys_empresas',
  itens: 'est_itens',
  colaboradores: 'rh_colaboradores',
  obras: 'sys_obras',
  classes_financeiras: 'fin_classes_financeiras',
  centros_custo: 'fin_centros_custo',
  grupos_financeiros: 'fin_grupos_financeiros',
  categorias_financeiras: 'fin_categorias_financeiras',
}

// ── Hook ────────────────────────────────────────────────────────────────────────

export function usePreCadastros() {
  const { perfil, isAdmin, papelGlobal, canTechnicalApprove } = useAuth()
  const qc = useQueryClient()

  const isAdminOrDirector =
    isAdmin
    || papelGlobal === 'diretor'
    || papelGlobal === 'ceo'
    || canTechnicalApprove('cadastros')

  // Fetch pending pre-cadastros (admin/director only)
  const { data: pendentes = [], isLoading } = useQuery({
    queryKey: ['pre-cadastros', 'pendente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_pre_cadastros')
        .select('*')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as PreCadastro[]
    },
    enabled: isAdminOrDirector,
    staleTime: 30_000, // poll every 30s
    refetchInterval: 30_000,
  })

  // Approve mutation — inserts into target table + updates status (#24)
  const aprovar = useMutation({
    mutationFn: async ({ id, dados, entidade, tabela_destino }: {
      id: string
      dados: Record<string, unknown>
      entidade?: string
      tabela_destino?: string
    }) => {
      // Prefer explicitly passed entidade/tabela_destino; fall back to pendentes lookup
      const resolvedEntidade = entidade ?? pendentes.find(p => p.id === id)?.entidade
      const resolvedTabela   = tabela_destino ?? pendentes.find(p => p.id === id)?.tabela_destino
      if (!resolvedEntidade) throw new Error('Pre-cadastro nao encontrado — recarregue a pagina')

      const targetTable = TABLE_MAP[resolvedEntidade] || resolvedTabela || resolvedEntidade

      // Insert into the actual table
      const { error: insertError } = await supabase
        .from(targetTable)
        .insert(dados)
      if (insertError) throw insertError

      // Update pre-cadastro status — use .select() to detect silent RLS failures
      const { data: updated, error: updateError } = await supabase
        .from('sys_pre_cadastros')
        .update({
          status: 'aprovado',
          dados,
          revisado_por: perfil?.auth_id,
          revisor_nome: perfil?.nome,
        })
        .eq('id', id)
        .select()
      if (updateError) throw updateError
      if (!updated || updated.length === 0) {
        throw new Error('Sem permissao para atualizar o pre-cadastro. Contate o administrador.')
      }
      return { id }
    },
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['pre-cadastros'] })
      const prev = qc.getQueryData<PreCadastro[]>(['pre-cadastros', 'pendente'])
      qc.setQueryData<PreCadastro[]>(['pre-cadastros', 'pendente'], (old = []) =>
        old.filter(p => p.id !== id),
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['pre-cadastros', 'pendente'], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['pre-cadastros'] })
    },
  })

  // Mark as approved without re-inserting data (used when item was saved via the full form modal)
  const marcarAprovado = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data: updated, error } = await supabase
        .from('sys_pre_cadastros')
        .update({
          status: 'aprovado',
          revisado_por: perfil?.auth_id,
          revisor_nome: perfil?.nome,
        })
        .eq('id', id)
        .select()
      if (error) throw error
      if (!updated || updated.length === 0) {
        throw new Error('Sem permissao para marcar como aprovado. Contate o administrador.')
      }
      return { id }
    },
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['pre-cadastros'] })
      const prev = qc.getQueryData<PreCadastro[]>(['pre-cadastros', 'pendente'])
      qc.setQueryData<PreCadastro[]>(['pre-cadastros', 'pendente'], (old = []) =>
        old.filter(p => p.id !== id),
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['pre-cadastros', 'pendente'], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['pre-cadastros'] })
      qc.invalidateQueries({ queryKey: ['est-itens'] })
      qc.invalidateQueries({ queryKey: ['lookups'] })
    },
  })

  // Reject mutation
  const rejeitar = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data: updated, error } = await supabase
        .from('sys_pre_cadastros')
        .update({
          status: 'rejeitado',
          motivo_rejeicao: motivo,
          revisado_por: perfil?.auth_id,
          revisor_nome: perfil?.nome,
        })
        .eq('id', id)
        .select()
      if (error) throw error
      if (!updated || updated.length === 0) {
        throw new Error('Sem permissao para rejeitar o pre-cadastro. Contate o administrador.')
      }
      return { id }
    },
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['pre-cadastros'] })
      const prev = qc.getQueryData<PreCadastro[]>(['pre-cadastros', 'pendente'])
      qc.setQueryData<PreCadastro[]>(['pre-cadastros', 'pendente'], (old = []) =>
        old.filter(p => p.id !== id),
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['pre-cadastros', 'pendente'], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['pre-cadastros'] })
    },
  })

  return {
    pendentes,
    count: pendentes.length,
    isLoading,
    isAdminOrDirector,
    aprovar,
    marcarAprovado,
    rejeitar,
  }
}
