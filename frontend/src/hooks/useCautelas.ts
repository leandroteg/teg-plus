import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  Cautela, CautelaItem, CautelaFavorito, CautelaTemplate,
  NovaCautelaPayload, StatusCautela, CautelaKPIs,
} from '../types/cautela'

// ── Regra de quem pode REGISTRAR DEVOLUÇÃO ───────────────────────────────────
// Espelha o enforço da RPC est_cautela_devolver_itens (mig 154):
//   - O próprio detentor NÃO pode (salvo Admin).
//   - Admin sempre pode.
//   - Cautela na SEDE (base.eh_sede) → só `comprador`.
//   - Cautela em OBRA → só `almoxarife` lotado na MESMA base (perfil.base_id == cautela.base_id).
// Obs: solicitante_id da cautela é o id do COLABORADOR → compara com perfil.colaborador_id.
export function podeDevolverCautela(opts: {
  cautela: Pick<Cautela, 'solicitante_id' | 'base_id' | 'base'>
  perfil: {
    colaborador_id: string | null
    base_id: string | null
    almoxarife?: boolean
    comprador?: boolean
  } | null | undefined
  isAdmin: boolean
}): boolean {
  const { cautela, perfil, isAdmin } = opts
  if (!perfil) return false

  const isHolder = !!perfil.colaborador_id && cautela.solicitante_id === perfil.colaborador_id
  if (isHolder && !isAdmin) return false   // o próprio não devolve, salvo admin
  if (isAdmin) return true

  if (cautela.base?.eh_sede) return !!perfil.comprador   // Sede → comprador
  // Obra → almoxarife lotado na mesma base
  return !!perfil.almoxarife && !!perfil.base_id && perfil.base_id === cautela.base_id
}

// ── List cautelas ───────────────────────────────────────────────────────────
export function useCautelas(filtros?: { status?: StatusCautela; solicitante_id?: string }) {
  return useQuery<Cautela[]>({
    queryKey: ['est-cautelas', filtros],
    queryFn: async () => {
      let q = supabase
        .from('est_cautelas')
        .select(`
          *,
          itens:est_cautela_itens(*, item:est_itens(codigo, descricao, unidade)),
          base:est_bases(id, nome, eh_sede)
        `)
        .order('criado_em', { ascending: false })

      if (filtros?.status) q = q.eq('status', filtros.status)
      if (filtros?.solicitante_id) q = q.eq('solicitante_id', filtros.solicitante_id)

      const { data, error } = await q
      if (error) return []
      return (data ?? []) as Cautela[]
    },
    staleTime: 30_000,
  })
}

// ── Single cautela with items ───────────────────────────────────────────────
export function useCautela(id: string | undefined) {
  return useQuery<Cautela | null>({
    queryKey: ['est-cautela', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_cautelas')
        .select(`
          *,
          itens:est_cautela_itens(*, item:est_itens(codigo, descricao, unidade)),
          base:est_bases(id, nome, eh_sede)
        `)
        .eq('id', id!)
        .single()
      if (error) return null
      return data as Cautela
    },
  })
}

// ── My cautelas (current user) ──────────────────────────────────────────────
// IMPORTANTE: solicitante_id é o id do COLABORADOR (rh_colaboradores), não o
// id do perfil logado. O caller deve passar perfil.colaborador_id.
export function useMinhasCautelas(colaboradorId: string | undefined) {
  return useQuery<Cautela[]>({
    queryKey: ['est-cautelas-minhas', colaboradorId],
    enabled: !!colaboradorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_cautelas')
        .select(`
          *,
          itens:est_cautela_itens(*, item:est_itens(codigo, descricao, unidade))
        `)
        .eq('solicitante_id', colaboradorId!)
        // status canônico (CHECK est_cautelas): retorna todas as cautelas do
        // colaborador; a página MinhasCautelas separa ativas de encerradas.
        .order('criado_em', { ascending: false })
      if (error) return []
      return (data ?? []) as Cautela[]
    },
    staleTime: 30_000,
  })
}

// ── Create cautela ──────────────────────────────────────────────────────────
export function useCriarCautela() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: NovaCautelaPayload) => {
      const { itens, ...cautela } = payload
      const { data, error } = await supabase
        .from('est_cautelas')
        .insert(cautela)
        .select('id')
        .single()
      if (error) throw error

      if (itens.length > 0) {
        const { error: eItens } = await supabase
          .from('est_cautela_itens')
          .insert(itens.map(i => ({ ...i, cautela_id: data.id })))
        if (eItens) throw eItens
      }
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-cautelas'] })
      qc.invalidateQueries({ queryKey: ['est-cautelas-minhas'] })
      qc.invalidateQueries({ queryKey: ['est-cautela-kpis'] })
    },
  })
}

