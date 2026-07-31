import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  LocImovel, LocEntrada, LocSaida, LocVistoria, LocVistoriaFoto,
  LocFatura, LocFaturaDesconto, LocSolicitacao, LocAcordo, LocAditivo,
  StatusEntrada, StatusSaida, StatusFatura, StatusVistoria, TipoVistoria,
  CriarEntradaPayload, CriarSolicitacaoPayload,
} from '../types/locacao'

const QK = {
  imoveis:      (f?: unknown) => ['loc_imoveis', f],
  imovel:       (id: string)  => ['loc_imovel', id],
  entradas:     (f?: unknown) => ['loc_entradas', f],
  entrada:      (id: string)  => ['loc_entrada', id],
  saidas:       (f?: unknown) => ['loc_saidas', f],
  saida:        (id: string)  => ['loc_saida', id],
  vistorias:    (f?: unknown) => ['loc_vistorias', f],
  vistoriaFotos:(id: string) => ['loc_vistoria_fotos', id],
  faturas:      (f?: unknown) => ['loc_faturas', f],
  solicitacoes: (f?: unknown) => ['loc_solicitacoes', f],
  acordos:      (f?: unknown) => ['loc_acordos', f],
  aditivos:     (f?: unknown) => ['loc_aditivos', f],
}

// ── Imoveis ───────────────────────────────────────────────────────────────────

export function useImoveis(filtros?: { status?: string }) {
  return useQuery({
    queryKey: QK.imoveis(filtros),
    queryFn: async () => {
      let q = supabase
        .from('loc_imoveis')
        .select(`*, centro_custo:sys_centros_custo(id, codigo, descricao), contrato:con_contratos!loc_imoveis_contrato_fk(id, numero, data_inicio, data_fim_previsto, data_assinatura, contraparte_nome, status)`)
        .order('created_at', { ascending: false })

      if (filtros?.status) q = q.eq('status', filtros.status)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as LocImovel[]
    },
  })
}

export function useImovel(id: string | undefined) {
  return useQuery({
    queryKey: QK.imovel(id!),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loc_imoveis')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as LocImovel
    },
  })
}

export function useCriarImovel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<LocImovel>) => {
      const { data, error } = await supabase
        .from('loc_imoveis')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as LocImovel
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loc_imoveis'] }),
  })
}

export function useAtualizarImovel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<LocImovel> & { id: string }) => {
      const { data, error } = await supabase
        .from('loc_imoveis')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as LocImovel
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['loc_imoveis'] })
      qc.invalidateQueries({ queryKey: ['loc_imovel', data.id] })
    },
  })
}

// ── Contas esperadas do imóvel ───────────────────────────────────────────────
// Define quais tipos de fatura a tela deve cobrar por mês naquele imóvel.
export function useSalvarFaturasEsperadas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ imovelId, tipos }: { imovelId: string; tipos: string[] | null }) => {
      const { error } = await supabase
        .from('loc_imoveis')
        .update({ faturas_esperadas: tipos, updated_at: new Date().toISOString() })
        .eq('id', imovelId)
      if (error) throw error
    },
    onSuccess: () => {
      ;['loc_imoveis', 'loc_alojamentos', 'loc_faturas'].forEach(k =>
        qc.invalidateQueries({ queryKey: [k] }))
    },
  })
}

// ── Entradas ──────────────────────────────────────────────────────────────────

export function useEntradas(filtros?: { status?: StatusEntrada }) {
  return useQuery({
    queryKey: QK.entradas(filtros),
    queryFn: async () => {
      let q = supabase
        .from('loc_entradas')
        .select(`*, imovel:loc_imoveis(id, descricao, endereco, cidade, uf, codigo, centro_custo_id, locador_nome, valor_aluguel_mensal), centro_custo:sys_centros_custo!loc_entradas_centro_custo_fk(id, codigo, descricao)`)
        .order('created_at', { ascending: false })

      if (filtros?.status) q = q.eq('status', filtros.status)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as LocEntrada[]
    },
  })
}

export function useEntrada(id: string | undefined) {
  return useQuery({
    queryKey: QK.entrada(id!),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loc_entradas')
        .select(`*, imovel:loc_imoveis(*), centro_custo:sys_centros_custo!loc_entradas_centro_custo_fk(id, codigo, descricao)`)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as LocEntrada
    },
  })
}

