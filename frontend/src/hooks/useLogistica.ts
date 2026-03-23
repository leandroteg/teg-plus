import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  LogSolicitacao, LogViagem, LogTransportadora, LogRota, LogNFe,
  LogTransporte, LogOcorrencia, LogRecebimento, LogAvaliacao,
  LogChecklistExpedicao, LogisticaKPIs,
  CriarSolicitacaoPayload, EmitirNFePayload, IniciarTransportePayload,
  StatusSolicitacao, TipoTransporte,
} from '../types/logistica'
import { applyEtasToEtapas, buildViagemEtapas } from '../utils/logisticaViagem'

const QK = {
  solicitacoes:    (f?: any) => ['log_solicitacoes', f],
  solicitacao:     (id: string) => ['log_solicitacao', id],
  transportadoras: () => ['log_transportadoras'],
  rotas:           () => ['log_rotas'],
  transportes:     () => ['log_transportes'],
  recebimentos:    (f?: any) => ['log_recebimentos', f],
  kpis:            () => ['log_kpis'],
}

// ── Solicitações ──────────────────────────────────────────────────────────────

export function useSolicitacoes(filtros?: {
  status?: StatusSolicitacao | StatusSolicitacao[]
  urgente?: boolean
  tipo?: TipoTransporte
}) {
  return useQuery({
    queryKey: QK.solicitacoes(filtros),
    queryFn: async () => {
      let q = supabase
        .from('log_solicitacoes')
        .select(`
          *,
          transportadora:log_transportadoras(id, nome_fantasia, razao_social, avaliacao_media),
          rota_planejada:log_rotas!rota_planejada_id(id, nome, distancia_km, tempo_estimado_h),
          viagem:log_viagens!viagem_id(id, numero, status, modal, veiculo_placa, motorista_nome, motorista_telefone, qtd_paradas, distancia_total_km, tempo_estimado_h, custo_total, origem_principal, destino_final, data_prevista_saida, data_real_saida, data_conclusao, rota_polyline),
          nfe:log_nfe(id, numero, status, chave_acesso, valor_total),
          transporte:log_transportes(id, hora_saida, hora_chegada, eta_atual, placa, motorista_nome),
          recebimento:log_recebimentos(id, status, confirmado_em),
          itens:log_itens_solicitacao(id, descricao, quantidade, unidade, peso_kg, volume_m3, numero_serie, observacao)
        `)
        .order('criado_em', { ascending: false })

      if (filtros?.status) {
        if (Array.isArray(filtros.status)) {
          q = q.in('status', filtros.status)
        } else {
          q = q.eq('status', filtros.status)
        }
      }
      if (filtros?.urgente !== undefined) q = q.eq('urgente', filtros.urgente)
      if (filtros?.tipo)    q = q.eq('tipo', filtros.tipo)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as LogSolicitacao[]
    },
  })
}

