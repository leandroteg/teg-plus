// ─────────────────────────────────────────────────────────────────────────────
// hooks/useRHAdmissaoFluxo.ts — Fluxo de Admissão (RH-only)
// Tabelas RH: rh_admissoes (requisição), rh_admissao_candidatos (N por requisição),
// rh_admissao_anexos, rh_admissao_historico. Bucket privado rh-admissao-docs.
// IA via webhook n8n RH-only. Não toca em nada de outros módulos.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { RHAdmissao, RHAdmissaoCandidato } from '../types/rh'

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

// ── IA: preenche a Ficha de Registro inteira lendo os anexos do candidato ──────
// Baixa cada anexo do bucket, converte p/ base64 e manda ao n8n (Gemini), que lê
// tudo e devolve os campos da ficha consolidados. Síncrono do ponto de vista da UI.
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = reader.result as string
      resolve(res.includes(',') ? res.split(',')[1] : res)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

const MAX_DOC_BYTES = 10 * 1024 * 1024   // pula anexo individual > 10MB
const MAX_TOTAL_B64 = 14 * 1024 * 1024   // limite do payload n8n (~16MB)

export async function preencherFichaRegistroAuto(
  cand: RHAdmissaoCandidato,
): Promise<Record<string, unknown> | null> {
  try {
    const anexos = cand.anexos ?? []
    const documentos: { tipo: string; nome: string; mime_type: string; base64: string }[] = []
    let totalB64 = 0
    for (const a of anexos) {
      if (a.tamanho_bytes && a.tamanho_bytes > MAX_DOC_BYTES) { console.warn('anexo grande pulado:', a.arquivo_nome); continue }
      const { data, error } = await supabase.storage.from(BUCKET).download(a.arquivo_path)
      if (error || !data) { console.warn('falha ao baixar anexo:', a.arquivo_nome, error); continue }
      const base64 = await blobToBase64(data)
      if (!base64) continue
      if (totalB64 + base64.length > MAX_TOTAL_B64) { console.warn('payload cheio, anexo ignorado:', a.arquivo_nome); continue }
      totalB64 += base64.length
      documentos.push({ tipo: a.tipo, nome: a.arquivo_nome, mime_type: a.mime_type || data.type || 'application/pdf', base64 })
    }
    if (!documentos.length) return null
    const resp = await fetch(`${N8N_URL}/rh/admissao/preencher-ficha-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'analise os documentos anexos desse colaborador e preencha automaticamente a ficha de registro',
        candidato: {
          id: cand.id,
          nome: cand.nome,
          cpf: cand.cpf,
          data_nascimento: cand.data_nascimento,
          cargo: cand.cargo,
          salario: cand.salario,
        },
        documentos,
      }),
    })
    if (!resp.ok) return null
    const json = (await resp.json()) as Record<string, unknown>
    return (json?.dados ?? json) as Record<string, unknown>
  } catch (e) {
    console.warn('preencherFichaRegistroAuto:', e)
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
      // 0) trava de duplicidade: CPF (ou nome) com requisição ainda aberta
      for (const c of candidatos) {
        const { data: dup } = await supabase.rpc('rh_admissao_existe_aberta', {
          p_cpf: c.cpf || null,
          p_nome: c.nome || null,
        })
        const d = dup as { existe?: boolean; criterio?: string; etapa?: string; candidato_nome?: string } | null
        if (d?.existe) {
          const etapaLabel = String(d.etapa ?? '').replace(/_/g, ' ')
          throw new Error(
            `${d.candidato_nome ?? c.nome} já possui uma requisição de admissão aberta (etapa: ${etapaLabel}), ` +
            `identificada por ${d.criterio === 'cpf' ? 'CPF' : 'nome'}. Conclua ou cancele a requisição existente antes de criar outra.`,
          )
        }
      }

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
export type AcaoAdmissao =
  | 'solicitar_aprovacao' | 'aprovar' | 'rejeitar' | 'esclarecer'
  | 'enviar_documentacao' | 'documentacao_recebida' | 'apto_registro'
  | 'registro_concluido' | 'mobilizacao_concluida'

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
        para = 'proposta_alinhamento'
        patch = {
          etapa: 'proposta_alinhamento', status_aprovacao: 'aprovado',
          aprovador_id: autorId ?? null, aprovador_nome: autorNome ?? null,
          data_decisao: new Date().toISOString(),
        }
        histAcao = 'aprovou'
      } else if (acao === 'enviar_documentacao') {
        para = 'documentacao'
        patch = { etapa: 'documentacao' }
        histAcao = 'proposta_concluida'
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
      } else if (acao === 'apto_registro') {
        para = 'registro'
        patch = { etapa: 'registro' }
        histAcao = 'apto_registro'
      } else if (acao === 'registro_concluido') {
        para = 'mobilizacao'
        patch = { etapa: 'mobilizacao' }
        histAcao = 'registro_concluido'
      } else if (acao === 'mobilizacao_concluida') {
        para = 'integracao'
        patch = { etapa: 'integracao' }
        histAcao = 'mobilizacao_concluida'
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
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rh_admissao_missoes_status', {
        p_candidato_id: candidatoId,
      })
      if (error) { console.error('useMissoesDocsStatus:', error); return [] }
      return (data ?? []) as MissaoDocStatus[]
    },
  })
}

// ── Parecer de Qualificação (SuperTEG x Matriz CEMIG) — interno do ERP ───────
export interface ParecerQualificacao {
  candidato_id: string
  cargo: string | null
  regra_chave: string | null
  regra: string | null
  aprovado: boolean | null
  paragrafos: string[] | null
  confianca: number | null
  gerado_em: string
}

export function useParecerQualificacao(candidatoId?: string) {
  return useQuery<ParecerQualificacao | null>({
    queryKey: ['rh-parecer-qual', candidatoId],
    enabled: !!candidatoId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await supabase.from('rh_admissao_pareceres')
        .select('*').eq('candidato_id', candidatoId).maybeSingle()
      return (data ?? null) as ParecerQualificacao | null
    },
  })
}

// ── Etapas 4-7: Exames/Treinamentos, Mobilização, Integração, Liberado ───────

export interface RHExame {
  candidato_id: string
  clinica: string | null
  endereco: string | null
  data_hora: string | null
  instrucoes: string | null
  status: 'pendente_agendamento' | 'agendado' | 'realizado' | 'apto' | 'inapto'
}

export interface RHTreinamento {
  id: string
  candidato_id: string
  nome: string
  norma: string | null
  status: 'pendente' | 'concluido'
}

export interface RHMobilizacao {
  candidato_id: string
  missao_id?: string | null
  data_apresentacao: string | null
  local_apresentacao: string | null
  transporte_tipo: string | null
  transporte_detalhes: string | null
  transporte_ok: boolean
  alojamento_endereco: string | null
  alojamento_detalhes: string | null
  alojamento_ok: boolean
  kit_epi_ok: boolean
  acessos_ok: boolean
  dados_confirmados: boolean
  respostas: Record<string, string> | null
}

export interface RHIntegracao {
  candidato_id: string
  contrato_assinado: boolean
  ficha_epi_assinada: boolean
  integracao_presencial: boolean
  aceites_enviados: boolean
  observacoes: string | null
}

export interface AceiteStatus {
  missao_id: string
  aceite: string
  titulo: string
  status: string
  concluida_em: string | null
}

export interface RHRegistro {
  candidato_id: string
  ficha_gerada_em: string | null
  missao_assinatura_id: string | null
  observacoes: string | null
  ficha_dados: Record<string, unknown> | null
}

export interface RHProposta {
  candidato_id: string
  proposta_enviada: boolean
  proposta_aceita: boolean
  condicoes: string | null
  data_chegada: string | null
  deslocamento_detalhes: string | null
  responsavel_recebimento: string | null
  observacoes: string | null
}

// Dados de etapa por candidato (1 fetch por card)
export function useEtapaCandidato(candidatoId?: string) {
  return useQuery({
    queryKey: ['rh-admissao-etapa-cand', candidatoId],
    enabled: !!candidatoId,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,   // não recarregar enquanto o RH preenche
    queryFn: async () => {
      const [prop, ex, tr, mob, integ, ace, reg, ass] = await Promise.all([
        supabase.from('rh_admissao_proposta').select('*').eq('candidato_id', candidatoId).maybeSingle(),
        supabase.from('rh_admissao_exame').select('*').eq('candidato_id', candidatoId).maybeSingle(),
        supabase.from('rh_admissao_treinamentos').select('*').eq('candidato_id', candidatoId).order('created_at'),
        supabase.from('rh_admissao_mobilizacao').select('*').eq('candidato_id', candidatoId).maybeSingle(),
        supabase.from('rh_admissao_integracao').select('*').eq('candidato_id', candidatoId).maybeSingle(),
        supabase.rpc('rh_admissao_aceites_status', { p_candidato_id: candidatoId }),
        supabase.from('rh_admissao_registro').select('*').eq('candidato_id', candidatoId).maybeSingle(),
        supabase.rpc('rh_admissao_assinatura_status', { p_candidato_id: candidatoId }),
      ])
      const assRow = (Array.isArray(ass.data) ? ass.data[0] : ass.data) as { status?: string; concluida_em?: string } | undefined
      return {
        proposta: (prop.data ?? null) as RHProposta | null,
        exame: (ex.data ?? null) as RHExame | null,
        treinamentos: (tr.data ?? []) as RHTreinamento[],
        mobilizacao: (mob.data ?? null) as RHMobilizacao | null,
        integracao: (integ.data ?? null) as RHIntegracao | null,
        aceites: (ace.data ?? []) as AceiteStatus[],
        registro: (reg.data ?? null) as RHRegistro | null,
        assinatura: assRow ? { status: assRow.status ?? 'pendente', concluida_em: assRow.concluida_em ?? null } : null,
      }
    },
  })
}

export function useProposta() {
  const qc = useQueryClient()
  const atualizar = useMutation({
    mutationFn: async (i: { candidatoId: string; patch: Partial<RHProposta> }) => {
      const { error } = await supabase.from('rh_admissao_proposta')
        .upsert({ candidato_id: i.candidatoId, ...i.patch, updated_at: new Date().toISOString() }, { onConflict: 'candidato_id' })
      if (error) throw error
    },
    onSuccess: (_, v) => invalidateEtapa(qc, v.candidatoId),
  })
  return { atualizar }
}

// Upload de anexo pelo RH em qualquer etapa (ex.: proposta assinada)
export function useUploadAnexoCandidato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { admissaoId: string; candidatoId: string; file: File; tipo?: string; autorId?: string }) => {
      const safeName = i.file.name.replace(/[^\w.\-]+/g, '_')
      const path = `${i.admissaoId}/${i.candidatoId}/rh_${i.tipo ?? 'outro'}_${Date.now()}_${safeName}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, i.file, { upsert: false })
      if (upErr) throw upErr
      const { error } = await supabase.from('rh_admissao_anexos').insert({
        admissao_id: i.admissaoId,
        candidato_id: i.candidatoId,
        tipo: i.tipo ?? 'outro',
        obrigatorio: false,
        arquivo_nome: i.file.name,
        arquivo_path: path,
        tamanho_bytes: i.file.size,
        mime_type: i.file.type || null,
        uploaded_por: i.autorId ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-admissoes-fluxo'] }),
  })
}

function invalidateEtapa(qc: ReturnType<typeof useQueryClient>, candidatoId: string) {
  qc.invalidateQueries({ queryKey: ['rh-admissao-etapa-cand', candidatoId] })
}

export function useAsoAgendar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { candidatoId: string; clinica: string; endereco: string; dataHora: string; instrucoes?: string; autorNome?: string }) => {
      const { data, error } = await supabase.rpc('rh_admissao_aso_agendar', {
        p_candidato_id: i.candidatoId, p_clinica: i.clinica, p_endereco: i.endereco,
        p_data_hora: i.dataHora, p_instrucoes: i.instrucoes ?? null, p_autor_nome: i.autorNome ?? null,
      })
      if (error) throw error
      const r = data as { ok: boolean; erro?: string }
      if (!r.ok) throw new Error(r.erro || 'Falha ao agendar')
      return r
    },
    onSuccess: (_, v) => invalidateEtapa(qc, v.candidatoId),
  })
}

