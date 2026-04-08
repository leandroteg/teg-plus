// ─────────────────────────────────────────────────────────────────────────────
// hooks/useRH.ts — Hooks do módulo Gestão de Colaboradores (RH)
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  RHColaborador, RHDependente, RHDocumento,
  RHMovimentacao, RHAdmissao, RHDesligamento,
  FiltrosColaboradores,
} from '../types/rh'

// ── Colaboradores ────────────────────────────────────────────────────────────

export function useRHColaboradores(filtros?: FiltrosColaboradores) {
  return useQuery<RHColaborador[]>({
    queryKey: ['rh-colaboradores', filtros],
    queryFn: async () => {
      let q = supabase
        .from('rh_colaboradores')
        .select('*, obra:sys_obras!obra_id(id, codigo, nome), gestor:rh_colaboradores!gestor_id(id, nome)')
        .order('nome')

      if (filtros?.ativo !== undefined) q = q.eq('ativo', filtros.ativo)
      if (filtros?.tipo_contrato) q = q.eq('tipo_contrato', filtros.tipo_contrato)
      if (filtros?.departamento) q = q.eq('departamento', filtros.departamento)
      if (filtros?.setor) q = q.eq('setor', filtros.setor)
      if (filtros?.obra_id) q = q.eq('obra_id', filtros.obra_id)

      const { data, error } = await q
      if (error) { console.error('useRHColaboradores:', error); return [] }
      return (data ?? []) as RHColaborador[]
    },
  })
}

export function useRHColaborador(id?: string) {
  return useQuery<RHColaborador | null>({
    queryKey: ['rh-colaborador', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_colaboradores')
        .select('*, obra:sys_obras!obra_id(id, codigo, nome), gestor:rh_colaboradores!gestor_id(id, nome)')
        .eq('id', id!)
        .single()
      if (error) return null
      return data as RHColaborador
    },
  })
}

export function useSalvarRHColaborador() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<RHColaborador> & { id?: string }) => {
      const { id, obra, gestor, ...rest } = payload as any
      if (id) {
        const { data, error } = await supabase.from('rh_colaboradores').update(rest).eq('id', id).select('*').single()
        if (error) throw error
        return data
      } else {
        const { data, error } = await supabase.from('rh_colaboradores').insert(rest).select('*').single()
        if (error) throw error
        return data
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-colaboradores'] })
      qc.invalidateQueries({ queryKey: ['rh-colaborador'] })
      qc.invalidateQueries({ queryKey: ['cad-colaboradores'] })
      qc.invalidateQueries({ queryKey: ['rh-stats'] })
    },
  })
}

// ── Dependentes ──────────────────────────────────────────────────────────────

export function useRHDependentes(colaboradorId?: string) {
  return useQuery<RHDependente[]>({
    queryKey: ['rh-dependentes', colaboradorId],
    enabled: !!colaboradorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_dependentes')
        .select('*')
        .eq('colaborador_id', colaboradorId!)
        .order('nome')
      if (error) return []
      return (data ?? []) as RHDependente[]
    },
  })
}

export function useSalvarRHDependente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<RHDependente> & { id?: string }) => {
      const { id, ...rest } = payload
      if (id) {
        const { error } = await supabase.from('rh_dependentes').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('rh_dependentes').insert(rest)
        if (error) throw error
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['rh-dependentes'] })
    },
  })
}

export function useRemoverRHDependente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rh_dependentes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-dependentes'] }),
  })
}

// ── Documentos ───────────────────────────────────────────────────────────────

export function useRHDocumentos(colaboradorId?: string) {
  return useQuery<RHDocumento[]>({
    queryKey: ['rh-documentos', colaboradorId],
    enabled: !!colaboradorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_documentos')
        .select('*')
        .eq('colaborador_id', colaboradorId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as RHDocumento[]
    },
  })
}

export function useSalvarRHDocumento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<RHDocumento>) => {
      const { error } = await supabase.from('rh_documentos').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-documentos'] }),
  })
}

// ── Movimentações ────────────────────────────────────────────────────────────

