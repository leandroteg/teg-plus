import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Requisicao, NovaRequisicaoPayload } from '../types'
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
    refetchInterval: 30_000,
    retry: 1,
    staleTime: 10_000,
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
          comprador_id:     payload.comprador_id || null,
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
