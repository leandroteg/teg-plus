import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { DespesaAdiantamento } from '../types'

type NovaSolicitacaoAdiantamentoPayload = {
  finalidade: string
  justificativa?: string
  valor_solicitado: number
  favorecido_nome: string
  favorecido_email?: string
  /** Chave PIX do favorecido — vai para a CP gerada na aprovação. */
  chave_pix?: string
  /** Banco do favorecido — sai no termo de repasse junto com a chave PIX. */
  banco?: string
  /** Comprovantes/orçamentos anexados à solicitação. */
  arquivos?: File[]
  data_limite_prestacao?: string
  data_pagamento?: string
  centro_custo?: string
  centro_custo_id?: string
  classe_financeira?: string
  classe_financeira_id?: string
  observacoes?: string
  solicitante_email?: string
}

export interface AnexoAdiantamento {
  id: string
  nome_arquivo: string
  arquivo_url: string
  mime_type: string | null
  tamanho_bytes: number | null
  uploaded_at: string | null
}

/** Anexos da solicitação — fin_documentos com entity_type='adiantamento'. */
export function useAnexosAdiantamento(adiantamentoId?: string) {
  return useQuery<AnexoAdiantamento[]>({
    queryKey: ['adiantamento-anexos', adiantamentoId],
    enabled: !!adiantamentoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_documentos')
        .select('id, nome_arquivo, arquivo_url, mime_type, tamanho_bytes, uploaded_at')
        .eq('entity_type', 'adiantamento')
        .eq('entity_id', adiantamentoId!)
        .order('uploaded_at', { ascending: false })
      if (error) return []
      return (data ?? []) as AnexoAdiantamento[]
    },
  })
}

function gerarNumeroAdiantamento() {
  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const seq = String(Date.now()).slice(-5)
  return `AD-${yyyymm}-${seq}`
}

export function isDespesaSchemaMissing(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const code = 'code' in error ? String(error.code ?? '') : ''
  const message = 'message' in error ? String(error.message ?? '') : ''

  return code === '42P01'
    || message.includes('desp_adiantamentos')
    || message.includes('relation')
}

export function useAdiantamentosDespesa(status?: string) {
  return useQuery<DespesaAdiantamento[]>({
    queryKey: ['despesas-adiantamentos', status],
    queryFn: async () => {
      let query = supabase
        .from('desp_adiantamentos')
        .select('*')
        .order('created_at', { ascending: false })

      if (status) query = query.eq('status', status)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as DespesaAdiantamento[]
    },
    staleTime: 30_000,
  })
}