export function useCriarEntrada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CriarEntradaPayload) => {
      const { data, error } = await supabase
        .from('loc_entradas')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as LocEntrada
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loc_entradas'] }),
  })
}

export function useAtualizarStatusEntrada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusEntrada }) => {
      const { data, error } = await supabase
        .from('loc_entradas')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      // Fecha o ciclo do imóvel: 'liberado' => ativo; demais etapas => em_entrada.
      // (Não há trigger no banco; a sincronização é responsabilidade do app.)
      const imovelId = (data as { imovel_id?: string }).imovel_id
      if (imovelId) {
        await supabase
          .from('loc_imoveis')
          .update({ status: status === 'liberado' ? 'ativo' : 'em_entrada' })
          .eq('id', imovelId)
      }
      return data as LocEntrada
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loc_entradas'] })
      qc.invalidateQueries({ queryKey: ['loc_imoveis'] })
    },
  })
}

// ── Saidas ────────────────────────────────────────────────────────────────────

export function useSaidas(filtros?: { status?: StatusSaida }) {
  return useQuery({
    queryKey: QK.saidas(filtros),
    queryFn: async () => {
      let q = supabase
        .from('loc_saidas')
        .select(`*, imovel:loc_imoveis(id, descricao, endereco, cidade, uf, codigo, centro_custo_id, locador_nome, valor_aluguel_mensal, centro_custo:sys_centros_custo(id, codigo, descricao))`)
        .order('created_at', { ascending: false })

      if (filtros?.status) q = q.eq('status', filtros.status)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as LocSaida[]
    },
  })
}

export function useSaida(id: string | undefined) {
  return useQuery({
    queryKey: QK.saida(id!),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loc_saidas')
        .select(`*, imovel:loc_imoveis(*)`)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as LocSaida
    },
  })
}

export function useCriarSaida() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<LocSaida>) => {
      const { data, error } = await supabase
        .from('loc_saidas')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as LocSaida
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loc_saidas'] }),
  })
}

export function useAtualizarStatusSaida() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusSaida }) => {
      const { data, error } = await supabase
        .from('loc_saidas')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      // Fecha o ciclo do imóvel: 'encerrado' => inativo (devolvido); demais => em_saida.
      const imovelId = (data as { imovel_id?: string }).imovel_id
      if (imovelId) {
        await supabase
          .from('loc_imoveis')
          .update({ status: status === 'encerrado' ? 'inativo' : 'em_saida' })
          .eq('id', imovelId)
      }
      return data as LocSaida
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loc_saidas'] })
      qc.invalidateQueries({ queryKey: ['loc_imoveis'] })
    },
  })
}

// ── Vistorias ─────────────────────────────────────────────────────────────────

export function useVistorias(filtros?: { imovel_id?: string; tipo?: string }) {
  return useQuery({
    queryKey: QK.vistorias(filtros),
    queryFn: async () => {
      let q = supabase
        .from('loc_vistorias')
        .select(`*, imovel:loc_imoveis(id, descricao), itens:loc_vistoria_itens(*)`)
        .order('created_at', { ascending: false })

      if (filtros?.imovel_id) q = q.eq('imovel_id', filtros.imovel_id)
      if (filtros?.tipo) q = q.eq('tipo', filtros.tipo)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as LocVistoria[]
    },
  })
}

export function useCriarVistoria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      imovel_id: string; tipo: TipoVistoria; entrada_id?: string; saida_id?: string
    }) => {
      const { data, error } = await supabase
        .from('loc_vistorias')
        .insert({ ...payload, status: 'pendente' as StatusVistoria })
        .select()
        .single()
      if (error) throw error
      return data as LocVistoria
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loc_vistorias'] }),
  })
}

export function useAtualizarVistoria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string; status?: StatusVistoria; observacoes_gerais?: string
      tem_pendencias?: boolean; pdf_url?: string; data_vistoria?: string
    }) => {
      const { error } = await supabase.from('loc_vistorias').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loc_vistorias'] }),
  })
}

export function useSalvarVistoriaItens() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ vistoriaId, itens }: {
      vistoriaId: string
      itens: { ambiente: string; item: string; estado_entrada?: string; estado_saida?: string; observacao?: string; ordem: number }[]
    }) => {
      // Delete existing and re-insert
      await supabase.from('loc_vistoria_itens').delete().eq('vistoria_id', vistoriaId)
      if (itens.length > 0) {
        const rows = itens.map(it => ({ vistoria_id: vistoriaId, ...it }))
        const { error } = await supabase.from('loc_vistoria_itens').insert(rows)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loc_vistorias'] }),
  })
}

