// ─────────────────────────────────────────────────────────────────────────────
// hooks/useFrotas.ts — Módulo Manutenção e Uso de Frotas
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  FroVeiculo, FroFornecedor, FroOrdemServico, FroItemOS,
  FroCotacaoOS, FroChecklist, FroAbastecimento,
  FroOcorrenciaTel, FroAvaliacaoFornecedor, FroPlanoPreventiva,
  FrotasKPIs,
  StatusVeiculo, CategoriaVeiculo,
  StatusOS, PrioridadeOS, StatusOcorrenciaTel, TipoChecklist,
  CriarOSPayload, CriarChecklistPayload, RegistrarAbastecimentoPayload,
} from '../types/frotas'

// ── Veículos ──────────────────────────────────────────────────────────────────

export function useVeiculos(filtros?: { status?: StatusVeiculo; categoria?: CategoriaVeiculo }) {
  return useQuery({
    queryKey: ['fro_veiculos', filtros],
    queryFn: async () => {
      let q = supabase.from('fro_veiculos').select('*').order('placa')
      if (filtros?.status)    q = q.eq('status', filtros.status)
      if (filtros?.categoria) q = q.eq('categoria', filtros.categoria)
      const { data, error } = await q
      if (error) throw error
      return data as FroVeiculo[]
    },
  })
}

export function useSalvarVeiculo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: Partial<FroVeiculo> & { id?: string }) => {
      const { id, created_at, updated_at, ...payload } = v
      if (id) {
        const { error } = await supabase.from('fro_veiculos').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('fro_veiculos').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fro_veiculos'] }),
  })
}

// ── Ordens de Serviço ─────────────────────────────────────────────────────────

export function useOrdensServico(filtros?: { status?: StatusOS | StatusOS[]; prioridade?: PrioridadeOS }) {
  return useQuery({
    queryKey: ['fro_os', filtros],
    queryFn: async () => {
      let q = supabase
        .from('fro_ordens_servico')
        .select('*, veiculo:fro_veiculos(id,placa,marca,modelo,status), fornecedor:fro_fornecedores(id,razao_social,nome_fantasia,tipo)')
        .order('prioridade', { ascending: true })
        .order('created_at', { ascending: false })

      if (filtros?.status) {
        if (Array.isArray(filtros.status)) q = q.in('status', filtros.status)
        else q = q.eq('status', filtros.status)
      }
      if (filtros?.prioridade) q = q.eq('prioridade', filtros.prioridade)

      const { data, error } = await q
      if (error) throw error
      return data as FroOrdemServico[]
    },
  })
}

