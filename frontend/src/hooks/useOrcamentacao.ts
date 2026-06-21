import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Orcamento, OrcPremissas, OrcArquivoTipo, OrcArquivo } from '../types/orcamentacao'

const BUCKET = 'orcamentacao-arquivos'

export interface NovoArquivo { file: File; tipo: OrcArquivoTipo }

export interface NovoOrcamentoInput {
  nome: string
  descricao?: string
  premissas: OrcPremissas
  arquivos: NovoArquivo[]
}

// ── Lista ─────────────────────────────────────────────────────────────────────
export function useOrcamentos() {
  return useQuery<Orcamento[]>({
    queryKey: ['orcamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orc_orcamentos')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Orcamento[]
    },
    staleTime: 0,
    refetchOnMount: true,
    // Atualiza a lista enquanto houver algum orçamento processando
    refetchInterval: (q) => {
      const rows = (q.state.data as Orcamento[] | undefined) ?? []
      return rows.some(o => o.status === 'processando') ? 5000 : false
    },
  })
}

// ── Detalhe (com polling enquanto processa) ─────────────────────────────────────
export function useOrcamento(id?: string) {
  return useQuery<Orcamento | null>({
    queryKey: ['orcamento', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orc_orcamentos')
        .select('*')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as Orcamento | null
    },
    refetchInterval: (q) => {
      const o = q.state.data as Orcamento | null | undefined
      return o?.status === 'processando' ? 4000 : false
    },
  })
}

const safeName = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 90)

// ── Criar: insere o orçamento, sobe os arquivos do lote e aciona o SuperTEG ──────
export function useCriarOrcamento() {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  return useMutation({
    mutationFn: async (input: NovoOrcamentoInput): Promise<string> => {
      // 1. Cria o cabeçalho
      const { data: orc, error: insErr } = await supabase
        .from('orc_orcamentos')
        .insert({
          nome: input.nome.trim(),
          descricao: input.descricao?.trim() || null,
          premissas: input.premissas,
          status: 'rascunho',
          criado_por: perfil?.id ?? null,
          criado_por_nome: perfil?.nome ?? null,
        })
        .select('id')
        .single()
      if (insErr || !orc) throw new Error(insErr?.message || 'Falha ao criar o orçamento')
      const orcId = orc.id as string

      // 2. Sobe cada arquivo do lote + registra em orc_arquivos
      for (const a of input.arquivos) {
        const path = `${orcId}/${Date.now()}_${safeName(a.file.name)}`
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, a.file, { upsert: true, contentType: a.file.type || 'application/octet-stream' })
        if (upErr) throw new Error('Falha no upload de ' + a.file.name + ': ' + upErr.message)
        const { error: arqErr } = await supabase.from('orc_arquivos').insert({
          orcamento_id: orcId,
          nome: a.file.name,
          tipo: a.tipo,
          storage_path: path,
          mime: a.file.type || null,
          tamanho: a.file.size,
        })
        if (arqErr) throw new Error('Falha ao registrar ' + a.file.name + ': ' + arqErr.message)
      }

      // 3. Aciona a Edge Function (cria signed URLs + dispara o SuperTEG)
      const { data: resp, error: fnErr } = await supabase.functions.invoke('orcamentacao-estimar', {
        body: { orcamento_id: orcId },
      })
      if (fnErr) throw new Error('Falha ao acionar o SuperTEG: ' + fnErr.message)
      if (resp && (resp as { ok?: boolean }).ok === false) {
        throw new Error((resp as { motivo?: string }).motivo || 'Falha ao acionar o SuperTEG')
      }
      return orcId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orcamentos'] })
    },
  })
}

// ── Reprocessar (re-aciona o SuperTEG para um orçamento existente) ───────────────
export function useReprocessarOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: resp, error } = await supabase.functions.invoke('orcamentacao-estimar', {
        body: { orcamento_id: id },
      })
      if (error) throw new Error(error.message)
      if (resp && (resp as { ok?: boolean }).ok === false) {
        throw new Error((resp as { motivo?: string }).motivo || 'Falha ao reprocessar')
      }
      return id
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['orcamento', id] })
      qc.invalidateQueries({ queryKey: ['orcamentos'] })
    },
  })
}

// ── Arquivos do orçamento ───────────────────────────────────────────────────────
export function useArquivos(orcamentoId?: string) {
  return useQuery<OrcArquivo[]>({
    queryKey: ['orc_arquivos', orcamentoId],
    enabled: !!orcamentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orc_arquivos').select('*').eq('orcamento_id', orcamentoId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as OrcArquivo[]
    },
  })
}

