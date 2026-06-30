// hooks/usePonto.ts — dados do módulo Ponto (DP), lendo do espelho do Secullum
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { proximoMes } from '../lib/ponto'
import type {
  PontoResumoMes, PontoDia, PontoAfastamento, PontoRetificacao, HoraExtraItem, AprovKey, AprovStatus,
} from '../types/ponto'

// Resumo mensal por colaborador (Registros / Consolidação)
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

// Retificações = marcações (FonteDados) com motivo
export function usePontoRetificacoes(anoMes: string) {
  return useQuery<PontoRetificacao[]>({
    queryKey: ['ponto-retificacoes', anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_ponto_marcacao')
        .select('nsr, data_hora, origem, motivo, aprov_status, aprov_por, aprov_em, colaborador:rh_colaboradores!colaborador_id(nome, base_id, base:est_bases!base_id(nome))')
        .eq('origem', '2')   // Origem 2 = inclusão/edição MANUAL no cartão (= retificação); 3=REP físico, 16=app
        .not('motivo', 'is', null)
        .gte('data', anoMes).lt('data', proximoMes(anoMes))
        .order('data_hora', { ascending: false }).limit(2000)
      if (error) { console.error('usePontoRetificacoes:', error); return [] }
      return (data ?? []) as unknown as PontoRetificacao[]
    },
  })
}

// Horas extras = dias com extra > 0 (view)
export function usePontoHorasExtras(anoMes: string, baseId?: string) {
  return useQuery<HoraExtraItem[]>({
    queryKey: ['ponto-horas-extras', anoMes, baseId || 'all'],
    queryFn: async () => {
      let q = supabase.from('vw_rh_ponto_hora_extra').select('*')
        .gte('data', anoMes).lt('data', proximoMes(anoMes))
      if (baseId) q = q.eq('base_id', baseId)
      const { data, error } = await q.order('data', { ascending: false }).limit(3000)
      if (error) { console.error('usePontoHorasExtras:', error); return [] }
      return (data ?? []) as HoraExtraItem[]
    },
  })
}

// Atestados / afastamentos
export function usePontoAtestados(anoMes: string) {
  return useQuery<PontoAfastamento[]>({
    queryKey: ['ponto-atestados', anoMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_ponto_afastamento')
        .select('*, colaborador:rh_colaboradores!colaborador_id(nome, base_id, base:est_bases!base_id(nome))')
        .lt('inicio', proximoMes(anoMes))
        .or(`fim.gte.${anoMes},fim.is.null`)
        .order('inicio', { ascending: false })
      if (error) { console.error('usePontoAtestados:', error); return [] }
      return (data ?? []) as unknown as PontoAfastamento[]
    },
  })
}

// Aprovar / reprovar um item (status no próprio registro)
export function useAprovarItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { key: AprovKey; status: AprovStatus; aprovador: string }) => {
      const patch = { aprov_status: v.status, aprov_por: v.aprovador, aprov_em: new Date().toISOString() }
      const k = v.key
      let res
      if (k.tipo === 'retificacao') res = await supabase.from('rh_ponto_marcacao').update(patch).eq('nsr', k.nsr!)
      else if (k.tipo === 'hora_extra') res = await supabase.from('rh_ponto_dia').update(patch).eq('data', k.data!).eq('secullum_func_id', k.secullum_func_id!)
      else res = await supabase.from('rh_ponto_afastamento').update(patch).eq('id', k.id!)
      if (res.error) throw res.error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ponto-retificacoes'] })
      qc.invalidateQueries({ queryKey: ['ponto-horas-extras'] })
      qc.invalidateQueries({ queryKey: ['ponto-atestados'] })
    },
  })
}