export function useCriarSolicitacaoAdiantamento() {
  const qc = useQueryClient()
  const { perfil } = useAuth()

  return useMutation({
    mutationFn: async (payload: NovaSolicitacaoAdiantamentoPayload) => {
      if (!perfil?.id || !perfil.email) {
        throw new Error('Perfil do solicitante não carregado.')
      }

      // ── Resolver aprovador (RPC SECURITY DEFINER) ───────────────────────────
      // Roteamento pela lotação do FAVORECIDO: UF do local de trabalho → obra →
      // endereço (MG=Welton, MS=Leandro), senão gestor direto do RH, senão
      // Welton. Roda no banco porque a RLS de sys_perfis só deixa o usuário ler
      // o PRÓPRIO perfil — resolvendo no cliente, a busca dos aprovadores vinha
      // vazia e a solicitação morria em "Nenhum aprovador disponível".
      const { data: rota, error: rotaError } = await supabase.rpc('desp_resolver_aprovador_adiantamento', {
        p_favorecido_email: payload.favorecido_email?.trim() || null,
        p_favorecido_nome: payload.favorecido_nome?.trim() || null,
      })
      if (rotaError) throw new Error(`Não foi possível definir o aprovador: ${rotaError.message}`)

      const aprovador = rota as { nome?: string; email?: string; gestor_rh_id?: string | null } | null
      if (!aprovador?.email) {
        throw new Error('Nenhum aprovador disponível para esta solicitação. Verifique o cadastro dos aprovadores (Welton/Leandro) no Admin de Usuários.')
      }

      const aprovadorRhId = aprovador.gestor_rh_id ?? null
      const aprovadorNome = aprovador.nome ?? ''
      const aprovadorEmail = aprovador.email

      const numero = gerarNumeroAdiantamento()
      const hoje = new Date().toISOString().split('T')[0]

      const { data: adiantamento, error: adiantamentoError } = await supabase
        .from('desp_adiantamentos')
        .insert({
          numero,
          solicitante_id: perfil.id,
          solicitante_nome: perfil.nome,
          solicitante_email: perfil.email,
          gestor_id: aprovadorRhId,
          gestor_nome: aprovadorNome,
          gestor_email: aprovadorEmail,
          favorecido_nome: payload.favorecido_nome.trim(),
          favorecido_email: payload.favorecido_email?.trim() || null,
          chave_pix: payload.chave_pix?.trim() || null,
          banco: payload.banco?.trim() || null,
          centro_custo: payload.centro_custo || null,
          centro_custo_id: payload.centro_custo_id || null,
          classe_financeira: payload.classe_financeira || null,
          classe_financeira_id: payload.classe_financeira_id || null,
          valor_solicitado: payload.valor_solicitado,
          valor_aprovado: 0,
          finalidade: payload.finalidade.trim(),
          justificativa: payload.justificativa?.trim() || null,
          data_solicitacao: hoje,
          data_limite_prestacao: payload.data_limite_prestacao || null,
          data_pagamento: payload.data_pagamento || null,
          status: 'solicitado',
          observacoes: payload.observacoes?.trim() || null,
        })
        .select('*')
        .single()

      if (adiantamentoError) {
        if (isDespesaSchemaMissing(adiantamentoError)) {
          throw new Error('Fluxo de adiantamentos ainda está em implantação no banco de dados.')
        }
        throw adiantamentoError
      }

      // Anexos → bucket financeiro-docs + fin_documentos (mesmo padrão da CP).
      // Best-effort: falha de anexo não derruba a solicitação já criada.
      const falhasAnexo: string[] = []
      for (const arquivo of payload.arquivos ?? []) {
        const ext = arquivo.name.split('.').pop()?.toLowerCase() || 'bin'
        const path = `adiantamento/${adiantamento.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const up = await supabase.storage
          .from('financeiro-docs')
          .upload(path, arquivo, { contentType: arquivo.type || undefined })
        if (up.error) { falhasAnexo.push(arquivo.name); continue }
        const { data: urlData } = supabase.storage.from('financeiro-docs').getPublicUrl(path)
        const { error: docErr } = await supabase.from('fin_documentos').insert({
          entity_type: 'adiantamento',
          entity_id: adiantamento.id,
          tipo: 'doc_financeiro',
          nome_arquivo: arquivo.name,
          arquivo_url: urlData.publicUrl,
          mime_type: arquivo.type || null,
          tamanho_bytes: arquivo.size || null,
          uploaded_by: perfil.id,
        })
        if (docErr) falhasAnexo.push(arquivo.name)
      }
      if (falhasAnexo.length > 0) {
        console.warn('Aviso: anexos não enviados:', falhasAnexo.join(', '))
      }

      const { data: aprovacao, error: aprovacaoError } = await supabase
        .from('apr_aprovacoes')
        .insert({
          modulo: 'desp',
          tipo_aprovacao: 'solicitacao_adiantamento',
          entidade_id: adiantamento.id,
          entidade_numero: numero,
          aprovador_nome: aprovadorNome,
          aprovador_email: aprovadorEmail,
          nivel: 1,
          status: 'pendente',
          data_limite: new Date(Date.now() + 48 * 3600_000).toISOString(),
        })
        .select('id')
        .single()

      if (aprovacaoError) throw aprovacaoError

      const { error: linkError } = await supabase
        .from('desp_adiantamentos')
        .update({ aprovacao_id: aprovacao.id, updated_at: new Date().toISOString() })
        .eq('id', adiantamento.id)

      if (linkError) {
        console.warn('Aviso: adiantamento criado sem vínculo da aprovação:', linkError.message)
      }

      return adiantamento as DespesaAdiantamento
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['despesas-adiantamentos'] })
      qc.invalidateQueries({ queryKey: ['adiantamento-anexos'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-kpis'] })
    },
  })
}

// ── Edição pelo criador ──────────────────────────────────────────────────────
// Campos operacionais (finalidade, PIX, banco, observação) podem ser corrigidos
// a qualquer tempo. Valor/favorecido/centro de custo só ANTES da aprovação: uma
// vez aprovado o adiantamento já virou conta a pagar no Financeiro.

export type CamposEdicaoAdiantamento = {
  finalidade?: string
  justificativa?: string
  observacoes?: string
  chave_pix?: string
  banco?: string
  favorecido_nome?: string
  favorecido_email?: string
  valor_solicitado?: number
  data_pagamento?: string
  data_limite_prestacao?: string
  centro_custo?: string
  centro_custo_id?: string
}

/** Campos que continuam editáveis depois que o gestor aprovou. */
const CAMPOS_POS_APROVACAO = new Set(['finalidade', 'justificativa', 'observacoes', 'chave_pix', 'banco'])

export function podeEditarAdiantamento(
  adiantamento: { solicitante_id?: string | null; status?: string } | null | undefined,
  perfilId?: string,
  isAdmin = false,
) {
  if (!adiantamento) return false
  if (['concluido', 'rejeitado'].includes(adiantamento.status ?? '')) return false
  return isAdmin || (!!perfilId && adiantamento.solicitante_id === perfilId)
}

export function useAtualizarAdiantamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, campos }: {
      id: string
      status: string
      campos: CamposEdicaoAdiantamento
    }) => {
      const aprovado = !['solicitado', 'rascunho'].includes(status)

      const patch: Record<string, unknown> = {}
      for (const [campo, valor] of Object.entries(campos)) {
        if (valor === undefined) continue
        if (aprovado && !CAMPOS_POS_APROVACAO.has(campo)) continue   // trava o que já virou CP
        patch[campo] = typeof valor === 'string' ? (valor.trim() || null) : valor
      }
      if (Object.keys(patch).length === 0) return { atualizados: 0 }

      patch.updated_at = new Date().toISOString()
      const { data, error } = await supabase
        .from('desp_adiantamentos')
        .update(patch)
        .eq('id', id)
        .select('id, numero, favorecido_nome, chave_pix, banco, solicitante_nome, aprovado_por, data_limite_prestacao, fin_conta_pagar_id')
        .single()
      if (error) throw new Error(error.message)

      // Já tem CP gerada: mantém os dados de pagamento da CP em dia
      if (data?.fin_conta_pagar_id && (campos.chave_pix !== undefined || campos.banco !== undefined)) {
        const partes = [
          `Adiantamento a ${data.favorecido_nome}`,
          data.banco ? `Banco: ${data.banco}` : null,
          data.chave_pix ? `PIX: ${data.chave_pix}` : null,
          `Solicitado por: ${data.solicitante_nome}`,
          data.aprovado_por ? `Aprovado por: ${data.aprovado_por}` : null,
          data.data_limite_prestacao
            ? `Prestação de contas até ${new Date(data.data_limite_prestacao + 'T00:00:00').toLocaleDateString('pt-BR')}`
            : null,
        ].filter(Boolean)
        await supabase
          .from('fin_contas_pagar')
          .update({
            observacoes: partes.join(' | '),
            forma_pagamento: data.chave_pix ? 'pix' : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.fin_conta_pagar_id)
          .neq('status', 'pago')
      }

      return { atualizados: Object.keys(patch).length - 1 }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['despesas-adiantamentos'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
    },
  })
}

/** Anexa documentos a um adiantamento já criado (comprovante, orçamento, prestação). */
export function useAnexarDocumentosAdiantamento() {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  return useMutation({
    mutationFn: async ({ adiantamentoId, arquivos }: { adiantamentoId: string; arquivos: File[] }) => {
      const falhas: string[] = []
      for (const arquivo of arquivos) {
        const ext = arquivo.name.split('.').pop()?.toLowerCase() || 'bin'
        const path = `adiantamento/${adiantamentoId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const up = await supabase.storage
          .from('financeiro-docs')
          .upload(path, arquivo, { contentType: arquivo.type || undefined })
        if (up.error) { falhas.push(arquivo.name); continue }
        const { data: urlData } = supabase.storage.from('financeiro-docs').getPublicUrl(path)
        const { error } = await supabase.from('fin_documentos').insert({
          entity_type: 'adiantamento',
          entity_id: adiantamentoId,
          tipo: 'doc_financeiro',
          nome_arquivo: arquivo.name,
          arquivo_url: urlData.publicUrl,
          mime_type: arquivo.type || null,
          tamanho_bytes: arquivo.size || null,
          uploaded_by: perfil?.id ?? null,
        })
        if (error) falhas.push(arquivo.name)
      }
      if (falhas.length > 0) throw new Error(`Falha ao anexar: ${falhas.join(', ')}`)
      return arquivos.length
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adiantamento-anexos'] })
    },
  })
}

export function useAtualizarClasseAdiantamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      classe_financeira,
      classe_financeira_id,
    }: {
      id: string
      classe_financeira: string
      classe_financeira_id: string
    }) => {
      const { error } = await supabase
        .from('desp_adiantamentos')
        .update({
          classe_financeira,
          classe_financeira_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['despesas-adiantamentos'] })
    },
  })
}
