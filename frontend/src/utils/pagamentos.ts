export interface ParcelaPreview {
  numero: number
  valor: number
  data_vencimento: string
  descricao: string
}

function addDays(base: Date, days: number) {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

function addMonths(base: Date, months: number) {
  const next = new Date(base)
  const targetMonth = next.getMonth() + months
  next.setMonth(targetMonth)
  return next
}

function toIsoDate(date: Date) {
  return date.toISOString().split('T')[0]
}

function splitValue(valorTotal: number, quantidade: number) {
  const base = Math.round((valorTotal / quantidade) * 100) / 100
  const values: number[] = []
  let acumulado = 0

  for (let index = 0; index < quantidade; index += 1) {
    const valor = index === quantidade - 1
      ? Math.round((valorTotal - acumulado) * 100) / 100
      : base
    values.push(valor)
    acumulado += valor
  }

  return values
}

function parseInstallmentDays(termo: string) {
  return termo
    .split('/')
    .map((parte) => parte.trim())
    .filter(Boolean)
    .map((parte) => Number(parte.replace(/[^\d]/g, '')))
    .filter((valor) => Number.isFinite(valor) && valor >= 0)
}

export function gerarPreviaParcelas(
  valorTotal: number,
  condicaoPagamento: string,
  dataBaseInput?: string,
): ParcelaPreview[] {
  const dataBase = dataBaseInput ? new Date(`${dataBaseInput}T12:00:00`) : new Date()
  const termo = condicaoPagamento.trim().toLowerCase()

  if (!valorTotal || valorTotal <= 0) return []

  if (!termo || termo === 'a vista' || termo === 'avista' || termo === 'a_vista') {
    return [{
      numero: 1,
      valor: Math.round(valorTotal * 100) / 100,
      data_vencimento: toIsoDate(dataBase),
      descricao: 'A vista',
    }]
  }

  if (/^\d+\s*dias?$/.test(termo)) {
    const dias = Number(termo.replace(/[^\d]/g, ''))
    return [{
      numero: 1,
      valor: Math.round(valorTotal * 100) / 100,
      data_vencimento: toIsoDate(addDays(dataBase, dias)),
      descricao: `${dias} dias`,
    }]
  }

  const diasParcelados = parseInstallmentDays(termo)
  if (diasParcelados.length >= 2) {
    const valores = splitValue(valorTotal, diasParcelados.length)
    return diasParcelados.map((dias, index) => ({
      numero: index + 1,
      valor: valores[index],
      data_vencimento: toIsoDate(addDays(dataBase, dias)),
      descricao: `${dias} dias`,
    }))
  }

  if (termo.includes('entrada') && termo.includes('+')) {
    const diasSaldo = Number(termo.split('+')[1]?.replace(/[^\d]/g, '') || 0)
    const [entrada, saldo] = splitValue(valorTotal, 2)
    return [
      {
        numero: 1,
        valor: entrada,
        data_vencimento: toIsoDate(dataBase),
        descricao: 'Entrada',
      },
      {
        numero: 2,
        valor: saldo,
        data_vencimento: toIsoDate(addDays(dataBase, diasSaldo)),
        descricao: `Saldo ${diasSaldo} dias`,
      },
    ]
  }

  if (/^\d+x$/.test(termo)) {
    const quantidade = Number(termo.replace(/[^\d]/g, ''))
    const valores = splitValue(valorTotal, quantidade)
    return valores.map((valor, index) => ({
      numero: index + 1,
      valor,
      data_vencimento: toIsoDate(addMonths(dataBase, index)),
      descricao: `${index + 1}a parcela`,
    }))
  }

  return [{
    numero: 1,
    valor: Math.round(valorTotal * 100) / 100,
    data_vencimento: toIsoDate(dataBase),
    descricao: 'Revisar manualmente',
  }]
}

export function resumirHomogeneidade(valores: Array<string | null | undefined>) {
  const normalizados = Array.from(new Set(
    valores
      .map((valor) => valor?.trim())
      .filter((valor): valor is string => Boolean(valor)),
  ))

  return {
    homogeno: normalizados.length === 1,
    valor: normalizados[0] ?? '',
    quantidade: normalizados.length,
  }
}