export function useUploadVistoriaFoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ vistoriaId, itemId, file, descricao, tipo }: {
      vistoriaId: string; itemId?: string; file: File; descricao?: string; tipo?: TipoVistoria
    }) => {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${vistoriaId}/${itemId || 'geral'}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('vistoria-fotos')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('vistoria-fotos').getPublicUrl(path)
      const { error: dbErr } = await supabase.from('loc_vistoria_fotos').insert({
        vistoria_id: vistoriaId, item_id: itemId || null, url: publicUrl, descricao, tipo,
      })
      if (dbErr) throw dbErr
      return publicUrl
    },
    onSuccess: (_d, { vistoriaId }) => qc.invalidateQueries({ queryKey: QK.vistoriaFotos(vistoriaId) }),
  })
}

export function useVistoriaFotos(vistoriaId?: string) {
  return useQuery({
    queryKey: QK.vistoriaFotos(vistoriaId || ''),
    queryFn: async () => {
      if (!vistoriaId) return []
      const { data, error } = await supabase
        .from('loc_vistoria_fotos')
        .select('*')
        .eq('vistoria_id', vistoriaId)
        .order('created_at')
      if (error) throw error
      return (data ?? []) as LocVistoriaFoto[]
    },
    enabled: !!vistoriaId,
  })
}

// ── Faturas ───────────────────────────────────────────────────────────────────

export function useFaturas(filtros?: { imovel_id?: string; status?: StatusFatura }) {
  return useQuery({
    queryKey: QK.faturas(filtros),
    queryFn: async () => {
      let q = supabase
        .from('loc_faturas')
        .select(`*, imovel:loc_imoveis(id, descricao, cidade)`)
        .order('vencimento', { ascending: true })

      if (filtros?.imovel_id) q = q.eq('imovel_id', filtros.imovel_id)
      if (filtros?.status) q = q.eq('status', filtros.status)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as LocFatura[]
    },
  })
}

export function useCriarFatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<LocFatura>) => {
      const { error } = await supabase.from('loc_faturas').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.faturas() })
    },
  })
}

export function useAtualizarFatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<LocFatura> & { id: string }) => {
      const { data, error } = await supabase
        .from('loc_faturas')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as LocFatura
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loc_faturas'] }),
  })
}

// ── Descontos da fatura (ex.: desconto no aluguel) ──────────────────────────
// Cada desconto tem descrição + valor + anexo OBRIGATÓRIO. O valor líquido
// (fatura − descontos) é o que a RPC de envio manda pro Financeiro.
export function useDescontosFatura(faturaId?: string) {
  return useQuery({
    queryKey: ['loc_fatura_descontos', faturaId],
    enabled: !!faturaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loc_fatura_descontos')
        .select('*')
        .eq('fatura_id', faturaId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as LocFaturaDesconto[]
    },
  })
}

// upload do anexo do desconto (bucket privado locacao-faturas, pasta descontos/)
export async function uploadDescontoAnexo(faturaId: string, file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `descontos/${faturaId}/${Date.now()}_${safe}`
  const { error } = await supabase.storage.from(FATURAS_BUCKET).upload(path, file, {
    upsert: true, contentType: file.type || undefined,
  })
  if (error) throw error
  return path
}

export function useCriarDescontoFatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { fatura_id: string; descricao: string; valor: number; anexo_url: string; criado_por_nome?: string }) => {
      const { error } = await supabase.from('loc_fatura_descontos').insert(p)
      if (error) throw error
    },
    onSuccess: (_d, { fatura_id }) => {
      qc.invalidateQueries({ queryKey: ['loc_fatura_descontos', fatura_id] })
      qc.invalidateQueries({ queryKey: ['loc_faturas'] })
    },
  })
}

export function useRemoverDescontoFatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, fatura_id, anexo_url }: { id: string; fatura_id: string; anexo_url?: string }) => {
      if (anexo_url && !/^https?:\/\//.test(anexo_url)) {
        await supabase.storage.from(FATURAS_BUCKET).remove([anexo_url])
      }
      const { error } = await supabase.from('loc_fatura_descontos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, { fatura_id }) => {
      qc.invalidateQueries({ queryKey: ['loc_fatura_descontos', fatura_id] })
      qc.invalidateQueries({ queryKey: ['loc_faturas'] })
    },
  })
}

