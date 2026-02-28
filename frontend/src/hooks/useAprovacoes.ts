import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AprovacaoPendente } from '../types'
import { supabase } from '../services/supabase'
import { api } from '../services/api'

const DEMO_APROVACOES: AprovacaoPendente[] = [
  {
    id: 'apr-1', requisicao_id: 'demo-5', aprovador_nome: 'Diretor Operacional',
    aprovador_email: 'diretor@teguniao.com.br', nivel: 3,
    status: 'pendente', token: 'apr-token-001',
    data_limite: new Date(Date.now() + 172800000).toISOString(),
    requisicao: {
      id: 'demo-5', numero: 'RC-202602-0008', solicitante_nome: 'Pedro Costa',
      obra_nome: 'SE Frutal', descricao: 'Locacao de guindaste 50t - 5 dias',
      valor_estimado: 32000, urgencia: 'critica', status: 'em_aprovacao',
      alcada_nivel: 3, categoria: 'servicos', created_at: new Date(Date.now() - 345600000).toISOString(),
    },
    cotacao_resumo: {
      fornecedor_nome: 'Loc Norte Guindastes',
      valor: 28500,
      prazo_dias: 3,
      total_cotados: 3,
    },
  },
  {
    id: 'apr-2', requisicao_id: 'demo-1', aprovador_nome: 'Gerente de Compras',
    aprovador_email: 'gerente@teguniao.com.br', nivel: 2,
    status: 'pendente', token: 'apr-token-002',
    data_limite: new Date(Date.now() + 86400000).toISOString(),
    requisicao: {
      id: 'demo-1', numero: 'RC-202602-0012', solicitante_nome: 'Carlos Silva',
      obra_nome: 'SE Frutal', descricao: 'Cabos XLPE 15kV 50mm2 - Fase 2',
      valor_estimado: 22750, urgencia: 'normal', status: 'em_aprovacao',
      alcada_nivel: 2, categoria: 'eletrico', created_at: new Date().toISOString(),
    },
    cotacao_resumo: {
      fornecedor_nome: 'Eletro Cabos MG',
      valor: 21200,
      prazo_dias: 7,
      total_cotados: 3,
    },
  },
  {
    id: 'apr-3', requisicao_id: 'demo-2', aprovador_nome: 'Diretor Operacional',
    aprovador_email: 'diretor@teguniao.com.br', nivel: 3,
    status: 'pendente', token: 'apr-token-003',
    data_limite: new Date(Date.now() + 259200000).toISOString(),
    requisicao: {
      id: 'demo-2', numero: 'RC-202602-0011', solicitante_nome: 'Ana Santos',
      obra_nome: 'SE Paracatu', descricao: 'Transformadores de corrente 600A',
      valor_estimado: 38500, urgencia: 'urgente', status: 'em_aprovacao',
      alcada_nivel: 3, categoria: 'eletrico', created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    cotacao_resumo: {
      fornecedor_nome: 'ABB Instrumentacao',
      valor: 36800,
      prazo_dias: 15,
      total_cotados: 2,
    },
  },
]

function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL || ''
  return url !== '' && !url.includes('placeholder')
}

export function useAprovacoesPendentes() {
  return useQuery<AprovacaoPendente[]>({
    queryKey: ['aprovacoes-pendentes'],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return DEMO_APROVACOES

      try {
        const { data, error } = await supabase
          .from('aprovacoes')
          .select('*, requisicao:requisicoes(*)')
          .eq('status', 'pendente')
          .order('created_at', { ascending: false })

        if (error) throw error
        return (data as AprovacaoPendente[]) ?? []
      } catch {
        return DEMO_APROVACOES
      }
    },
    refetchInterval: 15_000,
    retry: false,
  })
}

export function useProcessarAprovacaoAi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { token: string; decisao: 'aprovada' | 'rejeitada'; observacao?: string }) =>
      api.processarAprovacao(vars.token, vars.decisao, vars.observacao),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
