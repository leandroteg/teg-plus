import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

// Mesmo padrao do banco: UPPER + remove acentos (replica unaccent no client)
function norm(s: string): string {
  // U+0300..U+036F = combining diacritical marks
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
}

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

  // Permissão concedida por usuário (flag no perfil) — permite gestores/requisitantes
  // específicos gerenciarem pré-cadastros sem mudar o papel. Espelha o RLS
  // can_manage_pre_cadastros() na sys_pre_cadastros.
  const podeAprovarCadastros = !!((perfil?.permissoes_especiais as Record<string, unknown> | null)?.pode_aprovar_cadastros)

  const isAdminOrDirector =
    isAdmin
    || papelGlobal === 'diretor'
    || papelGlobal === 'ceo'
    || canTechnicalApprove('cadastros')
    || podeAprovarCadastros

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

  // ── Dedup automatico: pre-cadastros que ja existem como cadastro real ─────────
  // Para itens: bate por descricao normalizada (UPPER + unaccent)
  // Para fornecedores: por CNPJ (forte) ou razao_social normalizada (fallback)
  const { data: idsJaExistentes = [] } = useQuery({
    queryKey: ['pre-cadastros-dedup', pendentes.map(p => p.id).join(',')],
    enabled: pendentes.length > 0,
    queryFn: async () => {
      const matchedIds: string[] = []

      const itensPendentes = pendentes.filter(p => p.entidade === 'itens')
      const fornPendentes  = pendentes.filter(p => p.entidade === 'fornecedores')

      // itens — busca pelo descricao normalizada
      for (const p of itensPendentes) {
        const desc = (p.dados.descricao as string | undefined) ?? ''
        const descNorm = norm(desc)
        if (!descNorm) continue
        const { data } = await supabase
          .from('est_itens')
          .select('id')
          .eq('descricao', descNorm)
          .limit(1)
        if (data && data.length > 0) matchedIds.push(p.id)
      }

      // fornecedores — bate por CNPJ se tiver, senao por razao_social normalizada
      for (const p of fornPendentes) {
        const cnpj = (p.dados.cnpj as string | undefined)?.replace(/\D/g, '')
        const razao = (p.dados.razao_social as string | undefined) ?? ''
        let achou = false
        if (cnpj && cnpj.length >= 11) {
          const { data } = await supabase
            .from('cmp_fornecedores')
            .select('id')
            .eq('cnpj', cnpj)
            .limit(1)
          if (data && data.length > 0) achou = true
        }
        if (!achou && razao) {
          const razNorm = norm(razao)
          if (razNorm) {
            const { data } = await supabase
              .from('cmp_fornecedores')
              .select('id')
              .eq('razao_social', razNorm)
              .limit(1)
            if (data && data.length > 0) achou = true
          }
        }
        if (achou) matchedIds.push(p.id)
      }

      return matchedIds
    },
    staleTime: 60_000,
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

  // Auto-aprova pre-cadastros cujo cadastro real ja existe (silencioso, 1x por id)
  const autoProcessadosRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const id of idsJaExistentes) {
      if (autoProcessadosRef.current.has(id)) continue
      autoProcessadosRef.current.add(id)
      marcarAprovado.mutate({ id })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsJaExistentes])

  // Esconde os ja-existentes da UI imediatamente, mesmo antes do servidor responder
  const pendentesFiltrados = pendentes.filter(p => !idsJaExistentes.includes(p.id))

  return {
    pendentes: pendentesFiltrados,
    count: pendentesFiltrados.length,
    isLoading,
    isAdminOrDirector,
    aprovar,
    marcarAprovado,
    rejeitar,
  }
}