// ── Update cautela status ───────────────────────────────────────────────────
export function useAtualizarCautela() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: StatusCautela; aprovador_id?: string; aprovador_nome?: string; motivo_rejeicao?: string }) => {
      const { error } = await supabase
        .from('est_cautelas')
        .update({
          ...updates,
          atualizado_em: new Date().toISOString(),
          ...(updates.aprovador_id ? { aprovado_em: new Date().toISOString() } : {}),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-cautelas'] })
      qc.invalidateQueries({ queryKey: ['est-cautelas-minhas'] })
      qc.invalidateQueries({ queryKey: ['est-cautela'] })
      qc.invalidateQueries({ queryKey: ['est-cautela-kpis'] })
    },
  })
}

// ── Return items (partial/full) ─────────────────────────────────────────────
// Usa RPC est_cautela_devolver_itens que: (1) atualiza est_cautela_itens,
// (2) insere mov de devolucao em est_movimentacoes pelo delta (atualizando
// est_saldos via trigger), (3) transita status pra em_devolucao ou encerrada.
export function useDevolverItens() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cautela_id, itens }: {
      cautela_id: string
      itens: Array<{ id: string; quantidade_devolvida: number; condicao_devolucao?: string }>
    }) => {
      const { data, error } = await supabase.rpc('est_cautela_devolver_itens', {
        p_cautela_id: cautela_id,
        p_itens: itens,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-cautelas'] })
      qc.invalidateQueries({ queryKey: ['est-cautelas-minhas'] })
      qc.invalidateQueries({ queryKey: ['est-cautela'] })
      qc.invalidateQueries({ queryKey: ['est-cautela-kpis'] })
    },
  })
}

// ── User favorites ──────────────────────────────────────────────────────────
export function useCautelaFavoritos(userId: string | undefined) {
  return useQuery<CautelaFavorito[]>({
    queryKey: ['est-cautela-favoritos', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_cautela_favoritos')
        .select('*, item:est_itens(codigo, descricao, unidade)')
        .eq('usuario_id', userId!)
        .order('frequencia', { ascending: false })
      if (error) return []
      return (data ?? []) as CautelaFavorito[]
    },
  })
}

// ── Templates ───────────────────────────────────────────────────────────────
export function useCautelaTemplates() {
  return useQuery<CautelaTemplate[]>({
    queryKey: ['est-cautela-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_cautela_templates')
        .select('*')
        .eq('ativo', true)
        .order('nome')
      if (error) return []
      return (data ?? []) as CautelaTemplate[]
    },
  })
}

// ── KPIs ────────────────────────────────────────────────────────────────────
// colaboradorId = perfil.colaborador_id (rh_colaboradores), não o id do perfil.
export function useCautelaKPIs(colaboradorId: string | undefined) {
  return useQuery<CautelaKPIs>({
    queryKey: ['est-cautela-kpis', colaboradorId],
    enabled: !!colaboradorId,
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]

      // Cautelas ativas do colaborador
      const { data: minhas } = await supabase
        .from('est_cautelas')
        .select('id, status, data_devolucao_prevista')
        .eq('solicitante_id', colaboradorId!)
        .in('status', ['em_aberto', 'em_devolucao'])

      const ativas = minhas ?? []
      const vencidas = ativas.filter(c =>
        c.data_devolucao_prevista && c.data_devolucao_prevista < today
      ).length
      const devolverHoje = ativas.filter(c =>
        c.data_devolucao_prevista === today
      ).length

      return {
        itens_comigo: ativas.length,
        vencidas,
        devolver_hoje: devolverHoje,
      }
    },
    refetchInterval: 60_000,
  })
}

// Salva termo de aceite no Storage (PNG + PDF) e transita status via RPC (mig 136).
// Aceita já as Blobs prontas (geradas no modal) para evitar acoplamento de geração.
export function useSalvarTermoCautela() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cautelaId,
      assinaturaBlob,
      termoBlob,
    }: {
      cautelaId: string
      assinaturaBlob: Blob
      termoBlob: Blob
    }) => {
      const ts = Date.now()
      const assPath = `${cautelaId}/assinatura_${ts}.png`
      const pdfPath = `${cautelaId}/termo_${ts}.pdf`

      const { error: errAss } = await supabase.storage
        .from('cautelas-termos')
        .upload(assPath, assinaturaBlob, { contentType: 'image/png', upsert: false })
      if (errAss) throw errAss

      const { error: errPdf } = await supabase.storage
        .from('cautelas-termos')
        .upload(pdfPath, termoBlob, { contentType: 'application/pdf', upsert: false })
      if (errPdf) throw errPdf

      const { data, error } = await supabase.rpc('est_cautela_salvar_termo', {
        p_cautela_id: cautelaId,
        p_assinatura_path: assPath,
        p_termo_path: pdfPath,
      })
      if (error) throw error
      return data as { ok: boolean; status_anterior: string; status_novo: string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-cautelas'] })
      qc.invalidateQueries({ queryKey: ['est-cautelas-minhas'] })
      qc.invalidateQueries({ queryKey: ['est-cautela'] })
      qc.invalidateQueries({ queryKey: ['est-cautela-kpis'] })
    },
  })
}
