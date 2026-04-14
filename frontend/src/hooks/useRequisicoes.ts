import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Requisicao, NovaRequisicaoPayload, RequisicaoItem } from '../types'
import { supabase } from '../services/supabase'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

// Tabelas: cmp_requisicoes (módulo Compras)
const TABLE = 'cmp_requisicoes'

function sanitizeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function buildEsclarecimentoHistorico(rows: any[]) {
  const map = new Map<string, NonNullable<Requisicao['esclarecimento_historico']>>()

  for (const row of rows) {
    const obs = String(row.observacao ?? '').trim()
    if (!obs) continue

    const isResposta = obs.startsWith('Esclarecimento respondido')
    if (row.status !== 'esclarecimento' && !isResposta) continue

    const entidadeId = String(row.entidade_id ?? '')
    if (!entidadeId) continue

    const list = map.get(entidadeId) ?? []
    list.push({
      tipo: isResposta ? 'resposta' : 'pedido',
      autor: String(row.aprovador_nome ?? ''),
      msg: obs,
      data: String(row.data_decisao ?? row.created_at ?? ''),
    })
    map.set(entidadeId, list)
  }

  return map
}

export function useRequisicoes(status?: string, search?: string) {
  return useQuery<Requisicao[]>({
    queryKey: ['requisicoes', status, search],
    queryFn: async () => {
      let query = supabase
        .from(TABLE)
        .select(`
          id, numero, solicitante_nome, obra_nome, obra_id,
          descricao, justificativa, valor_estimado, urgencia, justificativa_urgencia, status,
          alcada_nivel, categoria, comprador_id, centro_custo, centro_custo_id,
          classe_financeira, classe_financeira_id, texto_original, ai_confianca,
          esclarecimento_msg, esclarecimento_por, esclarecimento_em,
          compra_recorrente,
          created_at,
          comprador:cmp_compradores(nome, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (status) query = query.eq('status', status)
      if (search) query = query.ilike('descricao', `%${search}%`)

      const { data, error } = await query
      if (error) throw error
      const rows = (data ?? []) as any[]
      const ids = rows.map(r => r.id).filter(Boolean)
      const historicoMap = new Map<string, NonNullable<Requisicao['esclarecimento_historico']>>()

      if (ids.length > 0) {
        const { data: historicoData } = await supabase
          .from('apr_aprovacoes')
          .select('entidade_id, status, observacao, aprovador_nome, data_decisao, created_at')
          .in('entidade_id', ids)
          .eq('modulo', 'cmp')
          .not('observacao', 'is', null)
          .order('created_at', { ascending: true })

        for (const [id, historico] of buildEsclarecimentoHistorico(historicoData ?? [])) {
          historicoMap.set(id, historico)
        }
      }

      // Flattens o join: comprador.nome → comprador_nome
      return rows.map(r => ({
        ...r,
        comprador_nome: r.comprador?.nome ?? undefined,
        comprador: undefined,
        esclarecimento_historico: historicoMap.get(r.id),
      })) as Requisicao[]
    },
    refetchInterval: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 0,
  })
}

export function useCriarRequisicao() {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  return useMutation({
    mutationFn: async (payload: NovaRequisicaoPayload) => {
      const n8nUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || ''
      const shouldUseN8n = Boolean(n8nUrl) && !payload.arquivo_referencia && !payload.rascunho

      // Tenta via n8n se configurado (skip for drafts)
      if (shouldUseN8n) {
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
      const classesSnapshot = Array.from(new Set(
        payload.itens
          .map(item => item.classe_financeira_codigo?.trim())
          .filter((value): value is string => Boolean(value)),
      ))

      const classeFinanceiraCodigo = classesSnapshot.length === 1 ? classesSnapshot[0] : null
      const classeFinanceiraId = classesSnapshot.length === 1
        ? payload.itens.find(item => item.classe_financeira_codigo === classeFinanceiraCodigo)?.classe_financeira_id ?? null
        : null

      let centroCustoId: string | null = null
      let centroCustoCodigo: string | null = null

      if (payload.obra_id) {
        try {
          const { data: obra } = await supabase
            .from('sys_obras')
            .select('centro_custo_id, centro_custo:sys_centros_custo!centro_custo_id(codigo)')
            .eq('id', payload.obra_id)
            .maybeSingle()

          centroCustoId = (obra as any)?.centro_custo_id ?? null
          centroCustoCodigo = (obra as any)?.centro_custo?.codigo ?? null
        } catch {
          // fallback sem centro de custo automatico
        }
      }

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
          solicitante_id:   perfil?.id ?? null,
          solicitante_nome: payload.solicitante_nome,
          obra_nome:        payload.obra_nome,
          obra_id:          payload.obra_id    || null,
          descricao:        payload.descricao,
          justificativa:    payload.justificativa || null,
          urgencia:         payload.urgencia,
          justificativa_urgencia: payload.justificativa_urgencia || null,
          compra_recorrente: payload.compra_recorrente || false,
          status:           payload.rascunho ? 'rascunho' : 'em_aprovacao',
          categoria:        payload.categoria  || null,
          comprador_id:     compradorId,
          alcada_nivel:     alcadaNivel,
          centro_custo:     centroCustoCodigo,
          centro_custo_id:  centroCustoId,
          classe_financeira: classeFinanceiraCodigo,
          classe_financeira_id: classeFinanceiraId,
          texto_original:   payload.texto_original || null,
          ai_confianca:     payload.ai_confianca  ?? null,
          valor_estimado:   valorEstimado,
          data_necessidade: (payload as any).data_necessidade || null,
        })
        .select('id, numero')
        .single()

      if (reqError) throw new Error(reqError.message)

      if (payload.arquivo_referencia) {
        try {
          const safeName = sanitizeFileName(payload.arquivo_referencia.name)
          const path = `requisicoes/${req.id}/${Date.now()}-${safeName}`

          const { error: uploadError } = await supabase.storage
            .from('cotacoes-docs')
            .upload(path, payload.arquivo_referencia, {
              upsert: false,
              contentType: payload.arquivo_referencia.type,
            })

          if (uploadError) throw uploadError

          const { data: { publicUrl } } = supabase.storage
            .from('cotacoes-docs')
            .getPublicUrl(path)

          const { error: updateArquivoError } = await supabase
            .from('cmp_requisicoes')
            .update({ arquivo_url: publicUrl })
            .eq('id', req.id)

          if (updateArquivoError) {
            console.warn('Aviso: referencia de cotacao enviada, mas a URL nao foi vinculada na requisicao:', updateArquivoError.message)
          }
        } catch (arquivoError) {
          console.warn('Aviso: falha ao subir referencia de cotacao:', arquivoError)
        }
      }

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
            est_item_id:              item.est_item_id || null,
            est_item_codigo:          item.est_item_codigo || null,
            classe_financeira_id:     item.classe_financeira_id || null,
            classe_financeira_codigo: item.classe_financeira_codigo || null,
            classe_financeira_descricao: item.classe_financeira_descricao || null,
            categoria_financeira_codigo: item.categoria_financeira_codigo || null,
            categoria_financeira_descricao: item.categoria_financeira_descricao || null,
            destino_operacional:      item.destino_operacional || 'estoque',
          }))
        if (itens.length > 0) {
          const { error: itensError } = await supabase
            .from('cmp_requisicao_itens')
            .insert(itens)
          if (itensError) console.warn('Aviso: itens não inseridos:', itensError.message)
        }
      }

      // Issue #60: Cria registro em apr_aprovacoes (skip for drafts)
      if (!payload.rascunho) try {
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

// ── Reenviar RC para aprovação após esclarecimento ───────────────────────────

export function useReenviarEsclarecimento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      requisicaoId,
      requisicaoNumero,
      alcadaNivel,
      solicitanteNome,
      resposta,
    }: {
      requisicaoId: string
      requisicaoNumero: string
      alcadaNivel: number
      solicitanteNome: string
      resposta?: string
    }) => {
      // 1. Atualiza status de volta para em_aprovacao
      const { error: reqError } = await supabase
        .from(TABLE)
        .update({ status: 'em_aprovacao' })
        .eq('id', requisicaoId)
      if (reqError) throw reqError

      // 2. Busca aprovador da alçada para recriar o registro pendente
      const { data: alcadaData } = await supabase
        .from('apr_alcadas')
        .select('id, prazo_horas, aprovador_padrao:sys_usuarios!aprovador_padrao_id(id, nome, email)')
        .eq('nivel', alcadaNivel)
        .eq('ativo', true)
        .maybeSingle()

      const aprovador = (alcadaData?.aprovador_padrao as unknown as { id: string; nome: string; email: string } | null)
      const prazoHoras = (alcadaData?.prazo_horas as number) ?? 48
      const dataLimite = new Date(Date.now() + prazoHoras * 3600_000).toISOString()
      const obs = resposta?.trim()
        ? `Esclarecimento respondido por ${solicitanteNome}: ${resposta.trim()}`
        : `Esclarecimento respondido por ${solicitanteNome}`

      // 3. Insere novo registro pendente em apr_aprovacoes
      await supabase.from('apr_aprovacoes').insert({
        modulo: 'cmp',
        tipo_aprovacao: 'requisicao_compra',
        entidade_id: requisicaoId,
        entidade_numero: requisicaoNumero,
        aprovador_nome: aprovador?.nome ?? solicitanteNome,
        aprovador_email: aprovador?.email ?? 'pendente@teguniao.com.br',
        nivel: alcadaNivel,
        status: 'pendente',
        observacao: obs,
        data_limite: dataLimite,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['requisicao'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-historico'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-kpis'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ── Reenviar RC após devolução do cotador ────────────────────────────────────
// Solicitante editou itens/descrição e reenvia → reinicia ciclo na alçada 1

export function useReenviarAposDevolucao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      requisicaoId,
      requisicaoNumero,
      solicitanteNome,
      resposta,
    }: {
      requisicaoId: string
      requisicaoNumero: string
      solicitanteNome: string
      resposta?: string
    }) => {
      // 1. Atualiza status para em_aprovacao e reseta alçada para 1
      const { error: reqError } = await supabase
        .from(TABLE)
        .update({ status: 'em_aprovacao', alcada_nivel: 1 })
        .eq('id', requisicaoId)
      if (reqError) throw reqError

      // 2. Busca aprovador da alçada 1
      const { data: alcadaData } = await supabase
        .from('apr_alcadas')
        .select('id, prazo_horas, aprovador_padrao:sys_usuarios!aprovador_padrao_id(id, nome, email)')
        .eq('nivel', 1)
        .eq('ativo', true)
        .maybeSingle()

      const aprovador = (alcadaData?.aprovador_padrao as unknown as { id: string; nome: string; email: string } | null)
      const prazoHoras = (alcadaData?.prazo_horas as number) ?? 48
      const dataLimite = new Date(Date.now() + prazoHoras * 3600_000).toISOString()
      const obs = resposta?.trim()
        ? `RC reenviada por ${solicitanteNome} após devolução da cotação: ${resposta.trim()}`
        : `RC reenviada por ${solicitanteNome} após devolução da cotação`

      // 3. Insere novo registro pendente em apr_aprovacoes (alçada 1)
      const { error: aprError } = await supabase.from('apr_aprovacoes').insert({
        modulo: 'cmp',
        tipo_aprovacao: 'requisicao_compra',
        entidade_id: requisicaoId,
        entidade_numero: requisicaoNumero,
        aprovador_nome: aprovador?.nome ?? solicitanteNome,
        aprovador_email: aprovador?.email ?? 'pendente@teguniao.com.br',
        nivel: 1,
        status: 'pendente',
        observacao: obs,
        data_limite: dataLimite,
      })
      if (aprError) throw aprError
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['requisicao'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-historico'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-kpis'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ── Enviar RC aprovada para cotação ──────────────────────────────────────────

export function useEnviarParaCotacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      requisicaoId,
      categoria,
    }: {
      requisicaoId: string
      categoria?: string
    }) => {
      // 1. Atualiza status para em_cotacao
      const { error: reqError } = await supabase
        .from(TABLE)
        .update({ status: 'em_cotacao' })
        .eq('id', requisicaoId)
      if (reqError) throw reqError

      // 2. Auto-criar cotacao
      try {
        let compradorId: string | null = null
        if (categoria) {
          const { data: compradores } = await supabase
            .from('cmp_compradores')
            .select('id, categorias')
          const match = compradores?.find(
            (c: { id: string; categorias: string[] }) =>
              c.categorias?.includes(categoria)
          )
          compradorId = match?.id ?? null
        }

        const dataLimite = new Date()
        dataLimite.setDate(dataLimite.getDate() + 5)

        await supabase.from('cmp_cotacoes').insert({
          requisicao_id: requisicaoId,
          comprador_id: compradorId,
          status: 'pendente',
          data_limite: dataLimite.toISOString(),
        })
      } catch (e) {
        console.warn('Aviso: cotacao nao criada automaticamente:', e)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['requisicao'] })
      qc.invalidateQueries({ queryKey: ['cotacoes'] })
      qc.invalidateQueries({ queryKey: ['cotacao'] })
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
          alcada_nivel, categoria, comprador_id, centro_custo, centro_custo_id,
          classe_financeira, classe_financeira_id, texto_original, ai_confianca,
          created_at, esclarecimento_msg, esclarecimento_por, esclarecimento_em,
          comprador:cmp_compradores(nome, email),
          itens:cmp_requisicao_itens(
            id, descricao, quantidade, unidade, valor_unitario_estimado,
            est_item_id, est_item_codigo,
            classe_financeira_id, classe_financeira_codigo, classe_financeira_descricao,
            categoria_financeira_codigo, categoria_financeira_descricao, destino_operacional
          )
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
