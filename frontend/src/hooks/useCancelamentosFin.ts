import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { Perfil } from '../contexts/AuthContext'

// Cancelamento de documentos financeiros (CP/CR) com fluxo solicita -> aprova.
// Backend: migration 194 (fin_cancelamentos + RPCs fin_solicitar/decidir_cancelamento).

export type TipoDocFin = 'cp' | 'cr'

export interface CancelamentoFin {
  id: string
  tipo_doc: TipoDocFin
  doc_id: string
  doc_descricao: string | null
  doc_valor: number | null
  doc_status_origem: string | null
  solicitante_id: string | null
  solicitante_nome: string | null
  justificativa: string
  status: 'pendente' | 'aprovado' | 'recusado'
  decidido_por_id: string | null
  decidido_por_nome: string | null
  decidido_em: string | null
  motivo_recusa: string | null
  criado_em: string
}

/** Documento liquidado não entra na Fase 1 (exigiria estorno). */
export function isDocLiquidado(tipo: TipoDocFin, status?: string): boolean {
  if (!status) return false
  return tipo === 'cp'
    ? ['pago', 'conciliado'].includes(status)
    : ['recebido', 'conciliado'].includes(status)
}

/** Pode o documento receber uma solicitação de cancelamento agora? */
export function podeSolicitarCancelamento(tipo: TipoDocFin, status?: string): boolean {
  return !!status && status !== 'cancelado' && !isDocLiquidado(tipo, status)
}

export function podeAprovarCancelamentoFin(perfil?: Perfil | null): boolean {
  return perfil?.aprova_cancelamento_fin === true
}

/** Solicitação de cancelamento pendente de um documento específico (badge + aprovação). */
export function useCancelamentoPendente(tipo: TipoDocFin, docId?: string, enabled = true) {
  return useQuery({
    queryKey: ['fin-cancelamento-pendente', tipo, docId],
    enabled: !!docId && enabled,
    queryFn: async (): Promise<CancelamentoFin | null> => {
      const { data, error } = await supabase
        .from('fin_cancelamentos')
        .select('*')
        .eq('tipo_doc', tipo)
        .eq('doc_id', docId as string)
        .eq('status', 'pendente')
        .maybeSingle()
      if (error) throw error
      return (data as CancelamentoFin) ?? null
    },
  })
}

function invalidateLists(qc: ReturnType<typeof useQueryClient>, tipo?: TipoDocFin) {
  qc.invalidateQueries({ queryKey: ['fin-cancelamento-pendente'] })
  qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
  if (!tipo || tipo === 'cp') qc.invalidateQueries({ queryKey: ['contas-pagar'] })
  if (!tipo || tipo === 'cr') qc.invalidateQueries({ queryKey: ['contas-receber'] })
}

export function useSolicitarCancelamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ tipo, docId, justificativa }: { tipo: TipoDocFin; docId: string; justificativa: string }) => {
      const { data, error } = await supabase.rpc('fin_solicitar_cancelamento', {
        p_tipo: tipo,
        p_doc_id: docId,
        p_justificativa: justificativa,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (_data, vars) => invalidateLists(qc, vars.tipo),
  })
}

export function useDecidirCancelamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cancelamentoId,
      aprovar,
      motivo,
    }: {
      cancelamentoId: string
      aprovar: boolean
      motivo?: string
      tipo?: TipoDocFin
    }) => {
      const { error } = await supabase.rpc('fin_decidir_cancelamento', {
        p_cancelamento_id: cancelamentoId,
        p_aprovar: aprovar,
        p_motivo: motivo ?? null,
      })
      if (error) throw error
    },
    onSuccess: (_data, vars) => invalidateLists(qc, vars.tipo),
  })
}
