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
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15_000) // 15s per-request timeout
    try {
      return await fetch(url, { ...init, signal: controller.signal })
    } catch (err) {
      if (attempt >= retries) throw err
      // Don't retry if it was an abort (timeout)
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (attempt >= retries) throw new Error('Tempo limite de conexao excedido')
      }
      await new Promise(r => setTimeout(r, 1000 * 2 ** attempt))
    } finally {
      clearTimeout(timeoutId)
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

  enviarEmailPedido: (data: {
    pedido_id: string;
    email_destinatario: string;
    subject: string;
    body: string;
    anexos_urls?: { url: string; nome: string; tipo: string }[];
    pdf_html?: string;
  }) =>
    request<{ ok: boolean }>('/compras/email-pedido', { method: 'POST', body: JSON.stringify(data) }),

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
        const raw: Record<string, unknown> = await request('/consulta-cnpj', {
          method: 'POST',
          body: JSON.stringify({ valor: limpo }),
        })
        // Normaliza resposta do n8n proxy
        const result = normalizeCnpjResponse(raw, limpo)
        return result
      } catch { /* fallback abaixo */ }
    }
    // Fallback: BrasilAPI direto
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`)
    if (!res.ok) {
      return { cnpj: limpo, razao_social: '', nome_fantasia: '', situacao: '', endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' }, telefone: '', email: '', error: true, message: `CNPJ não encontrado (${res.status})` }
    }
    const r = await res.json()
    let socios = normalizeSocios(r as Record<string, unknown>)
    // Se BrasilAPI não retornou sócios, tenta ReceitaWS como fallback
    if (!socios.length) {
      try {
        const rws = await fetch(`https://receitaws.com.br/v1/cnpj/${limpo}`)
        if (rws.ok) {
          const rwsData = await rws.json()
          socios = normalizeSocios(rwsData as Record<string, unknown>)
        }
      } catch { /* ignora erro do fallback */ }
    }
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
      socios,
    }
  },

  consultarPlaca: async (placa: string): Promise<PlacaResult> => {
    const limpa = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    if (limpa.length !== 7) return { placa: limpa, error: true, message: 'Placa inválida' }
    // Tenta n8n primeiro
    if (BASE) {
      try {
        const raw = await request<Record<string, unknown>>('/consulta-placa', {
          method: 'POST',
          body: JSON.stringify({ valor: limpa }),
        })
        return normalizePlacaResponse(raw, limpa)
      } catch { /* fallback */ }
    }
    // Fallback: API pública
    try {
      const res = await fetch(`https://brasilapi.com.br/api/fipe/preco/v1/${limpa}`)
      if (!res.ok) return { placa: limpa, error: true, message: 'Placa não encontrada' }
      const r = await res.json()
      return normalizePlacaResponse(r, limpa)
    } catch {
      return { placa: limpa, error: true, message: 'Serviço indisponível' }
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

// ── Normaliza resposta CNPJ (n8n proxy pode retornar campos com nomes diferentes) ──
function normalizeSocios(d: Record<string, unknown>): { nome: string; qualificacao: string }[] {
  // BrasilAPI: qsa: [{ nome_socio, qualificacao_socio }]
  // ReceitaWS: qsa: [{ nome, qual }]
  // n8n proxy: socios or qsa
  const raw = (d.qsa ?? d.socios ?? []) as Record<string, unknown>[]
  if (!Array.isArray(raw)) return []
  return raw.map(s => ({
    nome: String(s.nome_socio ?? s.nome ?? ''),
    qualificacao: String(s.qualificacao_socio ?? s.qual ?? s.qualificacao ?? 'Sócio Administrador'),
  })).filter(s => s.nome)
}

function normalizeCnpjResponse(r: Record<string, unknown>, cnpjDigits: string): CnpjResult {
  // Handle potential wrapper: n8n may return { data: {...} } or nested structure
  const d = (r.data && typeof r.data === 'object' ? r.data : r) as Record<string, unknown>

  const razao = String(d.razao_social ?? d.razao ?? d.nome ?? d.name ?? d.company_name ?? '')
  const fantasia = String(d.nome_fantasia ?? d.fantasia ?? d.trade_name ?? '')

  // Detect error responses
  if (d.error || d.erro) {
    return {
      cnpj: cnpjDigits,
      razao_social: razao,
      nome_fantasia: fantasia,
      situacao: '',
      endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
      telefone: '',
      email: '',
      error: true,
      message: String(d.message ?? d.mensagem ?? d.erro ?? 'CNPJ nao encontrado'),
    }
  }

  const endereco = (d.endereco && typeof d.endereco === 'object' ? d.endereco : {}) as Record<string, unknown>

  return {
    cnpj: String(d.cnpj ?? cnpjDigits).replace(/\D/g, ''),
    razao_social: razao,
    nome_fantasia: fantasia,
    situacao: String(d.situacao ?? d.descricao_situacao_cadastral ?? d.situacao_cadastral ?? ''),
    endereco: {
      cep: String(endereco.cep ?? d.cep ?? '').replace(/\D/g, ''),
      logradouro: String(endereco.logradouro ?? d.logradouro ?? ''),
      numero: String(endereco.numero ?? d.numero ?? ''),
      complemento: String(endereco.complemento ?? d.complemento ?? ''),
      bairro: String(endereco.bairro ?? d.bairro ?? ''),
      cidade: String(endereco.cidade ?? d.municipio ?? d.cidade ?? ''),
      uf: String(endereco.uf ?? d.uf ?? ''),
    },
    telefone: String(d.telefone ?? d.ddd_telefone_1 ?? '').replace(/\D/g, ''),
    email: String(d.email ?? '').toLowerCase(),
    socios: normalizeSocios(d),
    representante_nome: String(d.representante_nome ?? ''),
    representante_cpf: String(d.representante_cpf ?? ''),
    representante_cargo: String(d.representante_cargo ?? ''),
    endereco_completo: String(d.endereco_completo ?? ''),
  }
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
  socios?: { nome: string; qualificacao: string }[]
  representante_nome?: string
  representante_cpf?: string
  representante_cargo?: string
  endereco_completo?: string
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

export interface PlacaResult {
  placa: string
  marca?: string
  modelo?: string
  ano_fab?: number
  ano_mod?: number
  cor?: string
  combustivel?: string
  categoria?: string
  error?: boolean
  message?: string
}

function normalizePlacaResponse(r: unknown, placa: string): PlacaResult {
  const d = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>
  const inner = (d.data && typeof d.data === 'object' ? d.data : d) as Record<string, unknown>

  if (inner.error || inner.erro || !inner.marca) {
    return { placa, error: true, message: String(inner.message ?? inner.mensagem ?? 'Placa não encontrada') }
  }

  const anoStr = String(inner.ano ?? inner.anoModelo ?? inner.ano_modelo ?? '')
  const anoFab = Number(inner.ano_fab ?? inner.anoFabricacao ?? anoStr.split('/')[0]) || undefined
  const anoMod = Number(inner.ano_mod ?? inner.anoModelo ?? anoStr.split('/')[1] ?? anoStr.split('/')[0]) || undefined

  // Map combustivel
  const combRaw = String(inner.combustivel ?? inner.combustivel_tipo ?? '').toLowerCase()
  const combMap: Record<string, string> = { gasolina: 'gasolina', diesel: 'diesel', etanol: 'etanol', flex: 'flex', 'álcool': 'etanol', alcool: 'etanol', elétrico: 'eletrico', eletrico: 'eletrico', gnv: 'gnv' }
  const combustivel = combMap[combRaw] || (combRaw.includes('flex') ? 'flex' : undefined)

  // Map categoria
  const tipoRaw = String(inner.tipo ?? inner.categoria ?? inner.especie ?? '').toLowerCase()
  const catMap: Record<string, string> = { passeio: 'passeio', pickup: 'pickup', caminhonete: 'pickup', van: 'van', utilitário: 'vuc', utilitario: 'vuc', caminhão: 'truck', caminhao: 'truck', carreta: 'carreta', moto: 'moto', motocicleta: 'moto', ônibus: 'onibus', onibus: 'onibus' }
  const categoria = catMap[tipoRaw] || undefined

  return {
    placa,
    marca: String(inner.marca ?? inner.MARCA ?? ''),
    modelo: String(inner.modelo ?? inner.MODELO ?? ''),
    ano_fab: anoFab,
    ano_mod: anoMod,
    cor: inner.cor ? String(inner.cor) : undefined,
    combustivel,
    categoria,
  }
}
