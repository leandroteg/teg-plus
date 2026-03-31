import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { DespesaAdiantamento } from '../types'

type NovaSolicitacaoAdiantamentoPayload = {
  finalidade: string
  justificativa?: string
  valor_solicitado: number
  data_limite_prestacao?: string
  centro_custo?: string
  centro_custo_id?: string
  classe_financeira?: string
  classe_financeira_id?: string
  observacoes?: string
}

function gerarNumeroAdiantamento() {
  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const seq = String(Date.now()).slice(-5)
  return `AD-${yyyymm}-${seq}`
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

      const { data: colaborador, error: colaboradorError } = await supabase
        .from('rh_colaboradores')
        .select('id, nome, email, gestor_id')
        .eq('perfil_id', perfil.id)
        .maybeSingle()

      if (colaboradorError) throw colaboradorError
      if (!colaborador?.gestor_id) {
        throw new Error('Nenhum gestor vinculado ao solicitante no RH.')
      }

      const { data: gestor, error: gestorError } = await supabase
        .from('rh_colaboradores')
        .select('id, nome, email')
        .eq('id', colaborador.gestor_id)
        .maybeSingle()

      if (gestorError) throw gestorError
      if (!gestor?.email) {
        throw new Error('O gestor do solicitante está sem e-mail cadastrado no RH.')
      }

      const numero = gerarNumeroAdiantamento()
      const hoje = new Date().toISOString().split('T')[0]

      const { data: adiantamento, error: adiantamentoError } = await supabase
        .from('desp_adiantamentos')
        .insert({
          numero,
          solicitante_id: perfil.id,
          solicitante_nome: perfil.nome,
          gestor_id: gestor.id,
          gestor_nome: gestor.nome,
          gestor_email: gestor.email,
          favorecido_nome: perfil.nome,
          favorecido_email: perfil.email,
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
          status: 'solicitado',
          observacoes: payload.observacoes?.trim() || null,
        })
        .select('*')
        .single()

      if (adiantamentoError) throw adiantamentoError

      const { data: aprovacao, error: aprovacaoError } = await supabase
        .from('apr_aprovacoes')
        .insert({
          modulo: 'desp',
          tipo_aprovacao: 'solicitacao_adiantamento',
          entidade_id: adiantamento.id,
          entidade_numero: numero,
          aprovador_nome: gestor.nome,
          aprovador_email: gestor.email,
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