export function useSolicitacao(id: string | undefined) {
  return useQuery({
    queryKey: QK.solicitacao(id!),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('log_solicitacoes')
        .select(`
          *,
          transportadora:log_transportadoras(*),
          itens:log_itens_solicitacao(*),
          nfe:log_nfe(*),
          transporte:log_transportes(
            *,
            ocorrencias:log_ocorrencias(*)
          ),
          recebimento:log_recebimentos(*)
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as LogSolicitacao
    },
  })
}

export function useCriarSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CriarSolicitacaoPayload) => {
      const { itens, ...sol } = payload
      const { data, error } = await supabase
        .from('log_solicitacoes')
        .insert(sol)
        .select()
        .single()
      if (error) throw error

      if (itens?.length) {
        const { error: ei } = await supabase
          .from('log_itens_solicitacao')
          .insert(itens.map(i => ({ ...i, solicitacao_id: data.id })))
        if (ei) throw ei
      }
      return data as LogSolicitacao
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['log_solicitacoes'] }),
  })
}

export function useAtualizarStatusSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id, status, extra = {}
    }: { id: string; status: StatusSolicitacao; extra?: Record<string, any> }) => {
      const { data, error } = await supabase
        .from('log_solicitacoes')
        .update({ status, updated_at: new Date().toISOString(), ...extra })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as LogSolicitacao
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['log_solicitacao', data.id] })
    },
  })
}

export function usePlanejaarSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id, modal, transportadora_id, veiculo_placa, motorista_nome,
      motorista_telefone, data_prevista_saida, custo_estimado,
      distancia_km, tempo_estimado_h,
    }: {
      id: string
      modal?: string
      transportadora_id?: string
      veiculo_placa?: string
      motorista_nome?: string
      motorista_telefone?: string
      data_prevista_saida?: string
      custo_estimado?: number
      distancia_km?: number
      tempo_estimado_h?: number
    }) => {
      const { data, error } = await supabase
        .from('log_solicitacoes')
        .update({
          status: 'planejado' as const,
          modal, transportadora_id, veiculo_placa, motorista_nome,
          motorista_telefone, data_prevista_saida, custo_estimado,
          distancia_km, tempo_estimado_h,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as LogSolicitacao
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['log_solicitacao', data.id] })
    },
  })
}

// ── Viagem (consolida N solicitações numa trip) ──────────────────────────────

export function useCriarViagem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      solicitacaoIds: string[]
      modal?: string
      motorista_nome?: string
      motorista_telefone?: string
      veiculo_placa?: string
      data_prevista_saida?: string
      custo_total?: number
      distancia_total_km?: number
      tempo_estimado_h?: number
      origem_principal?: string
      destino_final?: string
      rota_polyline?: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()

      // 1. Criar a viagem
      const { data: viagem, error: vErr } = await supabase
        .from('log_viagens')
        .insert({
          status: 'planejada',
          modal: payload.modal,
          veiculo_placa: payload.veiculo_placa,
          motorista_nome: payload.motorista_nome,
          motorista_telefone: payload.motorista_telefone,
          origem_principal: payload.origem_principal,
          destino_final: payload.destino_final,
          distancia_total_km: payload.distancia_total_km,
          tempo_estimado_h: payload.tempo_estimado_h,
          qtd_paradas: payload.solicitacaoIds.length,
          custo_total: payload.custo_total,
          data_prevista_saida: payload.data_prevista_saida,
          rota_polyline: payload.rota_polyline,
          criado_por: user?.id,
        })
        .select()
        .single()
      if (vErr) throw vErr

      // 2. Vincular solicitações à viagem + atualizar status → planejado
      const custoRateado = payload.custo_total && payload.solicitacaoIds.length > 0
        ? Math.round((payload.custo_total / payload.solicitacaoIds.length) * 100) / 100
        : undefined

      for (let i = 0; i < payload.solicitacaoIds.length; i++) {
        const { error } = await supabase
          .from('log_solicitacoes')
          .update({
            viagem_id: viagem.id,
            ordem_na_viagem: i + 1,
            custo_rateado: custoRateado,
            status: 'planejado',
            modal: payload.modal,
            motorista_nome: payload.motorista_nome,
            veiculo_placa: payload.veiculo_placa,
            data_prevista_saida: payload.data_prevista_saida,
            custo_estimado: custoRateado,
            distancia_km: payload.distancia_total_km,
            tempo_estimado_h: payload.tempo_estimado_h,
            updated_at: new Date().toISOString(),
          })
          .eq('id', payload.solicitacaoIds[i])
        if (error) throw error
      }

      return viagem as LogViagem
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['log_viagens'] })
    },
  })
}

export function useAtualizarViagem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      viagemId: string
      solicitacaoIds: string[]
      modal?: string
      motorista_nome?: string
      motorista_telefone?: string
      veiculo_placa?: string
      data_prevista_saida?: string
      custo_total?: number
      distancia_total_km?: number
      tempo_estimado_h?: number
      origem_principal?: string
      destino_final?: string
      rota_polyline?: string
    }) => {
      // 1. Atualizar a viagem
      const { error: vErr } = await supabase
        .from('log_viagens')
        .update({
          modal: payload.modal,
          veiculo_placa: payload.veiculo_placa,
          motorista_nome: payload.motorista_nome,
          motorista_telefone: payload.motorista_telefone,
          origem_principal: payload.origem_principal,
          destino_final: payload.destino_final,
          distancia_total_km: payload.distancia_total_km,
          tempo_estimado_h: payload.tempo_estimado_h,
          qtd_paradas: payload.solicitacaoIds.length,
          custo_total: payload.custo_total,
          data_prevista_saida: payload.data_prevista_saida,
          rota_polyline: payload.rota_polyline,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.viagemId)
      if (vErr) throw vErr

      // 2. Desvincular solicitações que não estão mais na lista
      const { error: clearErr } = await supabase
        .from('log_solicitacoes')
        .update({ viagem_id: null, ordem_na_viagem: null, custo_rateado: null, status: 'solicitado', updated_at: new Date().toISOString() })
        .eq('viagem_id', payload.viagemId)
        .not('id', 'in', `(${payload.solicitacaoIds.join(',')})`)
      if (clearErr) throw clearErr

      // 3. Vincular/atualizar solicitações na viagem
      const custoRateado = payload.custo_total && payload.solicitacaoIds.length > 0
        ? Math.round((payload.custo_total / payload.solicitacaoIds.length) * 100) / 100
        : undefined

      for (let i = 0; i < payload.solicitacaoIds.length; i++) {
        const { error } = await supabase
          .from('log_solicitacoes')
          .update({
            viagem_id: payload.viagemId,
            ordem_na_viagem: i + 1,
            custo_rateado: custoRateado,
            status: 'planejado',
            modal: payload.modal,
            motorista_nome: payload.motorista_nome,
            veiculo_placa: payload.veiculo_placa,
            data_prevista_saida: payload.data_prevista_saida,
            custo_estimado: custoRateado,
            distancia_km: payload.distancia_total_km,
            tempo_estimado_h: payload.tempo_estimado_h,
            updated_at: new Date().toISOString(),
          })
          .eq('id', payload.solicitacaoIds[i])
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['log_viagens'] })
    },
  })
}

export function useEnviarViagemAprovacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ viagemId }: { viagemId: string }) => {
      // 1. Buscar viagem com solicitações vinculadas
      const { data: viagem, error: vErr } = await supabase
        .from('log_viagens')
        .select('id, numero, qtd_paradas, custo_total, origem_principal, destino_final')
        .eq('id', viagemId)
        .single()
      if (vErr) throw vErr

      // 2. Atualizar status da viagem
      const { error: updErr } = await supabase
        .from('log_viagens')
        .update({ status: 'aguardando_aprovacao', updated_at: new Date().toISOString() })
        .eq('id', viagemId)
      if (updErr) throw updErr

      // 3. Atualizar todas as solicitações da viagem → aguardando_aprovacao
      const { error: solErr } = await supabase
        .from('log_solicitacoes')
        .update({ status: 'aguardando_aprovacao', updated_at: new Date().toISOString() })
        .eq('viagem_id', viagemId)
      if (solErr) throw solErr

      // 4. Criar UMA aprovação para a viagem inteira
      const prazo = new Date()
      prazo.setHours(prazo.getHours() + 48)

      const { error: aprError } = await supabase.from('apr_aprovacoes').insert({
        modulo: 'log',
        tipo_aprovacao: 'aprovacao_transporte',
        entidade_id: viagemId,
        entidade_numero: viagem.numero,
        status: 'pendente',
        nivel: 1,
        aprovador_nome: 'Gestor Logística',
        aprovador_email: 'logistica@tegplus.com.br',
        data_limite: prazo.toISOString(),
      })
      if (aprError) throw new Error(`Erro ao criar aprovação: ${aprError.message}`)

      return viagem
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['log_viagens'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-kpis'] })
    },
  })
}

export function useAprovarViagem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ viagemId, aprovado, motivo }: { viagemId: string; aprovado: boolean; motivo?: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const novoStatus = aprovado ? 'aprovada' : 'cancelada'
      const solStatus = aprovado ? 'aprovado' : 'recusado'

      // 1. Atualizar viagem
      const { error: vErr } = await supabase
        .from('log_viagens')
        .update({
          status: novoStatus,
          aprovado_por: user?.id,
          aprovado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', viagemId)
      if (vErr) throw vErr

      // 2. Atualizar todas as solicitações da viagem
      const { error: solErr } = await supabase
        .from('log_solicitacoes')
        .update({
          status: solStatus,
          aprovado_por: user?.id,
          aprovado_em: new Date().toISOString(),
          ...(motivo ? { motivo_reprovacao: motivo } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('viagem_id', viagemId)
      if (solErr) throw solErr

      // 3. Atualizar apr_aprovacoes
      const { error: aprErr } = await supabase
        .from('apr_aprovacoes')
        .update({
          status: aprovado ? 'aprovada' : 'rejeitada',
          data_decisao: new Date().toISOString(),
        })
        .eq('entidade_id', viagemId)
        .eq('tipo_aprovacao', 'aprovacao_transporte')
        .eq('status', 'pendente')
      if (aprErr) throw aprErr

      return { viagemId, aprovado }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['log_viagens'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-kpis'] })
    },
  })
}

export function useAprovarSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, aprovado, motivo }: { id: string; aprovado: boolean; motivo?: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('log_solicitacoes')
        .update({
          status: aprovado ? 'aprovado' : 'recusado',
          aprovado_por: aprovado ? user?.id : undefined,
          aprovado_em: aprovado ? new Date().toISOString() : undefined,
          motivo_reprovacao: aprovado ? undefined : motivo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      // Atualizar apr_aprovacoes correspondente
      const aprStatus = aprovado ? 'aprovada' : 'rejeitada'
      await supabase
        .from('apr_aprovacoes')
        .update({
          status: aprStatus,
          data_decisao: new Date().toISOString(),
          observacao: motivo || null,
        })
        .eq('entidade_id', id)
        .eq('tipo_aprovacao', 'aprovacao_transporte')
        .eq('status', 'pendente')

      return data as LogSolicitacao
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['log_solicitacao', data.id] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-kpis'] })
    },
  })
}

export function useEnviarParaAprovacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data, error } = await supabase
        .from('log_solicitacoes')
        .update({ status: 'aguardando_aprovacao', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      const sol = data as LogSolicitacao

      // Criar registro em apr_aprovacoes para aparecer no AprovAi
      const prazo = new Date()
      prazo.setHours(prazo.getHours() + 48)

      const { error: aprError } = await supabase.from('apr_aprovacoes').insert({
        modulo: 'log',
        tipo_aprovacao: 'aprovacao_transporte',
        entidade_id: sol.id,
        entidade_numero: sol.numero,
        status: 'pendente',
        nivel: 1,
        aprovador_nome: 'Gestor Logística',
        aprovador_email: 'logistica@tegplus.com.br',
        data_limite: prazo.toISOString(),
      })
      if (aprError) throw new Error(`Erro ao criar aprovação: ${aprError.message}`)

      return sol
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['log_solicitacao', data.id] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-kpis'] })
    },
  })
}

export function useConfirmarAgendamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data, error } = await supabase
        .from('log_solicitacoes')
        .update({ status: 'aguardando_coleta', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as LogSolicitacao
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['log_solicitacao', data.id] })
    },
  })
}

export function useConcluirSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data, error } = await supabase
        .from('log_solicitacoes')
        .update({ status: 'concluido', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as LogSolicitacao
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['log_solicitacao', data.id] })
    },
  })
}

// ── Checklist de Expedição ────────────────────────────────────────────────────

export function useChecklistExpedicao(solicitacaoId: string | undefined) {
  return useQuery({
    queryKey: ['log_checklist', solicitacaoId],
    enabled: !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('log_checklists_expedicao')
        .select('*')
        .eq('solicitacao_id', solicitacaoId)
        .maybeSingle()
      if (error) throw error
      return data as LogChecklistExpedicao | null
    },
  })
}

export function useSalvarChecklistExpedicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (checklist: Partial<LogChecklistExpedicao> & { solicitacao_id: string }) => {
      const { data, error } = await supabase
        .from('log_checklists_expedicao')
        .upsert({
          ...checklist,
          conferido_em: new Date().toISOString(),
        }, { onConflict: 'solicitacao_id' })
        .select()
        .single()
      if (error) throw error
      return data as LogChecklistExpedicao
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['log_checklist', vars.solicitacao_id] })
    },
  })
}

// ── NF-e ──────────────────────────────────────────────────────────────────────

export function useNFe(solicitacaoId: string | undefined) {
  return useQuery({
    queryKey: ['log_nfe', solicitacaoId],
    enabled: !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('log_nfe')
        .select('*')
        .eq('solicitacao_id', solicitacaoId)
        .order('criado_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as LogNFe[]
    },
  })
}

export function useEmitirNFe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: EmitirNFePayload) => {
      const { data: { user } } = await supabase.auth.getUser()

      // Simula emissão SEFAZ — em produção, chamar n8n / edge function
      const chaveSimulada = `NFe${Date.now()}${Math.random().toString(36).slice(2, 10).toUpperCase()}`
      const numeroNFe = `${Math.floor(Math.random() * 900000) + 100000}`

      const { data, error } = await supabase
        .from('log_nfe')
        .insert({
          ...payload,
          tipo: payload.tipo ?? 'NFe',
          status: 'autorizada',
          numero: numeroNFe,
          chave_acesso: chaveSimulada,
          data_emissao: new Date().toISOString(),
          data_autorizacao: new Date().toISOString(),
          protocolo: `SEFAZ-${Date.now()}`,
          emitida_por: user?.id,
        })
        .select()
        .single()
      if (error) throw error

      const updateBase = { updated_at: new Date().toISOString() }
      const nextStatus = await supabase
        .from('log_solicitacoes')
        .update({ status: 'transporte_pendente', ...updateBase })
        .eq('id', payload.solicitacao_id)

      if (nextStatus.error) throw nextStatus.error

      return data as LogNFe
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['log_nfe', vars.solicitacao_id] })
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
    },
  })
}

export function useCancelarNFe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, motivo, solicitacao_id }: { id: string; motivo: string; solicitacao_id: string }) => {
      const { data, error } = await supabase
        .from('log_nfe')
        .update({
          status: 'cancelada',
          cancelada_em: new Date().toISOString(),
          motivo_cancelamento: motivo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as LogNFe
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['log_nfe', vars.solicitacao_id] })
    },
  })
}

// ── Romaneio ─────────────────────────────────────────────────────────────────

export function useEmitirRomaneio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      solicitacao_id: string
      romaneio_url: string
    }) => {
      const baseUpdate = {
        romaneio_url: payload.romaneio_url,
        doc_fiscal_tipo: 'romaneio' as const,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('log_solicitacoes')
        .update({
          status: 'transporte_pendente',
          ...baseUpdate,
        })
        .eq('id', payload.solicitacao_id)
        .select()
        .single()

      if (error) throw error
      return data as LogSolicitacao
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
    },
  })
}

// ── Solicitar NF ao Fiscal ───────────────────────────────────────────────────

export function useSolicitarNFFiscal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      solicitacao_id: string
      fornecedor_cnpj?: string
      fornecedor_nome: string
      valor_total: number
      cfop?: string
      natureza_operacao?: string
      descricao?: string
      destinatario_cnpj?: string
      destinatario_nome?: string
      destinatario_uf?: string
      emitente_cnpj?: string
      emitente_nome?: string
      items?: any[]
      obra_id?: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { solicitacao_id, ...rest } = payload

      // 1. Create fiscal solicitation linked back to logistica
      const { data, error } = await supabase
        .from('fis_solicitacoes_nf')
        .insert({
          ...rest,
          solicitacao_log_id: solicitacao_id,
          origem: 'logistica',
          status: 'pendente',
          solicitado_por: user?.id,
        })
        .select()
        .single()
      if (error) throw error

      // 2. Mark logistica solicitacao as NF requested
      await supabase
        .from('log_solicitacoes')
        .update({
          doc_fiscal_tipo: 'nf',
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitacao_id)

      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['solicitacoes-nf'] })
    },
  })
}

// ── Transporte ────────────────────────────────────────────────────────────────

export function useTransportes() {
  return useQuery({
    queryKey: QK.transportes(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('log_transportes')
        .select(`
          *,
          solicitacao:log_solicitacoes(
            id, numero, tipo, origem, destino, obra_nome, centro_custo, urgente,
            solicitante_nome, viagem_id, ordem_na_viagem,
            transportadora:log_transportadoras(nome_fantasia)
          ),
          ocorrencias:log_ocorrencias(*),
          viagem:log_viagens!viagem_id(id, numero, status, origem_principal, destino_final, qtd_paradas, distancia_total_km, tempo_estimado_h, motorista_nome, motorista_telefone, veiculo_placa, modal, data_prevista_saida, data_real_saida, rota_polyline)
        `)
        .is('hora_chegada', null)
        .order('criado_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as LogTransporte[]
    },
  })
}

export function useIniciarTransporte() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: IniciarTransportePayload) => {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('log_transportes')
        .insert({
          ...payload,
          hora_saida: new Date().toISOString(),
          despachado_por: user?.id,
        })
        .select()
        .single()
      if (error) throw error

      await supabase
        .from('log_solicitacoes')
        .update({ status: 'em_transito', updated_at: new Date().toISOString() })
        .eq('id', payload.solicitacao_id)

      // Cria recebimento pendente
      await supabase
        .from('log_recebimentos')
        .insert({ solicitacao_id: payload.solicitacao_id, status: 'pendente' })
        .select()

      return data as LogTransporte
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['log_transportes'] })
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['log_recebimentos'] })
    },
  })
}

export function useDespacharViagem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      viagemId: string
      placa: string
      motorista_nome: string
      motorista_telefone?: string
      codigo_rastreio?: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const agora = new Date().toISOString()

      const { data: viagem, error: viagemErr } = await supabase
        .from('log_viagens')
        .select('id, rota_polyline, distancia_total_km, tempo_estimado_h, data_prevista_saida, data_real_saida')
        .eq('id', payload.viagemId)
        .single()
      if (viagemErr) throw viagemErr

      // 1. Buscar solicitações da viagem
      const { data: sols, error: solErr } = await supabase
        .from('log_solicitacoes')
        .select('id, origem, destino, ordem_na_viagem, peso_total_kg, volumes_total, status')
        .eq('viagem_id', payload.viagemId)
        .order('ordem_na_viagem', { ascending: true })
      if (solErr) throw solErr
      if (!sols || sols.length === 0) throw new Error('Nenhuma solicitação encontrada na viagem')

      const etapas = applyEtasToEtapas(buildViagemEtapas(viagem as LogViagem, sols as LogSolicitacao[]), agora)
      const etaPorSolicitacao = new Map(
        etapas
          .filter(etapa => etapa.solicitacao?.id && etapa.eta_previsto)
          .map(etapa => [etapa.solicitacao!.id, etapa.eta_previsto!])
      )
      const etaFinal = etapas[etapas.length - 1]?.eta_previsto

      // 2. Criar 1 transporte por solicitação
      for (const sol of sols) {
        const { error } = await supabase
          .from('log_transportes')
          .insert({
            solicitacao_id: sol.id,
            viagem_id: payload.viagemId,
            placa: payload.placa,
            motorista_nome: payload.motorista_nome,
            motorista_telefone: payload.motorista_telefone,
            eta_original: etaPorSolicitacao.get(sol.id) ?? etaFinal ?? agora,
            eta_atual: etaPorSolicitacao.get(sol.id) ?? etaFinal ?? agora,
            codigo_rastreio: payload.codigo_rastreio,
            hora_saida: agora,
            despachado_por: user?.id,
            peso_total_kg: sol.peso_total_kg,
            volumes_total: sol.volumes_total,
          })
        if (error) throw error

        // Criar recebimento pendente
        await supabase
          .from('log_recebimentos')
          .insert({ solicitacao_id: sol.id, status: 'pendente' })
      }

      // 3. Atualizar solicitações → em_transito
      await supabase
        .from('log_solicitacoes')
        .update({ status: 'em_transito', updated_at: agora })
        .eq('viagem_id', payload.viagemId)

      // 4. Atualizar viagem → em_transito
      await supabase
        .from('log_viagens')
        .update({
          status: 'em_transito',
          data_real_saida: agora,
          veiculo_placa: payload.placa,
          motorista_nome: payload.motorista_nome,
          motorista_telefone: payload.motorista_telefone,
          updated_at: agora,
        })
        .eq('id', payload.viagemId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['log_transportes'] })
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['log_recebimentos'] })
      qc.invalidateQueries({ queryKey: ['log_viagens'] })
    },
  })
}

export function useConfirmarEntregaFisica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ transporte_id, solicitacao_id, viagem_id }: {
      transporte_id: string; solicitacao_id: string; viagem_id?: string
    }) => {
      const agora = new Date().toISOString()

      // 1. Marcar transporte como chegou
      await supabase
        .from('log_transportes')
        .update({ hora_chegada: agora, updated_at: agora })
        .eq('id', transporte_id)

      // 2. Marcar solicitação como entregue
      await supabase
        .from('log_solicitacoes')
        .update({ status: 'entregue', updated_at: agora })
        .eq('id', solicitacao_id)

      // 3. Marcar recebimento
      await supabase
        .from('log_recebimentos')
        .update({ entregue_em: agora, updated_at: agora })
        .eq('solicitacao_id', solicitacao_id)

      // 4. Se faz parte de viagem, verificar se TODAS as paradas foram entregues
      if (viagem_id) {
        const { data: pendentes } = await supabase
          .from('log_transportes')
          .select('id')
          .eq('viagem_id', viagem_id)
          .is('hora_chegada', null)

        if (!pendentes || pendentes.length === 0) {
          // Todas entregues → viagem concluída
          await supabase
            .from('log_viagens')
            .update({ status: 'concluida', data_conclusao: agora, updated_at: agora })
            .eq('id', viagem_id)
        }
      }

      return { ok: true }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['log_transportes'] })
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['log_recebimentos'] })
      qc.invalidateQueries({ queryKey: ['log_viagens'] })
    },
  })
}

// ── Ocorrências ───────────────────────────────────────────────────────────────

export function useRegistrarOcorrencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      transporte_id: string
      solicitacao_id: string
      tipo: string
      descricao: string
      localizacao?: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('log_ocorrencias')
        .insert({ ...payload, registrado_por: user?.id, fotos: [] })
        .select()
        .single()
      if (error) throw error
      return data as LogOcorrencia
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['log_transportes'] }),
  })
}

export function useResolverOcorrencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, resolucao }: { id: string; resolucao: string }) => {
      const { data, error } = await supabase
        .from('log_ocorrencias')
        .update({ resolvido: true, resolucao, resolvido_em: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as LogOcorrencia
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['log_transportes'] }),
  })
}

// ── Recebimentos ──────────────────────────────────────────────────────────────

export function useRecebimentos(filtros?: { status?: string }) {
  return useQuery({
    queryKey: QK.recebimentos(filtros),
    queryFn: async () => {
      let q = supabase
        .from('log_recebimentos')
        .select(`
          *,
          solicitacao:log_solicitacoes(
            id, numero, tipo, origem, destino, obra_nome, solicitante_nome, urgente,
            transportadora:log_transportadoras(nome_fantasia)
          )
        `)
        .order('criado_em', { ascending: false })

      if (filtros?.status) q = q.eq('status', filtros.status)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as LogRecebimento[]
    },
  })
}

export function useConfirmarRecebimento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      solicitacao_id,
      checklist,
      status,
      divergencias,
      avaliacao_qualidade,
      observacoes,
    }: {
      id: string
      solicitacao_id: string
      checklist: {
        quantidades_conferidas: boolean
        estado_verificado: boolean
        seriais_conferidos: boolean
        temperatura_verificada: boolean
      }
      status: 'confirmado' | 'parcial' | 'recusado'
      divergencias?: string
      avaliacao_qualidade?: number
      observacoes?: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const agora = new Date().toISOString()

      const { data, error } = await supabase
        .from('log_recebimentos')
        .update({
          ...checklist,
          status,
          divergencias,
          avaliacao_qualidade,
          observacoes,
          confirmado_por: user?.id,
          confirmado_em: agora,
          assinatura_digital: `CONF-${Date.now().toString(36).toUpperCase()}`,
          updated_at: agora,
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      if (status === 'confirmado' || status === 'parcial') {
        await supabase
          .from('log_solicitacoes')
          .update({
            status: 'concluido' as const,
            updated_at: agora,
          })
          .eq('id', solicitacao_id)
      }

      return data as LogRecebimento
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['log_recebimentos'] })
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
    },
  })
}

// ── Transportadoras ───────────────────────────────────────────────────────────

export function useTransportadoras() {
  return useQuery({
    queryKey: QK.transportadoras(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('log_transportadoras')
        .select('*')
        .order('razao_social')
      if (error) throw error
      return (data ?? []) as LogTransportadora[]
    },
  })
}

export function useSalvarTransportadora() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (t: Partial<LogTransportadora>) => {
      const { id, ...rest } = t
      const { data, error } = id
        ? await supabase.from('log_transportadoras').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id).select().single()
        : await supabase.from('log_transportadoras').insert(rest).select().single()
      if (error) throw error
      return data as LogTransportadora
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.transportadoras() }),
  })
}

export function useAvaliarTransportadora() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      transportadora_id: string
      solicitacao_id?: string
      prazo: number
      qualidade: number
      comunicacao: number
      comentario?: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const media = (payload.prazo + payload.qualidade + payload.comunicacao) / 3

      const { data, error } = await supabase
        .from('log_avaliacoes')
        .insert({ ...payload, media: parseFloat(media.toFixed(2)), avaliado_por: user?.id })
        .select()
        .single()
      if (error) throw error
      return data as LogAvaliacao
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.transportadoras() }),
  })
}

// ── Rotas ─────────────────────────────────────────────────────────────────────

export function useRotas() {
  return useQuery({
    queryKey: QK.rotas(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('log_rotas')
        .select('*, transportadora:log_transportadoras(id, nome_fantasia)')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return (data ?? []) as LogRota[]
    },
  })
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

export function useLogisticaKPIs() {
  return useQuery({
    queryKey: QK.kpis(),
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10)

      const [solTotal, emTransito, entreguesHoje, confirmadosHoje, urgentes, nfeMes] =
        await Promise.all([
          supabase.from('log_solicitacoes').select('id', { count: 'exact', head: true }),
          supabase.from('log_solicitacoes').select('id', { count: 'exact', head: true }).eq('status', 'em_transito'),
          supabase.from('log_recebimentos').select('id', { count: 'exact', head: true })
            .gte('entregue_em', `${hoje}T00:00:00`).lte('entregue_em', `${hoje}T23:59:59`),
          supabase.from('log_recebimentos').select('id', { count: 'exact', head: true })
            .eq('status', 'confirmado').gte('confirmado_em', `${hoje}T00:00:00`),
          supabase.from('log_solicitacoes').select('id', { count: 'exact', head: true })
            .eq('urgente', true).not('status', 'in', '(concluido,cancelado,recusado)'),
          supabase.from('log_nfe').select('id', { count: 'exact', head: true })
            .eq('status', 'autorizada').gte('data_autorizacao', `${hoje.slice(0, 7)}-01`),
        ])

      const totalAbertas = await supabase
        .from('log_solicitacoes')
        .select('id', { count: 'exact', head: true })
        .in('status', ['solicitado', 'planejado', 'aguardando_aprovacao', 'aprovado', 'transporte_pendente', 'aguardando_coleta'])

      return {
        total_solicitacoes: solTotal.count ?? 0,
        abertas: totalAbertas.count ?? 0,
        em_transito: emTransito.count ?? 0,
        entregues_hoje: entreguesHoje.count ?? 0,
        confirmadas_hoje: confirmadosHoje.count ?? 0,
        urgentes_pendentes: urgentes.count ?? 0,
        nfe_emitidas_mes: nfeMes.count ?? 0,
        custo_total_mes: 0,
        taxa_entrega_prazo: 0,
        taxa_avarias: 0,
        tempo_medio_confirmacao_h: 0,
      } as LogisticaKPIs
    },
  })
}
