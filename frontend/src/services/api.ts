import type { NovaRequisicaoPayload, AiParseResult, NovaCotacaoPayload } from '../types'

const BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`Erro ${res.status}: ${res.statusText}`)
  return res.json() as Promise<T>
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

  // ── Consultas BrasilAPI (via n8n proxy + cache) ──────────────────────────
  consultarCNPJ: (cnpj: string) =>
    request<CnpjResult>('/consulta-cnpj', {
      method: 'POST',
      body: JSON.stringify({ valor: cnpj.replace(/\D/g, '') }),
    }),

  consultarCEP: (cep: string) =>
    request<CepResult>('/consulta-cep', {
      method: 'POST',
      body: JSON.stringify({ valor: cep.replace(/\D/g, '') }),
    }),
}

// ── Types para consultas externas ────────────────────────────────────────
export interface CnpjResult {
  cnpj: string
  razao_social: string
  nome_fantasia: string
  situacao: string
  endereco: {
    cep: string
    logradouro: string
    numero: string
    complemento: string
    bairro: string
    cidade: string
    uf: string
  }
  telefone: string
  email: string
  error?: boolean
  message?: string
}

export interface CepResult {
  cep: string
  logradouro: string
  bairro: string
  cidade: string
  uf: string
  error?: boolean
  message?: string
}
