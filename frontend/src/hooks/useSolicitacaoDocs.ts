// ─────────────────────────────────────────────────────────────────────────────
// hooks/useSolicitacaoDocs.ts — Anexos da Solicitação de Contrato
//
// Duas categorias: fornecedor (Cartão CNPJ, CNH, CPF, Comprovante de Endereço) e
// complementar (Proposta Comercial, Ordem de Compra, Especificações Técnicas).
// Bucket privado (mig 195) → leitura via signed URL. Staged no cadastro novo
// (solicitação só tem id após a RPC), upload imediato no detalhe.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

const BUCKET = 'contratos-solicitacao-docs'
const ANEXO_MAX_BYTES = 15 * 1024 * 1024 // 15 MB

export type SolicitacaoDocCategoria = 'fornecedor' | 'complementar'
export type SolicitacaoDocTipo =
  | 'cartao_cnpj' | 'cnh' | 'cpf' | 'comprovante_endereco'
  | 'proposta_comercial' | 'ordem_compra' | 'especificacoes_tecnicas' | 'outro'

export interface SolicitacaoAnexo {
  id: string
  solicitacao_id: string
  categoria: SolicitacaoDocCategoria
  tipo: SolicitacaoDocTipo
  nome: string
  storage_path: string
  mime: string | null
  tamanho_bytes: number | null
  criado_em: string
  criado_por_nome: string | null
}

export const DOC_TIPOS: { value: SolicitacaoDocTipo; label: string; categoria: SolicitacaoDocCategoria }[] = [
  { value: 'cartao_cnpj',             label: 'Cartão CNPJ',             categoria: 'fornecedor' },
  { value: 'cnh',                     label: 'CNH',                     categoria: 'fornecedor' },
  { value: 'cpf',                     label: 'CPF',                     categoria: 'fornecedor' },
  { value: 'comprovante_endereco',    label: 'Comprovante de Endereço', categoria: 'fornecedor' },
  { value: 'proposta_comercial',      label: 'Proposta Comercial',      categoria: 'complementar' },
  { value: 'ordem_compra',            label: 'Ordem de Compra',         categoria: 'complementar' },
  { value: 'especificacoes_tecnicas', label: 'Especificações Técnicas', categoria: 'complementar' },
  { value: 'outro',                   label: 'Outro',                   categoria: 'complementar' },
]

export const docTipoLabel = (t: SolicitacaoDocTipo) =>
  DOC_TIPOS.find(d => d.value === t)?.label ?? t

export const tiposPorCategoria = (c: SolicitacaoDocCategoria) =>
  DOC_TIPOS.filter(d => d.categoria === c)

export const CATEGORIAS: { value: SolicitacaoDocCategoria; label: string; hint: string }[] = [
  { value: 'fornecedor',   label: 'Documentos do Fornecedor',  hint: 'Cartão CNPJ, CNH, CPF, Comprovante de Endereço' },
  { value: 'complementar', label: 'Documentos Complementares', hint: 'Proposta Comercial, Ordem de Compra, Especificações Técnicas' },
]

/** Documento em memória, ainda não enviado (fluxo de solicitação nova). */
export interface StagedDoc {
  tempId: string
  categoria: SolicitacaoDocCategoria
  tipo: SolicitacaoDocTipo
  file: File
}

/**
 * Regra de obrigatoriedade para ENVIAR (não para rascunho):
 *   Cartão CNPJ + (CNH ou CPF) + (Proposta Comercial ou Ordem de Compra).
 * Considera anexos já salvos (detalhe) + staged (nova solicitação).
 * Retorna a mensagem do primeiro bloqueio, ou null se tudo ok.
 */
export function motivoBloqueioDocsObrigatorios(
  existentes: { tipo: SolicitacaoDocTipo }[],
  staged: { tipo: SolicitacaoDocTipo }[],
): string | null {
  const tipos = new Set<SolicitacaoDocTipo>([
    ...existentes.map(a => a.tipo),
    ...staged.map(s => s.tipo),
  ])
  if (!tipos.has('cartao_cnpj')) return 'Anexe o Cartão CNPJ (Documentos do Fornecedor).'
  if (!tipos.has('cnh') && !tipos.has('cpf')) return 'Anexe a CNH ou o CPF (Documentos do Fornecedor).'
  if (!tipos.has('proposta_comercial') && !tipos.has('ordem_compra'))
    return 'Anexe a Proposta Comercial ou a Ordem de Compra (Documentos Complementares).'
  return null
}

// ── Storage helpers ──────────────────────────────────────────────────────────
function sanitizeFilename(name: string) {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120)
}

export async function getAnexoUrl(storage_path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storage_path, 60 * 5)
  if (error) throw error
  return data.signedUrl
}

/** Envia UM arquivo (arquivo → storage → linha em con_solicitacao_anexos). */
export async function uploadAnexo(input: {
  solicitacaoId: string
  categoria: SolicitacaoDocCategoria
  tipo: SolicitacaoDocTipo
  file: File
}) {
  if (input.file.size > ANEXO_MAX_BYTES) {
    throw new Error(`Arquivo passa do limite (${(input.file.size / 1024 / 1024).toFixed(1)} MB). Máx: 15 MB.`)
  }
  const safe = sanitizeFilename(input.file.name)
  const uid = crypto.randomUUID()
  const path = `${input.solicitacaoId}/${uid}-${safe}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, input.file, { contentType: input.file.type || undefined, upsert: false })
  if (upErr) throw upErr

  const { data, error: dbErr } = await supabase.from('con_solicitacao_anexos').insert({
    solicitacao_id: input.solicitacaoId,
    categoria: input.categoria,
    tipo: input.tipo,
    storage_path: path,
    nome: input.file.name,
    mime: input.file.type || null,
    tamanho_bytes: input.file.size,
  }).select('*').single()

  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    throw dbErr
  }
  return data as SolicitacaoAnexo
}

/** Persiste os documentos staged de uma solicitação recém-criada. */
export async function persistStagedDocs(solicitacaoId: string, staged: StagedDoc[]) {
  for (const doc of staged) {
    await uploadAnexo({ solicitacaoId, categoria: doc.categoria, tipo: doc.tipo, file: doc.file })
  }
}

// ── Query ────────────────────────────────────────────────────────────────────
export function useSolicitacaoAnexos(solicitacaoId?: string | null) {
  return useQuery<SolicitacaoAnexo[]>({
    queryKey: ['con-solicitacao-anexos', solicitacaoId],
    enabled: Boolean(solicitacaoId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_solicitacao_anexos')
        .select('*')
        .eq('solicitacao_id', solicitacaoId as string)
        .order('criado_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as SolicitacaoAnexo[]
    },
  })
}

// ── Mutations (solicitação já existente) ─────────────────────────────────────
export function useUploadSolicitacaoAnexo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: uploadAnexo,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['con-solicitacao-anexos', vars.solicitacaoId] })
    },
  })
}

export function useRemoverSolicitacaoAnexo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (anexo: SolicitacaoAnexo) => {
      const { error } = await supabase.from('con_solicitacao_anexos').delete().eq('id', anexo.id)
      if (error) throw error
      await supabase.storage.from(BUCKET).remove([anexo.storage_path]).catch(() => {})
    },
    onSuccess: (_d, anexo) => {
      qc.invalidateQueries({ queryKey: ['con-solicitacao-anexos', anexo.solicitacao_id] })
    },
  })
}