export function useRHMovimentacoes(filtros?: { colaborador_id?: string; tipo?: string }) {
  return useQuery<RHMovimentacao[]>({
    queryKey: ['rh-movimentacoes', filtros],
    queryFn: async () => {
      let q = supabase
        .from('rh_movimentacoes')
        .select(`
          *,
          colaborador:rh_colaboradores!colaborador_id(id, nome, cargo, matricula, foto_url),
          obra_anterior:sys_obras!obra_anterior_id(id, codigo, nome),
          obra_nova:sys_obras!obra_nova_id(id, codigo, nome)
        `)
        .order('data_efetivacao', { ascending: false })

      if (filtros?.colaborador_id) q = q.eq('colaborador_id', filtros.colaborador_id)
      if (filtros?.tipo) q = q.eq('tipo', filtros.tipo)

      const { data, error } = await q
      if (error) { console.error('useRHMovimentacoes:', error); return [] }
      return (data ?? []) as RHMovimentacao[]
    },
  })
}

export function useSalvarRHMovimentacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<RHMovimentacao>) => {
      const { colaborador, obra_anterior, obra_nova, ...rest } = payload as any
      const { error } = await supabase.from('rh_movimentacoes').insert(rest)
      if (error) throw error

      // Atualizar colaborador com os dados novos
      const updates: Record<string, any> = {}
      if (rest.cargo_novo) updates.cargo = rest.cargo_novo
      if (rest.departamento_novo) updates.departamento = rest.departamento_novo
      if (rest.setor_novo) updates.setor = rest.setor_novo
      if (rest.obra_nova_id) updates.obra_id = rest.obra_nova_id
      if (rest.salario_novo) updates.salario = rest.salario_novo

      if (Object.keys(updates).length > 0 && rest.colaborador_id) {
        const { error: upErr } = await supabase
          .from('rh_colaboradores')
          .update(updates)
          .eq('id', rest.colaborador_id)
        if (upErr) console.error('Erro ao atualizar colaborador:', upErr)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-movimentacoes'] })
      qc.invalidateQueries({ queryKey: ['rh-colaboradores'] })
      qc.invalidateQueries({ queryKey: ['rh-colaborador'] })
      qc.invalidateQueries({ queryKey: ['rh-stats'] })
    },
  })
}

// ── Admissões ────────────────────────────────────────────────────────────────

export function useRHAdmissoes(filtros?: { status?: string }) {
  return useQuery<RHAdmissao[]>({
    queryKey: ['rh-admissoes', filtros],
    queryFn: async () => {
      let q = supabase
        .from('rh_admissoes')
        .select('*, obra_prevista:sys_obras!obra_prevista_id(id, codigo, nome), colaborador:rh_colaboradores!colaborador_id(id, nome)')
        .order('created_at', { ascending: false })

      if (filtros?.status) q = q.eq('status', filtros.status)

      const { data, error } = await q
      if (error) { console.error('useRHAdmissoes:', error); return [] }
      return (data ?? []) as RHAdmissao[]
    },
  })
}

export function useSalvarRHAdmissao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<RHAdmissao> & { id?: string }) => {
      const { id, obra_prevista, colaborador, ...rest } = payload as any
      if (id) {
        const { error } = await supabase.from('rh_admissoes').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('rh_admissoes').insert(rest)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-admissoes'] })
      qc.invalidateQueries({ queryKey: ['rh-stats'] })
    },
  })
}

// ── Desligamentos ────────────────────────────────────────────────────────────

export function useRHDesligamentos(filtros?: { status?: string }) {
  return useQuery<RHDesligamento[]>({
    queryKey: ['rh-desligamentos', filtros],
    queryFn: async () => {
      let q = supabase
        .from('rh_desligamentos')
        .select('*, colaborador:rh_colaboradores!colaborador_id(id, nome, cargo, matricula, departamento, data_admissao, foto_url)')
        .order('created_at', { ascending: false })

      if (filtros?.status) q = q.eq('status', filtros.status)

      const { data, error } = await q
      if (error) { console.error('useRHDesligamentos:', error); return [] }
      return (data ?? []) as RHDesligamento[]
    },
  })
}

