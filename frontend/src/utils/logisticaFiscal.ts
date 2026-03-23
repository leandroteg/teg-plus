import type { LogSolicitacao } from '../types/logistica'

export type DocumentoFiscalRegra = 'romaneio' | 'nf' | 'indefinido'

const CIDADES_MG = [
  'araxa', 'araxá', 'frutal', 'ituiutaba', 'paracatu',
  'perdizes', 'rio paranaiba', 'rio paranaíba', 'tres marias', 'três marias',
]

function normalizeUf(value?: string | null) {
  const clean = String(value ?? '').trim().toUpperCase()
  return clean.length === 2 ? clean : ''
}

function parseUfFromTrecho(value?: string | null) {
  const text = String(value ?? '').trim().toUpperCase()
  if (!text) return ''
  const slashMatch = text.match(/(?:\/|-|\s)(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)\s*$/)
  if (slashMatch) return slashMatch[1]
  return ''
}

function inferUfFromCity(value?: string | null) {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return ''
  if (CIDADES_MG.some(city => text.includes(city))) return 'MG'
  if (text.includes('campo grande')) return 'MS'
  return ''
}

export function getOrigemUf(sol: Pick<LogSolicitacao, 'origem' | 'origem_uf'>) {
  return normalizeUf(sol.origem_uf) || parseUfFromTrecho(sol.origem) || inferUfFromCity(sol.origem)
}

export function getDestinoUf(sol: Pick<LogSolicitacao, 'destino' | 'destino_uf'>) {
  return normalizeUf(sol.destino_uf) || parseUfFromTrecho(sol.destino) || inferUfFromCity(sol.destino)
}

export function getTrechoLabel(cidade?: string | null, uf?: string | null) {
  const cidadeClean = String(cidade ?? '').trim()
  const ufClean = normalizeUf(uf)
  if (!cidadeClean) return '—'
  if (!ufClean) return cidadeClean
  const regex = new RegExp(`(?:/|-|\\s)${ufClean}$`, 'i')
  return regex.test(cidadeClean) ? cidadeClean : `${cidadeClean} / ${ufClean}`
}

export function getDocumentoFiscalContext(sol: Pick<LogSolicitacao, 'origem' | 'destino' | 'origem_uf' | 'destino_uf'>) {
  const origemUf = getOrigemUf(sol)
  const destinoUf = getDestinoUf(sol)

  let regra: DocumentoFiscalRegra = 'indefinido'
  if (origemUf === 'MG' && destinoUf === 'MG') regra = 'romaneio'
  else if (origemUf && destinoUf && origemUf !== destinoUf) regra = 'nf'
  else if (!origemUf && destinoUf === 'MG' && inferUfFromCity(sol.origem) === 'MG') regra = 'romaneio'
  else if (!origemUf && destinoUf && destinoUf !== 'MG') regra = 'nf'

  return {
    origemUf,
    destinoUf,
    regra,
    origemLabel: getTrechoLabel(sol.origem, origemUf),
    destinoLabel: getTrechoLabel(sol.destino, destinoUf),
  }
}

export function getDocumentoFiscalLabel(regra: DocumentoFiscalRegra) {
  switch (regra) {
    case 'romaneio':
      return 'MG → MG - Romaneio operacional'
    case 'nf':
      return 'Interestadual - NF obrigatória'
    default:
      return 'UF não confirmada - validar documento fiscal'
  }
}

export function mergeCidadeUf(cidade?: string | null, uf?: string | null) {
  return getTrechoLabel(cidade, uf)
}
