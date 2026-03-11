import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Requisicao, NovaRequisicaoPayload, RequisicaoItem } from '../types'
import { supabase } from '../services/supabase'
import { api } from '../services/api'

// Tabelas: cmp_requisicoes (módulo Compras)
const TABLE = 'cmp_requisicoes'

export function useRequisicoes(status?: string, search?: string) {
  return useQuery<Requisicao[]>({
    queryKey: ['requisicoes', status, search],
    queryFn: async () => {
      let query = supabase
        .from(TABLE)
        .select(`
          id, numero, solicitante_nome, obra_nome, obra_id,
          descricao, justificativa, valor_estimado, urgencia, status,
          alcada_nivel, categoria, comprador_id, texto_original, ai_confianca,
          esclarecimento_msg, esclarecimento_por, esclarecimento_em,
          created_at,
          comprador:cmp_compradores(nome, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (status) query = query.eq('status', status)
      if (search) query = query.ilike('descricao', `%${search}%`)

      const { data, error } = await query
      if (error) throw error

      // Flattens o join: comprador.nome → comprador_nome
      return ((data ?? []) as any[]).map(r => ({
        ...r,
        comprador_nome: r.comprador?.nome ?? undefined,
        comprador: undefined,
      })) as Requisicao[]
    },
    refetchInterval: 60_000,
    retry: false,
    staleTime: 30_000,
  })
}

export function useCriarRequisicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: NovaRequisicaoPayload) => {
      const n8nUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || ''

      // Tenta via n8n se configurado
      if (n8nUrl) {
        try {
          return await api.criarRequisicao(payload)
        } catch {
          // fallthrough → insert direto no Supabase
        }
      }

      // ── Insert direto no Supabase ────────────────────────────────────────
      const valorEstimado = payload.itens.reduce(
        (sum, item) => sum + (item.quantidade * (item.valor_unitario_estimado ?? 0)), 0
      )

      // Gera número único RC-YYYYMM-XXXX
      const now = new Date()
      const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
      const seq = String(Date.now()).slice(-5)
      const numero = `RC-${yyyymm}-${seq}`

      const alcadaNivel = valorEstimado > 2000 ? 2 : 1

      // Resolve comprador_id pelo nome da categoria quando não informado
      let compradorId = payload.comprador_id || null
      if (!compradorId && payload.categoria) {
        try {
          const { data: cat } = await supabase
            .from('cmp_categorias')
            .select('comprador_nome')
            .eq('codigo', payload.categoria)
            .maybeSingle()
          if (cat?.comprador_nome) {
            const { data: comp } = await supabase
              .from('cmp_compradores')
              .select('id')
              .ilike('nome', `%${cat.comprador_nome.split(' ')[0]}%`)
              .limit(1)
              .maybeSingle()
            compradorId = comp?.id ?? null
          }
        } catch { /* non-critical */ }
      }

      const { data: req, error: reqError } = await supabase
        .from('cmp_requisicoes')
        .insert({
          numero,
          solicitante_nome: payload.solicitante_nome,
          obra_nome:        payload.obra_nome,
          obra_id:          payload.obra_id    || null,
          descricao:        payload.descricao,
          justificativa:    payload.justificativa || null,
          urgencia:         payload.urgencia,
          status:           'pendente',
          categoria:        payload.categoria  || null,
          comprador_id:     compradorId,
          alcada_nivel:     alcadaNivel,
          texto_original:   payload.texto_original || null,
          ai_confianca:     payload.ai_confianca  ?? null,
          valor_estimado:   valorEstimado,
          data_necessidade: (payload as any).data_necessidade || null,
        })
        .select('id, numero')
        .single()

      if (reqError) throw new Error(reqError.message)

      // Insere itens (ignora erros não-críticos)
      if (payload.itens.length > 0) {
        const itens = payload.itens
          .filter(i => i.descricao?.trim())
          .map(item => ({
            requisicao_id:            req.id,
            descricao:                item.descricao,
            quantidade:               item.quantidade,
            unidade:                  item.unidade || 'un',
            valor_unitario_estimado:  item.valor_unitario_estimado ?? 0,
          }))
        if (itens.length > 0) {
          const { error: itensError } = await supabase
            .from('cmp_requisicao_itens')
            .insert(itens)
          if (itensError) console.warn('Aviso: itens não inseridos:', itensError.message)
        }
      }

      // Issue #60: Cria registro em apr_aprovacoes para que a RC apareça na tela AprovAi
      try {
        // Busca aprovador da alçada correspondente
        const { data: alcadaData } = await supabase
          .from('apr_alcadas')
          .select('id, prazo_horas, aprovador_padrao:sys_usuarios!aprovador_padrao_id(id, nome, email)')
          .eq('nivel', alcadaNivel)
          .eq('ativo', true)
          .maybeSingle()

        const aprovador = (alcadaData?.aprovador_padrao as { id: string; nome: string; email: string } | null)
        const prazoHoras = (alcadaData?.prazo_horas as number) ?? 48
        const dataLimite = new Date(Date.now() + prazoHoras * 3600_000).toISOString()

        const { error: aprError } = await supabase
          .from('apr_aprovacoes')
          .insert({
            modulo: 'cmp',
            tipo_aprovacao: 'requisicao_compra',
            entidade_id: req.id,
            entidade_numero: numero,
            aprovador_nome: aprovador?.nome ?? payload.solicitante_nome,
            aprovador_email: aprovador?.email ?? 'pendente@teguniao.com.br',
            nivel: alcadaNivel,
            status: 'pendente',
            data_limite: dataLimite,
          })
        if (aprError) console.warn('Aviso: apr_aprovacoes não inserido:', aprError.message)
      } catch (e) {
        console.warn('Aviso: erro ao criar aprovação pendente:', e)
      }

      return req
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useProcessarAprovacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { token: string; decisao: 'aprovada' | 'rejeitada'; observacao?: string }) =>
      api.processarAprovacao(vars.token, vars.decisao, vars.observacao),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ── Single requisicao with items ─────────────────────────────────────────────

export interface RequisicaoDetalhe extends Requisicao {
  itens: RequisicaoItem[]
}

export function useRequisicao(id?: string) {
  return useQuery<RequisicaoDetalhe | null>({
    queryKey: ['requisicao', id],
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from(TABLE)
        .select(`
          id, numero, solicitante_nome, obra_nome, obra_id,
          descricao, justificativa, valor_estimado, urgencia, status,
          alcada_nivel, categoria, comprador_id, texto_original, ai_confianca,
          created_at, esclarecimento_msg, esclarecimento_por, esclarecimento_em,
          comprador:cmp_compradores(nome, email),
          itens:cmp_requisicao_itens(id, descricao, quantidade, unidade, valor_unitario_estimado)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      if (!data) return null

      const d = data as any
      return {
        ...d,
        comprador_nome: d.comprador?.nome ?? undefined,
        comprador: undefined,
        itens: d.itens ?? [],
      } as RequisicaoDetalhe
    },
    enabled: !!id,
    staleTime: 15_000,
  })
}