export function useOrdemServico(id: string) {
  return useQuery({
    queryKey: ['fro_os_detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fro_ordens_servico')
        .select(`
          *,
          veiculo:fro_veiculos(id,placa,marca,modelo,status,hodometro_atual),
          fornecedor:fro_fornecedores(id,razao_social,nome_fantasia,tipo),
          itens:fro_itens_os(*),
          cotacoes:fro_cotacoes_os(*, fornecedor:fro_fornecedores(id,razao_social,nome_fantasia,avaliacao_media))
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as FroOrdemServico
    },
    enabled: !!id,
  })
}

export function useCriarOS() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CriarOSPayload) => {
      const { itens, ...osData } = payload
      const { data: os, error } = await supabase
        .from('fro_ordens_servico')
        .insert(osData)
        .select()
        .single()
      if (error) throw error

      if (itens?.length) {
        const { error: eItem } = await supabase
          .from('fro_itens_os')
          .insert(itens.map(i => ({ ...i, os_id: os.id })))
        if (eItem) throw eItem
      }

      // Bloqueio imediato para OS crítica
      if (osData.prioridade === 'critica') {
        await supabase
          .from('fro_veiculos')
          .update({ status: 'bloqueado' })
          .eq('id', osData.veiculo_id)
      } else {
        await supabase
          .from('fro_veiculos')
          .update({ status: 'em_manutencao' })
          .eq('id', osData.veiculo_id)
      }

      return os
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fro_os'] })
      qc.invalidateQueries({ queryKey: ['fro_veiculos'] })
    },
  })
}

export function useAtualizarStatusOS() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; status: StatusOS; extra?: Record<string, unknown> }) => {
      const { error } = await supabase
        .from('fro_ordens_servico')
        .update({ status: params.status, ...params.extra })
        .eq('id', params.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fro_os'] })
      qc.invalidateQueries({ queryKey: ['fro_os_detail'] })
    },
  })
}

export function useAprovarOS() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      id: string
      aprovado: boolean
      valor?: number
      motivo?: string
      userId?: string
    }) => {
      if (params.aprovado) {
        const { error } = await supabase.from('fro_ordens_servico').update({
          status: 'aprovada',
          valor_aprovado: params.valor,
          aprovado_por: params.userId,
          aprovado_em: new Date().toISOString(),
        }).eq('id', params.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('fro_ordens_servico').update({
          status: 'rejeitada',
          motivo_rejeicao: params.motivo,
          rejeitado_por: params.userId,
        }).eq('id', params.id)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fro_os'] }),
  })
}

export function useConcluirOS() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      id: string
      veiculo_id: string
      hodometro_saida?: number
      valor_final?: number
      descricao_servico?: string
    }) => {
      const { error } = await supabase.from('fro_ordens_servico').update({
        status: 'concluida',
        hodometro_saida: params.hodometro_saida,
        valor_final: params.valor_final,
        descricao_servico: params.descricao_servico,
        data_conclusao: new Date().toISOString(),
        checklist_saida_ok: true,
      }).eq('id', params.id)
      if (error) throw error

      await supabase.from('fro_veiculos').update({
        status: 'disponivel',
        ...(params.hodometro_saida ? { hodometro_atual: params.hodometro_saida } : {}),
      }).eq('id', params.veiculo_id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fro_os'] })
      qc.invalidateQueries({ queryKey: ['fro_veiculos'] })
    },
  })
}

// ── Cotações da OS ────────────────────────────────────────────────────────────

export function useCotacoesOS(osId: string) {
  return useQuery({
    queryKey: ['fro_cotacoes', osId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fro_cotacoes_os')
        .select('*, fornecedor:fro_fornecedores(id,razao_social,nome_fantasia,avaliacao_media)')
        .eq('os_id', osId)
        .order('valor_total')
      if (error) throw error
      return data as FroCotacaoOS[]
    },
    enabled: !!osId,
  })
}

export function useSalvarCotacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: Omit<FroCotacaoOS, 'id' | 'selecionado' | 'created_at' | 'fornecedor'>) => {
      const { error } = await supabase.from('fro_cotacoes_os').insert({ ...c, selecionado: false })
      if (error) throw error
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['fro_cotacoes', v.os_id] }),
  })
}

export function useSelecionarCotacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { cotacaoId: string; osId: string; fornecedorId: string; valor: number }) => {
      await supabase.from('fro_cotacoes_os').update({ selecionado: false }).eq('os_id', params.osId)
      await supabase.from('fro_cotacoes_os').update({ selecionado: true }).eq('id', params.cotacaoId)
      const { error } = await supabase.from('fro_ordens_servico').update({
        fornecedor_id: params.fornecedorId,
        valor_orcado: params.valor,
        status: 'aguardando_aprovacao',
      }).eq('id', params.osId)
      if (error) throw error
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['fro_cotacoes', v.osId] })
      qc.invalidateQueries({ queryKey: ['fro_os'] })
    },
  })
}

// ── Checklists ────────────────────────────────────────────────────────────────

export function useChecklists(filtros?: {
  data?: string
  veiculo_id?: string
  tipo?: TipoChecklist
  limit?: number
}) {
  return useQuery({
    queryKey: ['fro_checklists', filtros],
    queryFn: async () => {
      let q = supabase
        .from('fro_checklists')
        .select('*, veiculo:fro_veiculos(id,placa,marca,modelo)')
        .order('data_checklist', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(filtros?.limit ?? 100)

      if (filtros?.data)       q = q.eq('data_checklist', filtros.data)
      if (filtros?.veiculo_id) q = q.eq('veiculo_id', filtros.veiculo_id)
      if (filtros?.tipo)       q = q.eq('tipo', filtros.tipo)

      const { data, error } = await q
      if (error) throw error
      return data as FroChecklist[]
    },
  })
}

export function useCriarChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CriarChecklistPayload) => {
      const todosOk =
        payload.nivel_oleo_ok && payload.nivel_agua_ok &&
        payload.calibragem_pneus_ok && payload.lanternas_ok &&
        payload.freios_ok && payload.documentacao_ok && payload.limpeza_ok

      const { data, error } = await supabase
        .from('fro_checklists')
        .insert({
          ...payload,
          data_checklist: payload.data_checklist ?? new Date().toISOString().split('T')[0],
          assinado_em: new Date().toISOString(),
          liberado: todosOk,
        })
        .select()
        .single()
      if (error) throw error

      if (todosOk && payload.tipo === 'pre_viagem') {
        await supabase
          .from('fro_veiculos')
          .update({ status: 'em_uso', ...(payload.hodometro ? { hodometro_atual: payload.hodometro } : {}) })
          .eq('id', payload.veiculo_id)
      }

      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fro_checklists'] })
      qc.invalidateQueries({ queryKey: ['fro_veiculos'] })
    },
  })
}

// ── Abastecimentos ────────────────────────────────────────────────────────────

export function useAbastecimentos(filtros?: { veiculo_id?: string; mes?: string }) {
  return useQuery({
    queryKey: ['fro_abastecimentos', filtros],
    queryFn: async () => {
      let q = supabase
        .from('fro_abastecimentos')
        .select('*, veiculo:fro_veiculos(id,placa,marca,modelo)')
        .order('data_abastecimento', { ascending: false })
        .limit(200)

      if (filtros?.veiculo_id) q = q.eq('veiculo_id', filtros.veiculo_id)
      if (filtros?.mes) {
        const inicio = filtros.mes + '-01'
        const fim   = filtros.mes + '-31'
        q = q.gte('data_abastecimento', inicio).lte('data_abastecimento', fim)
      }

      const { data, error } = await q
      if (error) throw error
      return data as FroAbastecimento[]
    },
  })
}

export function useRegistrarAbastecimento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: RegistrarAbastecimentoPayload) => {
      const { data: hist } = await supabase
        .from('fro_abastecimentos')
        .select('hodometro, litros, km_litro')
        .eq('veiculo_id', payload.veiculo_id)
        .order('hodometro', { ascending: false })
        .limit(5)

      let km_litro: number | undefined
      let desvio_detectado = false
      let percentual_desvio: number | undefined

      const ultimo = hist?.[0]
      if (ultimo && payload.hodometro > ultimo.hodometro && payload.litros > 0) {
        km_litro = (payload.hodometro - ultimo.hodometro) / payload.litros
        const medias = (hist ?? []).filter(h => h.km_litro).map(h => h.km_litro as number)
        if (medias.length > 0) {
          const media_hist = medias.reduce((s, v) => s + v, 0) / medias.length
          if (km_litro < media_hist * 0.85) {
            desvio_detectado = true
            percentual_desvio = ((media_hist - km_litro) / media_hist) * 100
          }
        }
      }

      const valor_total = payload.litros * payload.valor_litro

      const { error } = await supabase.from('fro_abastecimentos').insert({
        ...payload,
        valor_total,
        km_litro,
        desvio_detectado,
        percentual_desvio,
      })
      if (error) throw error

      await supabase
        .from('fro_veiculos')
        .update({ hodometro_atual: payload.hodometro })
        .eq('id', payload.veiculo_id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fro_abastecimentos'] })
      qc.invalidateQueries({ queryKey: ['fro_veiculos'] })
    },
  })
}

// ── Ocorrências de Telemetria ─────────────────────────────────────────────────

export function useOcorrenciasTel(filtros?: { status?: StatusOcorrenciaTel }) {
  return useQuery({
    queryKey: ['fro_ocorrencias', filtros],
    queryFn: async () => {
      let q = supabase
        .from('fro_ocorrencias_telemetria')
        .select('*, veiculo:fro_veiculos(id,placa,marca,modelo)')
        .order('data_ocorrencia', { ascending: false })
        .limit(300)

      if (filtros?.status) q = q.eq('status', filtros.status)

      const { data, error } = await q
      if (error) throw error
      return data as FroOcorrenciaTel[]
    },
  })
}

export function useRegistrarOcorrencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<FroOcorrenciaTel>) => {
      const { error } = await supabase.from('fro_ocorrencias_telemetria').insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fro_ocorrencias'] }),
  })
}

export function useAtualizarOcorrencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; status: StatusOcorrenciaTel; observacoes?: string }) => {
      const extra: Record<string, unknown> = {}
      if (params.status === 'analisada')    extra.analisado_em    = new Date().toISOString()
      if (params.status === 'comunicado_rh') extra.rh_comunicado_em = new Date().toISOString()
      if (params.status === 'encerrada')    extra.encerrado_em    = new Date().toISOString()

      const { error } = await supabase
        .from('fro_ocorrencias_telemetria')
        .update({ status: params.status, observacoes: params.observacoes, ...extra })
        .eq('id', params.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fro_ocorrencias'] }),
  })
}

// ── Fornecedores ──────────────────────────────────────────────────────────────

export function useFornecedoresFrotas(apenasAtivos = true) {
  return useQuery({
    queryKey: ['fro_fornecedores', apenasAtivos],
    queryFn: async () => {
      let q = supabase.from('fro_fornecedores').select('*').order('razao_social')
      if (apenasAtivos) q = q.eq('ativo', true)
      const { data, error } = await q
      if (error) throw error
      return data as FroFornecedor[]
    },
  })
}

export function useSalvarFornecedorFrotas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (f: Partial<FroFornecedor> & { id?: string }) => {
      const { id, avaliacao_media, created_at, updated_at, ...payload } = f
      if (id) {
        const { error } = await supabase.from('fro_fornecedores').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('fro_fornecedores').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fro_fornecedores'] }),
  })
}

export function useAvaliarFornecedorFrotas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (av: Omit<FroAvaliacaoFornecedor, 'id' | 'created_at'>) => {
      const { error } = await supabase.from('fro_avaliacoes_fornecedor').insert(av)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fro_fornecedores'] })
      qc.invalidateQueries({ queryKey: ['fro_os'] })
    },
  })
}

// ── Planos Preventivos ────────────────────────────────────────────────────────

export function usePlanosPreventiva(veiculoId?: string) {
  return useQuery({
    queryKey: ['fro_planos', veiculoId],
    queryFn: async () => {
      let q = supabase.from('fro_planos_preventiva').select('*').eq('ativo', true)
      if (veiculoId) q = q.eq('veiculo_id', veiculoId)
      const { data, error } = await q
      if (error) throw error
      return data as FroPlanoPreventiva[]
    },
  })
}

export function useSalvarPlanoPreventiva() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: Partial<FroPlanoPreventiva> & { id?: string }) => {
      const { id, created_at, updated_at, ...payload } = p
      if (id) {
        const { error } = await supabase.from('fro_planos_preventiva').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('fro_planos_preventiva').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['fro_planos', v.veiculo_id] }),
  })
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

export function useFrotasKPIs() {
  return useQuery({
    queryKey: ['fro_kpis'],
    queryFn: async () => {
      const hoje      = new Date().toISOString().split('T')[0]
      const em7d      = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
      const inicioMes = hoje.slice(0, 7) + '-01'

      const [vsRes, osRes, abastRes, manutCustoRes, otelRes, prevRes] = await Promise.all([
        supabase.from('fro_veiculos').select('status').neq('status', 'baixado'),
        supabase.from('fro_ordens_servico').select('status, prioridade')
          .in('status', ['aberta','em_cotacao','aguardando_aprovacao','aprovada','em_execucao']),
        supabase.from('fro_abastecimentos').select('valor_total')
          .gte('data_abastecimento', inicioMes),
        supabase.from('fro_ordens_servico').select('valor_final')
          .eq('status', 'concluida').gte('data_abertura', inicioMes),
        supabase.from('fro_ocorrencias_telemetria').select('status')
          .in('status', ['registrada','analisada']),
        supabase.from('fro_veiculos')
          .select('data_proxima_preventiva, km_proxima_preventiva, hodometro_atual')
          .neq('status', 'baixado'),
      ])

      const vs = vsRes.data ?? []
      const os = osRes.data ?? []
      const total       = vs.length
      const disponiveis = vs.filter(v => v.status === 'disponivel').length
      const em_uso      = vs.filter(v => v.status === 'em_uso').length
      const em_manu     = vs.filter(v => v.status === 'em_manutencao').length
      const bloqueados  = vs.filter(v => v.status === 'bloqueado').length

      const prevs = prevRes.data ?? []
      const preventivas_vencidas   = prevs.filter(v =>
        (v.data_proxima_preventiva && v.data_proxima_preventiva < hoje) ||
        (v.km_proxima_preventiva   && v.km_proxima_preventiva  <= v.hodometro_atual)
      ).length
      const preventivas_proximas_7d = prevs.filter(v =>
        v.data_proxima_preventiva &&
        v.data_proxima_preventiva >= hoje &&
        v.data_proxima_preventiva <= em7d
      ).length

      return {
        total_veiculos: total,
        disponiveis,
        em_manutencao: em_manu,
        em_uso,
        bloqueados,
        taxa_disponibilidade: total ? Math.round((disponiveis / total) * 100) : 0,
        os_abertas:           os.length,
        os_criticas:          os.filter(o => o.prioridade === 'critica').length,
        preventivas_vencidas,
        preventivas_proximas_7d,
        abastecimentos_mes:     (abastRes.data ?? []).length,
        custo_manutencao_mes:   (manutCustoRes.data ?? []).reduce((s, o) => s + (o.valor_final ?? 0), 0),
        custo_abastecimento_mes:(abastRes.data ?? []).reduce((s, a) => s + (a.valor_total ?? 0), 0),
        ocorrencias_abertas:    (otelRes.data ?? []).length,
      } as FrotasKPIs
    },
  })
}
