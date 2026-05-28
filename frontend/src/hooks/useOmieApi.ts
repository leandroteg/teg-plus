import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  OmieCredentials,
  OmieContaCorrente,
  OmieLancamento,
} from '../lib/omieApi'

const OMIE_BROWSER_DISABLED =
  'Integracao direta com Omie foi desativada no navegador. Use o fluxo server-side via n8n/proxy.'

export interface OmieCredentialsResult {
  /** Deprecated: secrets must not be returned to the browser. Kept optional for legacy callers. */
  credentials?: OmieCredentials
  enabled: boolean
  isSandbox: boolean
  webhookUrl: string
}

export interface CPParaRemessa {
  id: string
  fornecedor_id: string | null
  fornecedor_nome: string
  valor_original: number
  data_vencimento: string
  data_emissao: string
  numero_documento: string | null
  descricao: string | null
  omie_cp_id?: number | null
}

export interface ResultadoRemessa {
  cpId: string
  omieId: number | null
  status: 'incluido' | 'ja_existe' | 'erro'
  mensagem?: string
}

export interface ResultadoAtualizacao {
  cpId: string
  omieId: number
  situacaoOmie: string
  novoStatus: string
  atualizado: boolean
}

export interface SyncContasPagarResult {
  total: number
  novas: number
  atualizadas: number
  erros: number
}

export function useOmieCredentials() {
  return useQuery<OmieCredentialsResult | null>({
    queryKey: ['omie-credentials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_config')
        .select('chave, valor')
        .in('chave', [
          'omie_enabled',
          'omie_sandbox_mode',
          'n8n_webhook_url',
        ])

      if (error) throw error
      if (!data) return null

      const map: Record<string, string> = {}
      data.forEach(row => { map[row.chave] = row.valor ?? '' })

      if (map['omie_enabled'] !== 'true') return null

      return {
        enabled: true,
        isSandbox: map['omie_sandbox_mode'] === 'true',
        webhookUrl: map['n8n_webhook_url'] ?? '',
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useOmieTestarConexao() {
  return useMutation({
    mutationFn: async (_credentials?: OmieCredentials) => {
      throw new Error(OMIE_BROWSER_DISABLED)
    },
  })
}

export function useOmieContasCorrentes(_credentials: OmieCredentials | null | undefined) {
  return useQuery<OmieContaCorrente[]>({
    queryKey: ['omie-contas-correntes'],
    queryFn: async () => [],
    enabled: false,
    staleTime: 2 * 60_000,
    retry: false,
  })
}

export function useSincronizarSaldoContaOmie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      contaInternaId,
      nCodCC,
      saldo,
    }: {
      contaInternaId: string
      nCodCC: number
      saldo: number
    }) => {
      const { error } = await supabase
        .from('fin_contas_bancarias')
        .update({
          saldo_atual: saldo,
          saldo_atualizado_em: new Date().toISOString(),
          omie_conta_id: nCodCC,
        })
        .eq('id', contaInternaId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-bancarias'] })
      qc.invalidateQueries({ queryKey: ['tesouraria-dashboard'] })
    },
  })
}

export function useOmieLancamentos(
  _credentials: OmieCredentials | null | undefined,
  _opts: { nCodCC?: number; dataInicio?: string; dataFim?: string } = {},
) {
  return useQuery<OmieLancamento[]>({
    queryKey: ['omie-lancamentos', _opts.nCodCC, _opts.dataInicio, _opts.dataFim],
    queryFn: async () => [],
    enabled: false,
    staleTime: 60_000,
    retry: false,
  })
}

export function useOmieEnviarRemessa() {
  return useMutation({
    mutationFn: async (_args: {
      credentials: OmieCredentials
      cps: CPParaRemessa[]
    }): Promise<ResultadoRemessa[]> => {
      throw new Error(OMIE_BROWSER_DISABLED)
    },
  })
}

export function useOmieAtualizarRemessas() {
  return useMutation({
    mutationFn: async (_args: {
      credentials: OmieCredentials
      cpIds?: string[]
    }): Promise<ResultadoAtualizacao[]> => {
      throw new Error(OMIE_BROWSER_DISABLED)
    },
  })
}

export function useOmieSyncContasPagar() {
  return useMutation({
    mutationFn: async (_credentials: OmieCredentials): Promise<SyncContasPagarResult> => {
      throw new Error(OMIE_BROWSER_DISABLED)
    },
  })
}
