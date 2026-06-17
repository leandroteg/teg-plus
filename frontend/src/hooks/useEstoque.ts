import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  EstBase, EstItem, EstSaldo, EstMovimentacao, EstSolicitacao,
  EstInventario, EstInventarioItem, EstoqueKPIs, NovaMovimentacaoPayload,
  EstoqueEntradaItem, EstoqueMovimentacaoItem,
} from '../types/estoque'
import { normalizeUnidade } from '../constants/unidades'

// ── Catalog search (for RC item autocomplete) ────────────────────────────────
export function useItemCatalogSearch(categoriaRC: string, categoriasEstoque: string[], search: string) {
  return useQuery<EstItem[]>({
    queryKey: ['est-itens-catalog', categoriaRC, categoriasEstoque, search],
    enabled: !!categoriaRC,
    queryFn: async () => {
      // Case-insensitive search across descricao, descricao_complementar, and codigo (#79, #138)
      const searchLower = search.trim().toLowerCase()
      let query = supabase
        .from('est_itens')
        .select(`
          id, codigo, descricao, descricao_complementar, categoria, subcategoria, unidade, valor_medio,
          classe_financeira_id, classe_financeira_codigo, classe_financeira_descricao,
          categoria_financeira_codigo, categoria_financeira_descricao, destino_operacional,
          exige_detalhe
        `)
        .eq('ativo', true)
        .order('descricao')
        .limit(100)
      if (searchLower.length >= 1) {
        const term = `%${searchLower}%`
        query = query.or(`descricao.ilike.${term},codigo.ilike.${term}`)
      }
      const { data, error } = await query
      if (error) return []

      // Apply client-side case-insensitive text filter (catches descricao_complementar too)
      const matched = ((data ?? []) as EstItem[]).filter((item) => {
        if (!searchLower) return true
        const desc = (item.descricao ?? '').toLowerCase()
        const comp = (item.descricao_complementar ?? '').toLowerCase()
        const cod  = (item.codigo ?? '').toLowerCase()
        return desc.includes(searchLower) || comp.includes(searchLower) || cod.includes(searchLower)
      })

      const categoriaNormalizada = categoriaRC.trim().toUpperCase()
      const categoriasLegadas = categoriasEstoque.map((c) => c.trim().toLowerCase())

      // If no legacy category mapping exists for this RC category, return all text-matched items
      if (categoriasLegadas.length === 0) {
        return matched.filter((item) => {
          const grupoCompra = (item.subcategoria ?? '').trim().toUpperCase()
          return !grupoCompra || grupoCompra === categoriaNormalizada
        })
      }

      return matched.filter((item) => {
        const grupoCompra = (item.subcategoria ?? '').trim().toUpperCase()
        const categoriaLegada = (item.categoria ?? '').trim().toLowerCase()

        if (grupoCompra) return grupoCompra === categoriaNormalizada
        return categoriasLegadas.includes(categoriaLegada)
      })
    },
    staleTime: 30_000,
  })
}

// ── Bases ─────────────────────────────────────────────────────────────────────
export function useBases() {
  return useQuery<EstBase[]>({
    queryKey: ['est-bases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_bases')
        .select('*')
        .eq('ativa', true)
        .order('nome')
      if (error) return []
      return (data ?? []) as EstBase[]
    },
  })
}

// ── Itens ─────────────────────────────────────────────────────────────────────
export function useEstoqueItens(filtros?: { categoria?: string; curva?: string; ativo?: boolean }) {
  return useQuery<EstItem[]>({
    queryKey: ['est-itens', filtros],
    queryFn: async () => {
      // PostgREST do Supabase capa em 1000 linhas por request mesmo com .range().
      // Pagina no cliente em lotes de 1000 e concatena.
      const PAGE = 1000
      const all: EstItem[] = []
      for (let from = 0; from < 50_000; from += PAGE) {
        let q = supabase
          .from('est_itens')
          .select('*')
          .order('descricao')
          .range(from, from + PAGE - 1)

        if (filtros?.categoria) q = q.eq('categoria', filtros.categoria)
        if (filtros?.curva)     q = q.eq('curva_abc', filtros.curva)
        if (filtros?.ativo !== undefined) q = q.eq('ativo', filtros.ativo)
        else q = q.eq('ativo', true)

        const { data, error } = await q
        if (error) break
        const batch = (data ?? []) as EstItem[]
        all.push(...batch)
        if (batch.length < PAGE) break
      }
      return all
    },
  })
}

export function useEstoqueItem(id: string | undefined) {
  return useQuery<EstItem | null>({
    queryKey: ['est-item', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_itens')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) return null
      return data as EstItem
    },
  })
}

