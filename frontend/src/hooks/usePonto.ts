// hooks/usePonto.ts — dados do módulo Ponto (DP), lendo do espelho do Secullum
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { proximoMes } from '../lib/ponto'
import type {
  PontoResumoMes, PontoDia, PontoAfastamento, PontoRetificacao, HoraExtraItem, AprovKey, AprovStatus, PontoDiaLista,
} from '../types/ponto'

// Conjunto de ids de colaboradores ATIVOS (para filtrar a lista de ponto por situação)
// Quem o Ponto deve cobrar. Nem todo colaborador ativo bate ponto:
//   cargo de confianca -> isento por definicao;
//   afastado           -> licenca medica / suspensao / maternidade.
// Os dois continuam ativos e no headcount, mas fora da lista de ponto - senao
// aparecem todo mes com o mes inteiro de "falta".
export interface PontoElegiveis {
  /** ativos que DEVEM bater ponto */
  batem: Set<string>
  /** ativos afastados (licenca medica / suspensao / maternidade) */
  afastados: Set<string>
  /** ativos em cargo de confianca (isentos por definicao) */
  confianca: Set<string>
  /** todos os ativos */
  ativos: Set<string>
}

export function useColabAtivosIds() {
  return useQuery<PontoElegiveis>({
    queryKey: ['ponto-colab-elegiveis'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const vazio: PontoElegiveis = { batem: new Set(), afastados: new Set(), confianca: new Set(), ativos: new Set() }
      const { data, error } = await supabase.from('rh_colaboradores')
        .select('id, cargo_confianca, afastado').eq('ativo', true)
      if (error) { console.error('useColabAtivosIds:', error); return vazio }
      const r: PontoElegiveis = { batem: new Set(), afastados: new Set(), confianca: new Set(), ativos: new Set() }
      for (const c of (data ?? []) as { id: string; cargo_confianca?: boolean; afastado?: boolean }[]) {
        r.ativos.add(c.id)
        if (c.afastado) r.afastados.add(c.id)
        else if (c.cargo_confianca) r.confianca.add(c.id)
        else r.batem.add(c.id)
      }
      return r
    },
  })
}

// Visão diária: todas as marcações/apuração de UM dia
export function usePontoDia(dataISO: string, baseId?: string) {
  return useQuery<PontoDiaLista[]>({
    queryKey: ['ponto-dia', dataISO, baseId || 'all'],
    enabled: !!dataISO,
    queryFn: async () => {
      let q = supabase.from('rh_ponto_dia')
        .select('data, secullum_func_id, colaborador_id, base_id, cargo, entrada1, saida1, entrada2, saida2, normais, faltas, ex50, ex70, ex100, aprov_status, equip_e1:raw->>EquipIdEntrada1, equip_s1:raw->>EquipIdSaida1, equip_e2:raw->>EquipIdEntrada2, equip_s2:raw->>EquipIdSaida2, colaborador:rh_colaboradores!colaborador_id(nome, base_id, base:est_bases!base_id(nome)), base:est_bases!base_id(nome)')
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
        // só batida real: Origem <> 2 (exclui inclusão manual/import)
        supabase.from('rh_ponto_dia').select('colaborador_id, data').gte('data', desde).not('entrada1', 'is', null)
          .neq('raw->FonteDadosEntrada1->>Origem', '2').limit(5000),
        // Denominador = quem REALMENTE deve bater ponto: ativo no de-para do Secullum
        // E ativo no TEG+ E fora de cargo de confiança / afastamento. O !inner também
        // derruba link sem colaborador vinculado — esse nunca poderia entrar no
        // numerador (o pico conta colaborador_id), então inflava o denominador à toa.
        supabase.from('rh_ponto_linkcolab')
          .select('secullum_func_id, colaborador:rh_colaboradores!inner(id)', { count: 'exact', head: true })
          .eq('status', 'ativo')
          .eq('colaborador.ativo', true)
          .eq('colaborador.cargo_confianca', false)
          .eq('colaborador.afastado', false),
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
      // sem paginar, 12 meses (~4 mil linhas) voltariam cortados em 1000
      try {
        return await paginar<PontoResumoMes>((from, to) => supabase
          .from('vw_rh_ponto_resumo_mes').select('*')
          .gte('ano_mes', `${de}-01`).lte('ano_mes', `${ate}-01`)
          .order('ano_mes').order('colaborador_nome').order('colaborador_id')
          .range(from, to))
      } catch (e) { console.error('usePontoResumoPeriodo:', e); return [] }
    },
  })
}

