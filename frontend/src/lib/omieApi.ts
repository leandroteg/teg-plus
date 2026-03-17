/**
 * omieApi.ts
 * Cliente direto para a API REST da Omie ERP.
 * Endpoint base: https://app.omie.com.br/api/v1/
 *
 * A Omie suporta chamadas CORS de browser (Access-Control-Allow-Origin: *),
 * portanto chamadas diretas do frontend funcionam sem proxy.
 */

const OMIE_BASE = 'https://app.omie.com.br/api/v1'

export interface OmieCredentials {
  appKey: string
  appSecret: string
}

// ── Erros Omie ────────────────────────────────────────────────────────────────

export class OmieApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly raw?: unknown,
  ) {
    super(message)
    this.name = 'OmieApiError'
  }
}

// ── Caller genérico ───────────────────────────────────────────────────────────

async function callOmie<T>(
  path: string,
  call: string,
  param: Record<string, unknown>[],
  credentials: OmieCredentials,
): Promise<T> {
  const res = await fetch(`${OMIE_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      call,
      app_key: credentials.appKey,
      app_secret: credentials.appSecret,
      param,
    }),
  })

  const json = await res.json().catch(() => null)

  // Omie retorna HTTP 200 mesmo em erros — erro fica em faultstring ou fault
  if (json?.faultstring) throw new OmieApiError(json.faultstring, json.faultcode, json)
  if (json?.fault?.faultstring) throw new OmieApiError(json.fault.faultstring, json.fault.faultcode, json)
  if (!res.ok) throw new OmieApiError(`HTTP ${res.status} ${res.statusText}`, String(res.status), json)

  return json as T
}

// ── Types ─────────────────────────────────────────────────────────────────────

// Conta corrente (banco)
export interface OmieContaCorrente {
  nCodCC: number
  cDescricao: string
  nCodBanco: number
  cNomeBanco: string
  cAgencia: string
  cConta: string
  nSaldo: number
  cTipoConta: string   // 'CC' | 'CP' | 'CI' ...
  cInativa: 'S' | 'N'
}

export interface OmieListarContasCorrentesResponse {
  lista_conta_corrente: OmieContaCorrente[]
  nPagina: number
  nTotPaginas: number
  nRegistros: number
}

// Conta a pagar
export interface OmieContaPagarCabecalho {
  nCodCP: number
  nCodConta: number
  cNumDocumento: string
  dDtEmissao: string       // DD/MM/AAAA
  dDtVenc: string          // DD/MM/AAAA
  dDtPagamento?: string
  nValorDocumento: number
  nValorPago?: number
  cStatus: string
  cFornecedor?: string
  nCodFornecedor?: number
  cObservacao?: string
  cCategoria?: string
}

export interface OmieContaPagar {
  cabecalho: OmieContaPagarCabecalho
  status?: { cSituacao: string }
}

export interface OmieListarContasPagarResponse {
  conta_pagar_cadastro: OmieContaPagar[]
  nPagina: number
  nTotPaginas: number
  nRegistros: number
}

export interface OmieIncluirContaPagarResponse {
  nCodCP: number
  cStatus: string
  cDescricao: string
}

// Lançamento financeiro
export interface OmieLancamento {
  nCodLanc: number
  nCodCC: number
  cDescricao: string
  dData: string
  nValor: number
  cTipoLanc: string   // 'E' entrada | 'S' saída
  cCodCateg: string
  lLancConciliado: 'S' | 'N'
}

export interface OmieListarLancamentosResponse {
  lancamentos: OmieLancamento[]
  nPagina: number
  nTotPaginas: number
  nRegistros: number
}

// Resposta do ping / teste
export interface OmieTestResponse {
  dDtAtual: string
  cHrAtual: string
  cVersaoAPI: string
}

// ── API Functions ─────────────────────────────────────────────────────────────

export const omieApi = {

  // ── Utilitário: testa conexão lendo data/hora do servidor Omie ──────────────
  async testarConexao(credentials: OmieCredentials): Promise<OmieTestResponse> {
    return callOmie<OmieTestResponse>(
      '/geral/empresa/',
      'ConsultarEmpresa',
      [{}],
      credentials,
    )
  },

  // ── Contas Correntes (Tesouraria) ───────────────────────────────────────────
  async listarContasCorrentes(
    credentials: OmieCredentials,
    pagina = 1,
    registros = 50,
  ): Promise<OmieListarContasCorrentesResponse> {
    return callOmie<OmieListarContasCorrentesResponse>(
      '/geral/contacorrente/',
      'ListarContasCorrentes',
      [{ pagina, registros_por_pagina: registros, apenas_importado_api: 'N' }],
      credentials,
    )
  },

  // ── Contas a Pagar ──────────────────────────────────────────────────────────
  async listarContasPagar(
    credentials: OmieCredentials,
    opts: {
      pagina?: number
      registros?: number
      status?: 'TODOS' | 'ABERTO' | 'PAGO' | 'CANCELADO'
      dataInicio?: string   // DD/MM/AAAA
      dataFim?: string
    } = {},
  ): Promise<OmieListarContasPagarResponse> {
    const { pagina = 1, registros = 50, status = 'TODOS', dataInicio, dataFim } = opts
    const filtros: Record<string, unknown> = {
      pagina,
      registros_por_pagina: registros,
      filtrar_apenas_importado: 'N',
    }
    if (status !== 'TODOS') filtros.filtrar_por_status = status
    if (dataInicio) filtros.filtrar_por_data_de = dataInicio
    if (dataFim) filtros.filtrar_por_data_ate = dataFim

    return callOmie<OmieListarContasPagarResponse>(
      '/financas/contapagar/',
      'ListarContasPagar',
      [filtros],
      credentials,
    )
  },

  // Incluir uma nova CP no Omie
  async incluirContaPagar(
    credentials: OmieCredentials,
    cp: {
      nCodFornecedor: number
      cNumDocumento: string
      dDtEmissao: string      // DD/MM/AAAA
      dDtVenc: string         // DD/MM/AAAA
      nValorDocumento: number
      cObservacao?: string
      nCodConta?: number      // conta corrente para débito
      cCategoria?: string
      cNatureza?: string
    },
  ): Promise<OmieIncluirContaPagarResponse> {
    return callOmie<OmieIncluirContaPagarResponse>(
      '/financas/contapagar/',
      'IncluirContaPagar',
      [{
        cabecalho: {
          nCodFornecedor: cp.nCodFornecedor,
          cNumDocumento: cp.cNumDocumento,
          dDtEmissao: cp.dDtEmissao,
          dDtVenc: cp.dDtVenc,
          nValorDocumento: cp.nValorDocumento,
          cObservacao: cp.cObservacao ?? '',
          ...(cp.nCodConta ? { nCodConta: cp.nCodConta } : {}),
        },
        departamentos: [],
        categorias: cp.cCategoria
          ? [{ cCodCateg: cp.cCategoria, nValor: cp.nValorDocumento }]
          : [],
      }],
      credentials,
    )
  },

  // Consultar CP por código Omie
  async consultarContaPagar(
    credentials: OmieCredentials,
    nCodCP: number,
  ): Promise<OmieContaPagar> {
    return callOmie<OmieContaPagar>(
      '/financas/contapagar/',
      'ConsultarContaPagar',
      [{ nCodCP }],
      credentials,
    )
  },

  // ── Lançamentos / Extrato bancário ──────────────────────────────────────────
  async listarLancamentos(
    credentials: OmieCredentials,
    opts: {
      nCodCC?: number
      pagina?: number
      registros?: number
      dataInicio?: string   // DD/MM/AAAA
      dataFim?: string
    } = {},
  ): Promise<OmieListarLancamentosResponse> {
    const { nCodCC, pagina = 1, registros = 100, dataInicio, dataFim } = opts
    const param: Record<string, unknown> = {
      pagina,
      registros_por_pagina: registros,
    }
    if (nCodCC) param.nCodCC = nCodCC
    if (dataInicio) param.dDtInicio = dataInicio
    if (dataFim) param.dDtFim = dataFim

    return callOmie<OmieListarLancamentosResponse>(
      '/financas/pesquisarlancamentos/',
      'PesquisarLancamentos',
      [param],
      credentials,
    )
  },
}

// ── Helpers de formatação ─────────────────────────────────────────────────────

/** Converte Date → "DD/MM/AAAA" (formato Omie) */
export function toOmieDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/** Converte "DD/MM/AAAA" → "AAAA-MM-DD" (ISO) */
export function fromOmieDate(omieDate: string): string {
  const [dd, mm, yyyy] = omieDate.split('/')
  return `${yyyy}-${mm}-${dd}`
}

/** Status Omie → status interno remessa */
export function mapOmieStatus(situacao: string): 'confirmada' | 'cancelado' | 'processando' {
  const s = situacao.toUpperCase()
  if (s === 'PAGO' || s === 'LIQUIDADO' || s === 'REALIZADO') return 'confirmada'
  if (s === 'CANCELADO' || s === 'INATIVO') return 'cancelado'
  return 'processando'
}
