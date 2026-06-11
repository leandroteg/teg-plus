// ─────────────────────────────────────────────────────────────────────────────
// hooks/useRHAdmissaoFluxo.ts — Fluxo de Admissão (RH-only)
// Tabelas RH: rh_admissoes (requisição), rh_admissao_candidatos (N por requisição),
// rh_admissao_anexos, rh_admissao_historico. Bucket privado rh-admissao-docs.
// IA via webhook n8n RH-only. Não toca em nada de outros módulos.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { RHAdmissao } from '../types/rh'

const BUCKET = 'rh-admissao-docs'
const N8N_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'

const SELECT =
  '*, centro_custo:sys_centros_custo!centro_custo_id(id,codigo,descricao), ' +
  'candidatos:rh_admissao_candidatos(*, anexos:rh_admissao_anexos!candidato_id(*)), ' +
  'anexos:rh_admissao_anexos!admissao_id(*)'

// Bases operacionais (cadastro est_bases) — leitura para o select da requisição
export function useBasesAdmissao() {
  return useQuery<{ id: string; nome: string; codigo?: string }[]>({
    queryKey: ['rh-bases-admissao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_bases')
        .select('id,nome,codigo')
        .eq('ativa', true)
        .order('nome')
      if (error) { console.error('useBasesAdmissao:', error); return [] }
      return (data ?? []) as { id: string; nome: string; codigo?: string }[]
    },
  })
}

export function useAdmissoesFluxo() {
  return useQuery<RHAdmissao[]>({
    queryKey: ['rh-admissoes-fluxo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_admissoes')
        .select(SELECT)
        .order('created_at', { ascending: false })
      if (error) {
        console.error('useAdmissoesFluxo:', error)
        return []
      }
      return (data ?? []) as unknown as RHAdmissao[]
    },
  })
}

