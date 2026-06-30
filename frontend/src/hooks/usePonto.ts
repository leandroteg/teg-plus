// hooks/usePonto.ts — dados do módulo Ponto (DP), lendo do espelho do Secullum
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { proximoMes } from '../lib/ponto'
import type {
  PontoResumoMes, PontoDia, PontoAfastamento, PontoPendencia, PontoAprovacao, PontoRetificacao,
} from '../types/ponto'

// Resumo mensal por colaborador (1 linha/pessoa) — base das abas Registros/Horas Extras/Consolidação
export function usePontoResumoMes(anoMes: string, baseId?: string) {
  return useQuery<PontoResumoMes[]>({
    queryKey: ['ponto-resumo', anoMes, baseId || 'all'],
    queryFn: async () => {
      let q = supabase.from('vw_rh_ponto_resumo_mes').select('*').eq('ano_mes', anoMes)
      if (baseId) q = q.eq('base_id', baseId)
      const { data, error } = await q.order('colaborador_nome')
      if (error) { console.error('usePontoResumoMes:', error); return [] }
      return (data ?? []) as PontoResumoMes[]
    },
  })
}

// Cartão (dia a dia) de um colaborador no mês
export function usePontoCartao(colaboradorId?: string, anoMes?: string) {
  return useQuery<PontoDia[]>({
    queryKey: ['ponto-cartao', colaboradorId, anoMes],
    enabled: !!colaboradorId && !!anoMes,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_ponto_dia').select('*')
        .eq('colaborador_id', colaboradorId!)
        .gte('data', anoMes!).lt('data', proximoMes(anoMes!))
        .order('data')
      if (error) { console.error('usePontoCartao:', error); return [] }
      return (data ?? []) as PontoDia[]
    },
  })
}

// Retificações = marcações (FonteDados) com motivo/justificativa no mês
export function usePontoRetificacoes(anoMes: string) {
  return useQuery<PontoRetificacao[]>({
    queryKey: ['ponto-retificacoes', anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_ponto_marcacao')
        .select('data_hora, origem, motivo, nsr, colaborador:rh_colaboradores!colaborador_id(nome, base_id, base:est_bases!base_id(nome))')
        .not('motivo', 'is', null)
        .gte('data', anoMes).lt('data', proximoMes(anoMes))
        .order('data_hora', { ascending: false }).limit(1000)
      if (error) { console.error('usePontoRetificacoes:', error); return [] }
      return (data ?? []) as unknown as PontoRetificacao[]
    },
  })
}

export function usePontoAfastamentos(anoMes: string) {
  return useQuery<PontoAfastamento[]>({
    queryKey: ['ponto-afastamentos', anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_ponto_afastamento')
        .select('*, colaborador:rh_colaboradores!colaborador_id(nome)')
        .lt('inicio', proximoMes(anoMes))
        .or(`fim.gte.${anoMes},fim.is.null`)
        .order('inicio', { ascending: false })
      if (error) { console.error('usePontoAfastamentos:', error); return [] }
      return (data ?? []) as PontoAfastamento[]
    },
  })
}

export function usePontoPendencias() {
  return useQuery<PontoPendencia[]>({
    queryKey: ['ponto-pendencias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_ponto_pendencia')
        .select('*, colaborador:rh_colaboradores!colaborador_id(nome)')
        .order('data_hora', { ascending: false }).limit(500)
      if (error) { console.error('usePontoPendencias:', error); return [] }
      return (data ?? []) as PontoPendencia[]
    },
  })
}

export function usePontoAprovacoes(anoMes: string) {
  return useQuery<PontoAprovacao[]>({
    queryKey: ['ponto-aprovacoes', anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_ponto_aprovacao').select('*').eq('ano_mes', anoMes)
      if (error) { console.error('usePontoAprovacoes:', error); return [] }
      return (data ?? []) as PontoAprovacao[]
    },
  })
}

// Enviar ponto da base p/ aprovação (status enviado)
export function useEnviarAprovacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { anoMes: string; baseId: string }) => {
      const { error } = await supabase.from('rh_ponto_aprovacao').upsert({
        ano_mes: v.anoMes, base_id: v.baseId, status: 'enviado',
        enviado_em: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: 'ano_mes,base_id' })
      if (error) throw error
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['ponto-aprovacoes', v.anoMes] }),
  })
}

// Aprovar / reprovar
export function useDecidirAprovacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { anoMes: string; baseId: string; aprovar: boolean; aprovador: string; observacao?: string }) => {
      const { error } = await supabase.from('rh_ponto_aprovacao').upsert({
        ano_mes: v.anoMes, base_id: v.baseId,
        status: v.aprovar ? 'aprovado' : 'reprovado',
        aprovado_em: new Date().toISOString(), aprovador_nome: v.aprovador,
        observacao: v.observacao ?? null, updated_at: new Date().toISOString(),
      }, { onConflict: 'ano_mes,base_id' })
      if (error) throw error
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['ponto-aprovacoes', v.anoMes] }),
  })
}
