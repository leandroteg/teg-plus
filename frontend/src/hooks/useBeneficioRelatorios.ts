// ─────────────────────────────────────────────────────────────────────────────
// hooks/useBeneficioRelatorios.ts — DP › Benefícios: relatórios do fornecedor.
// UM endpoint do SuperTEG (edge rh-beneficios → /beneficios/relatorio) para os
// três benefícios; TABELAS SEPARADAS por benefício:
//   plano_saude → rh_plano_lotes / rh_plano_vidas / rh_plano_coparticipacao
//   vr          → rh_vr_lotes    / rh_vr_linhas
//   vt          → rh_vt_lotes    / rh_vt_linhas
// O consolidado dos três sai da view vw_rh_beneficio_consolidado.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

export type Beneficio = 'plano_saude' | 'vr' | 'vt'
export type LoteStatus = 'processando' | 'erro' | 'conferido' | 'enviado_financeiro'
export type Vinculo = 'titular_ativo' | 'titular_inativo' | 'dependente' | 'nao_identificado'

export const BENEFICIO_LABEL: Record<Beneficio, string> = {
  plano_saude: 'Plano de Saúde',
  vr: 'Alimentação (VR/VA)',
  vt: 'Transporte (VT)',
}

const TAB_LOTES: Record<Beneficio, string> = {
  plano_saude: 'rh_plano_lotes', vr: 'rh_vr_lotes', vt: 'rh_vt_lotes',
}
// no plano a coluna do fornecedor chama "operadora"
const COL_FORN: Record<Beneficio, string> = {
  plano_saude: 'operadora', vr: 'fornecedor', vt: 'fornecedor',
}

export interface BeneficioLote {
  id: string
  competencia: string
  fornecedor: string | null
  tipo: string | null
  documento: string | null
  arquivo_path: string
  arquivo_nome: string
  vencimento: string | null
  total_documento: number | null
  total_extraido: number | null
  qtd_linhas: number | null
  cobranca: boolean
  status: LoteStatus
  erro: string | null
  resultado: { observacao?: string | null; qtd_paginas?: number | null } | null
  fin_conta_pagar_id: string | null
  enviado_financeiro_em: string | null
  criado_por_nome: string | null
  created_at: string
}

export interface BeneficioConsolidado {
  beneficio: Beneficio
  competencia: string
  fornecedor: string
  cobranca: boolean
  linhas: number
  valor_principal: number
  valor_secundario: number
  alocado_ativos: number
  sem_dono: number
  total_geral: number
  vencimento: string | null
  status: LoteStatus
  fin_conta_pagar_id: string | null
  enviado_financeiro_em: string | null
  lote_ids: string[]
}

// Linha genérica pro detalhe — cada benefício preenche o que tem
export interface BeneficioLinha {
  id: string
  lote_id: string
  origem: string          // 'mensalidade' | 'coparticipação' | 'crédito'
  nome: string
  cpf: string | null
  documento: string | null   // credencial (plano) / matrícula (VR) / código (VT)
  referencia: string | null  // plano/produto/procedimento
  detalhe: string | null     // parentesco (plano) / prestador / departamento
  valor: number
  colaborador_id: string | null
  vinculo: Vinculo
  observacao: string | null
}

export const compIso = (ym: string) => `${ym}-01`
export const compYm = (iso?: string | null) => (iso ?? '').slice(0, 7)

const CAMPOS_LOTE = 'id, competencia, tipo, documento, arquivo_path, arquivo_nome, vencimento, total_documento, total_extraido, qtd_linhas, cobranca, status, erro, resultado, fin_conta_pagar_id, enviado_financeiro_em, criado_por_nome, created_at'