// Envia faturas selecionadas pro financeiro (RPC migrations 124 + 147).
// Cria 1 fin_contas_pagar por fatura elegivel (status previsto/lancado) com
// loc_fatura_id vinculado, e muda status da fatura pra enviado_pagamento.
// Pula faturas ja enviadas (mesma fatura nao gera CP duplicado).
export function useEnviarFaturasFinanceiro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ faturaIds }: { faturaIds: string[] }) => {
      const { data, error } = await supabase.rpc('loc_enviar_faturas_financeiro', {
        p_fatura_ids: faturaIds,
      })
      if (error) throw error
      return data as {
        enviadas: number
        puladas: number
        motivos?: { fatura_id: string; motivo: string }[]
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loc_faturas'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['cps-para-pagamento'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
      qc.invalidateQueries({ queryKey: ['loc-fatura-resumo'] })
    },
  })
}

// Gera faturas mensais (aluguel + iptu + condominio + energia + agua + internet)
// para todos os imoveis ativos. Idempotente: nao re-cria se ja existe (imovel, tipo, mes).
// Aluguel e o unico lancamento previsivel (valor e vencimento estao no contrato).
// Gera de uma vez ate o fim de cada contrato. NAO cria energia/agua/internet:
// conta de concessionaria so existe quando chega, e linha zerada faz
// 'este imovel nao tem' parecer 'esta faltando'.
export function useGerarAlugueis() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ de }: { de: string }) => {
      const { data, error } = await supabase.rpc('loc_gerar_alugueis', { p_de: de })
      if (error) throw error
      return data as { ok: boolean; criadas: number; imoveis: number; de: string; erro?: string }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loc_faturas'] }),
  })
}

export function useGerarFaturasMes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ competencia }: { competencia: string }) => {
      const { data, error } = await supabase.rpc('loc_gerar_faturas_mes', {
        p_competencia: competencia,
      })
      if (error) throw error
      return data as {
        ok: boolean
        competencia: string
        imoveis_ativos: number
        criadas: number
        puladas_existentes: number
        erro?: string
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loc_faturas'] })
      qc.invalidateQueries({ queryKey: ['loc-fatura-resumo'] })
    },
  })
}

// Desfaz envio de fatura: volta status para 'lancado' e deleta CP previsto.
// Bloqueia se CP ja tem pagamento.
export function useCancelarEnvioFatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ faturaId }: { faturaId: string }) => {
      const { data, error } = await supabase.rpc('loc_cancelar_envio_fatura', {
        p_fatura_id: faturaId,
      })
      if (error) throw error
      return data as { ok: boolean; erro?: string; fatura_id?: string; cp_deletado?: string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loc_faturas'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['cps-para-pagamento'] })
      qc.invalidateQueries({ queryKey: ['loc-fatura-resumo'] })
    },
  })
}

// Resumo de uma loc_fatura p/ badge no Painel de Pagamentos (imovel/competencia)
export function useLocFaturaResumo(locFaturaId?: string) {
  return useQuery({
    queryKey: ['loc-fatura-resumo', locFaturaId],
    enabled: !!locFaturaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loc_faturas')
        .select(`
          id, competencia, tipo,
          imovel:loc_imoveis(id, codigo, descricao, endereco, numero, cidade)
        `)
        .eq('id', locFaturaId!)
        .maybeSingle()
      if (error) throw error
      return data as {
        id: string
        competencia: string | null
        tipo: string
        imovel: { id: string; codigo: string | null; descricao: string | null; endereco: string | null; numero: string | null; cidade: string | null } | null
      } | null
    },
    retry: false,
  })
}

// ── Solicitacoes ──────────────────────────────────────────────────────────────

export function useSolicitacoesLocacao(filtros?: { status?: string; tipo?: string; imovel_id?: string }) {
  return useQuery({
    queryKey: QK.solicitacoes(filtros),
    queryFn: async () => {
      let q = supabase
        .from('loc_solicitacoes')
        .select(`*, imovel:loc_imoveis(id, descricao, cidade)`)
        .order('created_at', { ascending: false })

      if (filtros?.status) q = q.eq('status', filtros.status)
      if (filtros?.tipo) q = q.eq('tipo', filtros.tipo)
      if (filtros?.imovel_id) q = q.eq('imovel_id', filtros.imovel_id)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as LocSolicitacao[]
    },
  })
}

export function useCriarSolicitacaoLocacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CriarSolicitacaoPayload) => {
      const { data, error } = await supabase
        .from('loc_solicitacoes')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as LocSolicitacao
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loc_solicitacoes'] }),
  })
}

export function useAtualizarSolicitacaoLocacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<LocSolicitacao>) => {
      const { data, error } = await supabase
        .from('loc_solicitacoes')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as LocSolicitacao
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loc_solicitacoes'] }),
  })
}

// ── Acordos ───────────────────────────────────────────────────────────────────

export function useAcordos(filtros?: { imovel_id?: string }) {
  return useQuery({
    queryKey: QK.acordos(filtros),
    queryFn: async () => {
      let q = supabase
        .from('loc_acordos')
        .select(`*, imovel:loc_imoveis(id, descricao)`)
        .order('created_at', { ascending: false })

      if (filtros?.imovel_id) q = q.eq('imovel_id', filtros.imovel_id)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as LocAcordo[]
    },
  })
}

// ── Aditivos ──────────────────────────────────────────────────────────────────

export function useAditivos(filtros?: { imovel_id?: string }) {
  return useQuery({
    queryKey: QK.aditivos(filtros),
    queryFn: async () => {
      let q = supabase
        .from('loc_aditivos')
        .select(`*, imovel:loc_imoveis(id, descricao, endereco, numero, cidade)`)
        .order('created_at', { ascending: false })

      if (filtros?.imovel_id) q = q.eq('imovel_id', filtros.imovel_id)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as LocAditivo[]
    },
  })
}

export function useCriarAditivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<LocAditivo>) => {
      const { data, error } = await supabase
        .from('loc_aditivos')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as LocAditivo
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loc_aditivos'] }),
  })
}

// Avança o status do aditivo e, ao assinar, aplica o efeito no contrato/imóvel:
//  - renovacao: estende a data_fim_previsto do contrato
//  - reajuste:  atualiza o valor do imóvel (valor_aluguel_mensal) e do contrato (valor_mensal)
export function useAtualizarStatusAditivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'rascunho' | 'aguardando_assinatura' | 'assinado' }) => {
      const { data, error } = await supabase
        .from('loc_aditivos')
        .update({ status })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      const ad = data as {
        tipo?: string; imovel_id?: string; con_contrato_id?: string
        data_fim?: string; valor_novo?: number
      }
      if (status === 'assinado') {
        if (ad.tipo === 'renovacao' && ad.data_fim && ad.con_contrato_id) {
          await supabase.from('con_contratos')
            .update({ data_fim_previsto: ad.data_fim }).eq('id', ad.con_contrato_id)
        }
        if (ad.tipo === 'reajuste' && ad.valor_novo != null) {
          if (ad.imovel_id) {
            await supabase.from('loc_imoveis')
              .update({ valor_aluguel_mensal: ad.valor_novo }).eq('id', ad.imovel_id)
          }
          if (ad.con_contrato_id) {
            await supabase.from('con_contratos')
              .update({ valor_mensal: ad.valor_novo }).eq('id', ad.con_contrato_id)
          }
        }
      }
      return data as LocAditivo
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loc_aditivos'] })
      qc.invalidateQueries({ queryKey: ['loc_imoveis'] })
      qc.invalidateQueries({ queryKey: ['contratos'] })
    },
  })
}

// ── Lançamento de faturas por anexo (IA via n8n) ──────────────────────────────
// Envia os arquivos (base64) ao webhook n8n "Locacao - Parse Faturas AI" (Gemini),
// que identifica tipo (energia/água/...), valor, vencimento e competência de cada
// documento — 1 arquivo = 1 fatura. O arquivo fica no bucket privado
// locacao-faturas e o path é gravado em loc_faturas.boleto_url.

const N8N_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'
const FATURAS_BUCKET = 'locacao-faturas'