export function useSalvarItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<EstItem> & { id?: string }) => {
      const { id, ...rest } = payload
      if (rest.descricao) rest.descricao = rest.descricao.replace(/^"+|"+$/g, '').trim()
      // Guarda final: força `unidade` para o enum est_unidade (UPPER + valid).
      // Protege contra payloads vindos de pre-cadastros antigos que ainda têm
      // unidade minúscula (cmp_requisicao_itens.unidade é text livre).
      if (rest.unidade !== undefined) rest.unidade = normalizeUnidade(rest.unidade)
      if (id) {
        const { error } = await supabase.from('est_itens').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('est_itens').insert(rest)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-itens'] })
      // Invalida o cache do proximo codigo p/ evitar reuso do mesmo codigo
      // em cadastros consecutivos (raiz do "duplicate key" no est_itens_codigo_key)
      qc.invalidateQueries({ queryKey: ['next-code', 'est_itens'] })
    },
  })
}

// ── Saldos ────────────────────────────────────────────────────────────────────
export function useSaldos(baseId?: string) {
  return useQuery<EstSaldo[]>({
    queryKey: ['est-saldos', baseId],
    queryFn: async () => {
      // PostgREST capa em 1000 — paginar no cliente
      const PAGE = 1000
      const all: EstSaldo[] = []
      for (let from = 0; from < 50_000; from += PAGE) {
        let q = supabase
          .from('est_saldos')
          .select(`
            *,
            item:est_itens(codigo, descricao, unidade, curva_abc, estoque_minimo, ponto_reposicao),
            base:est_bases(codigo, nome)
          `)
          .order('atualizado_em', { ascending: false })
          .range(from, from + PAGE - 1)

        if (baseId) q = q.eq('base_id', baseId)

        const { data, error } = await q
        if (error) break
        const batch = (data ?? []) as EstSaldo[]
        all.push(...batch)
        if (batch.length < PAGE) break
      }
      return all
    },
    refetchInterval: 60_000,
  })
}

export function useSaldosAbaixoMinimo() {
  return useQuery<EstSaldo[]>({
    queryKey: ['est-saldos-alerta'],
    queryFn: async () => {
      // PostgREST capa em 1000 — paginar no cliente
      const PAGE = 1000
      const all: EstSaldo[] = []
      for (let from = 0; from < 50_000; from += PAGE) {
        const { data, error } = await supabase
          .from('est_saldos')
          .select(`
            *,
            item:est_itens(codigo, descricao, unidade, curva_abc, estoque_minimo, ponto_reposicao),
            base:est_bases(codigo, nome)
          `)
          .range(from, from + PAGE - 1)
        if (error) break
        const batch = (data ?? []) as EstSaldo[]
        all.push(...batch)
        if (batch.length < PAGE) break
      }
      // Filtra no client: saldo <= ponto_reposicao do item
      return all.filter(
        (s: any) => s.item && s.saldo <= (s.item.ponto_reposicao ?? s.item.estoque_minimo)
      )
    },
  })
}

// ── Movimentações ─────────────────────────────────────────────────────────────
export function useMovimentacoes(filtros?: {
  item_id?: string
  base_id?: string
  tipo?: string
  obra?: string
  busca?: string         // matches item.descricao/codigo OR responsavel_nome
  dateFrom?: string      // ISO yyyy-mm-dd inclusive
  dateTo?: string        // ISO yyyy-mm-dd inclusive
  page?: number
}) {
  const limit = 50
  const offset = ((filtros?.page ?? 1) - 1) * limit

  return useQuery<EstMovimentacao[]>({
    queryKey: ['est-movimentacoes', filtros],
    queryFn: async () => {
      let q = supabase
        .from('est_movimentacoes')
        .select(`
          *,
          item:est_itens!est_movimentacoes_item_id_fkey(codigo, descricao, unidade),
          base:est_bases!est_movimentacoes_base_id_fkey(codigo, nome)
        `)
        .order('criado_em', { ascending: false })
        .range(offset, offset + limit - 1)

      if (filtros?.item_id)  q = q.eq('item_id', filtros.item_id)
      if (filtros?.base_id)  q = q.eq('base_id', filtros.base_id)
      if (filtros?.tipo)     q = q.eq('tipo', filtros.tipo)
      if (filtros?.obra)     q = q.ilike('obra_nome', `%${filtros.obra}%`)
      if (filtros?.dateFrom) q = q.gte('criado_em', `${filtros.dateFrom}T00:00:00`)
      if (filtros?.dateTo)   q = q.lte('criado_em', `${filtros.dateTo}T23:59:59`)

      // Busca server-side em obra_nome OU responsavel_nome
      // (descricao/codigo do item viriam via embed e .or não suporta — fica client-side)
      if (filtros?.busca && filtros.busca.trim().length >= 2) {
        const s = filtros.busca.trim().replace(/[%,]/g, '')
        q = q.or(`responsavel_nome.ilike.%${s}%,obra_nome.ilike.%${s}%,nf_numero.ilike.%${s}%`)
      }

      const { data, error } = await q
      if (error) return []
      return (data ?? []) as EstMovimentacao[]
    },
  })
}

