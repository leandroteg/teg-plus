// ─────────────────────────────────────────────────────────────────────────────
// hooks/useDPFolha.ts — DP › Folha de Pagamento.
// Fluxo: Apuração → Verificação (SuperTEG) → Correções → Fechamento → Envio
// Pagamento → Concluído. Tabelas dp_folha / _arquivos / _itens / _desvios.
// Verificação = job assíncrono do SuperTEG (edge dp-folha, callback grava itens
// e desvios). Aqui lemos/criamos/transicionamos.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

const BUCKET = 'dp-folha'

export type FolhaStatus =
  | 'apuracao' | 'verificando' | 'verificado' | 'corrigindo'
  | 'fechamento' | 'pagamento' | 'concluido' | 'erro'

export type FolhaTipo = 'mensal' | '13o' | 'ferias' | 'complementar'

export interface DPFolha {
  id: string
  competencia: string          // YYYY-MM-DD (1º do mês)
  tipo: FolhaTipo
  status: FolhaStatus
  job_id: string | null
  resumo: Record<string, any> | null
  verificacao_md: string | null
  qtd_desvios: number
  qtd_desvios_abertos: number
  data_pagamento: string | null
  enviado_verif_em: string | null
  verificado_em: string | null
  enviado_correcao_em: string | null
  correcao_concluida_em: string | null
  aprovado_por: string | null
  aprovado_por_nome: string | null
  aprovado_em: string | null
  pago_em: string | null
  erro: string | null
  criado_por_nome: string | null
  created_at: string
  updated_at: string
}

export interface DPFolhaArquivo {
  id: string
  folha_id: string
  tipo: string | null
  nome: string | null
  arquivo_url: string
  tamanho: number | null
  uploaded_por_nome: string | null
  uploaded_at: string
}

export interface DPFolhaItem {
  id: string
  folha_id: string
  secao: string | null
  secao_ordem: number
  item_codigo: string | null
  item_titulo: string | null
  resultado: 'ok' | 'desvio' | 'atencao' | 'na' | 'nao_verificavel'
  qtd_desvios: number
  observacao: string | null
  ordem: number
}

export interface DPFolhaDesvio {
  id: string
  folha_id: string
  item_id: string | null
  item_codigo: string | null
  secao: string | null
  colaborador_id: string | null
  colaborador_nome: string | null
  severidade: 'alta' | 'media' | 'baixa'
  tipo: string | null
  descricao: string
  valor_esperado: string | null
  valor_encontrado: string | null
  fonte: string | null
  status: 'aberto' | 'corrigido' | 'ignorado'
  correcao_marcada: boolean
  correcao_obs: string | null
  corrigido_por_nome: string | null
  corrigido_em: string | null
}

// ── Lista de folhas (polling enquanto houver verificação em andamento) ───────
export function useFolhas() {
  return useQuery<DPFolha[]>({
    queryKey: ['dp-folhas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('dp_folha').select('*').order('competencia', { ascending: false }).order('created_at', { ascending: false })
      if (error) { console.error('useFolhas:', error); return [] }
      return (data ?? []) as DPFolha[]
    },
    refetchInterval: (q) => ((q.state.data as DPFolha[] | undefined) ?? []).some(f => f.status === 'verificando') ? 12_000 : false,
  })
}

// ── Detalhe: arquivos + itens do checklist + desvios ─────────────────────────
export function useFolhaArquivos(folhaId?: string) {
  return useQuery<DPFolhaArquivo[]>({
    queryKey: ['dp-folha-arquivos', folhaId],
    enabled: !!folhaId,
    queryFn: async () => {
      const { data } = await supabase.from('dp_folha_arquivos').select('*').eq('folha_id', folhaId!).order('uploaded_at')
      return (data ?? []) as DPFolhaArquivo[]
    },
  })
}

export function useFolhaItens(folhaId?: string) {
  return useQuery<DPFolhaItem[]>({
    queryKey: ['dp-folha-itens', folhaId],
    enabled: !!folhaId,
    queryFn: async () => {
      const { data } = await supabase.from('dp_folha_itens').select('*').eq('folha_id', folhaId!).order('ordem')
      return (data ?? []) as DPFolhaItem[]
    },
  })
}