export interface FaturaParseada {
  doc: number
  tipo: string
  valor: number | null
  vencimento: string
  competencia: string
  fornecedor: string
  confianca: number
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = reader.result as string
      resolve(res.includes(',') ? res.split(',')[1] : res)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const MAX_DOC_BYTES = 10 * 1024 * 1024   // anexo individual > 10MB não passa
const MAX_TOTAL_B64 = 14 * 1024 * 1024   // limite do payload do n8n (~16MB)

export async function parseFaturasAnexos(
  files: File[],
  contexto: { competencia?: string; imovel?: string },
): Promise<FaturaParseada[]> {
  let totalB64 = 0
  const documentos: { nome: string; mime_type: string; base64: string }[] = []
  for (const f of files) {
    if (f.size > MAX_DOC_BYTES) {
      throw new Error(`"${f.name}" tem mais de 10MB — reduza o arquivo (foto menor ou PDF compactado)`)
    }
    const base64 = await fileToBase64(f)
    totalB64 += base64.length
    if (totalB64 > MAX_TOTAL_B64) {
      throw new Error('Os anexos juntos passam de ~14MB — envie em lotes menores')
    }
    documentos.push({ nome: f.name, mime_type: f.type || 'application/pdf', base64 })
  }
  const resp = await fetch(`${N8N_URL}/locacao/faturas/parse-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentos, contexto }),
  })
  if (!resp.ok) throw new Error('IA indisponível no momento — tente novamente')
  const json = await resp.json() as { success?: boolean; error?: string; faturas?: FaturaParseada[] }
  if (!json?.success) throw new Error(json?.error || 'Falha ao analisar os anexos')
  return json.faturas ?? []
}

export async function uploadFaturaAnexo(imovelId: string, competencia: string, file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${imovelId}/${competencia}/${Date.now()}_${safe}`
  const { error } = await supabase.storage.from(FATURAS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  })
  if (error) throw error
  return path
}

// URL p/ abrir o anexo: path do bucket privado (signed 1h) ou URL http legada
export async function faturaAnexoUrl(pathOrUrl?: string): Promise<string | null> {
  if (!pathOrUrl) return null
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl
  const { data } = await supabase.storage.from(FATURAS_BUCKET).createSignedUrl(pathOrUrl, 3600)
  return data?.signedUrl ?? null
}

// Apaga o arquivo do bucket (ignora URLs http legadas de fora do bucket)
export async function removerFaturaAnexoStorage(path?: string) {
  if (path && !/^https?:\/\//.test(path)) {
    await supabase.storage.from(FATURAS_BUCKET).remove([path])
  }
}

// Exclui a fatura (e o anexo dela no bucket, se houver)
export function useExcluirFatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, boleto_url }: { id: string; boleto_url?: string }) => {
      await removerFaturaAnexoStorage(boleto_url)
      const { error } = await supabase.from('loc_faturas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loc_faturas'] }),
  })
}

// ── KPIs / Dashboard ──────────────────────────────────────────────────────────

export function useLocacaoKPIs() {
  return useQuery({
    queryKey: ['loc_kpis'],
    queryFn: async () => {
      const today = new Date()
      const sevenDaysFromNow = new Date(today)
      sevenDaysFromNow.setDate(today.getDate() + 7)
      const sixtyDaysFromNow = new Date(today)
      sixtyDaysFromNow.setDate(today.getDate() + 60)

      const [imoveisRes, faturasRes, solicitacoesRes, aditivosRes] = await Promise.all([
        supabase.from('loc_imoveis').select('id, status, valor_aluguel_mensal'),
        supabase.from('loc_faturas').select('id, status, vencimento').lte('vencimento', sevenDaysFromNow.toISOString().split('T')[0]).neq('status', 'pago'),
        supabase.from('loc_solicitacoes').select('id, status').in('status', ['aberta', 'em_andamento']),
        supabase.from('loc_aditivos').select('id, data_fim').lte('data_fim', sixtyDaysFromNow.toISOString().split('T')[0]).gte('data_fim', today.toISOString().split('T')[0]),
      ])

      const imoveis = imoveisRes.data ?? []
      const ativos = imoveis.filter(i => i.status === 'ativo')
      const valorTotalMensal = ativos.reduce((sum, i) => sum + (i.valor_aluguel_mensal ?? 0), 0)

      return {
        imoveisAtivos: ativos.length,
        faturasVencendo: (faturasRes.data ?? []).length,
        manutencoesAbertas: (solicitacoesRes.data ?? []).length,
        contratosExpirando: (aditivosRes.data ?? []).length,
        valorTotalMensal,
      }
    },
  })
}
