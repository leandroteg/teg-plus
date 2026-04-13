import type { LogSolicitacao } from '../types/logistica'

export type DocumentoFiscalRegra = 'romaneio' | 'nf' | 'indefinido'

const CIDADES_POR_UF: Record<string, string[]> = {
  MG: [
    'araxa',
    'frutal',
    'ituiutaba',
    'paracatu',
    'perdizes',
    'rio paranaiba',
    'tres marias',
  ],
  MS: [
    'campo grande',
    'corumba',
    'paraiso das aguas',
    'paraíso das águas',
    'tres lagoas',
    'três lagoas',
    'dourados',
    'sidrolandia',
    'sidrolândia',
    'chapadao do sul',
    'chapadão do sul',
    'cassilandia',
    'cassilândia',
    'sonora',
    'coxim',
    'rio verde de mato grosso',
  ],
}

function normalizeText(value?: string | null) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

function normalizeUf(value?: string | null) {
  const clean = normalizeText(value)
  return clean.length === 2 ? clean : ''
}

function parseUfFromTrecho(value?: string | null) {
  const text = normalizeText(value)
  if (!text) return ''
  const slashMatch = text.match(/(?:\/|-|\s)(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)\s*$/)
  if (slashMatch) return slashMatch[1]
  return ''
}

function inferUfFromCity(value?: string | null) {
  const text = normalizeText(value).toLowerCase()
  if (!text) return ''

  for (const [uf, cidades] of Object.entries(CIDADES_POR_UF)) {
    if (cidades.some(city => text.includes(city.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))) {
      return uf
    }
  }

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
  if (origemUf && destinoUf && origemUf === destinoUf) regra = 'romaneio'
  else if (origemUf && destinoUf && origemUf !== destinoUf) regra = 'nf'

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
      return 'Mesmo estado - Romaneio operacional'
    case 'nf':
      return 'Interestadual - NF obrigatória'
    default:
      return 'UF não confirmada - validar documento fiscal'
  }
}

export function mergeCidadeUf(cidade?: string | null, uf?: string | null) {
  return getTrechoLabel(cidade, uf)
}
