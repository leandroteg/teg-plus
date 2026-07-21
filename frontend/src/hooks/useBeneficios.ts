// ─────────────────────────────────────────────────────────────────────────────
// hooks/useBeneficios.ts — DP › Benefícios (Fase 1: Plano de Saúde)
// Adesões em rh_beneficio_adesoes; vidas (titular+dependentes) sincronizam
// con_contratos.quantitativo via trigger no banco (rh_beneficio_sync_contrato).
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

export interface BeneficioAdesao {
  id: string
  colaborador_id: string
  tipo: string
  contrato_id: string | null
  dependentes: number
  valor_mensal: number | null
  desconto_mensal: number | null
  data_inicio: string
  data_fim: string | null
  observacao: string | null
  colaborador?: { nome: string; matricula: string | null; cargo: string | null } | null
}

export interface ContratoPlanoSaude {
  id: string
  numero: string
  contraparte_nome: string | null
  valor_mensal: number | null
  preco_unitario: number | null
  quantitativo: number | null
}

// Adesões ativas de um tipo de benefício (com o colaborador embutido — FK real)
export function useAdesoesBeneficio(tipo = 'plano_saude') {
  return useQuery({
    queryKey: ['rh_beneficio_adesoes', tipo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_beneficio_adesoes')
        .select('*, colaborador:rh_colaboradores(nome, matricula, cargo)')
        .eq('tipo', tipo)
        .is('data_fim', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as BeneficioAdesao[]
    },
  })
}

// Contrato do plano de saúde (Hapvida) — categoria 'medicos' recorrente vigente
export function useContratoPlanoSaude() {
  return useQuery({
    queryKey: ['contrato_plano_saude'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_contratos')
        .select('id, numero, contraparte_nome, valor_mensal, preco_unitario, quantitativo')
        .eq('tipo_categoria', 'medicos')
        .eq('recorrente', true)
        .eq('status', 'vigente')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as ContratoPlanoSaude | null
    },
  })
}

function useInvalidarBeneficios() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['rh_beneficio_adesoes'] })
    qc.invalidateQueries({ queryKey: ['contrato_plano_saude'] })
  }
}

export function useAderirBeneficio() {
  const invalidar = useInvalidarBeneficios()
  return useMutation({
    mutationFn: async (p: { colaboradorId: string; tipo?: string; contratoId?: string | null; dependentes?: number; criadoPor?: string | null }) => {
      const { error } = await supabase.from('rh_beneficio_adesoes').insert({
        colaborador_id: p.colaboradorId,
        tipo: p.tipo ?? 'plano_saude',
        contrato_id: p.contratoId ?? null,
        dependentes: p.dependentes ?? 0,
        valor_mensal: (p as { valorMensal?: number }).valorMensal ?? null,
        desconto_mensal: 60,  // padrão da rubrica 8111 (editável na matriz)
        criado_por_nome: p.criadoPor ?? null,
      })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useAtualizarAdesao() {
  const invalidar = useInvalidarBeneficios()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; dependentes?: number; valor_mensal?: number | null; desconto_mensal?: number | null; data_inicio?: string }) => {
      const { error } = await supabase
        .from('rh_beneficio_adesoes')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useEncerrarAdesao() {
  const invalidar = useInvalidarBeneficios()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rh_beneficio_adesoes')
        .update({ data_fim: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}
