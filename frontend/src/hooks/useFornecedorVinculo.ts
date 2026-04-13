import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { Fornecedor } from '../types/financeiro'

type CotacaoFornecedorSelecionado = {
  id: string
  fornecedor_nome?: string | null
  fornecedor_contato?: string | null
  fornecedor_cnpj?: string | null
  condicao_pagamento?: string | null
}

export type FornecedorCotacaoResolvidoStatus =
  | 'matched_complete'
  | 'matched_missing_payment'
  | 'not_found'

export interface FornecedorCotacaoResolvido {
  cotacaoId: string
  fornecedorCotacao: CotacaoFornecedorSelecionado | null
  fornecedorCorrespondente: Fornecedor | null
  nomeCotacao: string
  cnpjCotacao: string
  contatoCotacao?: string
  condicaoPagamento?: string
  status: FornecedorCotacaoResolvidoStatus
  camposPagamentoFaltantes: string[]
}

export function normalizeDigits(value?: string | null) {
  return (value ?? '').replace(/\D/g, '')
}

export function formatCNPJ(value?: string | null) {
  const digits = normalizeDigits(value)
  if (digits.length !== 14) return value?.trim() ?? ''
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function getFornecedorPaymentMissingFields(fornecedor?: Partial<Fornecedor> | null) {
  if (fornecedor?.boleto) return []

  const banco = fornecedor?.banco_nome?.trim()
  const agencia = fornecedor?.agencia?.trim()
  const conta = fornecedor?.conta?.trim()
  const pixChave = fornecedor?.pix_chave?.trim()
  const pixTipo = fornecedor?.pix_tipo?.trim()

  const hasContaBancaria = Boolean(banco && agencia && conta)
  const hasPix = Boolean(pixChave && pixTipo)

  if (hasContaBancaria || hasPix) return []

  const faltantes = new Set<string>()
  if (!banco) faltantes.add('Banco')
  if (!agencia) faltantes.add('Agência')
  if (!conta) faltantes.add('Conta')
  if (!pixChave) faltantes.add('Chave PIX')
  if (pixChave && !pixTipo) faltantes.add('Tipo PIX')

  return Array.from(faltantes)
}

export function hasFornecedorPaymentData(fornecedor?: Partial<Fornecedor> | null) {
  return getFornecedorPaymentMissingFields(fornecedor).length === 0
}

export function buildFornecedorPrefillFromCotacao(resolvido?: FornecedorCotacaoResolvido | null): Partial<Fornecedor> {
  return {
    razao_social: resolvido?.nomeCotacao ?? '',
    nome_fantasia: resolvido?.nomeCotacao ?? '',
    cnpj: formatCNPJ(resolvido?.cnpjCotacao),
    contato_nome: resolvido?.contatoCotacao ?? '',
    banco_nome: '',
    agencia: '',
    conta: '',
    boleto: false,
    pix_chave: '',
    pix_tipo: '',
    ativo: true,
  }
}

export function useFornecedorCotacaoResolver(cotacaoId?: string) {
  return useQuery<FornecedorCotacaoResolvido | null>({
    queryKey: ['fornecedor-cotacao-resolver', cotacaoId],
    enabled: Boolean(cotacaoId),
    queryFn: async () => {
      if (!cotacaoId) return null

      const { data: cotacao, error: cotacaoError } = await supabase
        .from('cmp_cotacoes')
        .select('id, fornecedor_selecionado_id, fornecedor_selecionado_nome')
        .eq('id', cotacaoId)
        .maybeSingle()

      if (cotacaoError) throw cotacaoError
      if (!cotacao) return null

      let fornecedorCotacao: CotacaoFornecedorSelecionado | null = null

      if (cotacao.fornecedor_selecionado_id) {
        const { data: selecionado, error: selecionadoError } = await supabase
          .from('cmp_cotacao_fornecedores')
          .select('id, fornecedor_nome, fornecedor_contato, fornecedor_cnpj, condicao_pagamento')
          .eq('id', cotacao.fornecedor_selecionado_id)
          .maybeSingle()

        if (selecionadoError) throw selecionadoError
        fornecedorCotacao = selecionado
      }

      if (!fornecedorCotacao) {
        const { data: fallback, error: fallbackError } = await supabase
          .from('cmp_cotacao_fornecedores')
          .select('id, fornecedor_nome, fornecedor_contato, fornecedor_cnpj, condicao_pagamento')
          .eq('cotacao_id', cotacaoId)
          .eq('selecionado', true)
          .limit(1)
          .maybeSingle()

        if (fallbackError) throw fallbackError
        fornecedorCotacao = fallback
      }

      const nomeCotacao = fornecedorCotacao?.fornecedor_nome?.trim()
        || cotacao.fornecedor_selecionado_nome?.trim()
        || 'Fornecedor não definido'
      const cnpjCotacao = normalizeDigits(fornecedorCotacao?.fornecedor_cnpj)
      const cnpjVariants = Array.from(new Set([
        cnpjCotacao,
        formatCNPJ(cnpjCotacao),
      ].filter(Boolean)))

      let fornecedorCorrespondente: Fornecedor | null = null

      if (cnpjVariants.length > 0) {
        const { data: fornecedor, error: fornecedorError } = await supabase
          .from('cmp_fornecedores')
          .select('*')
          .in('cnpj', cnpjVariants)
          .limit(1)
          .maybeSingle()

        if (fornecedorError) throw fornecedorError
        fornecedorCorrespondente = fornecedor as Fornecedor | null
      }

      const camposPagamentoFaltantes = getFornecedorPaymentMissingFields(fornecedorCorrespondente)

      return {
        cotacaoId,
        fornecedorCotacao,
        fornecedorCorrespondente,
        nomeCotacao,
        cnpjCotacao,
        contatoCotacao: fornecedorCotacao?.fornecedor_contato ?? undefined,
        condicaoPagamento: fornecedorCotacao?.condicao_pagamento ?? undefined,
        status: fornecedorCorrespondente
          ? (camposPagamentoFaltantes.length > 0 ? 'matched_missing_payment' : 'matched_complete')
          : 'not_found',
        camposPagamentoFaltantes,
      } satisfies FornecedorCotacaoResolvido
    },
    staleTime: 30_000,
  })
}