// Triagem do CD: atende um item da solicitacao pelo estoque (transferencia CD->canteiro via RPC).
export function useAtenderItemSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, quantidade }: { itemId: string; quantidade: number }) => {
      const { error } = await supabase.rpc('est_solicitacao_atender_item', {
        p_item_id: itemId,
        p_quantidade: quantidade,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['est-saldos'] })
      qc.invalidateQueries({ queryKey: ['est-movimentacoes'] })
    },
  })
}

// Encaminha o pendente da solicitacao para Compras (gera RC via RPC)
export function useEncaminharParaCompras() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (solicitacaoId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('est_encaminhar_solicitacao_compras', {
        p_solicitacao_id: solicitacaoId,
      })
      if (error) throw error
      return data as string // id da RC criada
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useRegistrarMovimentacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: NovaMovimentacaoPayload) => {
      const { error } = await supabase
        .from('est_movimentacoes')
        .insert({
          ...payload,
          valor_unitario: payload.valor_unitario ?? 0,
        })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-movimentacoes'] })
      qc.invalidateQueries({ queryKey: ['est-saldos'] })
      qc.invalidateQueries({ queryKey: ['est-saldos-alerta'] })
      qc.invalidateQueries({ queryKey: ['est-kpis'] })
    },
  })
}

// RCs aguardando triagem pelo CD Araxa (status em_triagem_cd).
// Usado no painel do Estoque pra alertar o triador.
export function useRCsEmTriagemCD() {
  return useQuery<{ id: string; numero: string; obra_nome: string; solicitante_nome: string; categoria: string | null; created_at: string }[]>({
    queryKey: ['rcs-em-triagem-cd'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cmp_requisicoes')
        .select('id, numero, obra_nome, solicitante_nome, categoria, created_at')
        .eq('status', 'em_triagem_cd')
        .order('created_at', { ascending: true })
      if (error) return []
      return data ?? []
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

// ── Acompanhamento do CD ──────────────────────────────────────────────────────
// Lista RCs (cmp_requisicoes) que estao em triagem OU ja tiveram pelo menos 1
// item atendido pelo CD. Visao read-only pro almoxarife acompanhar o fluxo
// 'atendimento pelo estoque' sem precisar abrir o modulo Compras.
export type AcompCDStatus = 'em_triagem' | 'parcial_cd' | 'total_cd' | 'liberada_compras'

export interface AcompCDItem {
  id: string
  descricao: string
  codigo?: string | null
  unidade?: string | null
  quantidade: number
  qtd_atendida_cd: number
  qtd_pra_compras: number
  atendimento_cd_em?: string | null
}

export interface AcompCD {
  id: string
  numero: string
  solicitante_nome?: string | null
  obra_nome?: string | null
  base_destino_id?: string | null
  base_destino_nome?: string | null
  urgencia?: string | null
  status_rc: string
  status_acomp: AcompCDStatus
  criado_em: string
  total_itens: number
  itens_atendidos_cd: number
  itens_compras: number
  itens: AcompCDItem[]
}

export function useAcompanhamentoCD() {
  return useQuery<AcompCD[]>({
    queryKey: ['est-acomp-cd'],
    queryFn: async () => {
      // RCs em triagem (status atual)
      const { data: emTriagem } = await supabase
        .from('cmp_requisicoes')
        .select('id')
        .eq('status', 'em_triagem_cd')

      // RCs com algum item ja atendido pelo CD (mesmo se hoje status virou outro)
      const { data: itensAtendidos } = await supabase
        .from('cmp_requisicao_itens')
        .select('requisicao_id')
        .gt('qtd_atendida_cd', 0)

      // RCs que JA passaram pela triagem em algum momento (historico de status)
      const [{ data: histA }, { data: histB }] = await Promise.all([
        supabase.from('cmp_historico_status').select('requisicao_id').eq('status_anterior', 'em_triagem_cd'),
        supabase.from('cmp_historico_status').select('requisicao_id').eq('status_novo',      'em_triagem_cd'),
      ])

      const idsCom = new Set((itensAtendidos ?? []).map((r: any) => r.requisicao_id))
      const idsTriagem = new Set((emTriagem ?? []).map((r: any) => r.id))
      const idsHist = new Set<string>([
        ...((histA ?? []) as any[]).map(r => r.requisicao_id),
        ...((histB ?? []) as any[]).map(r => r.requisicao_id),
      ])
      const todosIds = new Set<string>([...idsCom, ...idsTriagem, ...idsHist])
      if (todosIds.size === 0) return []

      const { data: rcs } = await supabase
        .from('cmp_requisicoes')
        .select('id, numero, solicitante_nome, obra_nome, urgencia, status, created_at, base_destino_id')
        .in('id', Array.from(todosIds))

      const { data: itensTodos } = await supabase
        .from('cmp_requisicao_itens')
        .select('id, requisicao_id, descricao, codigo, unidade, quantidade, qtd_atendida_cd, atendimento_cd_em, atendido_em_pedido_id')
        .in('requisicao_id', Array.from(todosIds))

      // Resolve nome da base pelo id (cmp_requisicoes nao tem desnormalizado)
      const baseIds = new Set<string>()
      for (const r of (rcs ?? []) as any[]) if (r.base_destino_id) baseIds.add(r.base_destino_id)
      const basesMap = new Map<string, string>()
      if (baseIds.size > 0) {
        const { data: basesData } = await supabase
          .from('est_bases')
          .select('id, nome')
          .in('id', Array.from(baseIds))
        for (const b of (basesData ?? []) as any[]) basesMap.set(b.id, b.nome)
      }

      const itensByRc = new Map<string, any[]>()
      for (const it of (itensTodos ?? []) as any[]) {
        const arr = itensByRc.get(it.requisicao_id) ?? []
        arr.push(it)
        itensByRc.set(it.requisicao_id, arr)
      }

      return ((rcs ?? []) as any[]).map(rc => {
        const items = (itensByRc.get(rc.id) ?? []).map(it => {
          const qtd = Number(it.quantidade ?? 0)
          const qcd = Number(it.qtd_atendida_cd ?? 0)
          return {
            id: String(it.id),
            descricao: String(it.descricao ?? ''),
            codigo: it.codigo ?? null,
            unidade: it.unidade ?? null,
            quantidade: qtd,
            qtd_atendida_cd: qcd,
            qtd_pra_compras: Math.max(0, qtd - qcd),
            atendimento_cd_em: it.atendimento_cd_em ?? null,
          } as AcompCDItem
        })
        const itens_atendidos_cd = items.filter(i => i.qtd_atendida_cd > 0).length
        const itens_compras      = items.filter(i => i.qtd_pra_compras > 0).length

        let status_acomp: AcompCDStatus
        if (rc.status === 'em_triagem_cd') status_acomp = 'em_triagem'
        else if (itens_compras === 0 && itens_atendidos_cd > 0) status_acomp = 'total_cd'
        else if (itens_atendidos_cd > 0) status_acomp = 'parcial_cd'
        else status_acomp = 'liberada_compras'

        return {
          id: String(rc.id),
          numero: String(rc.numero ?? ''),
          solicitante_nome: rc.solicitante_nome ?? null,
          obra_nome: rc.obra_nome ?? null,
          base_destino_id: rc.base_destino_id ?? null,
          base_destino_nome: rc.base_destino_id ? (basesMap.get(rc.base_destino_id) ?? null) : null,
          urgencia: rc.urgencia ?? null,
          status_rc: String(rc.status ?? ''),
          status_acomp,
          criado_em: String(rc.created_at ?? ''),
          total_itens: items.length,
          itens_atendidos_cd,
          itens_compras,
          itens: items,
        } as AcompCD
      }).sort((a, b) => (b.criado_em ?? '').localeCompare(a.criado_em ?? ''))
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

// ── Solicitações ──────────────────────────────────────────────────────────────
export function useSolicitacoes(status?: StatusSolicitacao) {
  return useQuery<EstSolicitacao[]>({
    queryKey: ['est-solicitacoes', status],
    queryFn: async () => {
      // PostgREST capa em 1000 — paginar no cliente
      const PAGE = 1000
      const all: EstSolicitacao[] = []
      for (let from = 0; from < 50_000; from += PAGE) {
        let q = supabase
          .from('est_solicitacoes')
          .select(`*, itens:est_solicitacao_itens(*, item:est_itens(codigo, descricao, unidade))`)
          .order('criado_em', { ascending: false })
          .range(from, from + PAGE - 1)

        if (status) q = q.eq('status', status)

        const { data, error } = await q
        if (error) break
        const batch = (data ?? []) as EstSolicitacao[]
        all.push(...batch)
        if (batch.length < PAGE) break
      }
      return all
    },
  })
}

type StatusSolicitacao = 'aberta' | 'aprovada' | 'em_separacao' | 'atendida' | 'parcial' | 'cancelada' | 'encaminhada_compras'

export function useCriarSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      solicitante_nome: string
      obra_nome: string
      centro_custo?: string
      urgencia: string
      observacao?: string
      base_destino_id?: string
      solicitante_id?: string
      itens: { item_id?: string; descricao_livre?: string; quantidade: number; unidade?: string }[]
    }) => {
      const { itens, ...solicitacao } = payload
      const { data, error } = await supabase
        .from('est_solicitacoes')
        .insert(solicitacao)
        .select('id')
        .single()
      if (error) throw error

      if (itens.length > 0) {
        const { error: eItens } = await supabase
          .from('est_solicitacao_itens')
          .insert(itens.map(i => ({ ...i, solicitacao_id: data.id })))
        if (eItens) throw eItens
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['est-solicitacoes'] }),
  })
}

export function useAtualizarSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, aprovado_por }: { id: string; status: StatusSolicitacao; aprovado_por?: string }) => {
      const { error } = await supabase
        .from('est_solicitacoes')
        .update({
          status,
          ...(aprovado_por ? { aprovado_por, aprovado_em: new Date().toISOString() } : {}),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['est-solicitacoes'] }),
  })
}

