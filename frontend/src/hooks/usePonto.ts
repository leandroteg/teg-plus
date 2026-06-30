// hooks/usePonto.ts — dados do módulo Ponto (DP), lendo do espelho do Secullum
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { proximoMes } from '../lib/ponto'
import type {
  PontoResumoMes, PontoDia, PontoAfastamento, PontoRetificacao, HoraExtraItem, AprovKey, AprovStatus, PontoDiaLista,
} from '../types/ponto'

// Visão diária: todas as marcações/apuração de UM dia
export function usePontoDia(dataISO: string, baseId?: string) {
  return useQuery<PontoDiaLista[]>({
    queryKey: ['ponto-dia', dataISO, baseId || 'all'],
    enabled: !!dataISO,
    queryFn: async () => {
      let q = supabase.from('rh_ponto_dia')
        .select('data, secullum_func_id, colaborador_id, base_id, cargo, entrada1, saida1, entrada2, saida2, normais, faltas, ex50, ex70, ex100, aprov_status, colaborador:rh_colaboradores!colaborador_id(nome), base:est_bases!base_id(nome)')
        .eq('data', dataISO)
      if (baseId) q = q.eq('base_id', baseId)
      const { data, error } = await q.limit(2000)
      if (error) { console.error('usePontoDia:', error); return [] }
      return (data ?? []) as unknown as PontoDiaLista[]
    },
  })
}

// Colaboradores ativos no ponto: pico diário de batedores nos últimos 7 dias vs headcount (ativos)
export function usePontoColabAtivos() {
  return useQuery<{ pico: number; headcount: number }>({
    queryKey: ['ponto-colab-ativos-7d'],
    queryFn: async () => {
      const d = new Date(); d.setDate(d.getDate() - 6)
      const desde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const [pontos, head] = await Promise.all([
        supabase.from('rh_ponto_dia').select('colaborador_id, data').gte('data', desde).not('entrada1', 'is', null).limit(5000),
        supabase.from('rh_colaboradores').select('id', { count: 'exact', head: true }).eq('ativo', true),
      ])
      if (pontos.error) console.error('usePontoColabAtivos:', pontos.error)
      const porDia = new Map<string, Set<string>>()
      for (const r of (pontos.data ?? []) as { colaborador_id: string | null; data: string }[]) {
        if (!r.colaborador_id) continue
        const set = porDia.get(r.data) ?? new Set<string>()
        set.add(r.colaborador_id); porDia.set(r.data, set)
      }
      const pico = porDia.size ? Math.max(...[...porDia.values()].map(s => s.size)) : 0
      return { pico, headcount: head.count ?? 0 }
    },
  })
}

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

// Resumo por PERÍODO (de..ate em 'YYYY-MM') — agrega vários meses (Painel DP)
export function usePontoResumoPeriodo(de: string, ate: string) {
  return useQuery<PontoResumoMes[]>({
    queryKey: ['ponto-resumo-periodo', de, ate],
    queryFn: async () => {
      const { data, error } = await supabase.from('vw_rh_ponto_resumo_mes').select('*')
        .gte('ano_mes', `${de}-01`).lte('ano_mes', `${ate}-01`).order('colaborador_nome')
      if (error) { console.error('usePontoResumoPeriodo:', error); return [] }
      return (data ?? []) as PontoResumoMes[]
    },
  })
}

// Horas extras por PERÍODO (de..ate em 'YYYY-MM')
export function usePontoHorasExtrasPeriodo(de: string, ate: string) {
  return useQuery<HoraExtraItem[]>({
    queryKey: ['ponto-he-periodo', de, ate],
    queryFn: async () => {
      const { data, error } = await supabase.from('vw_rh_ponto_hora_extra').select('*')
        .gte('data', `${de}-01`).lt('data', proximoMes(`${ate}-01`))
        .order('data', { ascending: false }).limit(3000)
      if (error) { console.error('usePontoHorasExtrasPeriodo:', error); return [] }
      return (data ?? []) as HoraExtraItem[]
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

// Enviar itens selecionados para aprovação (pendente -> em_aprovacao), em lote
export function useEnviarItens() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { keys: AprovKey[]; por: string }) => {
      const patch = { aprov_status: 'em_aprovacao', aprov_por: v.por, aprov_em: new Date().toISOString() }
      const nsrs = v.keys.filter(k => k.tipo === 'retificacao').map(k => k.nsr).filter((x): x is number => x != null)
      const ids = v.keys.filter(k => k.tipo === 'atestado').map(k => k.id).filter((x): x is string => !!x)
      const hes = v.keys.filter(k => k.tipo === 'hora_extra')
      if (nsrs.length) { const { error } = await supabase.from('rh_ponto_marcacao').update(patch).in('nsr', nsrs); if (error) throw error }
      if (ids.length) { const { error } = await supabase.from('rh_ponto_afastamento').update(patch).in('id', ids); if (error) throw error }
      for (const k of hes) { const { error } = await supabase.from('rh_ponto_dia').update(patch).eq('data', k.data!).eq('secullum_func_id', k.secullum_func_id!); if (error) throw error }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ponto-retificacoes'] })
      qc.invalidateQueries({ queryKey: ['ponto-horas-extras'] })
      qc.invalidateQueries({ queryKey: ['ponto-atestados'] })
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