export function useAsoSetStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { candidatoId: string; status: RHExame['status'] }) => {
      const { error } = await supabase.from('rh_admissao_exame')
        .upsert({ candidato_id: i.candidatoId, status: i.status, updated_at: new Date().toISOString() }, { onConflict: 'candidato_id' })
      if (error) throw error
    },
    onSuccess: (_, v) => invalidateEtapa(qc, v.candidatoId),
  })
}

export function useTreinamentos() {
  const qc = useQueryClient()
  const add = useMutation({
    mutationFn: async (i: { candidatoId: string; nome: string; norma?: string }) => {
      const { error } = await supabase.from('rh_admissao_treinamentos')
        .insert({ candidato_id: i.candidatoId, nome: i.nome, norma: i.norma ?? null })
      if (error) throw error
    },
    onSuccess: (_, v) => invalidateEtapa(qc, v.candidatoId),
  })
  const toggle = useMutation({
    mutationFn: async (i: { id: string; candidatoId: string; concluido: boolean }) => {
      const { error } = await supabase.from('rh_admissao_treinamentos')
        .update({ status: i.concluido ? 'concluido' : 'pendente', concluido_em: i.concluido ? new Date().toISOString() : null })
        .eq('id', i.id)
      if (error) throw error
    },
    onSuccess: (_, v) => invalidateEtapa(qc, v.candidatoId),
  })
  const remover = useMutation({
    mutationFn: async (i: { id: string; candidatoId: string }) => {
      const { error } = await supabase.from('rh_admissao_treinamentos').delete().eq('id', i.id)
      if (error) throw error
    },
    onSuccess: (_, v) => invalidateEtapa(qc, v.candidatoId),
  })
  return { add, toggle, remover }
}

