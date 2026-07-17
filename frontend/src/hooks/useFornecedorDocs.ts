import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { FornecedorAnexo, FornecedorDocTipo } from '../types/financeiro'

const BUCKET = 'fornecedores-docs'
const ANEXO_MAX_BYTES = 15 * 1024 * 1024 // 15 MB
export const CARTAO_CNPJ_VALIDADE_DIAS = 90

export const DOC_TIPOS: { value: FornecedorDocTipo; label: string; exigeEmissao?: boolean }[] = [
  { value: 'cartao_cnpj',     label: 'Cartão CNPJ',     exigeEmissao: true },
  { value: 'cnd_federal',     label: 'CND Federal' },
  { value: 'fgts',            label: 'FGTS (CRF)' },
  { value: 'trabalhista',     label: 'CNDT Trabalhista' },
  { value: 'contrato_social', label: 'Contrato Social' },
  { value: 'outro',           label: 'Outro' },
]

export const docTipoLabel = (t: FornecedorDocTipo) =>
  DOC_TIPOS.find(d => d.value === t)?.label ?? t

// ── Regra de negócio (pura) ──────────────────────────────────────────────────
export const onlyDigits = (v?: string | null) => String(v ?? '').replace(/\D/g, '')
export const isCnpj = (cnpj?: string | null) => onlyDigits(cnpj).length === 14

/** Cartão CNPJ é válido se emitido há no máximo 90 dias. Sem data → tratado como vencido. */
export function cartaoCnpjValido(dataEmissao?: string | null): boolean {
  if (!dataEmissao) return false
  const emissao = new Date(dataEmissao + 'T00:00:00')
  if (Number.isNaN(emissao.getTime())) return false
  const limite = new Date()
  limite.setHours(0, 0, 0, 0)
  limite.setDate(limite.getDate() - CARTAO_CNPJ_VALIDADE_DIAS)
  return emissao >= limite
}

/** Documento em memória, ainda não enviado (fluxo de cadastro novo). */
export interface StagedDoc {
  tempId: string
  tipo: FornecedorDocTipo
  file: File
  data_emissao?: string
}

/**
 * Retorna mensagem de bloqueio se o fornecedor CNPJ não tiver um Cartão CNPJ
 * atualizado (entre os anexos já salvos OU os staged). Retorna null se ok
 * ou se não for CNPJ (CPF/pessoa física fica de fora da regra).
 */
export function motivoBloqueioCartaoCnpj(
  cnpj: string | null | undefined,
  existentes: FornecedorAnexo[],
  staged: StagedDoc[],
): string | null {
  if (!isCnpj(cnpj)) return null
  const temValido =
    existentes.some(a => a.tipo === 'cartao_cnpj' && cartaoCnpjValido(a.data_emissao)) ||
    staged.some(s => s.tipo === 'cartao_cnpj' && cartaoCnpjValido(s.data_emissao))
  if (temValido) return null
  return `Fornecedor CNPJ exige o Cartão CNPJ atualizado (emitido nos últimos ${CARTAO_CNPJ_VALIDADE_DIAS} dias) anexado.`
}

// ── Query ────────────────────────────────────────────────────────────────────
export function useFornecedorAnexos(fornecedorId?: string | null) {
  return useQuery<FornecedorAnexo[]>({
    queryKey: ['fornecedor-anexos', fornecedorId],
    enabled: Boolean(fornecedorId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cmp_fornecedor_anexos')
        .select('*')
        .eq('fornecedor_id', fornecedorId as string)
        .order('criado_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as FornecedorAnexo[]
    },
  })
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

/** Envia UM arquivo (arquivo → storage → linha em cmp_fornecedor_anexos). */
export async function uploadAnexo(input: {
  fornecedorId: string
  tipo: FornecedorDocTipo
  file: File
  data_emissao?: string
}) {
  if (input.file.size > ANEXO_MAX_BYTES) {
    throw new Error(`Arquivo passa do limite (${(input.file.size / 1024 / 1024).toFixed(1)} MB). Máx: 15 MB.`)
  }
  if (input.tipo === 'cartao_cnpj' && !input.data_emissao) {
    throw new Error('Informe a data de emissão do Cartão CNPJ.')
  }
  const safe = sanitizeFilename(input.file.name)
  const uid = crypto.randomUUID()
  const path = `${input.fornecedorId}/${uid}-${safe}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, input.file, { contentType: input.file.type || undefined, upsert: false })
  if (upErr) throw upErr

  const { data, error: dbErr } = await supabase.from('cmp_fornecedor_anexos').insert({
    fornecedor_id: input.fornecedorId,
    tipo: input.tipo,
    storage_path: path,
    nome: input.file.name,
    mime: input.file.type || null,
    tamanho_bytes: input.file.size,
    data_emissao: input.data_emissao || null,
  }).select('*').single()

  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    throw dbErr
  }
  return data as FornecedorAnexo
}

/** Persiste uma lista de documentos staged para um fornecedor recém-criado. */
export async function persistStagedDocs(fornecedorId: string, staged: StagedDoc[]) {
  for (const doc of staged) {
    await uploadAnexo({ fornecedorId, tipo: doc.tipo, file: doc.file, data_emissao: doc.data_emissao })
  }
}

// ── Mutations (fluxo de fornecedor já existente) ─────────────────────────────
export function useUploadFornecedorAnexo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: uploadAnexo,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['fornecedor-anexos', vars.fornecedorId] })
      qc.invalidateQueries({ queryKey: ['fornecedores-doc-status'] })
    },
  })
}

export function useRemoverFornecedorAnexo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (anexo: FornecedorAnexo) => {
      const { error } = await supabase.from('cmp_fornecedor_anexos').delete().eq('id', anexo.id)
      if (error) throw error
      await supabase.storage.from(BUCKET).remove([anexo.storage_path]).catch(() => {})
    },
    onSuccess: (_d, anexo) => {
      qc.invalidateQueries({ queryKey: ['fornecedor-anexos', anexo.fornecedor_id] })
      qc.invalidateQueries({ queryKey: ['fornecedores-doc-status'] })
    },
  })
}

/**
 * Mapa fornecedor_id → tem Cartão CNPJ válido? Usado pela lista para marcar
 * pendências de regularização (carrega só anexos cartao_cnpj, poucas linhas).
 */
export function useFornecedoresCartaoCnpjStatus() {
  return useQuery<Map<string, boolean>>({
    queryKey: ['fornecedores-doc-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cmp_fornecedor_anexos')
        .select('fornecedor_id, data_emissao')
        .eq('tipo', 'cartao_cnpj')
      if (error) throw error
      const map = new Map<string, boolean>()
      for (const row of (data ?? []) as { fornecedor_id: string; data_emissao: string | null }[]) {
        if (cartaoCnpjValido(row.data_emissao)) map.set(row.fornecedor_id, true)
      }
      return map
    },
    staleTime: 60_000,
  })
}