export function useFolhaDesvios(folhaId?: string) {
  return useQuery<DPFolhaDesvio[]>({
    queryKey: ['dp-folha-desvios', folhaId],
    enabled: !!folhaId,
    queryFn: async () => {
      const { data } = await supabase.from('dp_folha_desvios').select('*').eq('folha_id', folhaId!).order('severidade').order('created_at')
      return (data ?? []) as DPFolhaDesvio[]
    },
  })
}

// URL assinada (1h) pra ver/baixar arquivo da folha.
export async function getFolhaArquivoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error) return null
  return data?.signedUrl ?? null
}

// ── Criar folha (Apuração) ───────────────────────────────────────────────────
export function useCriarFolha() {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  return useMutation({
    mutationFn: async (p: { competencia: string; tipo?: FolhaTipo }) => {
      // competencia recebida como 'YYYY-MM' → 1º dia do mês
      const comp = /^\d{4}-\d{2}$/.test(p.competencia) ? `${p.competencia}-01` : p.competencia
      const { data, error } = await supabase.from('dp_folha').insert({
        competencia: comp, tipo: p.tipo ?? 'mensal', status: 'apuracao',
        criado_por: perfil?.id ?? null, criado_por_nome: perfil?.nome ?? null,
      }).select().single()
      if (error) throw error
      return data as DPFolha
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dp-folhas'] }),
  })
}

export function useRemoverFolha() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (folha: DPFolha) => {
      const { data: arqs } = await supabase.from('dp_folha_arquivos').select('arquivo_url').eq('folha_id', folha.id)
      const paths = (arqs ?? []).map(a => a.arquivo_url).filter(Boolean)
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
      const { error } = await supabase.from('dp_folha').delete().eq('id', folha.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dp-folhas'] }),
  })
}

// ── Upload / remoção de arquivo da folha ─────────────────────────────────────
export function useUploadFolhaArquivo() {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  return useMutation({
    mutationFn: async ({ folhaId, file, tipo }: { folhaId: string; file: File; tipo: string }) => {
      const ext = file.name.split('.').pop() || 'bin'
      const path = `${folhaId}/${tipo}_${Date.now()}.${ext}`
      const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined })
      if (up.error) throw up.error
      const { error } = await supabase.from('dp_folha_arquivos').insert({
        folha_id: folhaId, tipo, nome: file.name, arquivo_url: path, tamanho: file.size,
        uploaded_por_nome: perfil?.nome ?? null,
      })
      if (error) throw error
    },
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['dp-folha-arquivos', v.folhaId] }) },
  })
}

export function useRemoverFolhaArquivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (arq: DPFolhaArquivo) => {
      await supabase.storage.from(BUCKET).remove([arq.arquivo_url])
      const { error } = await supabase.from('dp_folha_arquivos').delete().eq('id', arq.id)
      if (error) throw error
    },
    onSuccess: (_d, arq) => qc.invalidateQueries({ queryKey: ['dp-folha-arquivos', arq.folha_id] }),
  })
}

// ── Enviar para Verificação (aciona o SuperTEG via edge) ─────────────────────
export function useEnviarVerificacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (folhaId: string) => {
      const { data, error } = await supabase.functions.invoke('dp-folha', { body: { action: 'verificar', folha_id: folhaId } })
      if (error) throw new Error(error.message)
      const resp = data as { ok?: boolean; motivo?: string }
      if (!resp?.ok) throw new Error(resp?.motivo || 'Falha ao enviar para verificação')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dp-folhas'] }),
  })
}

// ── Enviar para Correção (verificado → corrigindo) ───────────────────────────
export function useEnviarCorrecao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (folhaId: string) => {
      const { error } = await supabase.from('dp_folha').update({
        status: 'corrigindo', enviado_correcao_em: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', folhaId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dp-folhas'] }),
  })
}

