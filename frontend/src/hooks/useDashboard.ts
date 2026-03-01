import { useQuery } from '@tanstack/react-query'
import type { DashboardData, Requisicao, Aprovacao } from '../types'
import { supabase } from '../services/supabase'

// Tabelas: cmp_requisicoes | apr_aprovacoes (módulos Compras e Aprovações)
const TABLE_REQ = 'cmp_requisicoes'
const TABLE_APR = 'apr_aprovacoes'

// Mapeia a resposta do RPC para o tipo DashboardData
function mapRpcToDashboard(raw: Record<string, unknown>): DashboardData {
  const kpisRaw = (raw.kpis ?? {}) as Record<string, number>
  const recentes = (raw.recentes ?? []) as Requisicao[]
  const aprovacoesPendentes = (raw.aprovacoes_pendentes ?? []) as Aprovacao[]
  const porStatus = (raw.por_status ?? []) as { status: string; total: number; valor: number }[]
  const porObra   = (raw.por_obra   ?? []) as { obra_nome: string; total: number; valor: number; pendentes: number }[]

  return {
    kpis: {
      total_mes:                  kpisRaw.total ?? 0,
      aguardando_aprovacao:       kpisRaw.aguardando_aprovacao ?? 0,
      aprovadas_mes:              kpisRaw.aprovadas ?? 0,
      rejeitadas_mes:             kpisRaw.rejeitadas ?? 0,
      valor_total_mes:            kpisRaw.valor_total ?? 0,
      tempo_medio_aprovacao_horas: kpisRaw.tempo_medio_aprovacao_horas ?? 0,
    },
    por_status:             porStatus ?? [],
    por_obra:               porObra   ?? [],
    requisicoes_recentes:   recentes  ?? [],
    aprovacoes_pendentes:   aprovacoesPendentes ?? [],
  }
}

// Fallback: consultas diretas caso o RPC falhe
async function fetchDashboardDireto(periodo: string): Promise<DashboardData> {
  const agora = new Date()
  let dataInicio: Date

  if (periodo === 'semana') {
    dataInicio = new Date(agora)
    dataInicio.setDate(agora.getDate() - agora.getDay())
    dataInicio.setHours(0, 0, 0, 0)
  } else if (periodo === 'trimestre') {
    const mes = Math.floor(agora.getMonth() / 3) * 3
    dataInicio = new Date(agora.getFullYear(), mes, 1)
  } else {
    dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
  }

  const [reqRes, aprRes] = await Promise.all([
    supabase
      .from(TABLE_REQ)
      .select('id, numero, solicitante_nome, obra_nome, obra_id, descricao, valor_estimado, urgencia, status, alcada_nivel, categoria, created_at')
      .gte('created_at', dataInicio.toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from(TABLE_APR)
      .select('id, entidade_id, aprovador_nome, aprovador_email, nivel, status, token, data_limite')
      .eq('status', 'pendente')
      .eq('modulo', 'cmp')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (reqRes.error) throw reqRes.error

  const requisicoes = (reqRes.data ?? []) as Requisicao[]
  const aprovacoes  = ((aprRes.data ?? []) as unknown[]).map((a: unknown) => {
    const apr = a as Record<string, unknown>
    return { ...apr, requisicao_id: apr.entidade_id } as Aprovacao
  })

  const total_mes            = requisicoes.length
  const aguardando_aprovacao = requisicoes.filter(r => r.status === 'em_aprovacao').length
  const aprovadas_mes        = requisicoes.filter(r => r.status === 'aprovada').length
  const rejeitadas_mes       = requisicoes.filter(r => r.status === 'rejeitada').length
  const valor_total_mes      = requisicoes.reduce((s, r) => s + (r.valor_estimado ?? 0), 0)

  const porStatusMap: Record<string, { total: number; valor: number }> = {}
  for (const r of requisicoes) {
    if (!porStatusMap[r.status]) porStatusMap[r.status] = { total: 0, valor: 0 }
    porStatusMap[r.status].total++
    porStatusMap[r.status].valor += r.valor_estimado ?? 0
  }

  const porObraMap: Record<string, { total: number; valor: number; pendentes: number }> = {}
  for (const r of requisicoes) {
    if (!porObraMap[r.obra_nome]) porObraMap[r.obra_nome] = { total: 0, valor: 0, pendentes: 0 }
    porObraMap[r.obra_nome].total++
    porObraMap[r.obra_nome].valor += r.valor_estimado ?? 0
    if (r.status === 'em_aprovacao') porObraMap[r.obra_nome].pendentes++
  }

  return {
    kpis: { total_mes, aguardando_aprovacao, aprovadas_mes, rejeitadas_mes, valor_total_mes, tempo_medio_aprovacao_horas: 0 },
    por_status:           Object.entries(porStatusMap).map(([status, v]) => ({ status, ...v })),
    por_obra:             Object.entries(porObraMap).map(([obra_nome, v]) => ({ obra_nome, ...v })).sort((a, b) => b.valor - a.valor),
    requisicoes_recentes: requisicoes.slice(0, 20),
    aprovacoes_pendentes: aprovacoes,
  }
}

export function useDashboard(periodo = 'mes', obraId?: string) {
  return useQuery<DashboardData>({
    queryKey: ['dashboard', periodo, obraId],
    queryFn: async () => {
      // Tenta RPC primeiro (uma chamada, mais eficiente)
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_dashboard_compras', {
          p_periodo: periodo,
          p_obra_id: obraId ?? null,
        })

      if (!rpcError && rpcData) {
        return mapRpcToDashboard(rpcData as Record<string, unknown>)
      }

      // Fallback: consultas diretas nas tabelas
      return fetchDashboardDireto(periodo)
    },
    refetchInterval: 30_000,
    retry: 1,
    staleTime: 10_000,
  })
}
