// ─────────────────────────────────────────────────────────────────────────────
// useHolerites.ts — Holerites do colaborador logado (Portal TEG) + upload (RH).
// Mig 131 cria rh_holerites + RLS (proprios vs RH).
// Bucket storage: rh-holerites (privado, signed URL via getDownloadUrl).
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

export type TipoHolerite = 'mensal' | '13o' | 'ferias' | 'rescisao' | 'adiantamento'

export interface Holerite {
  id: string
  colaborador_id: string
  competencia: string         // YYYY-MM-DD
  tipo: TipoHolerite
  arquivo_url: string         // storage path (bucket rh-holerites)
  arquivo_nome: string | null
  valor_liquido: number | null
  observacao: string | null
  uploaded_at: string
  uploaded_por_nome: string | null
}

const BUCKET = 'rh-holerites'

// ── Lista holerites visiveis (RLS filtra automaticamente) ────────────────────
// Sem args: do proprio colaborador. Com colaboradorId: usado por RH admin.
export function useHolerites(colaboradorId?: string) {
  return useQuery<Holerite[]>({
    queryKey: ['holerites', colaboradorId ?? 'self'],
    queryFn: async () => {
      let q = supabase
        .from('rh_holerites')
        .select('id, colaborador_id, competencia, tipo, arquivo_url, arquivo_nome, valor_liquido, observacao, uploaded_at, uploaded_por_nome')
        .order('competencia', { ascending: false })
      if (colaboradorId) q = q.eq('colaborador_id', colaboradorId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Holerite[]
    },
    staleTime: 60_000,
  })
}

// Gera signed URL (1h) pra download. Bucket e privado.
export async function getHoleriteDownloadUrl(arquivoPath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(arquivoPath, 3600)
  if (error) return null
  return data?.signedUrl ?? null
}

// ── Upload de holerite (RH/admin via RLS) ────────────────────────────────────
export function useUploadHolerite() {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  return useMutation({
    mutationFn: async ({
      colaboradorId,
      competencia,
      tipo,
      file,
      valorLiquido,
      observacao,
    }: {
      colaboradorId: string
      competencia: string        // YYYY-MM-DD
      tipo: TipoHolerite
      file: File
      valorLiquido?: number
      observacao?: string
    }) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
      const path = `${colaboradorId}/${competencia.slice(0, 7)}/${tipo}_${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: file.type || 'application/pdf',
          upsert: true,
        })
      if (upErr) throw upErr

      // UPSERT em rh_holerites (unique colaborador_id+competencia+tipo)
      const { data: { user } } = await supabase.auth.getUser()
      const { error: insErr } = await supabase
        .from('rh_holerites')
        .upsert({
          colaborador_id: colaboradorId,
          competencia,
          tipo,
          arquivo_url: path,
          arquivo_nome: file.name,
          valor_liquido: valorLiquido ?? null,
          observacao: observacao ?? null,
          uploaded_by: user?.id ?? null,
          uploaded_por_nome: perfil?.nome ?? null,
        }, { onConflict: 'colaborador_id,competencia,tipo' })
      if (insErr) throw insErr
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['holerites', vars.colaboradorId] })
      qc.invalidateQueries({ queryKey: ['holerites', 'self'] })
    },
  })
}

// ── Upload em batch: 1 arquivo por colaborador (nome do arquivo = matricula ou cpf) ──
// Pra futuro: parser de planilha de RH com competencia+colaborador+valor.
// Por ora a UI faz upload individual por colaborador.

// ── Lote consolidado → SuperTEG (split por colaborador) ──────────────────────
// Sobe 1 PDF consolidado no bucket e dispara o SuperTEG via webhook n8n
// (a SUPERTEG_API_KEY fica como secret no n8n; nunca no browser).
export type TipoLoteHolerite = 'mensal' | '13_salario' | 'ferias'

const N8N_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'

export interface LoteResultado {
  job_id?: string
  status?: string
  recebido_em?: string
  error?: string
  storage_path: string
  uploaded: boolean
  [k: string]: unknown
}

export function useEnviarLoteHolerites() {
  const { perfil } = useAuth()
  return useMutation<LoteResultado, Error, { competencia: string; tipo: TipoLoteHolerite; file: File }>({
    mutationFn: async ({ competencia, tipo, file }) => {
      const comp = competencia.slice(0, 7) // YYYY-MM
      const safe = file.name.replace(/[^\w.\-]+/g, '_')
      const path = `lote/${comp}/${Date.now()}_${safe}`

      // 1) sobe o PDF consolidado
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || 'application/pdf', upsert: false,
      })
      if (upErr) throw upErr

      // 2) URL assinada (1h) do arquivo
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
      const fileUrl = signed?.signedUrl
      if (!fileUrl) throw new Error('Falha ao gerar URL do arquivo no Storage')

      // 3) dispara o SuperTEG via n8n (key fica no n8n)
      let data: Record<string, unknown> = {}
      let ok = false
      try {
        const resp = await fetch(`${N8N_URL}/rh/holerites/processar`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_url: fileUrl, competencia: comp, tipo, perfil_id: perfil?.id }),
        })
        data = await resp.json().catch(() => ({}))
        ok = resp.ok
      } catch (e) {
        data = { error: String(e) }
      }

      const result: LoteResultado = { ...data, storage_path: path, uploaded: true }
      if (!ok && !result.status) result.status = 'erro'
      return result
    },
  })
}

// ── Remover holerite (RH/admin) ──────────────────────────────────────────────
export function useRemoverHolerite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Busca path pra remover do storage
      const { data: h } = await supabase
        .from('rh_holerites')
        .select('arquivo_url, colaborador_id')
        .eq('id', id)
        .single()

      // 2. Deleta o registro (storage ate fica orfao se falhar; nao bloqueia)
      const { error } = await supabase.from('rh_holerites').delete().eq('id', id)
      if (error) throw error

      if (h?.arquivo_url) {
        await supabase.storage.from(BUCKET).remove([h.arquivo_url]).catch(() => {})
      }
      return h
    },
    onSuccess: (h) => {
      qc.invalidateQueries({ queryKey: ['holerites', h?.colaborador_id] })
      qc.invalidateQueries({ queryKey: ['holerites', 'self'] })
    },
  })
}