// ── Marcar/desmarcar correção de um desvio + recontar abertos ────────────────
export function useMarcarCorrecao() {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  return useMutation({
    mutationFn: async ({ desvio, marcado, obs }: { desvio: DPFolhaDesvio; marcado: boolean; obs?: string }) => {
      const { error } = await supabase.from('dp_folha_desvios').update({
        correcao_marcada: marcado,
        status: marcado ? 'corrigido' : 'aberto',
        correcao_obs: obs ?? desvio.correcao_obs ?? null,
        corrigido_por: marcado ? (perfil?.id ?? null) : null,
        corrigido_por_nome: marcado ? (perfil?.nome ?? null) : null,
        corrigido_em: marcado ? new Date().toISOString() : null,
      }).eq('id', desvio.id)
      if (error) throw error
      // recontar abertos
      const { count } = await supabase.from('dp_folha_desvios').select('id', { count: 'exact', head: true })
        .eq('folha_id', desvio.folha_id).eq('status', 'aberto')
      await supabase.from('dp_folha').update({ qtd_desvios_abertos: count ?? 0, updated_at: new Date().toISOString() }).eq('id', desvio.folha_id)
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['dp-folha-desvios', v.desvio.folha_id] })
      qc.invalidateQueries({ queryKey: ['dp-folhas'] })
    },
  })
}

// ── Enviar para Fechamento (corrigindo → fechamento) ─────────────────────────
export function useEnviarFechamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (folhaId: string) => {
      const { count } = await supabase.from('dp_folha_desvios').select('id', { count: 'exact', head: true })
        .eq('folha_id', folhaId).eq('status', 'aberto')
      if ((count ?? 0) > 0) throw new Error(`Ainda há ${count} desvio(s) sem correção marcada`)
      const { error } = await supabase.from('dp_folha').update({
        status: 'fechamento', correcao_concluida_em: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', folhaId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dp-folhas'] }),
  })
}

// ── Aprovar Folha (fechamento → pagamento) — gated na UI (supervisor/admin) ──
export function useAprovarFolha() {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  return useMutation({
    mutationFn: async (folhaId: string) => {
      const { error } = await supabase.from('dp_folha').update({
        status: 'pagamento', aprovado_por: perfil?.id ?? null, aprovado_por_nome: perfil?.nome ?? null,
        aprovado_em: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', folhaId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dp-folhas'] }),
  })
}

// ── Enviar para Pagamento (pagamento → concluido) ────────────────────────────
export function useEnviarPagamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ folhaId, dataPagamento }: { folhaId: string; dataPagamento: string }) => {
      if (!dataPagamento) throw new Error('Informe a data de pagamento')
      const { error } = await supabase.from('dp_folha').update({
        status: 'concluido', data_pagamento: dataPagamento, pago_em: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', folhaId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dp-folhas'] }),
  })
}

// ── Colaboradores ATIVOS sem dados bancários completos no ERP ────────────────
export interface ColaboradorSemConta {
  id: string
  nome: string
  matricula: string | null
  cargo: string | null
  banco: string | null
  agencia: string | null
  conta: string | null
}
export function useColaboradoresSemConta() {
  return useQuery<ColaboradorSemConta[]>({
    queryKey: ['dp-colab-sem-conta'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rh_colaboradores')
        .select('id, nome, matricula, cargo, banco, agencia, conta')
        .eq('ativo', true).is('data_demissao', null)
        .or('banco.is.null,agencia.is.null,conta.is.null')
        .order('nome')
      if (error) { console.error('useColaboradoresSemConta:', error); return [] }
      return (data ?? []) as ColaboradorSemConta[]
    },
    staleTime: 30_000,
  })
}

// ── Corrigir cadastro (conta bancária) direto no rh_colaboradores ────────────
export function useCorrigirContaColaborador() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ colaboradorId, banco, agencia, conta, desvioId }: {
      colaboradorId: string; banco: string; agencia: string; conta: string; desvioId?: string
    }) => {
      const { error } = await supabase.from('rh_colaboradores').update({ banco, agencia, conta }).eq('id', colaboradorId)
      if (error) throw error
      if (desvioId) {
        await supabase.from('dp_folha_desvios').update({ status: 'corrigido', correcao_marcada: true, corrigido_em: new Date().toISOString() }).eq('id', desvioId)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dp-folha-desvios'] })
      qc.invalidateQueries({ queryKey: ['dp-folhas'] })
      qc.invalidateQueries({ queryKey: ['dp-colab-sem-conta'] })
    },
  })
}