// ── Lotes de um benefício ──
export function useBeneficioLotes(beneficio: Beneficio) {
  return useQuery({
    queryKey: ['rh_beneficio_lotes', beneficio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TAB_LOTES[beneficio])
        .select(`${CAMPOS_LOTE}, ${COL_FORN[beneficio]}`)
        .order('competencia', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as unknown as Record<string, unknown>[]
      return rows.map(row =>
        ({ ...row, fornecedor: (row[COL_FORN[beneficio]] ?? null) as string | null }) as unknown as BeneficioLote)
    },
    refetchInterval: q => {
      const d = q.state.data as BeneficioLote[] | undefined
      return d?.some(l => l.status === 'processando') ? 15000 : false
    },
  })
}

// ── Consolidado (mesma view p/ os três) ──
export function useBeneficioConsolidado(beneficio: Beneficio) {
  return useQuery({
    queryKey: ['rh_beneficio_consolidado', beneficio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_rh_beneficio_consolidado')
        .select('*')
        .eq('beneficio', beneficio)
        .order('competencia', { ascending: false })
      if (error) throw error
      return (data ?? []) as BeneficioConsolidado[]
    },
    refetchInterval: q => {
      const d = q.state.data as BeneficioConsolidado[] | undefined
      return d?.some(l => l.status === 'processando') ? 15000 : false
    },
  })
}

