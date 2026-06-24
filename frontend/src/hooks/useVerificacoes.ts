// ─────────────────────────────────────────────────────────────────────────────
// hooks/useVerificacoes.ts — Verificações do SuperTEG (RH › Colaboradores).
// Job assíncrono: cria a verificação (status 'processando'), o SuperTEG roda
// até ~40min e devolve o PDF via callback. Aqui só lemos/criamos/apagamos.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

export type VerificacaoTipo = 'verificacao' | 'parecer' | 'historico' | 'outros'
export type VerificacaoStatus = 'processando' | 'concluido' | 'erro'

export interface RHVerificacao {
  id: string
  tipo: VerificacaoTipo
  titulo: string | null
  comando: string
  status: VerificacaoStatus
  resultado_texto: string | null
  pdf_path: string | null
  job_id: string | null
  colaborador_id: string | null
  erro: string | null
  criado_por_nome: string | null
  created_at: string
  updated_at: string
}

// Lista todas as verificações (mais recentes primeiro).
// Faz polling enquanto houver alguma 'processando' (tasks pending).
export function useVerificacoes() {
  return useQuery<RHVerificacao[]>({
    queryKey: ['rh-verificacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_verificacoes')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) { console.error('useVerificacoes:', error); return [] }
      return (data ?? []) as RHVerificacao[]
    },
    refetchInterval: (query) => {
      const rows = (query.state.data as RHVerificacao[] | undefined) ?? []
      return rows.some(r => r.status === 'processando') ? 15_000 : false
    },
  })
}

// Cria uma verificação → aciona a Edge Function que dispara o SuperTEG (async).
export function useCriarVerificacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { tipo: VerificacaoTipo; comando: string; titulo?: string; colaborador_id?: string | null }) => {
      const { data, error } = await supabase.functions.invoke('rh-verificacao', {
        body: { action: 'criar', ...input },
      })
      if (error) throw new Error(error.message)
      const resp = data as { ok?: boolean; motivo?: string; id?: string }
      if (!resp?.ok) throw new Error(resp?.motivo || 'Falha ao enviar verificação')
      return { id: resp.id! }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-verificacoes'] }),
  })
}

// Apaga uma verificação (linha + PDF no storage).
export function useApagarVerificacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: Pick<RHVerificacao, 'id' | 'pdf_path'>) => {
      if (v.pdf_path) {
        await supabase.storage.from('rh-verificacoes').remove([v.pdf_path])
      }
      const { error } = await supabase.from('rh_verificacoes').delete().eq('id', v.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-verificacoes'] }),
  })
}

// URL assinada temporária para ver/baixar o PDF.
export async function getVerificacaoPdfUrl(pdfPath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('rh-verificacoes')
    .createSignedUrl(pdfPath, 60 * 60)
  if (error) { console.error('getVerificacaoPdfUrl:', error); return null }
  return data?.signedUrl ?? null
}