// ── Inventários ───────────────────────────────────────────────────────────────
export function useInventarios() {
  return useQuery<EstInventario[]>({
    queryKey: ['est-inventarios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_inventarios')
        .select('*, base:est_bases(codigo, nome)')
        .order('criado_em', { ascending: false })
      if (error) return []
      return (data ?? []) as EstInventario[]
    },
  })
}

export function useInventario(id: string | undefined) {
  return useQuery<EstInventario | null>({
    queryKey: ['est-inventario', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_inventarios')
        .select(`
          *,
          base:est_bases(codigo, nome),
          itens:est_inventario_itens(*, item:est_itens(codigo, descricao, unidade, curva_abc))
        `)
        .eq('id', id!)
        .single()
      if (error) return null
      return data as EstInventario
    },
  })
}

export function useAbrirInventario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      tipo: 'ciclico' | 'periodico' | 'surpresa'
      base_id?: string
      curva_filtro?: 'A' | 'B' | 'C'
      responsavel: string
    }) => {
      // 1. Criar sessão
      const { data: inv, error } = await supabase
        .from('est_inventarios')
        .insert(payload)
        .select('id')
        .single()
      if (error) throw error

      // 2. Popular est_inventario_itens com saldos atuais.
      //    Regras:
      //    - Se base_id informado: filtra por base; senao pega TODAS as bases.
      //    - Inventario ciclico/surpresa => so itens com saldo > 0 (nao faz
      //      sentido contar item zerado em amostragem).
      //    - Inventario periodico => carrega tudo (precisa fechar a base
      //      inteira, incluindo zerados).
      //    - Pagina em loop de 1000 (PostgREST capa).
      const PAGE = 1000
      const todos: Array<{ item_id: string; base_id: string; saldo: number }> = []
      const somenteComSaldo = payload.tipo === 'ciclico' || payload.tipo === 'surpresa'

      for (let from = 0; ; from += PAGE) {
        let q = supabase
          .from('est_saldos')
          .select('item_id, base_id, saldo')
          .not('base_id', 'is', null)  // exclui saldos orfaos (base_id NULL)
          .range(from, from + PAGE - 1)
        if (payload.base_id) q = q.eq('base_id', payload.base_id)
        if (somenteComSaldo)  q = q.gt('saldo', 0)

        const { data: pageData, error: pageErr } = await q
        if (pageErr) break
        if (!pageData || pageData.length === 0) break
        todos.push(...(pageData as any[]))
        if (pageData.length < PAGE) break
      }

      // 3. Aplica filtro de curva ABC (cliente — exige join em est_itens)
      let saldosPraInserir = todos
      if (payload.curva_filtro && todos.length > 0) {
        const itemIds = Array.from(new Set(todos.map(s => s.item_id)))
        // Carrega curva_abc dos itens em paginas de 1000
        const curvaPorItem = new Map<string, string | null>()
        for (let i = 0; i < itemIds.length; i += PAGE) {
          const slice = itemIds.slice(i, i + PAGE)
          const { data: itensCurva } = await supabase
            .from('est_itens')
            .select('id, curva_abc')
            .in('id', slice)
          for (const it of (itensCurva ?? []) as any[]) curvaPorItem.set(it.id, it.curva_abc)
        }
        saldosPraInserir = todos.filter(s => curvaPorItem.get(s.item_id) === payload.curva_filtro)
      }

      // 4. Insere em paginas (PostgREST aceita batches grandes mas seguramos em 500)
      if (saldosPraInserir.length > 0) {
        const itensInv = saldosPraInserir.map(s => ({
          inventario_id: inv.id,
          item_id: s.item_id,
          base_id: s.base_id,
          saldo_sistema: s.saldo,
        }))
        const BATCH = 500
        for (let i = 0; i < itensInv.length; i += BATCH) {
          const slice = itensInv.slice(i, i + BATCH)
          const { error: insErr } = await supabase.from('est_inventario_itens').insert(slice)
          if (insErr) throw insErr
        }
      }

      return { inventario_id: inv.id, itens_carregados: saldosPraInserir.length }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['est-inventarios'] }),
  })
}

