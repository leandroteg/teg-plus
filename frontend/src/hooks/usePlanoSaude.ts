// ─────────────────────────────────────────────────────────────────────────────
// hooks/usePlanoSaude.ts — DP › Benefícios › Plano de Saúde (relatórios da operadora)
// Um LOTE = um arquivo enviado (mensalidade OU coparticipação). O SuperTEG lê o
// arquivo (edge rh-plano-saude → worker plano_saude_worker.py) e a edge casa cada
// CPF com o cadastro. Daqui pra frente é só leitura + envio ao contas a pagar.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

export type LoteStatus = 'processando' | 'erro' | 'conferido' | 'enviado_financeiro'
export type LoteTipo = 'mensalidade' | 'coparticipacao'
export type Vinculo = 'titular_ativo' | 'titular_inativo' | 'dependente' | 'nao_identificado'

export interface PlanoLote {
  id: string
  competencia: string
  operadora: string | null
  tipo: LoteTipo | null
  arquivo_path: string
  arquivo_nome: string
  vencimento: string | null
  total_documento: number | null
  total_extraido: number | null
  qtd_linhas: number | null
  status: LoteStatus
  erro: string | null
  resultado: { observacao?: string | null; qtd_paginas?: number | null } | null
  fin_conta_pagar_id: string | null
  enviado_financeiro_em: string | null
  criado_por_nome: string | null
  created_at: string
}

export interface PlanoConsolidado {
  competencia: string
  operadora: string
  vidas: number
  mensalidade: number
  coparticipacao: number
  alocado_ativos: number
  inativos: number
  total_geral: number
  vencimento: string | null
  lotes_mensalidade: number
  lotes_coparticipacao: number
  status: LoteStatus
  fin_conta_pagar_id: string | null
  enviado_financeiro_em: string | null
  lote_ids: string[]
}

export interface PlanoVida {
  id: string
  lote_id: string
  credencial: string | null
  cpf: string | null
  nome: string
  parentesco: string | null
  data_nascimento: string | null
  idade: number | null
  data_inicio: string | null
  plano: string | null
  mensalidade: number | null
  cobrado: number | null
  titular_cpf: string | null
  titular_nome: string | null
  colaborador_id: string | null
  vinculo: Vinculo
  observacao: string | null
}

export interface PlanoCopart {
  id: string
  lote_id: string
  cpf: string | null
  nome: string
  titular_nome: string | null
  guia: string | null
  data_atendimento: string | null
  procedimento: string | null
  prestador: string | null
  quantidade: number | null
  valor: number
  colaborador_id: string | null
  vinculo: Vinculo
  observacao: string | null
}

// competência sempre no 1º dia do mês (a coluna é date)
export const compIso = (ym: string) => `${ym}-01`
export const compYm = (iso?: string | null) => (iso ?? '').slice(0, 7)

// ── Lotes (lista completa; a tela filtra por mês/operadora) ──
export function usePlanoLotes() {
  return useQuery({
    queryKey: ['rh_plano_lotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_plano_lotes')
        .select('id, competencia, operadora, tipo, arquivo_path, arquivo_nome, vencimento, total_documento, total_extraido, qtd_linhas, status, erro, resultado, fin_conta_pagar_id, enviado_financeiro_em, criado_por_nome, created_at')
        .order('competencia', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as PlanoLote[]
    },
    // enquanto houver lote em leitura, acompanha sozinho
    refetchInterval: q => {
      const d = q.state.data as PlanoLote[] | undefined
      return d?.some(l => l.status === 'processando') ? 15000 : false
    },
  })
}

// ── Consolidado: 1 linha por mês × operadora ──
export function usePlanoConsolidado() {
  return useQuery({
    queryKey: ['rh_plano_consolidado'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_rh_plano_consolidado')
        .select('*')
        .order('competencia', { ascending: false })
      if (error) throw error
      return (data ?? []) as PlanoConsolidado[]
    },
    refetchInterval: q => {
      const d = q.state.data as PlanoConsolidado[] | undefined
      return d?.some(l => l.status === 'processando') ? 15000 : false
    },
  })
}

// ── Linhas de um conjunto de lotes (detalhe do consolidado) ──
export function usePlanoDetalhe(loteIds: string[] | null) {
  const ids = (loteIds ?? []).slice().sort()
  return useQuery({
    queryKey: ['rh_plano_detalhe', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const [v, c] = await Promise.all([
        supabase.from('rh_plano_vidas')
          .select('id, lote_id, credencial, cpf, nome, parentesco, data_nascimento, idade, data_inicio, plano, mensalidade, cobrado, titular_cpf, titular_nome, colaborador_id, vinculo, observacao')
          .in('lote_id', ids).order('nome'),
        supabase.from('rh_plano_coparticipacao')
          .select('id, lote_id, cpf, nome, titular_nome, guia, data_atendimento, procedimento, prestador, quantidade, valor, colaborador_id, vinculo, observacao')
          .in('lote_id', ids).order('nome'),
      ])
      if (v.error) throw v.error
      if (c.error) throw c.error
      return { vidas: (v.data ?? []) as PlanoVida[], copart: (c.data ?? []) as PlanoCopart[] }
    },
  })
}

export interface PlanoMesColab {
  operadora: string | null
  mensalidade: number | null
  coparticipacao: number | null
  vidas: number
}

