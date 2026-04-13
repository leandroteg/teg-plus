import { sanitizeAiText } from './sanitizeAiText'
import type { ParcelaPlanejada, ResumoExecutivo, Solicitacao } from '../types/contratos'

type RecorrenciaInferida = 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'

const MESES_POR_RECORRENCIA: Record<RecorrenciaInferida, number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function normalizeText(value?: string | null) {
  return sanitizeAiText(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(value?: string | null) {
  if (!value) return null
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function endOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function buildDueDate(baseDate: Date, mesesAdd: number, diaBase: number) {
  const monthIndex = baseDate.getMonth() + mesesAdd
  const year = baseDate.getFullYear() + Math.floor(monthIndex / 12)
  const month = ((monthIndex % 12) + 12) % 12
  return new Date(year, month, Math.min(diaBase, endOfMonth(year, month)))
}

function buildDateWithDays(baseDate: Date, diasAdd: number) {
  const next = new Date(baseDate)
  next.setDate(next.getDate() + diasAdd)
  return next
}

function diffMonthsInclusive(inicio?: string, fim?: string) {
  const start = parseDate(inicio)
  const end = parseDate(fim)
  if (!start || !end || end < start) return null

  return ((end.getFullYear() - start.getFullYear()) * 12) + (end.getMonth() - start.getMonth()) + 1
}

function inferRecorrencia(texto: string): RecorrenciaInferida {
  if (/\banual|ano\b/i.test(texto)) return 'anual'
  if (/\bsemestral|semestre\b/i.test(texto)) return 'semestral'
  if (/\btrimestral|trimestre\b/i.test(texto)) return 'trimestral'
  if (/\bbimestral|bimestre\b/i.test(texto)) return 'bimestral'
  return 'mensal'
}

function inferQtdParcelas(texto: string, prazoMeses: number | null, recorrencia: RecorrenciaInferida) {
  if (/\b(a vista|à vista|parcela unica|parcela única|pagamento unico|pagamento único)\b/i.test(texto)) {
    return 1
  }

  const matchQuantidade = texto.match(/(\d{1,3})\s*(x|parcelas?|vezes)/i)
  if (matchQuantidade) {
    return clamp(parseInt(matchQuantidade[1], 10), 1, 120)
  }

  if (prazoMeses && prazoMeses > 0) {
    return clamp(Math.ceil(prazoMeses / MESES_POR_RECORRENCIA[recorrencia]), 1, 120)
  }

  return 1
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function extractEntradaPercent(texto: string) {
  const match = texto.match(/(?:sinal|entrada)\s*(?:de)?\s*(\d{1,3}(?:[.,]\d+)?)\s*%/i)
  return match ? Number(match[1].replace(',', '.')) / 100 : null
}

function extractEntradaValor(texto: string) {
  const match = texto.match(/(?:sinal|entrada)\s*(?:de)?\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:[.,]\d+)?)/i)
  if (!match) return null

  const raw = match[1]
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw

  const valor = Number(normalized)
  return Number.isFinite(valor) ? valor : null
}

function parseDiaOffsets(texto: string) {
  const slashSequence = texto.match(/\b\d{1,3}(?:\s*\/\s*\d{1,3}){1,11}\b/)
  if (!slashSequence) return null

  const dias = slashSequence[0]
    .split('/')
    .map((chunk) => Number(chunk.trim()))
    .filter((value) => Number.isFinite(value))

  return dias.length > 1 ? dias : null
}

function buildEqualParcelas(valorTotal: number, qtdParcelas: number, dates: Date[]) {
  const valorParcela = roundCurrency(valorTotal / qtdParcelas)

  return dates.map((date, index) => ({
    numero: index + 1,
    valor: index === dates.length - 1
      ? roundCurrency(valorTotal - valorParcela * (dates.length - 1))
      : valorParcela,
    data_vencimento: toIsoDate(date),
  }))
}

function buildEntradaMaisParcelas(input: {
  valorTotal: number
  texto: string
  qtdRestante: number
  baseDate: Date
  recorrencia: RecorrenciaInferida
  diaBase: number
}) {
  const entradaPercent = extractEntradaPercent(input.texto)
  const entradaValorTexto = entradaPercent == null ? extractEntradaValor(input.texto) : null
  const mencionaSinalMaior = /\b(sinal|entrada)\b.*\bmaior\b/i.test(input.texto) || /\bmaior\b.*\b(sinal|entrada)\b/i.test(input.texto)

  let entradaValor = 0

  if (entradaPercent != null) {
    entradaValor = roundCurrency(input.valorTotal * entradaPercent)
  } else if (entradaValorTexto != null && entradaValorTexto < input.valorTotal) {
    entradaValor = roundCurrency(entradaValorTexto)
  } else if (mencionaSinalMaior) {
    entradaValor = roundCurrency((input.valorTotal * 2) / (input.qtdRestante + 2))
  } else {
    entradaValor = roundCurrency(input.valorTotal / (input.qtdRestante + 1))
  }

  const restante = Math.max(0, roundCurrency(input.valorTotal - entradaValor))
  const valorParcela = input.qtdRestante > 0
    ? roundCurrency(restante / input.qtdRestante)
    : 0

  const parcelas: ParcelaPlanejada[] = [{
    numero: 1,
    valor: entradaValor,
    data_vencimento: toIsoDate(input.baseDate),
  }]

  for (let index = 0; index < input.qtdRestante; index++) {
    parcelas.push({
      numero: index + 2,
      valor: index === input.qtdRestante - 1
        ? roundCurrency(restante - valorParcela * Math.max(0, input.qtdRestante - 1))
        : valorParcela,
      data_vencimento: toIsoDate(
        buildDueDate(
          input.baseDate,
          MESES_POR_RECORRENCIA[input.recorrencia] * (index + 1),
          input.diaBase,
        ),
      ),
    })
  }

  return parcelas
}

function parseFormaPagamento(input: {
  texto: string
  valorTotal: number
  prazoMeses: number | null
  recorrencia: RecorrenciaInferida
  baseDate: Date
  diaBase: number
}) {
  const texto = input.texto

  if (/\b(a vista|parcela unica|pagamento unico)\b/i.test(texto)) {
    return [{
      numero: 1,
      valor: roundCurrency(input.valorTotal),
      data_vencimento: toIsoDate(input.baseDate),
    }]
  }

  const diaOffsets = parseDiaOffsets(texto)
  if (diaOffsets) {
    const dates = diaOffsets.map((offset) => buildDateWithDays(input.baseDate, offset))
    return buildEqualParcelas(input.valorTotal, dates.length, dates)
  }

  const entradaMaisParcelas = texto.match(/(?:sinal|entrada)[^0-9a-z]*(?:de\s+[^+]+)?\+\s*(\d{1,3})\s*(x|parcelas?|vezes)\b/i)
    ?? texto.match(/(?:sinal|entrada)[\w\s]*?(\d{1,3})\s*(x|parcelas?|vezes)\b/i)
  if (entradaMaisParcelas) {
    return buildEntradaMaisParcelas({
      valorTotal: input.valorTotal,
      texto,
      qtdRestante: clamp(parseInt(entradaMaisParcelas[1], 10), 1, 120),
      baseDate: input.baseDate,
      recorrencia: input.recorrencia,
      diaBase: input.diaBase,
    })
  }

  const matchQuantidade = texto.match(/(\d{1,3})\s*(x|parcelas?|vezes)\b/i)
  if (matchQuantidade) {
    const qtdParcelas = clamp(parseInt(matchQuantidade[1], 10), 1, 120)
    const dates = Array.from({ length: qtdParcelas }, (_, index) => (
      buildDueDate(input.baseDate, MESES_POR_RECORRENCIA[input.recorrencia] * index, input.diaBase)
    ))
    return buildEqualParcelas(input.valorTotal, qtdParcelas, dates)
  }

  const qtdParcelas = inferQtdParcelas(texto, input.prazoMeses, input.recorrencia)
  const dates = Array.from({ length: qtdParcelas }, (_, index) => (
    buildDueDate(input.baseDate, MESES_POR_RECORRENCIA[input.recorrencia] * index, input.diaBase)
  ))
  return buildEqualParcelas(input.valorTotal, qtdParcelas, dates)
}

export function normalizarParcelasPlanejadas(
  parcelas: Array<Partial<ParcelaPlanejada>>,
  valorTotal?: number,
): ParcelaPlanejada[] {
  const cleaned = parcelas
    .map((parcela, index) => ({
      numero: index + 1,
      valor: roundCurrency(Number(parcela.valor) || 0),
      data_vencimento: parcela.data_vencimento || '',
    }))

  if (!cleaned.length) return []
  if (typeof valorTotal !== 'number' || !Number.isFinite(valorTotal)) return cleaned

  const totalSemUltima = cleaned
    .slice(0, -1)
    .reduce((acc, parcela) => acc + parcela.valor, 0)

  const ultima = cleaned[cleaned.length - 1]
  ultima.valor = roundCurrency(Math.max(0, valorTotal - totalSemUltima))

  return cleaned
}

export function calcularDiferencaParcelas(parcelas: ParcelaPlanejada[], valorTotal?: number) {
  if (typeof valorTotal !== 'number' || !Number.isFinite(valorTotal)) return 0
  const soma = parcelas.reduce((acc, parcela) => acc + parcela.valor, 0)
  return roundCurrency(valorTotal - soma)
}

export function sugerirParcelasContrato(input: {
  solicitacao: Pick<Solicitacao, 'forma_pagamento' | 'valor_estimado' | 'data_inicio_prevista' | 'data_fim_prevista' | 'prazo_meses'>
  resumo?: Pick<ResumoExecutivo, 'valor_total' | 'vigencia' | 'recomendacao'> | null
}) {
  const valorTotal = Number(input.resumo?.valor_total ?? input.solicitacao.valor_estimado ?? 0)
  const formaPagamento = normalizeText(input.solicitacao.forma_pagamento)
  const textos = [
    formaPagamento,
    normalizeText(input.resumo?.vigencia),
    normalizeText(input.resumo?.recomendacao),
  ]
    .filter(Boolean)
    .join(' ')

  const recorrencia = inferRecorrencia(textos)
  const prazoMeses = input.solicitacao.prazo_meses
    ?? diffMonthsInclusive(input.solicitacao.data_inicio_prevista, input.solicitacao.data_fim_prevista)

  const qtdParcelas = inferQtdParcelas(textos, prazoMeses, recorrencia)
  const dataBase = parseDate(input.solicitacao.data_inicio_prevista)
    ?? parseDate(input.solicitacao.data_fim_prevista)
    ?? new Date()
  const diaBase = dataBase.getDate()

  if (!Number.isFinite(valorTotal) || valorTotal <= 0) {
    return [{
      numero: 1,
      valor: 0,
      data_vencimento: toIsoDate(dataBase),
    }]
  }

  return parseFormaPagamento({
    texto: formaPagamento || textos,
    valorTotal,
    prazoMeses,
    recorrencia,
    baseDate: dataBase,
    diaBase,
  })
}