// Horas extras por PERÍODO (de..ate em 'YYYY-MM')
export function usePontoHorasExtrasPeriodo(de: string, ate: string) {
  return useQuery<HoraExtraItem[]>({
    queryKey: ['ponto-he-periodo', de, ate],
    queryFn: async () => {
      try {
        return await paginar<HoraExtraItem>((from, to) => supabase
          .from('vw_rh_ponto_hora_extra').select('*')
          .gte('data', `${de}-01`).lt('data', proximoMes(`${ate}-01`))
          .order('data', { ascending: false }).order('secullum_func_id').range(from, to))
      } catch (e) { console.error('usePontoHorasExtrasPeriodo:', e); return [] }
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

// O PostgREST do Supabase capa em 1000 linhas por request mesmo com .limit()
// maior — um .limit(3000) devolve 1000 em silêncio e o total da tela mente.
// Pagina em lotes e concatena. A ordenação precisa ser TOTAL (com desempate),
// senão linha repete ou some entre um lote e outro.
const PAGE = 1000
async function paginar<T>(
  lote: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
  max = 30_000,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await lote(from, from + PAGE - 1)
    if (error) throw error
    const pag = (data ?? []) as T[]
    all.push(...pag)
    if (pag.length < PAGE) break
  }
  return all
}

// Retificações = dias com batida de Origem 2 (inclusão manual no Secullum).
// Lê a view, que desempacota o rh_ponto_dia.raw já gravado — o endpoint
// /FonteDados (que trazia o texto do motivo) saiu do sync em 29/06, então
// `motivo` só vem preenchido até essa data.
export function usePontoRetificacoes(anoMes: string) {
  return useQuery<PontoRetificacao[]>({
    queryKey: ['ponto-retificacoes', anoMes],
    queryFn: async () => {
      try {
        return await paginar<PontoRetificacao>((from, to) => supabase
          .from('vw_rh_ponto_retificacao').select('*')
          .gte('data', anoMes).lt('data', proximoMes(anoMes))
          .order('data', { ascending: false }).order('secullum_func_id')
          .range(from, to))
      } catch (e) { console.error('usePontoRetificacoes:', e); return [] }
    },
  })
}

// Horas extras = dias com extra > 0 (view)
export function usePontoHorasExtras(anoMes: string, baseId?: string) {
  return useQuery<HoraExtraItem[]>({
    queryKey: ['ponto-horas-extras', anoMes, baseId || 'all'],
    queryFn: async () => {
      try {
        return await paginar<HoraExtraItem>((from, to) => {
          let q = supabase.from('vw_rh_ponto_hora_extra').select('*')
            .gte('data', anoMes).lt('data', proximoMes(anoMes))
          if (baseId) q = q.eq('base_id', baseId)
          return q.order('data', { ascending: false }).order('secullum_func_id').range(from, to)
        })
      } catch (e) { console.error('usePontoHorasExtras:', e); return [] }
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
      // retificação tem tabela de aprovação PRÓPRIA: 75% dos dias com retificação
      // também têm hora extra, e rh_ponto_dia.aprov_status é uma coluna só —
      // aprovar um marcaria o outro.
      const rets = v.keys.filter(k => k.tipo === 'retificacao' && k.data && k.secullum_func_id != null)
      const ids = v.keys.filter(k => k.tipo === 'atestado').map(k => k.id).filter((x): x is string => !!x)
      const hes = v.keys.filter(k => k.tipo === 'hora_extra')
      if (rets.length) {
        const rows = rets.map(k => ({ data: k.data!, secullum_func_id: k.secullum_func_id!, ...patch }))
        const { error } = await supabase.from('rh_ponto_ret_aprov').upsert(rows, { onConflict: 'data,secullum_func_id' })
        if (error) throw error
      }
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
      if (k.tipo === 'retificacao') res = await supabase.from('rh_ponto_ret_aprov')
        .upsert({ data: k.data!, secullum_func_id: k.secullum_func_id!, ...patch }, { onConflict: 'data,secullum_func_id' })
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

// dispositivos de ponto (Ponto Virtual) — p/ o filtro da tela Registros Ponto
export function usePontoDispositivos() {
  return useQuery<{ secullum_equip_id: number; descricao: string; base_id: string | null }[]>({
    queryKey: ['ponto-dispositivos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rh_ponto_linkdisp').select('secullum_equip_id, descricao, base_id').order('descricao')
      if (error) { console.error('usePontoDispositivos:', error); return [] }
      return (data ?? []) as { secullum_equip_id: number; descricao: string; base_id: string | null }[]
    },
    staleTime: 10 * 60 * 1000,
  })
}
