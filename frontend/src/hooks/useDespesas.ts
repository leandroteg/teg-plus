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
  data_limite_prestacao?: string
  data_pagamento?: string
  centro_custo?: string
  centro_custo_id?: string
  classe_financeira?: string
  classe_financeira_id?: string
  observacoes?: string
  solicitante_email?: string
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

      // ── Resolver aprovador ──────────────────────────────────────────────────
      // O roteamento segue o FAVORECIDO (quem recebe o adiantamento), não quem
      // digitou: o comprador lança em nome de terceiros e a aprovação precisa
      // cair no gestor/UF de quem vai receber. Sem colaborador correspondente
      // (favorecido fornecedor PJ, p.ex.), volta a usar o solicitante.
      // Regras de roteamento (em ordem de prioridade):
      //   1. UF da obra onde o colaborador está lotado:
      //      MG → Welton Aparecido Pereira
      //      MS → Leandro Maia Mallet
      //   2. UF do próprio colaborador (endereço): mesma lógica acima
      //   3. Gestor direto cadastrado no RH
      //   4. Fallback: Leandro Maia Mallet

      const COLAB_FIELDS = 'id, nome, email, gestor_id, uf, obra_id, local_trabalho_uf'
      type ColaboradorRota = {
        id: string
        nome: string
        email: string | null
        gestor_id: string | null
        uf: string | null
        obra_id: string | null
        local_trabalho_uf: string | null
      }

      let colaborador: ColaboradorRota | null = null

      const favorecidoEmail = payload.favorecido_email?.trim()
      if (favorecidoEmail) {
        const { data } = await supabase
          .from('rh_colaboradores')
          .select(COLAB_FIELDS)
          .ilike('email', favorecidoEmail)
          .limit(1)
          .maybeSingle()
        colaborador = (data as ColaboradorRota | null) ?? null
      }

      if (!colaborador && payload.favorecido_nome?.trim()) {
        const { data } = await supabase
          .from('rh_colaboradores')
          .select(COLAB_FIELDS)
          .ilike('nome', payload.favorecido_nome.trim())
          .limit(1)
          .maybeSingle()
        colaborador = (data as ColaboradorRota | null) ?? null
      }

      if (!colaborador) {
        const { data, error: colaboradorError } = await supabase
          .from('rh_colaboradores')
          .select(COLAB_FIELDS)
          .eq('perfil_id', perfil.id)
          .limit(1)
          .maybeSingle()
        if (colaboradorError) throw colaboradorError
        colaborador = (data as ColaboradorRota | null) ?? null
      }

      // Determinar UF efetiva (prioridade: campo explícito > obra > endereço)
      let ufEfetiva: string | null = null
      if (colaborador?.local_trabalho_uf) {
        ufEfetiva = colaborador.local_trabalho_uf.toUpperCase()
      } else if (colaborador?.obra_id) {
        const { data: obra } = await supabase
          .from('sys_obras')
          .select('uf')
          .eq('id', colaborador.obra_id)
          .maybeSingle()
        ufEfetiva = obra?.uf?.toUpperCase() ?? null
      }
      if (!ufEfetiva && colaborador?.uf) {
        ufEfetiva = colaborador.uf.toUpperCase()
      }

      // Buscar aprovadores nomeados por UF
      const [{ data: welton }, { data: leandro }] = await Promise.all([
        supabase.from('sys_perfis').select('id, nome, email').ilike('nome', '%WELTON APARECIDO PEREIRA%').maybeSingle(),
        supabase.from('sys_perfis').select('id, nome, email').ilike('nome', '%LEANDRO MAIA MALLET%').maybeSingle(),
      ])

      let aprovadorRhId: string | null = null
      let aprovadorNome = ''
      let aprovadorEmail = ''

      if (ufEfetiva === 'MG' && welton?.email) {
        aprovadorNome = welton.nome
        aprovadorEmail = welton.email
      } else if (ufEfetiva === 'MS' && leandro?.email) {
        aprovadorNome = leandro.nome
        aprovadorEmail = leandro.email
      } else if (colaborador?.gestor_id) {
        // Fallback: gestor direto no RH
        const { data: gestor, error: gestorError } = await supabase
          .from('rh_colaboradores')
          .select('id, nome, email')
          .eq('id', colaborador.gestor_id)
          .maybeSingle()
        if (gestorError) throw gestorError
        if (!gestor?.email) throw new Error('O gestor do solicitante está sem e-mail cadastrado no RH.')
        aprovadorRhId = gestor.id
        aprovadorNome = gestor.nome
        aprovadorEmail = gestor.email
      } else {
        // Fallback final: Welton (sem UF definida)
        const admin = welton ?? leandro ?? null
        if (!admin?.email) throw new Error('Nenhum aprovador disponível para esta solicitação.')
        aprovadorNome = admin.nome
        aprovadorEmail = admin.email
      }

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
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-kpis'] })
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