// ── Detalhe: as linhas dos lotes, já normalizadas pra uma tabela só ──
export function useBeneficioDetalhe(beneficio: Beneficio, loteIds: string[] | null) {
  const ids = (loteIds ?? []).slice().sort()
  return useQuery({
    queryKey: ['rh_beneficio_detalhe', beneficio, ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async (): Promise<BeneficioLinha[]> => {
      if (beneficio === 'plano_saude') {
        const [v, c] = await Promise.all([
          supabase.from('rh_plano_vidas')
            .select('id, lote_id, credencial, cpf, nome, parentesco, plano, mensalidade, cobrado, colaborador_id, vinculo, observacao')
            .in('lote_id', ids).order('nome'),
          supabase.from('rh_plano_coparticipacao')
            .select('id, lote_id, cod_usuario, cpf, nome, procedimento, prestador, valor, colaborador_id, vinculo, observacao')
            .in('lote_id', ids).order('nome'),
        ])
        if (v.error) throw v.error
        if (c.error) throw c.error
        return [
          ...(v.data ?? []).map(r => ({
            id: String(r.id), lote_id: String(r.lote_id), origem: 'mensalidade',
            nome: String(r.nome), cpf: r.cpf as string | null, documento: r.credencial as string | null,
            referencia: r.plano as string | null, detalhe: r.parentesco as string | null,
            valor: Number(r.cobrado ?? r.mensalidade ?? 0),
            colaborador_id: r.colaborador_id as string | null, vinculo: r.vinculo as Vinculo,
            observacao: r.observacao as string | null,
          })),
          ...(c.data ?? []).map(r => ({
            id: String(r.id), lote_id: String(r.lote_id), origem: 'coparticipação',
            nome: String(r.nome), cpf: r.cpf as string | null, documento: r.cod_usuario as string | null,
            referencia: r.procedimento as string | null, detalhe: r.prestador as string | null,
            valor: Number(r.valor ?? 0),
            colaborador_id: r.colaborador_id as string | null, vinculo: r.vinculo as Vinculo,
            observacao: r.observacao as string | null,
          })),
        ]
      }
      if (beneficio === 'vr') {
        const { data, error } = await supabase.from('rh_vr_linhas')
          .select('id, lote_id, cpf, matricula, nome, produto, valor, local_entrega, departamento, colaborador_id, vinculo, observacao')
          .in('lote_id', ids).order('nome')
        if (error) throw error
        return (data ?? []).map(r => ({
          id: String(r.id), lote_id: String(r.lote_id), origem: 'crédito',
          nome: String(r.nome), cpf: r.cpf as string | null, documento: r.matricula as string | null,
          referencia: r.produto as string | null,
          detalhe: [r.departamento, r.local_entrega].filter(Boolean).join(' · ') || null,
          valor: Number(r.valor ?? 0),
          colaborador_id: r.colaborador_id as string | null, vinculo: r.vinculo as Vinculo,
          observacao: r.observacao as string | null,
        }))
      }
      const { data, error } = await supabase.from('rh_vt_linhas')
        .select('id, lote_id, codigo, matricula_operadora, serial, nome, cpf, valor, tipo_transacao, colaborador_id, vinculo, observacao')
        .in('lote_id', ids).order('nome')
      if (error) throw error
      return (data ?? []).map(r => ({
        id: String(r.id), lote_id: String(r.lote_id), origem: 'crédito',
        nome: String(r.nome), cpf: r.cpf as string | null, documento: r.codigo as string | null,
        referencia: r.matricula_operadora ? `matr. operadora ${r.matricula_operadora}` : null,
        detalhe: r.tipo_transacao as string | null,
        valor: Number(r.valor ?? 0),
        colaborador_id: r.colaborador_id as string | null, vinculo: r.vinculo as Vinculo,
        observacao: r.observacao as string | null,
      }))
    },
  })
}

export interface BeneficioMesColab {
  fornecedor: string | null
  principal: number | null    // mensalidade (plano) / valor creditado (VR/VT)
  secundario: number | null   // coparticipação (só plano)
  linhas: number
}

// ── O que o fornecedor cobrou de cada colaborador no mês (alimenta a matriz) ──
export function useBeneficioMesPorColaborador(beneficio: Beneficio, competenciaYm: string | null) {
  return useQuery({
    queryKey: ['rh_beneficio_mes_colab', beneficio, competenciaYm],
    enabled: !!competenciaYm,
    queryFn: async () => {
      const map = new Map<string, BeneficioMesColab>()
      const { data: lotes, error } = await supabase
        .from(TAB_LOTES[beneficio])
        .select(`id, tipo, cobranca, ${COL_FORN[beneficio]}`)
        .eq('competencia', compIso(competenciaYm!))
        .in('status', ['conferido', 'enviado_financeiro'])
      if (error) throw error
      const rows = (lotes ?? []) as unknown as { id: string; tipo?: string; cobranca?: boolean }[]
      if (!rows.length) return map

      const forn = new Map<string, string | null>()
      for (const row of rows as unknown as Record<string, unknown>[]) {
        forn.set(String(row.id), (row[COL_FORN[beneficio]] ?? null) as string | null)
      }
      const cobrados = rows.filter(l => l.cobranca !== false)
      const up = (cid: string, loteId: string) => {
        let cur = map.get(cid)
        if (!cur) { cur = { fornecedor: forn.get(loteId) ?? null, principal: null, secundario: null, linhas: 0 }; map.set(cid, cur) }
        if (!cur.fornecedor) cur.fornecedor = forn.get(loteId) ?? null
        return cur
      }

      if (beneficio === 'plano_saude') {
        const mens = cobrados.filter(l => l.tipo === 'mensalidade').map(l => String(l.id))
        const cop = cobrados.filter(l => l.tipo === 'coparticipacao').map(l => String(l.id))
        if (mens.length) {
          const { data, error: e } = await supabase.from('rh_plano_vidas')
            .select('lote_id, colaborador_id, cobrado, mensalidade').in('lote_id', mens)
          if (e) throw e
          for (const v of data ?? []) {
            if (!v.colaborador_id) continue
            const cur = up(String(v.colaborador_id), String(v.lote_id))
            cur.principal = (cur.principal ?? 0) + Number(v.cobrado ?? v.mensalidade ?? 0)
            cur.linhas += 1
          }
        }
        if (cop.length) {
          const { data, error: e } = await supabase.from('rh_plano_coparticipacao')
            .select('lote_id, colaborador_id, valor').in('lote_id', cop)
          if (e) throw e
          for (const c of data ?? []) {
            if (!c.colaborador_id) continue
            const cur = up(String(c.colaborador_id), String(c.lote_id))
            cur.secundario = (cur.secundario ?? 0) + Number(c.valor ?? 0)
          }
        }
        return map
      }

      const ids = cobrados.map(l => String(l.id))
      if (!ids.length) return map
      const { data, error: e } = await supabase
        .from(beneficio === 'vr' ? 'rh_vr_linhas' : 'rh_vt_linhas')
        .select('lote_id, colaborador_id, valor').in('lote_id', ids)
      if (e) throw e
      for (const r of data ?? []) {
        if (!r.colaborador_id) continue
        const cur = up(String(r.colaborador_id), String(r.lote_id))
        cur.principal = (cur.principal ?? 0) + Number(r.valor ?? 0)
        cur.linhas += 1
      }
      return map
    },
  })
}

function useInvalidarBeneficio() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['rh_beneficio_lotes'] })
    qc.invalidateQueries({ queryKey: ['rh_beneficio_consolidado'] })
    qc.invalidateQueries({ queryKey: ['rh_beneficio_mes_colab'] })
    qc.invalidateQueries({ queryKey: ['rh_beneficio_detalhe'] })
  }
}