export function useSalvarContagem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      saldo_contado,
      contado_por,
      observacao,
    }: {
      id: string
      saldo_contado: number
      contado_por?: string
      observacao?: string
    }) => {
      const { error } = await supabase
        .from('est_inventario_itens')
        .update({
          saldo_contado,
          contado_por,
          observacao,
          contado_em: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['est-inventario'] })
    },
  })
}

// ── Disparo automatico de OC por estoque minimo ──────────────────────────────
// Chama RPC est_gerar_oc_minimo (mig 128). Cria 1 RC em rascunho por base com
// os itens abaixo do minimo. Idempotente — pula itens ja cobertos por RC em
// aberto. p_base_id=null roda em todas as bases.
export interface OcMinimoResult {
  ok: boolean
  rcs_criadas: number
  itens_inclusos: number
  itens_ja_pendentes: number
  resumo: Array<{
    base: string
    rc_numero: string
    rc_id: string
    valor_estimado: number
  }>
}

export function useGerarOcMinimo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (baseId?: string): Promise<OcMinimoResult> => {
      const { data, error } = await supabase.rpc('est_gerar_oc_minimo', {
        p_base_id: baseId ?? null,
      })
      if (error) throw error
      return data as OcMinimoResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-saldos-alerta'] })
      qc.invalidateQueries({ queryKey: ['est-kpis'] })
      qc.invalidateQueries({ queryKey: ['cmp-requisicoes'] })
    },
  })
}