export function useMobilizacao() {
  const qc = useQueryClient()
  const enviarMissao = useMutation({
    mutationFn: async (i: { candidatoId: string; autorNome?: string }) => {
      const { data, error } = await supabase.rpc('rh_admissao_mob_enviar_missao', {
        p_candidato_id: i.candidatoId, p_autor_nome: i.autorNome ?? null,
      })
      if (error) throw error
      const r = data as { ok: boolean; erro?: string }
      if (!r.ok) throw new Error(r.erro || 'Falha ao enviar missão')
    },
    onSuccess: (_, v) => invalidateEtapa(qc, v.candidatoId),
  })
  const atualizar = useMutation({
    mutationFn: async (i: { candidatoId: string; patch: Partial<RHMobilizacao> }) => {
      const { error } = await supabase.from('rh_admissao_mobilizacao')
        .upsert({ candidato_id: i.candidatoId, ...i.patch, updated_at: new Date().toISOString() }, { onConflict: 'candidato_id' })
      if (error) throw error
    },
    onSuccess: (_, v) => invalidateEtapa(qc, v.candidatoId),
  })
  return { enviarMissao, atualizar }
}

export function useIntegracao() {
  const qc = useQueryClient()
  const enviarAceites = useMutation({
    mutationFn: async (i: { candidatoId: string; autorNome?: string }) => {
      const { data, error } = await supabase.rpc('rh_admissao_int_enviar_aceites', {
        p_candidato_id: i.candidatoId, p_autor_nome: i.autorNome ?? null,
      })
      if (error) throw error
      const r = data as { ok: boolean; erro?: string }
      if (!r.ok) throw new Error(r.erro || 'Falha ao enviar aceites')
    },
    onSuccess: (_, v) => invalidateEtapa(qc, v.candidatoId),
  })
  const atualizar = useMutation({
    mutationFn: async (i: { candidatoId: string; patch: Partial<RHIntegracao> }) => {
      const { error } = await supabase.from('rh_admissao_integracao')
        .upsert({ candidato_id: i.candidatoId, ...i.patch, updated_at: new Date().toISOString() }, { onConflict: 'candidato_id' })
      if (error) throw error
    },
    onSuccess: (_, v) => invalidateEtapa(qc, v.candidatoId),
  })
  return { enviarAceites, atualizar }
}