export function useSalvarRHDesligamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<RHDesligamento> & { id?: string }) => {
      const { id, colaborador, ...rest } = payload as any
      if (id) {
        const { error } = await supabase.from('rh_desligamentos').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('rh_desligamentos').insert(rest)
        if (error) throw error
      }

      // Se concluído, marcar colaborador como inativo
      if (rest.status === 'concluido' && (rest.colaborador_id || payload.colaborador_id)) {
        const colabId = rest.colaborador_id || payload.colaborador_id
        await supabase.from('rh_colaboradores').update({
          ativo: false,
          data_demissao: rest.data_desligamento,
          motivo_demissao: rest.motivo,
        }).eq('id', colabId)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-desligamentos'] })
      qc.invalidateQueries({ queryKey: ['rh-colaboradores'] })
      qc.invalidateQueries({ queryKey: ['rh-stats'] })
    },
  })
}

// ── Stats (Dashboard) ────────────────────────────────────────────────────────

export interface RHStats {
  totalAtivos: number
  totalInativos: number
  totalCLT: number
  totalPJ: number
  admissoesMes: number
  desligamentosMes: number
  admissoesPendentes: number
  aniversariantes: RHColaborador[]
  porDepartamento: { departamento: string; total: number }[]
  porObra: { obra: string; total: number }[]
}

export function useRHStats() {
  return useQuery<RHStats>({
    queryKey: ['rh-stats'],
    queryFn: async () => {
      const { data: todos = [] } = await supabase
        .from('rh_colaboradores')
        .select('id, nome, ativo, tipo_contrato, departamento, data_nascimento, data_admissao, data_demissao, obra:sys_obras!obra_id(id, nome)')

      const { data: admissoes = [] } = await supabase
        .from('rh_admissoes')
        .select('id, status, created_at')

      const { data: desligamentos = [] } = await supabase
        .from('rh_desligamentos')
        .select('id, status, data_desligamento')

      const ativos = (todos as any[]).filter((c: any) => c.ativo)
      const inativos = (todos as any[]).filter((c: any) => !c.ativo)
      const now = new Date()
      const mesAtual = now.getMonth()
      const anoAtual = now.getFullYear()

      // Aniversariantes do mês
      const aniversariantes = ativos.filter((c: any) => {
        if (!c.data_nascimento) return false
        const dn = new Date(c.data_nascimento)
        return dn.getMonth() === mesAtual
      }) as RHColaborador[]

      // Admissões do mês
      const admissoesMes = (admissoes as any[]).filter((a: any) => {
        const d = new Date(a.created_at)
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual
      }).length

      // Desligamentos do mês
      const desligamentosMes = (desligamentos as any[]).filter((d: any) => {
        if (!d.data_desligamento) return false
        const dt = new Date(d.data_desligamento)
        return dt.getMonth() === mesAtual && dt.getFullYear() === anoAtual && d.status === 'concluido'
      }).length

      // Por departamento
      const deptMap = new Map<string, number>()
      ativos.forEach((c: any) => {
        const dept = c.departamento || 'Sem departamento'
        deptMap.set(dept, (deptMap.get(dept) || 0) + 1)
      })
      const porDepartamento = Array.from(deptMap.entries())
        .map(([departamento, total]) => ({ departamento, total }))
        .sort((a, b) => b.total - a.total)

      // Por obra
      const obraMap = new Map<string, number>()
      ativos.forEach((c: any) => {
        const obra = (c.obra as any)?.nome || 'Sem obra'
        obraMap.set(obra, (obraMap.get(obra) || 0) + 1)
      })
      const porObra = Array.from(obraMap.entries())
        .map(([obra, total]) => ({ obra, total }))
        .sort((a, b) => b.total - a.total)

      const admissoesPendentes = (admissoes as any[]).filter((a: any) =>
        a.status === 'pendente' || a.status === 'avaliacao_documentos' || a.status === 'aguardando_cadastro'
      ).length

      return {
        totalAtivos: ativos.length,
        totalInativos: inativos.length,
        totalCLT: ativos.filter((c: any) => c.tipo_contrato === 'CLT' || !c.tipo_contrato).length,
        totalPJ: ativos.filter((c: any) => c.tipo_contrato === 'PJ').length,
        admissoesMes,
        desligamentosMes,
        admissoesPendentes,
        aniversariantes,
        porDepartamento,
        porObra,
      }
    },
  })
}