export function useConcluirInventario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ inventario_id, aprovado_por }: { inventario_id: string; aprovado_por: string }) => {
      // RPC est_concluir_inventario (mig 142):
      //   1) Calcula acuracia
      //   2) Marca status='concluido' (idempotente)
      //   3) Gera movs ajuste_positivo/negativo por item com divergencia
      //   4) Trigger fn_atualiza_saldo_estoque propaga pra est_saldos
      const { data, error } = await supabase.rpc('est_concluir_inventario', {
        p_inventario_id: inventario_id,
        p_aprovado_por: aprovado_por || null,
      })
      if (error) throw error
      return data as {
        ok: boolean
        numero: string
        acuracia: number
        movs_inseridas: number
        movs_existentes: number
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-inventarios'] })
      qc.invalidateQueries({ queryKey: ['est-inventario'] })
      qc.invalidateQueries({ queryKey: ['est-kpis'] })
      qc.invalidateQueries({ queryKey: ['est-saldos'] })
      qc.invalidateQueries({ queryKey: ['est-movimentacoes'] })
    },
  })
}

// ── Adicionar item avulso ao inventário ──────────────────────────────────────
// Importa contagem de inventario via RPC (mig 127). Recebe linhas parseadas
// do CSV: [{codigo, quantidade, observacao?}]. Resolve item pelo codigo,
// calcula saldo_sistema e divergencia, UPSERT em est_inventario_itens.
export function useImportarInventarioCSV() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      inventarioId,
      linhas,
      contadoPor,
    }: {
      inventarioId: string
      linhas: Array<{ codigo: string; quantidade: number | string; observacao?: string }>
      contadoPor?: string
    }) => {
      const { data, error } = await supabase.rpc('est_importar_inventario', {
        p_inventario_id: inventarioId,
        p_linhas: linhas as any,
        p_contado_por: contadoPor ?? null,
      })
      if (error) throw error
      return data as {
        ok: boolean
        importados?: number
        erros_count?: number
        erros?: Array<{ linha: any; motivo: string }>
        erro?: string
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-inventario'] })
      qc.invalidateQueries({ queryKey: ['est-inventarios'] })
    },
  })
}

export function useAdicionarItemInventario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      inventario_id: string
      item_id?: string
      base_id?: string
      descricao_livre?: string
      unidade?: string
      quantidade_fisica?: number
    }) => {
      const { error } = await supabase
        .from('est_inventario_itens')
        .insert({
          inventario_id: payload.inventario_id,
          item_id: payload.item_id ?? null,
          base_id: payload.base_id ?? null,
          saldo_sistema: 0,
          saldo_contado: payload.quantidade_fisica ?? 0,
          ajuste_aplicado: false,
          observacao: payload.descricao_livre
            ? `Item avulso: ${payload.descricao_livre} (${payload.unidade ?? 'UN'})`
            : undefined,
        })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-inventario'] })
      qc.invalidateQueries({ queryKey: ['est-inventarios'] })
    },
  })
}