// Etapa Registro: ficha p/ contabilidade, contrato p/ assinatura, matrícula
export function useRegistro() {
  const qc = useQueryClient()
  const gerarFicha = useMutation({
    mutationFn: async (i: { candidatoId: string; dados?: Record<string, unknown> }) => {
      const { data, error } = await supabase.functions.invoke('rh-ficha-colaborador', {
        body: { candidato_id: i.candidatoId, dados: i.dados ?? {} },
      })
      if (error) throw error
      const r = data as { ok: boolean; url?: string; motivo?: string }
      if (!r.ok) throw new Error(r.motivo || 'Falha ao gerar a ficha')
      return r
    },
    onSuccess: (_, v) => {
      invalidateEtapa(qc, v.candidatoId)
      qc.invalidateQueries({ queryKey: ['rh-admissoes-fluxo'] })
    },
  })
  const enviarAssinatura = useMutation({
    mutationFn: async (i: { candidatoId: string; contratoPath: string; autorNome?: string }) => {
      // URL assinada de 7 dias pro colaborador abrir o contrato no Portal
      const { data: signed, error: sErr } = await supabase.storage
        .from(BUCKET).createSignedUrl(i.contratoPath, 7 * 24 * 3600)
      if (sErr || !signed?.signedUrl) throw new Error('Falha ao gerar o link do contrato')
      const { data, error } = await supabase.rpc('rh_admissao_reg_enviar_assinatura', {
        p_candidato_id: i.candidatoId, p_acao_url: signed.signedUrl, p_autor_nome: i.autorNome ?? null,
      })
      if (error) throw error
      const r = data as { ok: boolean; erro?: string }
      if (!r.ok) throw new Error(r.erro || 'Falha ao enviar para assinatura')
    },
    onSuccess: (_, v) => invalidateEtapa(qc, v.candidatoId),
  })
  const setMatricula = useMutation({
    mutationFn: async (i: { colaboradorId: string; candidatoId: string; matricula: string }) => {
      const { error } = await supabase.from('rh_colaboradores')
        .update({ matricula: i.matricula || null }).eq('id', i.colaboradorId)
      if (error) throw error
    },
    onSuccess: (_, v) => invalidateEtapa(qc, v.candidatoId),
  })
  // Envia a ficha + documentos do candidato por e-mail (caixa do RH via n8n)
  const enviarEmail = useMutation({
    mutationFn: async (i: { candidatoId: string; destinatario: string }) => {
      const resp = await fetch(`${N8N_URL}/rh/ficha/enviar-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidato_id: i.candidatoId, destinatario: i.destinatario }),
      })
      const r = (await resp.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!resp.ok || !r.ok) throw new Error(r.message || 'Falha ao enviar o e-mail')
    },
  })
  return { gerarFicha, enviarAssinatura, setMatricula, enviarEmail }
}

// Matrícula atual do colaborador vinculado (etapa Registro)
export function useMatriculaColaborador(colaboradorId?: string) {
  return useQuery<string | null>({
    queryKey: ['rh-colab-matricula', colaboradorId],
    enabled: !!colaboradorId,
    queryFn: async () => {
      const { data } = await supabase.from('rh_colaboradores').select('matricula').eq('id', colaboradorId).maybeSingle()
      return (data?.matricula ?? null) as string | null
    },
  })
}

export function useLiberarAdmissao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { admissaoId: string; autorId?: string; autorNome?: string }) => {
      const { data, error } = await supabase.rpc('rh_admissao_liberar', {
        p_admissao_id: i.admissaoId, p_autor_id: i.autorId ?? null, p_autor_nome: i.autorNome ?? null,
      })
      if (error) throw error
      const r = data as { ok: boolean; erro?: string; liberados?: number }
      if (!r.ok) throw new Error(r.erro || 'Falha ao liberar')
      return r
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-admissoes-fluxo'] })
      qc.invalidateQueries({ queryKey: ['rh-colaboradores'] })
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