// ── O que a operadora cobrou de cada colaborador no mês (alimenta a matriz) ──
// Soma titular + dependentes/vidas que caíram no mesmo colaborador_id.
export function usePlanoMesPorColaborador(competenciaYm: string | null) {
  return useQuery({
    queryKey: ['rh_plano_mes_colab', competenciaYm],
    enabled: !!competenciaYm,
    queryFn: async () => {
      const { data: lotes, error: e0 } = await supabase
        .from('rh_plano_lotes')
        .select('id, tipo, operadora')
        .eq('competencia', compIso(competenciaYm!))
        .in('status', ['conferido', 'enviado_financeiro'])
      if (e0) throw e0
      const map = new Map<string, PlanoMesColab>()
      if (!lotes?.length) return map
      const opPorLote = new Map(lotes.map(l => [String(l.id), (l.operadora ?? null) as string | null]))
      const idsMens = lotes.filter(l => l.tipo === 'mensalidade').map(l => String(l.id))
      const idsCop = lotes.filter(l => l.tipo === 'coparticipacao').map(l => String(l.id))

      const upsert = (cid: string, op: string | null) => {
        let cur = map.get(cid)
        if (!cur) { cur = { operadora: op, mensalidade: null, coparticipacao: null, vidas: 0 }; map.set(cid, cur) }
        if (!cur.operadora && op) cur.operadora = op
        return cur
      }

      if (idsMens.length) {
        const { data, error } = await supabase.from('rh_plano_vidas')
          .select('lote_id, colaborador_id, cobrado, mensalidade').in('lote_id', idsMens)
        if (error) throw error
        for (const v of data ?? []) {
          if (!v.colaborador_id) continue
          const cur = upsert(String(v.colaborador_id), opPorLote.get(String(v.lote_id)) ?? null)
          cur.mensalidade = (cur.mensalidade ?? 0) + Number(v.cobrado ?? v.mensalidade ?? 0)
          cur.vidas += 1
        }
      }
      if (idsCop.length) {
        const { data, error } = await supabase.from('rh_plano_coparticipacao')
          .select('lote_id, colaborador_id, valor').in('lote_id', idsCop)
        if (error) throw error
        for (const c of data ?? []) {
          if (!c.colaborador_id) continue
          const cur = upsert(String(c.colaborador_id), opPorLote.get(String(c.lote_id)) ?? null)
          cur.coparticipacao = (cur.coparticipacao ?? 0) + Number(c.valor ?? 0)
        }
      }
      return map
    },
  })
}

function useInvalidarPlano() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['rh_plano_lotes'] })
    qc.invalidateQueries({ queryKey: ['rh_plano_consolidado'] })
    qc.invalidateQueries({ queryKey: ['rh_plano_mes_colab'] })
    qc.invalidateQueries({ queryKey: ['rh_plano_detalhe'] })
  }
}

// ── Sobe o(s) arquivo(s) e manda o SuperTEG ler ──
export function useEnviarRelatorioPlano() {
  const invalidar = useInvalidarPlano()
  return useMutation({
    mutationFn: async (p: { arquivos: File[]; competenciaYm: string; criadoPor?: string | null }) => {
      const criados: string[] = []
      for (const f of p.arquivos) {
        const rand = Math.random().toString(36).slice(2, 10)
        const limpo = f.name.replace(/[^A-Za-z0-9._-]/g, '_')
        const path = `${p.competenciaYm}/${rand}_${limpo}`
        const up = await supabase.storage.from('rh-beneficios').upload(path, f, { upsert: false })
        if (up.error) throw up.error
        const { data, error } = await supabase.from('rh_plano_lotes').insert({
          competencia: compIso(p.competenciaYm),
          arquivo_path: path,
          arquivo_nome: f.name,
          status: 'processando',
          criado_por_nome: p.criadoPor ?? null,
        }).select('id').single()
        if (error) throw error
        criados.push(String(data.id))
        const { error: fnErr } = await supabase.functions.invoke('rh-plano-saude', {
          body: { action: 'processar', lote_id: data.id },
        })
        if (fnErr) throw fnErr
      }
      return criados
    },
    onSuccess: invalidar,
  })
}

// Reprocessa um lote que deu erro (mesmo arquivo, nova leitura)
export function useReprocessarLote() {
  const invalidar = useInvalidarPlano()
  return useMutation({
    mutationFn: async (loteId: string) => {
      const { error } = await supabase.functions.invoke('rh-plano-saude', {
        body: { action: 'processar', lote_id: loteId },
      })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useExcluirLote() {
  const invalidar = useInvalidarPlano()
  return useMutation({
    mutationFn: async (lote: PlanoLote) => {
      const { error } = await supabase.from('rh_plano_lotes').delete().eq('id', lote.id)
      if (error) throw error
      await supabase.storage.from('rh-beneficios').remove([lote.arquivo_path])
    },
    onSuccess: invalidar,
  })
}

// Gera link temporário pro PDF original (bucket privado)
export async function urlArquivoLote(path: string) {
  const { data, error } = await supabase.storage.from('rh-beneficios').createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}

// ── Envia a linha do consolidado pro contas a pagar (1 título por mês+operadora) ──
export function useEnviarPlanoFinanceiro() {
  const qc = useQueryClient()
  const invalidar = useInvalidarPlano()
  return useMutation({
    mutationFn: async (p: { competencia: string; operadora: string; usuarioNome?: string | null }) => {
      const { data, error } = await supabase.rpc('rh_plano_enviar_lote_financeiro', {
        p_competencia: p.competencia,
        p_operadora: p.operadora,
        p_usuario_nome: p.usuarioNome ?? null,
      })
      if (error) throw error
      return data as { ok: boolean; motivo?: string; conta_pagar_id?: string; valor?: number; status?: string }
    },
    onSuccess: () => {
      invalidar()
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}