// ── Adicionar documentos a um orçamento existente (+ premissas) ──────────────────
export function useAdicionarArquivos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { orcamentoId: string; arquivos: NovoArquivo[]; premissas?: Partial<OrcPremissas>; onProgress?: (done: number, total: number) => void }) => {
      const falhas: string[] = []
      let done = 0
      for (const a of input.arquivos) {
        try {
          const path = `${input.orcamentoId}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${safeName(a.file.name)}`
          const { error: upErr } = await supabase.storage
            .from(BUCKET).upload(path, a.file, { upsert: true, contentType: a.file.type || 'application/octet-stream' })
          if (upErr) throw new Error(upErr.message)
          const { error: arqErr } = await supabase.from('orc_arquivos').insert({
            orcamento_id: input.orcamentoId, nome: a.file.name, tipo: a.tipo,
            storage_path: path, mime: a.file.type || null, tamanho: a.file.size,
          })
          if (arqErr) throw new Error(arqErr.message)
        } catch (e) {
          falhas.push(`${a.file.name}: ${e instanceof Error ? e.message : 'erro'}`)
        }
        done++; input.onProgress?.(done, input.arquivos.length)
      }
      if (input.premissas) {
        const { data: cur } = await supabase.from('orc_orcamentos').select('premissas').eq('id', input.orcamentoId).maybeSingle()
        const merged = { ...((cur?.premissas as object) ?? {}), ...input.premissas }
        await supabase.from('orc_orcamentos').update({ premissas: merged }).eq('id', input.orcamentoId)
      }
      if (falhas.length) throw new Error(`${falhas.length} de ${input.arquivos.length} arquivo(s) falharam:\n` + falhas.slice(0, 6).join('\n'))
      return input.orcamentoId
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: ['orc_arquivos', input.orcamentoId] })
      qc.invalidateQueries({ queryKey: ['orcamento', input.orcamentoId] })
    },
  })
}

// ── Remover um arquivo do orçamento (storage + registro) ─────────────────────────
export function useRemoverArquivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; orcamentoId: string; storage_path: string }) => {
      // remove do storage primeiro (best-effort — não bloqueia a exclusão do registro)
      await supabase.storage.from(BUCKET).remove([input.storage_path])
      const { error } = await supabase.from('orc_arquivos').delete().eq('id', input.id)
      if (error) throw error
      return input.id
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: ['orc_arquivos', input.orcamentoId] })
      qc.invalidateQueries({ queryKey: ['orcamento', input.orcamentoId] })
    },
  })
}

// ── Concluir (marca estágio + reprocessa com os docs) ────────────────────────────
export function useConcluirOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; premissas?: Partial<OrcPremissas> }) => {
      if (input.premissas) {
        const { data: cur } = await supabase.from('orc_orcamentos').select('premissas').eq('id', input.id).maybeSingle()
        const merged = { ...((cur?.premissas as object) ?? {}), ...input.premissas }
        await supabase.from('orc_orcamentos').update({ premissas: merged, estagio: 'concluido' }).eq('id', input.id)
      } else {
        await supabase.from('orc_orcamentos').update({ estagio: 'concluido' }).eq('id', input.id)
      }
      const { data: resp, error } = await supabase.functions.invoke('orcamentacao-estimar', { body: { orcamento_id: input.id } })
      if (error) throw new Error(error.message)
      if (resp && (resp as { ok?: boolean }).ok === false) throw new Error((resp as { motivo?: string }).motivo || 'Falha ao concluir')
      return input.id
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['orcamento', id] })
      qc.invalidateQueries({ queryKey: ['orcamentos'] })
    },
  })
}

// ── Rodar um estágio do wizard (aciona o SuperTEG; sessão persistente) ───────────
export function useRodarEstagio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; estagio: number; fiscais?: Record<string, unknown> }) => {
      const { data: resp, error } = await supabase.functions.invoke('orcamentacao-estagio', {
        body: { orcamento_id: input.id, estagio: input.estagio, fiscais: input.fiscais ?? {} },
      })
      if (error) throw new Error(error.message)
      if (resp && (resp as { ok?: boolean }).ok === false) throw new Error((resp as { motivo?: string }).motivo || 'Falha ao rodar o estágio')
      return input.id
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['orcamento', id] })
      qc.invalidateQueries({ queryKey: ['orcamentos'] })
    },
  })
}

// ── Salvar edições dos dados de um estágio (direto no banco) ──────────────────────
export function useSalvarDadosEstagio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; estagio: number; dados: Record<string, unknown> }) => {
      const { data: cur } = await supabase.from('orc_orcamentos').select('dados_estagios').eq('id', input.id).maybeSingle()
      const merged = { ...((cur?.dados_estagios as object) ?? {}), [String(input.estagio)]: input.dados }
      const { error } = await supabase.from('orc_orcamentos').update({ dados_estagios: merged }).eq('id', input.id)
      if (error) throw error
      return input.id
    },
    onSuccess: (id) => qc.invalidateQueries({ queryKey: ['orcamento', id] }),
  })
}

// ── Editar (nome / descrição / premissas) ───────────────────────────────────────
export function useAtualizarOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; nome?: string; descricao?: string; premissas?: Partial<OrcPremissas> }) => {
      const patch: Record<string, unknown> = {}
      if (input.nome !== undefined) patch.nome = input.nome.trim()
      if (input.descricao !== undefined) patch.descricao = input.descricao.trim() || null
      if (input.premissas !== undefined) patch.premissas = input.premissas
      const { error } = await supabase.from('orc_orcamentos').update(patch).eq('id', input.id)
      if (error) throw error
      return input.id
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['orcamento', id] })
      qc.invalidateQueries({ queryKey: ['orcamentos'] })
    },
  })
}

// ── Excluir ─────────────────────────────────────────────────────────────────────
export function useExcluirOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('orc_orcamentos').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamentos'] }),
  })
}
