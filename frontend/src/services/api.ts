import type { NovaRequisicaoPayload, AiParseResult, NovaCotacaoPayload } from '../types'

const BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'

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

  // ── Consultas BrasilAPI (n8n proxy → fallback direto BrasilAPI) ──────────
  consultarCNPJ: async (cnpj: string): Promise<CnpjResult> => {
    const limpo = cnpj.replace(/\D/g, '')
    // Tenta n8n primeiro (cache + monitoramento)
    if (BASE) {
      try {
        return await request<CnpjResult>('/consulta-cnpj', {
          method: 'POST',
          body: JSON.stringify({ valor: limpo }),
        })
      } catch { /* fallback abaixo */ }
    }
    // Fallback: BrasilAPI direto
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`)
    if (!res.ok) {
      return { cnpj: limpo, razao_social: '', nome_fantasia: '', situacao: '', endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' }, telefone: '', email: '', error: true, message: `CNPJ não encontrado (${res.status})` }
    }
    const r = await res.json()
    return {
      cnpj: String(r.cnpj ?? '').replace(/\D/g, ''),
      razao_social: r.razao_social ?? '',
      nome_fantasia: r.nome_fantasia ?? '',
      situacao: r.descricao_situacao_cadastral ?? r.situacao_cadastral ?? '',
      endereco: {
        cep: String(r.cep ?? '').replace(/\D/g, ''),
        logradouro: [r.descricao_tipo_de_logradouro, r.logradouro].filter(Boolean).join(' '),
        numero: r.numero ?? '',
        complemento: r.complemento ?? '',
        bairro: r.bairro ?? '',
        cidade: r.municipio ?? '',
        uf: r.uf ?? '',
      },
      telefone: String(r.ddd_telefone_1 ?? '').replace(/\D/g, ''),
      email: (r.email ?? '').toLowerCase(),
    }
  },

  consultarCEP: async (cep: string): Promise<CepResult> => {
    const limpo = cep.replace(/\D/g, '')
    // Tenta n8n primeiro
    if (BASE) {
      try {
        return await request<CepResult>('/consulta-cep', {
          method: 'POST',
          body: JSON.stringify({ valor: limpo }),
        })
      } catch { /* fallback abaixo */ }
    }
    // Fallback: BrasilAPI direto
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${limpo}`)
    if (!res.ok) {
      return { cep: limpo, logradouro: '', bairro: '', cidade: '', uf: '', error: true, message: `CEP não encontrado (${res.status})` }
    }
    const r = await res.json()
    return {
      cep: String(r.cep ?? '').replace(/\D/g, ''),
      logradouro: r.street ?? '',
      bairro: r.neighborhood ?? '',
      cidade: r.city ?? '',
      uf: r.state ?? '',
    }
  },
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