// ── Busca itens do catálogo (para inventário) ────────────────────────────────
export function useInventarioItemSearch(search: string) {
  return useQuery<EstItem[]>({
    queryKey: ['est-itens-inv-search', search],
    enabled: search.length >= 2,
    queryFn: async () => {
      const term = `%${search}%`
      const { data, error } = await supabase
        .from('est_itens')
        .select('id, codigo, descricao, descricao_complementar, categoria, unidade, valor_medio')
        .eq('ativo', true)
        .or(`descricao.ilike.${term},descricao_complementar.ilike.${term},codigo.ilike.${term}`)
        .order('descricao')
        .limit(30)
      if (error) return []
      return (data ?? []) as EstItem[]
    },
    staleTime: 30_000,
  })
}

// ── Pipeline: Aguardando Entrada (recebimento items pending validation) ──────
export function useAguardandoEntrada() {
  return useQuery<EstoqueEntradaItem[]>({
    queryKey: ['est-aguardando-entrada'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cmp_recebimento_itens')
        .select(`
          id, descricao, quantidade_recebida, valor_unitario,
          tipo_destino, item_estoque_id, created_at,
          item:est_itens!cmp_recebimento_itens_item_estoque_id_fkey(codigo, descricao, unidade),
          recebimento:cmp_recebimentos!cmp_recebimento_itens_recebimento_id_fkey(
            nf_numero, data_recebimento,
            base:est_bases(nome),
            pedido:cmp_pedidos(numero_pedido, fornecedor_nome, requisicao:cmp_requisicoes(obra_nome))
          )
        `)
        .eq('status', 'aguardando_entrada')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) return []
      return (data ?? []).map((m: any) => ({
        id: m.id,
        item_id: m.item_estoque_id ?? '',
        codigo: m.item?.codigo ?? '',
        descricao: m.item?.descricao ?? m.descricao ?? '',
        unidade: m.item?.unidade ?? 'UN',
        quantidade: m.quantidade_recebida,
        tipo: 'recebimento' as const,
        tipo_destino: m.tipo_destino,
        fornecedor_nome: m.recebimento?.pedido?.fornecedor_nome,
        nf_numero: m.recebimento?.nf_numero,
        base_nome: m.recebimento?.base?.nome,
        obra_nome: m.recebimento?.pedido?.requisicao?.obra_nome,
        valor_unitario: m.valor_unitario,
        numero_pedido: m.recebimento?.pedido?.numero_pedido,
        criado_em: m.created_at,
      })) as EstoqueEntradaItem[]
    },
    staleTime: 30_000,
  })
}

// ── Confirm entry: move from aguardando_entrada → confirmado ─────────────────
// Usa RPC fn_confirmar_entrada_estoque (mig 125) que tambem gera movimentacao
// de entrada automatica em est_movimentacoes pra itens vinculados ao catalogo.
export function useConfirmarEntrada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itemIds: string[]) => {
      const { data, error } = await supabase.rpc('fn_confirmar_entrada_estoque', {
        p_item_ids: itemIds,
      })
      if (error) throw error
      return data as { confirmados: number; puladas: number }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-aguardando-entrada'] })
      qc.invalidateQueries({ queryKey: ['est-saldos'] })
      qc.invalidateQueries({ queryKey: ['est-movimentacoes'] })
      qc.invalidateQueries({ queryKey: ['pat-imobilizados'] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      qc.invalidateQueries({ queryKey: ['recebimentos'] })
    },
  })
}

export function useCancelarEntrada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itemIds: string[]) => {
      const { error } = await supabase
        .from('cmp_recebimento_itens')
        .update({ status: 'rejeitado' })
        .in('id', itemIds)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['est-aguardando-entrada'] })
      qc.invalidateQueries({ queryKey: ['est-saldos'] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      qc.invalidateQueries({ queryKey: ['recebimentos'] })
    },
  })
}

