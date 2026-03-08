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
  const { perfil, isAdmin } = useAuth()
  const qc = useQueryClient()

  const isAdminOrDirector = isAdmin || perfil?.role === 'gerente'

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

  // Approve mutation — inserts into target table + updates status
  const aprovar = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Record<string, unknown> }) => {
      // Find the pre-cadastro to get target table
      const pre = pendentes.find(p => p.id === id)
      if (!pre) throw new Error('Pre-cadastro nao encontrado')

      const targetTable = TABLE_MAP[pre.entidade] || pre.tabela_destino

      // Insert into the actual table
      const { error: insertError } = await supabase
        .from(targetTable)
        .insert(dados)
      if (insertError) throw insertError

      // Update pre-cadastro status
      const { error: updateError } = await supabase
        .from('sys_pre_cadastros')
        .update({
          status: 'aprovado',
          dados,
          revisado_por: perfil?.auth_id,
          revisor_nome: perfil?.nome,
        })
        .eq('id', id)
      if (updateError) throw updateError
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pre-cadastros'] })
    },
  })

  // Reject mutation
  const rejeitar = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await supabase
        .from('sys_pre_cadastros')
        .update({
          status: 'rejeitado',
          motivo_rejeicao: motivo,
          revisado_por: perfil?.auth_id,
          revisor_nome: perfil?.nome,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pre-cadastros'] })
    },
  })

  return {
    pendentes,
    count: pendentes.length,
    isLoading,
    isAdminOrDirector,
    aprovar,
    rejeitar,
  }
}
