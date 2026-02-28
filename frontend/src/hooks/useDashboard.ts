import { useQuery } from '@tanstack/react-query'
import type { DashboardData } from '../types'
import { supabase } from '../services/supabase'

const DEMO_DATA: DashboardData = {
  kpis: {
    total_mes: 12,
    aguardando_aprovacao: 3,
    aprovadas_mes: 7,
    rejeitadas_mes: 2,
    valor_total_mes: 187450.00,
    tempo_medio_aprovacao_horas: 18.5,
  },
  por_status: [
    { status: 'em_aprovacao', total: 3, valor: 42300 },
    { status: 'aprovada', total: 7, valor: 128650 },
    { status: 'rejeitada', total: 2, valor: 16500 },
  ],
  por_obra: [
    { obra_nome: 'SE Frutal', total: 4, valor: 67200, pendentes: 1 },
    { obra_nome: 'SE Paracatu', total: 3, valor: 45800, pendentes: 1 },
    { obra_nome: 'SE Perdizes', total: 2, valor: 32100, pendentes: 0 },
    { obra_nome: 'SE Tres Marias', total: 2, valor: 28500, pendentes: 1 },
    { obra_nome: 'SE Ituiutaba', total: 1, valor: 13850, pendentes: 0 },
  ],
  requisicoes_recentes: [
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
  ],
}

function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL || ''
  return url !== '' && !url.includes('placeholder')
}

export function useDashboard(periodo = 'mes', obraId?: string) {
  return useQuery<DashboardData>({
    queryKey: ['dashboard', periodo, obraId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return DEMO_DATA

      try {
        const { data, error } = await supabase
          .rpc('get_dashboard_compras', {
            p_periodo: periodo,
            p_obra_id: obraId ?? null,
          })
        if (error) throw error
        return (data as DashboardData) ?? DEMO_DATA
      } catch {
        return DEMO_DATA
      }
    },
    refetchInterval: 30_000,
    retry: false,
  })
}