// ── Sobe o(s) arquivo(s) e manda o SuperTEG ler ──
export function useEnviarRelatorioBeneficio() {
  const invalidar = useInvalidarBeneficio()
  return useMutation({
    mutationFn: async (p: { beneficio: Beneficio; arquivos: File[]; competenciaYm: string; criadoPor?: string | null }) => {
      const criados: string[] = []
      for (const f of p.arquivos) {
        const rand = Math.random().toString(36).slice(2, 10)
        const limpo = f.name.replace(/[^A-Za-z0-9._-]/g, '_')
        const path = `${p.beneficio}/${p.competenciaYm}/${rand}_${limpo}`
        const up = await supabase.storage.from('rh-beneficios').upload(path, f, { upsert: false })
        if (up.error) throw up.error
        const { data, error } = await supabase.from(TAB_LOTES[p.beneficio]).insert({
          competencia: compIso(p.competenciaYm),
          arquivo_path: path,
          arquivo_nome: f.name,
          status: 'processando',
          criado_por_nome: p.criadoPor ?? null,
        }).select('id').single()
        if (error) throw error
        criados.push(String(data.id))
        const { error: fnErr } = await supabase.functions.invoke('rh-beneficios', {
          body: { action: 'processar', beneficio: p.beneficio, lote_id: data.id },
        })
        if (fnErr) throw fnErr
      }
      return criados
    },
    onSuccess: invalidar,
  })
}

export function useReprocessarLote() {
  const invalidar = useInvalidarBeneficio()
  return useMutation({
    mutationFn: async (p: { beneficio: Beneficio; loteId: string }) => {
      const { error } = await supabase.functions.invoke('rh-beneficios', {
        body: { action: 'processar', beneficio: p.beneficio, lote_id: p.loteId },
      })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useExcluirLote() {
  const invalidar = useInvalidarBeneficio()
  return useMutation({
    mutationFn: async (p: { beneficio: Beneficio; lote: BeneficioLote }) => {
      const { error } = await supabase.from(TAB_LOTES[p.beneficio]).delete().eq('id', p.lote.id)
      if (error) throw error
      await supabase.storage.from('rh-beneficios').remove([p.lote.arquivo_path])
    },
    onSuccess: invalidar,
  })
}

// Link temporário pro arquivo original (bucket privado)
export async function urlArquivoLote(path: string) {
  const { data, error } = await supabase.storage.from('rh-beneficios').createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}

// ── Envia a linha do consolidado pro contas a pagar ──
export function useEnviarBeneficioFinanceiro() {
  const qc = useQueryClient()
  const invalidar = useInvalidarBeneficio()
  return useMutation({
    mutationFn: async (p: { beneficio: Beneficio; competencia: string; fornecedor: string; usuarioNome?: string | null }) => {
      const { data, error } = await supabase.rpc('rh_beneficio_enviar_lote_financeiro', {
        p_beneficio: p.beneficio,
        p_competencia: p.competencia,
        p_fornecedor: p.fornecedor,
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
