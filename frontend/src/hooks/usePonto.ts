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

// ── Fechamento mensal do ponto ───────────────────────────────────────────────
// Não trava o rh_ponto_dia: o sync só cobre o mês corrente, então mês passado
// já congela sozinho. O fechamento guarda o snapshot dos totais e o estado.
export interface PontoFechamento {
  ano_mes: string
  status: 'fechado' | 'liberado'
  fechado_por: string | null; fechado_em: string | null
  liberado_por: string | null; liberado_em: string | null; liberado_motivo: string | null
  colaboradores: number | null; hh_min: number | null; extras_min: number | null; faltas_min: number | null
  /** intervalo REAL que foi fechado (competência da folha, 26→25) */
  periodo_ini: string | null; periodo_fim: string | null
}

export function usePontoFechamentos() {
  return useQuery<PontoFechamento[]>({
    queryKey: ['ponto-fechamentos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rh_ponto_fechamento').select('*').order('ano_mes', { ascending: false })
      if (error) { console.error('usePontoFechamentos:', error); return [] }
      return (data ?? []) as PontoFechamento[]
    },
  })
}

/** janela padrão da folha: 26 do mês anterior → 25 da competência */
export function janelaPadrao(anoMes: string) {
  const [y, m] = anoMes.slice(0, 7).split('-').map(Number)
  const ini = new Date(y, m - 2, 26)
  const fim = new Date(y, m - 1, 25)
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { ini: iso(ini), fim: iso(fim) }
}

export function useFecharMes() {
  const qc = useQueryClient()
  return useMutation({
    // o intervalo vai explícito: a competência da folha é 26→25, não o mês civil
    mutationFn: async (v: { anoMes: string; por: string; ini?: string; fim?: string }) => {
      const j = janelaPadrao(v.anoMes)
      const { error } = await supabase.rpc('rh_ponto_fechar_mes', {
        p_ano_mes: v.anoMes, p_por: v.por, p_ini: v.ini ?? j.ini, p_fim: v.fim ?? j.fim,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ponto-fechamentos'] }),
  })
}

export function useLiberarMes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { anoMes: string; por: string; motivo?: string }) => {
      const { error } = await supabase.rpc('rh_ponto_liberar_mes', { p_ano_mes: v.anoMes, p_por: v.por, p_motivo: v.motivo ?? null })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ponto-fechamentos'] }),
  })
}

// ── Espelho para assinatura no Portal TEG ────────────────────────────────────
// Fechar e enviar são passos separados de propósito: o fechamento congela os
// números, o envio pede a assinatura em cima deles. A RPC recusa envio de
// competência aberta, então a ordem não depende só da tela.
export interface PontoEspelhoEnvio {
  id: string
  colaborador_id: string
  ano_mes: string
  periodo_ini: string | null; periodo_fim: string | null
  documento_id: string
  missao_id: string | null
  arquivo_path: string | null
  status: 'enviado' | 'assinado' | 'obsoleto'
  enviado_em: string; enviado_por: string | null
  assinado_em: string | null; auth_metodo: string | null
  arquivo_assinado_path: string | null
  titulo: string | null
  obsoleto_em: string | null; obsoleto_por: string | null
}

export function usePontoEnvios(anoMes: string) {
  return useQuery<PontoEspelhoEnvio[]>({
    queryKey: ['ponto-envios', anoMes],
    queryFn: async () => {
      const { data, error } = await supabase.from('vw_rh_ponto_espelho_envio')
        .select('*').eq('ano_mes', anoMes).order('enviado_em', { ascending: false })
      if (error) { console.error('usePontoEnvios:', error); return [] }
      return (data ?? []) as PontoEspelhoEnvio[]
    },
    enabled: !!anoMes,
    // o colaborador pode assinar a qualquer momento — a tela acompanha sozinha
    refetchInterval: 30_000,
  })
}

/** Envia UM espelho: gera o HTML da tela, a edge renderiza o PDF e cria a missão. */
export function useEnviarEspelho() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      colaboradorId: string; colaboradorNome: string; anoMes: string
      por?: string; ini?: string; fim?: string
    }) => {
      const { buildPontoReportHtml } = await import('../utils/ponto-report-html')
      const html = await buildPontoReportHtml({
        colaborador_id: v.colaboradorId, colaborador_nome: v.colaboradorNome, ano_mes: v.anoMes,
      })
      const j = janelaPadrao(v.anoMes)
      const { data, error } = await supabase.functions.invoke('ponto-espelho-assinatura', {
        body: {
          colaborador_id: v.colaboradorId, ano_mes: v.anoMes, html,
          periodo_ini: v.ini ?? j.ini, periodo_fim: v.fim ?? j.fim, por: v.por ?? null,
        },
      })
      if (error) throw error
      const r = data as { ok?: boolean; erro?: string }
      // a edge devolve erro de negócio no CORPO (competência aberta, colaborador
      // sem CPF) — sem esta checagem o envio falharia calado
      if (!r?.ok) throw new Error(r?.erro || 'Falha ao enviar para assinatura')
      return r as { ok: true; documento_id?: string; missao_id?: string; ja_enviado?: boolean }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ponto-envios'] }),
  })
}

