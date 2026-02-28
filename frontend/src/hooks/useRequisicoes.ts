import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Requisicao, NovaRequisicaoPayload } from '../types'
import { supabase } from '../services/supabase'
import { api } from '../services/api'

const DEMO_REQUISICOES: Requisicao[] = [
  {
    id: 'demo-1', numero: 'RC-202602-0012', solicitante_nome: 'Carlos Silva',
    obra_nome: 'SE Frutal', descricao: 'Cabos XLPE 15kV 50mm2 - Fase 2',
    valor_estimado: 22750, urgencia: 'normal', status: 'em_aprovacao',
    alcada_nivel: 2, created_at: new Date().toISOString(),
  },
  {
    id: 'demo-2', numero: 'RC-202602-0011', solicitante_nome: 'Ana Santos',
    obra_nome: 'SE Paracatu', descricao: 'Transformadores de corrente 600A',
    valor_estimado: 38500, urgencia: 'urgente', status: 'em_aprovacao',
    alcada_nivel: 3, created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'demo-3', numero: 'RC-202602-0010', solicitante_nome: 'Roberto Lima',
    obra_nome: 'SE Perdizes', descricao: 'EPIs - Luvas isolantes Classe 2',
    valor_estimado: 4200, urgencia: 'normal', status: 'aprovada',
    alcada_nivel: 1, created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'demo-4', numero: 'RC-202602-0009', solicitante_nome: 'Maria Oliveira',
    obra_nome: 'SE Tres Marias', descricao: 'Conectores de aluminio tipo cunha',
    valor_estimado: 8900, urgencia: 'normal', status: 'aprovada',
    alcada_nivel: 2, created_at: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: 'demo-5', numero: 'RC-202602-0008', solicitante_nome: 'Pedro Costa',
    obra_nome: 'SE Frutal', descricao: 'Locacao de guindaste 50t - 5 dias',
    valor_estimado: 32000, urgencia: 'critica', status: 'aprovada',
    alcada_nivel: 3, created_at: new Date(Date.now() - 345600000).toISOString(),
  },
  {
    id: 'demo-6', numero: 'RC-202602-0007', solicitante_nome: 'Joao Ferreira',
    obra_nome: 'SE Ituiutaba', descricao: 'Isoladores de porcelana 15kV',
    valor_estimado: 13850, urgencia: 'normal', status: 'aprovada',
    alcada_nivel: 2, created_at: new Date(Date.now() - 432000000).toISOString(),
  },
  {
    id: 'demo-7', numero: 'RC-202602-0006', solicitante_nome: 'Lucas Mendes',
    obra_nome: 'SE Paracatu', descricao: 'Aluguel de caminhao munck - 3 dias',
    valor_estimado: 9500, urgencia: 'normal', status: 'rejeitada',
    alcada_nivel: 2, created_at: new Date(Date.now() - 518400000).toISOString(),
  },
  {
    id: 'demo-8', numero: 'RC-202602-0005', solicitante_nome: 'Fernanda Rocha',
    obra_nome: 'SE Tres Marias', descricao: 'Cimento CP-V ARI - 200 sacos',
    valor_estimado: 7000, urgencia: 'urgente', status: 'rejeitada',
    alcada_nivel: 2, created_at: new Date(Date.now() - 604800000).toISOString(),
  },
]

function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL || ''
  return url !== '' && !url.includes('placeholder')
}

export function useRequisicoes(status?: string) {
  return useQuery<Requisicao[]>({
    queryKey: ['requisicoes', status],
    queryFn: async () => {
      if (!isSupabaseConfigured()) {
        if (status) return DEMO_REQUISICOES.filter(r => r.status === status)
        return DEMO_REQUISICOES
      }

      try {
        let query = supabase
          .from('requisicoes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)

        if (status) query = query.eq('status', status)

        const { data, error } = await query
        if (error) throw error
        return (data as Requisicao[]) ?? []
      } catch {
        if (status) return DEMO_REQUISICOES.filter(r => r.status === status)
        return DEMO_REQUISICOES
      }
    },
    refetchInterval: 30_000,
    retry: false,
  })
}

export function useCriarRequisicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: NovaRequisicaoPayload) => api.criarRequisicao(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useProcessarAprovacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { token: string; decisao: 'aprovada' | 'rejeitada'; observacao?: string }) =>
      api.processarAprovacao(vars.token, vars.decisao, vars.observacao),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
