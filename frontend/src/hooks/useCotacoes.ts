import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Cotacao, NovaCotacaoPayload } from '../types'
import { supabase } from '../services/supabase'
import { api } from '../services/api'

const DEMO_COTACOES: Cotacao[] = [
  {
    id: 'cot-1', requisicao_id: 'demo-1', comprador_id: 'comp-1',
    comprador_nome: 'Marcos Almeida', status: 'pendente',
    created_at: new Date().toISOString(),
    requisicao: {
      id: 'demo-1', numero: 'RC-202602-0012', solicitante_nome: 'Carlos Silva',
      obra_nome: 'SE Frutal', descricao: 'Cabos XLPE 15kV 50mm2 - Fase 2',
      valor_estimado: 22750, urgencia: 'normal', status: 'em_cotacao',
      alcada_nivel: 2, categoria: 'eletrico', created_at: new Date().toISOString(),
    },
  },
  {
    id: 'cot-2', requisicao_id: 'demo-2', comprador_id: 'comp-1',
    comprador_nome: 'Marcos Almeida', status: 'em_andamento',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    requisicao: {
      id: 'demo-2', numero: 'RC-202602-0011', solicitante_nome: 'Ana Santos',
      obra_nome: 'SE Paracatu', descricao: 'Transformadores de corrente 600A',
      valor_estimado: 38500, urgencia: 'urgente', status: 'em_cotacao',
      alcada_nivel: 3, categoria: 'eletrico', created_at: new Date(Date.now() - 86400000).toISOString(),
    },
  },
  {
    id: 'cot-3', requisicao_id: 'demo-5', comprador_id: 'comp-3',
    comprador_nome: 'Ricardo Santos', status: 'concluida',
    valor_selecionado: 28500, fornecedor_selecionado_nome: 'Loc Norte Guindastes',
    data_conclusao: new Date(Date.now() - 172800000).toISOString(),
    created_at: new Date(Date.now() - 345600000).toISOString(),
    requisicao: {
      id: 'demo-5', numero: 'RC-202602-0008', solicitante_nome: 'Pedro Costa',
      obra_nome: 'SE Frutal', descricao: 'Locacao de guindaste 50t - 5 dias',
      valor_estimado: 32000, urgencia: 'critica', status: 'em_aprovacao',
      alcada_nivel: 3, categoria: 'servicos', created_at: new Date(Date.now() - 345600000).toISOString(),
    },
    fornecedores: [
      {
        id: 'forn-1', cotacao_id: 'cot-3', fornecedor_nome: 'Loc Norte Guindastes',
        fornecedor_contato: '(34) 3333-1111', valor_total: 28500,
        prazo_entrega_dias: 3, condicao_pagamento: '30 dias',
        itens_precos: [{ descricao: 'Guindaste 50t - diaria', qtd: 5, valor_unitario: 5700, valor_total: 28500 }],
        selecionado: true,
      },
      {
        id: 'forn-2', cotacao_id: 'cot-3', fornecedor_nome: 'MG Locacoes',
        fornecedor_contato: '(31) 3222-4444', valor_total: 35000,
        prazo_entrega_dias: 5, condicao_pagamento: '28 dias',
        itens_precos: [{ descricao: 'Guindaste 50t - diaria', qtd: 5, valor_unitario: 7000, valor_total: 35000 }],
        selecionado: false,
      },
      {
        id: 'forn-3', cotacao_id: 'cot-3', fornecedor_nome: 'Total Equipamentos',
        fornecedor_contato: '(11) 4555-6666', valor_total: 31200,
        prazo_entrega_dias: 4, condicao_pagamento: '30 dias',
        itens_precos: [{ descricao: 'Guindaste 50t - diaria', qtd: 5, valor_unitario: 6240, valor_total: 31200 }],
        selecionado: false,
      },
    ],
  },
]

function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL || ''
  return url !== '' && !url.includes('placeholder')
}

export function useCotacoes(compradorId?: string, status?: string) {
  return useQuery<Cotacao[]>({
    queryKey: ['cotacoes', compradorId, status],
    queryFn: async () => {
      if (!isSupabaseConfigured()) {
        let result = DEMO_COTACOES
        if (compradorId) result = result.filter(c => c.comprador_id === compradorId)
        if (status) result = result.filter(c => c.status === status)
        return result
      }

      try {
        let query = supabase
          .from('cotacoes')
          .select('*, requisicao:requisicoes(*)')
          .order('created_at', { ascending: false })

        if (compradorId) query = query.eq('comprador_id', compradorId)
        if (status) query = query.eq('status', status)

        const { data, error } = await query
        if (error) throw error
        return (data as Cotacao[]) ?? []
      } catch {
        return DEMO_COTACOES
      }
    },
    refetchInterval: 30_000,
    retry: false,
  })
}

export function useCotacao(id?: string) {
  return useQuery<Cotacao | null>({
    queryKey: ['cotacao', id],
    enabled: !!id,
    queryFn: async () => {
      if (!isSupabaseConfigured()) {
        const found = DEMO_COTACOES.find(c => c.id === id)
        return found ?? null
      }

      try {
        const { data, error } = await supabase
          .from('cotacoes')
          .select('*, requisicao:requisicoes(*), fornecedores:cotacao_fornecedores(*)')
          .eq('id', id)
          .single()
        if (error) throw error
        return data as Cotacao
      } catch {
        return DEMO_COTACOES.find(c => c.id === id) ?? null
      }
    },
    retry: false,
  })
}

export function useSubmeterCotacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: NovaCotacaoPayload) => api.submeterCotacao(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotacoes'] })
      qc.invalidateQueries({ queryKey: ['cotacao'] })
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