/** Descarta o envio: o PDF assinado continua no bucket, mas sai de circulação. */
export function useDescartarEspelho() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; por?: string }) => {
      const { data, error } = await supabase.rpc('rh_ponto_espelho_descartar', { p_id: v.id, p_por: v.por ?? null })
      if (error) throw error
      const r = data as { ok?: boolean; erro?: string }
      if (!r?.ok) throw new Error(r?.erro || 'Falha ao descartar')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ponto-envios'] }),
  })
}

/** Contagem de envios/assinados por competência — alimenta a visão mensal. */
export function usePontoEnviosResumo() {
  return useQuery<{ ano_mes: string; enviados: number; assinados: number; obsoletos: number }[]>({
    queryKey: ['ponto-envios-resumo'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vw_rh_ponto_espelho_resumo').select('*')
      if (error) { console.error('usePontoEnviosResumo:', error); return [] }
      return (data ?? []) as { ano_mes: string; enviados: number; assinados: number; obsoletos: number }[]
    },
    refetchInterval: 60_000,
  })
}

/** Baixa num ZIP só os espelhos ASSINADOS da competência (1 PDF por pessoa). */
export function useZipEspelhosAssinados() {
  return useMutation({
    mutationFn: async (v: { anoMes: string }) => {
      const { data: envios, error } = await supabase.from('vw_rh_ponto_espelho_envio')
        .select('colaborador_id, arquivo_assinado_path, assinado_em')
        .eq('ano_mes', v.anoMes).eq('status', 'assinado')
      if (error) throw error
      const linhas = (envios ?? []).filter(e => e.arquivo_assinado_path) as
        { colaborador_id: string; arquivo_assinado_path: string }[]
      if (!linhas.length) throw new Error('Nenhum espelho assinado nesta competência.')

      // a view não carrega FK, então o embed não funciona — nomes vêm à parte
      const { data: colabs } = await supabase.from('rh_colaboradores')
        .select('id, nome').in('id', linhas.map(l => l.colaborador_id))
      const nomePor = new Map((colabs ?? []).map(c => [c.id as string, c.nome as string]))

      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const usados = new Set<string>()
      let falhas = 0
      await Promise.all(linhas.map(async l => {
        const { data, error: e } = await supabase.storage.from('rh-admissao-docs').download(l.arquivo_assinado_path)
        if (e || !data) { falhas++; return }
        const base = (nomePor.get(l.colaborador_id) ?? l.colaborador_id)
          .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '_')
        // homônimo não pode sobrescrever o arquivo do outro
        let nome = `${base}.pdf`; let n = 2
        while (usados.has(nome)) nome = `${base}_${n++}.pdf`
        usados.add(nome)
        zip.file(nome, data)
      }))
      if (!usados.size) throw new Error('Não foi possível baixar nenhum PDF assinado.')

      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `espelhos-assinados-${v.anoMes.slice(0, 7)}.zip`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      return { total: usados.size, falhas }
    },
  })
}

// ── Resumo por INTERVALO de datas (competência da folha: 26 → 25) ────────────
// A view mensal agrega por mês civil e não consegue cortar no dia 25; a RPC faz
// a MESMA agregação sobre um intervalo livre. Confere com a view quando o
// intervalo é o mês inteiro.
export function usePontoResumoIntervalo(ini: string, fim: string) {
  return useQuery<PontoResumoMes[]>({
    queryKey: ['ponto-resumo-intervalo', ini, fim],
    enabled: !!ini && !!fim && ini <= fim,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rh_ponto_resumo_intervalo', { p_ini: ini, p_fim: fim })
      if (error) { console.error('usePontoResumoIntervalo:', error); return [] }
      return (data ?? []) as PontoResumoMes[]
    },
  })
}

/** Horas extras dia a dia dentro do intervalo (mesma view, recorte por data). */
export function usePontoHorasExtrasIntervalo(ini: string, fim: string) {
  return useQuery<HoraExtraItem[]>({
    queryKey: ['ponto-he-intervalo', ini, fim],
    enabled: !!ini && !!fim && ini <= fim,
    queryFn: async () => {
      try {
        return await paginar<HoraExtraItem>((from, to) => supabase
          .from('vw_rh_ponto_hora_extra').select('*')
          .gte('data', ini).lte('data', fim)
          .order('data', { ascending: false }).order('secullum_func_id').range(from, to))
      } catch (e) { console.error('usePontoHorasExtrasIntervalo:', e); return [] }
    },
  })
}