// ── IA: extrai dados de 1 documento de candidato via webhook n8n ──────────────
export interface CandidatoExtraido {
  nome?: string
  cpf?: string
  cargo_pretendido?: string
  confianca?: number
  success?: boolean
  [k: string]: unknown
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = reader.result as string
      resolve(res.includes(',') ? res.split(',')[1] : res)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function parseDocumentoAdmissao(file: File, tipo?: string): Promise<CandidatoExtraido | null> {
  try {
    const base64 = await fileToBase64(file)
    const resp = await fetch(`${N8N_URL}/rh/admissao/parse-documento-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, nome: file.name, mime_type: file.type || 'application/pdf', tipo: tipo || '' }),
    })
    if (!resp.ok) return null
    return (await resp.json()) as CandidatoExtraido
  } catch (e) {
    console.warn('parseDocumentoAdmissao:', e)
    return null
  }
}

// ── Criar requisição com N candidatos ─────────────────────────────────────────
export interface ArquivoCandidato {
  file: File
  tipo: string
}

export interface CandidatoInput {
  nome: string
  cpf?: string
  data_nascimento?: string
  cargo?: string
  salario?: number
  dados_extras?: Record<string, unknown>
  arquivos: ArquivoCandidato[]
}

export interface NovaAdmissaoInput {
  dados: Partial<RHAdmissao>           // campos compartilhados da requisição
  candidatos: CandidatoInput[]
  autorId?: string
  autorNome?: string
}

export function useCriarAdmissao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dados, candidatos, autorId, autorNome }: NovaAdmissaoInput) => {
      // 1) cria a requisição (compartilhada)
      const insert = {
        ...dados,
        nome_candidato: candidatos[0]?.nome ?? null,   // fallback de exibição
        etapa: 'requisicao',
        status: 'pendente',
        status_aprovacao: null,
        registrado_por: autorId ?? dados.registrado_por ?? null,
        solicitante_id: dados.solicitante_id ?? autorId ?? null,
        solicitante_nome: dados.solicitante_nome ?? autorNome ?? null,
      }
      const { data: adm, error } = await supabase
        .from('rh_admissoes')
        .insert(insert)
        .select('id')
        .single()
      if (error || !adm) throw error ?? new Error('Falha ao criar requisição')
      const admissaoId = (adm as { id: string }).id

      // 2) candidatos + seus anexos
      for (const c of candidatos) {
        const { data: cand, error: cErr } = await supabase
          .from('rh_admissao_candidatos')
          .insert({
            admissao_id: admissaoId,
            nome: c.nome,
            cpf: c.cpf || null,
            data_nascimento: c.data_nascimento || null,
            cargo: c.cargo || null,
            salario: c.salario ?? null,
            dados_extras: c.dados_extras ?? null,
          })
          .select('id')
          .single()
        if (cErr || !cand) { console.error('candidato:', cErr); continue }
        const candidatoId = (cand as { id: string }).id

        for (const a of c.arquivos) {
          const safeName = a.file.name.replace(/[^\w.\-]+/g, '_')
          const path = `${admissaoId}/${candidatoId}/${a.tipo}_${Date.now()}_${safeName}`
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, a.file, { upsert: false })
          if (upErr) { console.error('upload anexo:', upErr); continue }
          await supabase.from('rh_admissao_anexos').insert({
            admissao_id: admissaoId,
            candidato_id: candidatoId,
            tipo: a.tipo,
            obrigatorio: a.tipo === 'ctps',
            arquivo_nome: a.file.name,
            arquivo_path: path,
            tamanho_bytes: a.file.size,
            mime_type: a.file.type || null,
            uploaded_por: autorId ?? null,
          })
        }
      }

      // 3) histórico
      await supabase.from('rh_admissao_historico').insert({
        admissao_id: admissaoId,
        acao: 'criada',
        para_etapa: 'requisicao',
        autor_id: autorId ?? null,
        autor_nome: autorNome ?? null,
        observacao: `${candidatos.length} candidato(s)`,
      })

      return admissaoId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-admissoes-fluxo'] })
      qc.invalidateQueries({ queryKey: ['rh-admissoes'] })
    },
  })
}

// ── Transições do fluxo (RH-only) ─────────────────────────────────────────────
export type AcaoAdmissao = 'solicitar_aprovacao' | 'aprovar' | 'rejeitar' | 'esclarecer' | 'documentacao_recebida'

export interface TransicaoInput {
  adm: RHAdmissao
  acao: AcaoAdmissao
  autorId?: string
  autorNome?: string
  motivo?: string
}

export function useTransicaoAdmissao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ adm, acao, autorId, autorNome, motivo }: TransicaoInput) => {
      const de = adm.etapa ?? 'requisicao'
      let para = de
      let patch: Record<string, unknown> = {}
      let histAcao = acao as string

      if (acao === 'solicitar_aprovacao') {
        para = 'aprovacao'
        patch = { etapa: 'aprovacao', status: 'pendente', status_aprovacao: 'pendente', motivo_decisao: null }
        histAcao = 'solicitou_aprovacao'
      } else if (acao === 'aprovar') {
        para = 'documentacao'
        patch = {
          etapa: 'documentacao', status_aprovacao: 'aprovado',
          aprovador_id: autorId ?? null, aprovador_nome: autorNome ?? null,
          data_decisao: new Date().toISOString(),
        }
        histAcao = 'aprovou'
      } else if (acao === 'rejeitar') {
        // Rejeição encerra a requisição: vai para etapa terminal e some das abas do fluxo
        para = 'cancelada'
        patch = {
          etapa: 'cancelada', status: 'cancelada', status_aprovacao: 'rejeitado',
          aprovador_id: autorId ?? null, aprovador_nome: autorNome ?? null,
          data_decisao: new Date().toISOString(), motivo_decisao: motivo ?? null,
        }
        histAcao = 'rejeitou'
      } else if (acao === 'esclarecer') {
        para = 'requisicao'
        patch = { etapa: 'requisicao', status_aprovacao: 'esclarecimento', motivo_decisao: motivo ?? null }
        histAcao = 'esclarecimento'
      } else if (acao === 'documentacao_recebida') {
        para = 'exames_treinamentos'
        patch = { etapa: 'exames_treinamentos' }
        histAcao = 'documentacao_recebida'
      }

      const { error } = await supabase.from('rh_admissoes').update(patch).eq('id', adm.id)
      if (error) throw error

      await supabase.from('rh_admissao_historico').insert({
        admissao_id: adm.id,
        acao: histAcao,
        de_etapa: de,
        para_etapa: para,
        autor_id: autorId ?? null,
        autor_nome: autorNome ?? null,
        observacao: motivo ?? null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-admissoes-fluxo'] })
    },
  })
}

// ── Edição pelo RH (campos corrigidos ficam tagueados) ───────────────────────
const LABELS_EDICAO: Record<string, string> = {
  base: 'Base', centro_custo_id: 'Centro de Custo', departamento_previsto: 'Departamento',
  tipo_contrato: 'Tipo de contrato', data_prevista_inicio: 'Início previsto', motivo: 'Motivo',
  nome: 'Nome', cpf: 'CPF', data_nascimento: 'Data de nascimento', cargo: 'Cargo', salario: 'Salário',
}

export interface EdicaoAdmissaoInput {
  adm: RHAdmissao
  patch: Partial<Record<string, unknown>>                       // campos da requisição alterados
  candidatos: { id: string; nome?: string; patch: Partial<Record<string, unknown>> }[]
  autorId?: string
  autorNome?: string
}

export function useEditarAdmissao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ adm, patch, candidatos, autorId, autorNome }: EdicaoAdmissaoInput) => {
      const editado: Record<string, boolean> = { ...(adm.editado_rh ?? {}) }
      const mudancas: string[] = []

      const reqPatch: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(patch)) {
        const atual = (adm as unknown as Record<string, unknown>)[k] ?? null
        const novo = (v === '' ? null : v) as unknown
        if (String(atual ?? '') === String(novo ?? '')) continue
        reqPatch[k] = novo
        editado[k] = true
        mudancas.push(`${LABELS_EDICAO[k] ?? k}: "${atual ?? '—'}" → "${novo ?? '—'}"`)
      }

      const candUpdates: { id: string; patch: Record<string, unknown> }[] = []
      for (const c of candidatos) {
        const original = (adm.candidatos ?? []).find(x => x.id === c.id)
        if (!original) continue
        const cp: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(c.patch)) {
          const atual = (original as unknown as Record<string, unknown>)[k] ?? null
          const novo = (v === '' ? null : v) as unknown
          if (String(atual ?? '') === String(novo ?? '')) continue
          cp[k] = novo
          editado[`cand:${c.id}:${k}`] = true
          mudancas.push(`${c.nome || original.nome || 'Candidato'} · ${LABELS_EDICAO[k] ?? k}: "${atual ?? '—'}" → "${novo ?? '—'}"`)
        }
        if (Object.keys(cp).length) candUpdates.push({ id: c.id, patch: cp })
      }

      if (!Object.keys(reqPatch).length && !candUpdates.length) return { mudancas: 0 }

      const { error } = await supabase
        .from('rh_admissoes')
        .update({ ...reqPatch, editado_rh: editado })
        .eq('id', adm.id)
      if (error) throw error

      for (const cu of candUpdates) {
        const { error: cErr } = await supabase.from('rh_admissao_candidatos').update(cu.patch).eq('id', cu.id)
        if (cErr) throw cErr
      }

      await supabase.from('rh_admissao_historico').insert({
        admissao_id: adm.id,
        acao: 'edicao_rh',
        de_etapa: adm.etapa ?? null,
        para_etapa: adm.etapa ?? null,
        autor_id: autorId ?? null,
        autor_nome: autorNome ?? null,
        observacao: `[Editado pelo RH] ${mudancas.join('; ')}`,
      })

      return { mudancas: mudancas.length }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-admissoes-fluxo'] })
    },
  })
}

// ── Missão de envio de documentos (Portal TEG) ────────────────────────────────
// RH dispara: cadastra colaborador em admissão + cria missões de documentação.
export function useEnviarMissaoDocs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ candidatoId, autorId, autorNome }: { candidatoId: string; autorId?: string; autorNome?: string }) => {
      const { data, error } = await supabase.rpc('rh_admissao_enviar_missao_docs', {
        p_candidato_id: candidatoId,
        p_autor_id: autorId ?? null,
        p_autor_nome: autorNome ?? null,
      })
      if (error) throw error
      const r = data as { ok: boolean; erro?: string; colaborador_id?: string; missoes_criadas?: number }
      if (!r.ok) throw new Error(r.erro || 'Falha ao enviar a missão')
      return r
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-admissoes-fluxo'] })
      qc.invalidateQueries({ queryKey: ['rh-admissao-missoes-docs'] })
    },
  })
}

export interface MissaoDocStatus {
  missao_id: string
  doc_tipo: string
  titulo: string
  status: 'pendente' | 'concluida' | 'dispensada'
  opcional: boolean
  concluida_em: string | null
}

// Checklist dos docs da missão de um candidato (pra etapa Documentação)
export function useMissoesDocsStatus(candidatoId?: string) {
  return useQuery<MissaoDocStatus[]>({
    queryKey: ['rh-admissao-missoes-docs', candidatoId],
    enabled: !!candidatoId,
    refetchInterval: 30_000,   // RH vê os checks chegando quase em tempo real
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rh_admissao_missoes_status', {
        p_candidato_id: candidatoId,
      })
      if (error) { console.error('useMissoesDocsStatus:', error); return [] }
      return (data ?? []) as MissaoDocStatus[]
    },
  })
}

/** Gera uma URL temporária (10 min) para visualizar um anexo do bucket privado. */
export async function getAnexoSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600)
  if (error) {
    console.error('signed url:', error)
    return null
  }
  return data?.signedUrl ?? null
}