// ── Pipeline: Em Movimentação ────────────────────────────────────────────────
export function useEmMovimentacao() {
  return useQuery<EstoqueMovimentacaoItem[]>({
    queryKey: ['est-em-movimentacao'],
    queryFn: async () => {
      const trinta_dias = new Date(Date.now() - 30 * 86400000).toISOString()
      const { data, error } = await supabase
        .from('est_movimentacoes')
        .select(`
          id, item_id, tipo, quantidade,
          responsavel_nome, obra_nome, criado_em,
          item:est_itens!est_movimentacoes_item_id_fkey(codigo, descricao, unidade),
          base:est_bases!est_movimentacoes_base_id_fkey(nome),
          base_destino:est_bases!est_movimentacoes_base_destino_id_fkey(nome)
        `)
        .in('tipo', ['saida', 'transferencia_out', 'ajuste_negativo', 'baixa'])
        .gte('criado_em', trinta_dias)
        .order('criado_em', { ascending: false })
        .limit(200)
      if (error) return []
      return (data ?? []).map((m: any) => ({
        id: m.id,
        item_id: m.item_id,
        codigo: m.item?.codigo ?? '',
        descricao: m.item?.descricao ?? '',
        unidade: m.item?.unidade ?? 'UN',
        quantidade: m.quantidade,
        tipo: m.tipo,
        base_nome: m.base?.nome,
        base_destino_nome: m.base_destino?.nome,
        responsavel_nome: m.responsavel_nome,
        obra_nome: m.obra_nome,
        criado_em: m.criado_em,
      })) as EstoqueMovimentacaoItem[]
    },
    staleTime: 30_000,
  })
}

// ── Pipeline: Liberado para Retirada (solicitações aprovadas/em_separacao) ────
export function useLiberadosRetirada() {
  return useQuery<EstSolicitacao[]>({
    queryKey: ['est-liberados-retirada'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_solicitacoes')
        .select(`*, itens:est_solicitacao_itens(*, item:est_itens(codigo, descricao, unidade))`)
        .in('status', ['aprovada', 'em_separacao'])
        .order('criado_em', { ascending: false })
        .limit(200)
      if (error) return []
      return (data ?? []) as EstSolicitacao[]
    },
    staleTime: 30_000,
  })
}

// ── Conta Corrente do Item ────────────────────────────────────────────────────
export function useContaCorrenteItem(itemId: string | undefined) {
  return useQuery<{ saldos: EstSaldo[]; movimentacoes: EstMovimentacao[] }>({
    queryKey: ['est-conta-corrente', itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const [saldosRes, movsRes] = await Promise.all([
        supabase
          .from('est_saldos')
          .select('*, base:est_bases(codigo, nome)')
          .eq('item_id', itemId!)
          .order('base_id'),
        supabase
          .from('est_movimentacoes')
          .select(`
            *,
            item:est_itens!est_movimentacoes_item_id_fkey(codigo, descricao, unidade),
            base:est_bases!est_movimentacoes_base_id_fkey(codigo, nome)
          `)
          .eq('item_id', itemId!)
          .order('criado_em', { ascending: true })
          .limit(500),
      ])
      return {
        saldos: (saldosRes.data ?? []) as EstSaldo[],
        movimentacoes: (movsRes.data ?? []) as EstMovimentacao[],
      }
    },
  })
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
export function useEstoqueKPIs() {
  return useQuery<EstoqueKPIs>({
    queryKey: ['est-kpis'],
    queryFn: async () => {
      const [itensRes, saldosRes, movsRes, solRes, invRes] = await Promise.all([
        supabase.from('est_itens').select('id', { count: 'exact' }).eq('ativo', true),
        supabase.from('est_saldos').select('saldo, saldo_reservado, item:est_itens(estoque_minimo, ponto_reposicao, valor_medio, curva_abc)'),
        supabase.from('est_movimentacoes').select('id', { count: 'exact' })
          .gte('criado_em', new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from('est_solicitacoes').select('id', { count: 'exact' }).in('status', ['aberta', 'aprovada', 'em_separacao']),
        supabase.from('est_inventarios').select('acuracia').eq('status', 'concluido').order('criado_em', { ascending: false }).limit(1),
      ])

      const saldos = (saldosRes.data ?? []) as any[]
      const noventa_dias_atras = new Date(Date.now() - 90 * 86400000).toISOString()

      // Itens abaixo do mínimo
      const abaixo = saldos.filter(s => s.item && s.saldo <= (s.item.ponto_reposicao ?? s.item.estoque_minimo)).length

      // Valor total em estoque
      const valor_total = saldos.reduce((acc, s) => acc + (s.saldo * (s.item?.valor_medio ?? 0)), 0)

      return {
        total_itens: itensRes.count ?? 0,
        itens_abaixo_minimo: abaixo,
        itens_parados: 0, // simplificado
        valor_estoque_total: valor_total,
        movimentacoes_mes: movsRes.count ?? 0,
        taxa_ruptura: 0,
        acuracia_ultimo_inventario: invRes.data?.[0]?.acuracia ?? undefined,
        solicitacoes_abertas: solRes.count ?? 0,
      }
    },
    refetchInterval: 60_000,
  })
}
