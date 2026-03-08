import type { NovaRequisicaoPayload, AiParseResult, NovaCotacaoPayload } from '../types'

const BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || ''

// ── Rate limiter: max concurrent requests + retry with backoff ──────────────
const MAX_CONCURRENT = 10
let activeRequests = 0
const queue: Array<() => void> = []

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++
    return Promise.resolve()
  }
  return new Promise(resolve => queue.push(resolve))
}

function releaseSlot() {
  activeRequests--
  const next = queue.shift()
  if (next) { activeRequests++; next() }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  await acquireSlot()
  try {
    const res = await fetchWithRetry(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    if (!res.ok) throw new Error(`Erro ${res.status}: ${res.statusText}`)
    return res.json() as Promise<T>
  } finally {
    releaseSlot()
  }
}

async function fetchWithRetry(url: string, init?: RequestInit, retries = 2): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, init)
    } catch (err) {
      if (attempt >= retries) throw err
      await new Promise(r => setTimeout(r, 1000 * 2 ** attempt))
    }
  }
}

export interface ParseCotacaoResult {
  success: boolean
  error?: string
  fornecedores: {
    fornecedor_nome: string
    fornecedor_cnpj?: string
    fornecedor_contato?: string
    valor_total: number
    prazo_entrega_dias?: number
    condicao_pagamento?: string
    itens?: { descricao: string; qtd: number; valor_unitario: number; valor_total: number }[]
    observacao?: string
  }[]
}

export const api = {
  criarRequisicao: (data: NovaRequisicaoPayload) =>
    request<unknown>('/compras/requisicao', { method: 'POST', body: JSON.stringify(data) }),

  parseRequisicaoAi: (texto: string, solicitante_nome?: string, arquivo?: { base64: string; nome: string; mime: string }) =>
    request<AiParseResult>('/compras/requisicao-ai', {
      method: 'POST',
      body: JSON.stringify({ texto, solicitante_nome, arquivo }),
    }),

  processarAprovacao: (token: string, decisao: 'aprovada' | 'rejeitada', observacao?: string) =>
    request<unknown>('/compras/aprovacao', {
      method: 'POST',
      body: JSON.stringify({ token, decisao, observacao }),
    }),

  submeterCotacao: (data: NovaCotacaoPayload) =>
    request<unknown>('/compras/cotacao', { method: 'POST', body: JSON.stringify(data) }),

  parseCotacaoFile: (data: { file_base64: string; file_name: string; mime_type: string }) =>
    request<ParseCotacaoResult>('/compras/parse-cotacao', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getDashboard: (params?: { periodo?: string; obra_id?: string }) => {
    const qs = params ? new URLSearchParams(params as Record<string, string>).toString() : ''
    return request<unknown>(`/painel/compras${qs ? `?${qs}` : ''}`)
  },
}
