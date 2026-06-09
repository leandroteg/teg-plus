// ─────────────────────────────────────────────────────────────────────────────
// hooks/useRHAdmissaoFluxo.ts — Fluxo de Admissão (RH-only)
// Lê/escreve apenas tabelas RH: rh_admissoes, rh_admissao_anexos, rh_admissao_historico
// e o bucket privado rh-admissao-docs. Não toca em nada de outros módulos.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { RHAdmissao } from '../types/rh'

const BUCKET = 'rh-admissao-docs'
const SELECT =
  '*, obra_prevista:sys_obras!obra_prevista_id(id,codigo,nome), anexos:rh_admissao_anexos(*)'

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
      return (data ?? []) as RHAdmissao[]
    },
  })
}

export interface ArquivoAdmissao {
  file: File
  tipo: string
  obrigatorio: boolean
}

export interface NovaAdmissaoInput {
  dados: Partial<RHAdmissao>
  arquivos: ArquivoAdmissao[]
  autorId?: string
  autorNome?: string
}

export function useCriarAdmissao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dados, arquivos, autorId, autorNome }: NovaAdmissaoInput) => {
      // 1) cria a admissão (etapa = requisição, pendente)
      const insert = {
        ...dados,
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
      if (error || !adm) throw error ?? new Error('Falha ao criar admissão')
      const admissaoId = (adm as { id: string }).id

      // 2) upload dos arquivos + registro dos anexos
      for (const a of arquivos) {
        const safeName = a.file.name.replace(/[^\w.\-]+/g, '_')
        const path = `${admissaoId}/${a.tipo}_${Date.now()}_${safeName}`
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, a.file, { upsert: false })
        if (upErr) {
          console.error('upload anexo:', upErr)
          continue
        }
        await supabase.from('rh_admissao_anexos').insert({
          admissao_id: admissaoId,
          tipo: a.tipo,
          obrigatorio: a.obrigatorio,
          arquivo_nome: a.file.name,
          arquivo_path: path,
          tamanho_bytes: a.file.size,
          mime_type: a.file.type || null,
          uploaded_por: autorId ?? null,
        })
      }

      // 3) histórico
      await supabase.from('rh_admissao_historico').insert({
        admissao_id: admissaoId,
        acao: 'criada',
        para_etapa: 'requisicao',
        autor_id: autorId ?? null,
        autor_nome: autorNome ?? null,
      })

      return admissaoId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rh-admissoes-fluxo'] })
      qc.invalidateQueries({ queryKey: ['rh-admissoes'] })
    },
  })
}

export type AcaoAdmissao = 'solicitar_aprovacao' | 'aprovar' | 'rejeitar' | 'esclarecer'

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
        para = 'requisicao'
        patch = {
          etapa: 'requisicao', status_aprovacao: 'rejeitado',
          aprovador_id: autorId ?? null, aprovador_nome: autorNome ?? null,
          data_decisao: new Date().toISOString(), motivo_decisao: motivo ?? null,
        }
        histAcao = 'rejeitou'
      } else if (acao === 'esclarecer') {
        para = 'requisicao'
        patch = { etapa: 'requisicao', status_aprovacao: 'esclarecimento', motivo_decisao: motivo ?? null }
        histAcao = 'esclarecimento'
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

/** Gera uma URL temporária (10 min) para visualizar um anexo do bucket privado. */
export async function getAnexoSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600)
  if (error) {
    console.error('signed url:', error)
    return null
  }
  return data?.signedUrl ?? null
}
