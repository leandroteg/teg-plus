import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  LocImovel, LocEntrada, LocSaida, LocVistoria, LocVistoriaFoto,
  LocFatura, LocSolicitacao, LocAcordo, LocAditivo,
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
      return data as LocEntrada
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loc_entradas'] })
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
      return data as LocSaida
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loc_saidas'] })
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

// ── Solicitacoes ──────────────────────────────────────────────────────────────

export function useSolicitacoesLocacao(filtros?: { status?: string; tipo?: string }) {
  return useQuery({
    queryKey: QK.solicitacoes(filtros),
    queryFn: async () => {
      let q = supabase
        .from('loc_solicitacoes')
        .select(`*, imovel:loc_imoveis(id, descricao, cidade)`)
        .order('created_at', { ascending: false })

      if (filtros?.status) q = q.eq('status', filtros.status)
      if (filtros?.tipo) q = q.eq('tipo', filtros.tipo)

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
        .select(`*, imovel:loc_imoveis(id, descricao)`)
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
