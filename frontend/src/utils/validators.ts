/**
 * BACKUP: Arquivo novo — utils/validators.ts
 * Utilitários de validação para o TEG+ ERP.
 * Funções puras, sem side effects, 100% testáveis.
 */

// ── CNPJ ────────────────────────────────────────────────────────────────────

export function validarCNPJ(cnpj: string): boolean {
  const limpo = cnpj.replace(/\D/g, '')
  if (limpo.length !== 14) return false
  // Rejeita CNPJs com todos os dígitos iguais
  if (/^(\d)\1+$/.test(limpo)) return false

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  let soma = 0
  for (let i = 0; i < 12; i++) soma += parseInt(limpo[i]) * pesos1[i]
  let resto = soma % 11
  const dig1 = resto < 2 ? 0 : 11 - resto

  if (parseInt(limpo[12]) !== dig1) return false

  soma = 0
  for (let i = 0; i < 13; i++) soma += parseInt(limpo[i]) * pesos2[i]
  resto = soma % 11
  const dig2 = resto < 2 ? 0 : 11 - resto

  return parseInt(limpo[13]) === dig2
}

export function formatarCNPJ(cnpj: string): string {
  const limpo = cnpj.replace(/\D/g, '').padStart(14, '0')
  return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5, 8)}/${limpo.slice(8, 12)}-${limpo.slice(12, 14)}`
}

// ── CPF ─────────────────────────────────────────────────────────────────────

export function validarCPF(cpf: string): boolean {
  const limpo = cpf.replace(/\D/g, '')
  if (limpo.length !== 11) return false
  if (/^(\d)\1+$/.test(limpo)) return false

  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(limpo[i]) * (10 - i)
  let resto = (soma * 10) % 11
  const dig1 = resto === 10 ? 0 : resto

  if (parseInt(limpo[9]) !== dig1) return false

  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(limpo[i]) * (11 - i)
  resto = (soma * 10) % 11
  const dig2 = resto === 10 ? 0 : resto

  return parseInt(limpo[10]) === dig2
}

export function formatarCPF(cpf: string): string {
  const limpo = cpf.replace(/\D/g, '').padStart(11, '0')
  return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9, 11)}`
}

// ── Placa de veículo ────────────────────────────────────────────────────────

/** Valida placa antiga (ABC-1234) ou Mercosul (ABC1D23) */
export function validarPlaca(placa: string): boolean {
  const limpa = placa.replace(/[-\s]/g, '').toUpperCase()
  // Mercosul: 3 letras + 1 digito + 1 alfanum + 2 digitos
  const mercosul = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
  // Antiga: 3 letras + 4 digitos
  const antiga = /^[A-Z]{3}[0-9]{4}$/
  return mercosul.test(limpa) || antiga.test(limpa)
}

// ── Chave NF-e ──────────────────────────────────────────────────────────────

export function validarChaveNFe(chave: string): boolean {
  const limpa = chave.replace(/\D/g, '')
  return limpa.length === 44
}

// ── Valores monetários ──────────────────────────────────────────────────────

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function parseMoeda(texto: string): number {
  // BRL: "R$ 1.234,56" → remove pontos de milhar, troca vírgula por ponto decimal
  const limpo = texto.replace(/[^\d,.-]/g, '')
  const normalizado = limpo.replace(/\./g, '').replace(',', '.')
  return parseFloat(normalizado) || 0
}

// ── Alçada de aprovação (Compras) ───────────────────────────────────────────

export function determinarAlcada(valor: number): number {
  if (valor <= 5000) return 1
  if (valor <= 25000) return 2
  if (valor <= 100000) return 3
  return 4
}

export const ALCADA_LABELS: Record<number, string> = {
  0: 'Sem alçada',
  1: 'Coordenador (até R$ 5.000)',
  2: 'Gerente (até R$ 25.000)',
  3: 'Diretor (até R$ 100.000)',
  4: 'CEO (sem limite)',
}

// ── Cotações mínimas por faixa de valor ─────────────────────────────────────

export function cotacoesMinimas(valor: number): number {
  if (valor <= 1000) return 1
  if (valor <= 5000) return 2
  return 3
}

// ── Número de requisição ────────────────────────────────────────────────────

export function gerarNumeroRequisicao(sequencial: number, data?: Date): string {
  const d = data ?? new Date()
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
  return `RC-${ym}-${String(sequencial).padStart(4, '0')}`
}

// ── Número de pedido ────────────────────────────────────────────────────────

export function gerarNumeroPedido(sequencial: number, data?: Date): string {
  const d = data ?? new Date()
  return `PO-${d.getFullYear()}-${String(sequencial).padStart(5, '0')}`
}

// ── Confiança AI ────────────────────────────────────────────────────────────

export type NivelConfianca = 'alto' | 'medio' | 'baixo'

export function getNivelConfianca(score: number): NivelConfianca {
  if (score >= 0.8) return 'alto'
  if (score >= 0.5) return 'medio'
  return 'baixo'
}

export function getCorConfianca(nivel: NivelConfianca): string {
  switch (nivel) {
    case 'alto': return 'text-green-600'
    case 'medio': return 'text-yellow-600'
    case 'baixo': return 'text-red-600'
  }
}

// ── Contratos: cálculo de parcelas ──────────────────────────────────────────

export type Recorrencia = 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'

const MESES_POR_RECORRENCIA: Record<Recorrencia, number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
}

export function ajustarDiaVencimento(dia: number, mes: number, ano: number): Date {
  // Se dia > dias do mês, ajusta para último dia
  const ultimoDia = new Date(ano, mes + 1, 0).getDate()
  const diaReal = Math.min(dia, ultimoDia)
  return new Date(ano, mes, diaReal)
}

export function calcularProximoVencimento(
  dataBase: Date,
  recorrencia: Recorrencia,
  numeroParcela: number,
): Date {
  const mesesAdd = MESES_POR_RECORRENCIA[recorrencia] * numeroParcela
  const novoMes = dataBase.getMonth() + mesesAdd
  const novoAno = dataBase.getFullYear() + Math.floor(novoMes / 12)
  const mesReal = novoMes % 12
  return ajustarDiaVencimento(dataBase.getDate(), mesReal, novoAno)
}

export function gerarParcelas(
  valorTotal: number,
  qtdParcelas: number,
  dataBase: Date,
  recorrencia: Recorrencia,
  diaVencimento: number,
): Array<{ numero: number; valor: number; data_vencimento: Date }> {
  const valorParcela = Math.round((valorTotal / qtdParcelas) * 100) / 100
  const parcelas = []

  for (let i = 0; i < qtdParcelas; i++) {
    const mesesAdd = MESES_POR_RECORRENCIA[recorrencia] * i
    const novoMes = dataBase.getMonth() + mesesAdd
    const novoAno = dataBase.getFullYear() + Math.floor(novoMes / 12)
    const mesReal = novoMes % 12

    parcelas.push({
      numero: i + 1,
      valor: i === qtdParcelas - 1
        ? Math.round((valorTotal - valorParcela * (qtdParcelas - 1)) * 100) / 100
        : valorParcela,
      data_vencimento: ajustarDiaVencimento(diaVencimento, mesReal, novoAno),
    })
  }

  return parcelas
}

export function calcularProgressoContrato(valorMedido: number, valorTotal: number): number {
  if (valorTotal <= 0) return 0
  return Math.min(100, Math.round((valorMedido / valorTotal) * 10000) / 100)
}

// ── Logística: alçada automática por custo ──────────────────────────────────

export function determinarAlcadaLogistica(custoEstimado: number): 'auto' | 'gerente' | 'diretoria' {
  if (custoEstimado <= 500) return 'auto'
  if (custoEstimado <= 2000) return 'gerente'
  return 'diretoria'
}

// ── Frotas: desvio de consumo ───────────────────────────────────────────────

export function calcularDesvioConsumo(consumoReal: number, consumoEsperado: number): {
  desvio: number
  alerta: boolean
} {
  if (consumoEsperado <= 0) return { desvio: 0, alerta: false }
  const desvio = Math.abs(consumoReal - consumoEsperado) / consumoEsperado
  return { desvio: Math.round(desvio * 10000) / 100, alerta: desvio > 0.15 }
}

export function calcularKmProximaPreventiva(
  hodometroAtual: number,
  intervaloPreventiva: number,
): number {
  return hodometroAtual + intervaloPreventiva
}

export function alertaVencimento(dataVencimento: Date, diasAlerta = 30): boolean {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const diff = dataVencimento.getTime() - hoje.getTime()
  const dias = diff / (1000 * 60 * 60 * 24)
  return dias >= 0 && dias <= diasAlerta
}

// ── Estoque: valor médio ────────────────────────────────────────────────────

export function calcularValorMedio(
  saldoAnterior: number,
  valorMedioAnterior: number,
  qtdEntrada: number,
  custoEntrada: number,
): number {
  const totalAnterior = saldoAnterior * valorMedioAnterior
  const totalEntrada = qtdEntrada * custoEntrada
  const novoSaldo = saldoAnterior + qtdEntrada
  if (novoSaldo <= 0) return 0
  return Math.round(((totalAnterior + totalEntrada) / novoSaldo) * 100) / 100
}

// ── Estoque: Curva ABC ──────────────────────────────────────────────────────

export function classificarCurvaABC(
  itens: Array<{ id: string; valor_total: number }>,
): Map<string, 'A' | 'B' | 'C'> {
  const sorted = [...itens].sort((a, b) => b.valor_total - a.valor_total)
  const total = sorted.reduce((s, i) => s + i.valor_total, 0)
  const result = new Map<string, 'A' | 'B' | 'C'>()

  let acumulado = 0
  for (const item of sorted) {
    acumulado += item.valor_total
    const pct = total > 0 ? acumulado / total : 0
    if (pct <= 0.8) result.set(item.id, 'A')
    else if (pct <= 0.95) result.set(item.id, 'B')
    else result.set(item.id, 'C')
  }

  return result
}

// ── Estoque: depreciação linear ─────────────────────────────────────────────

export function calcularDepreciacaoMensal(
  valorAquisicao: number,
  vidaUtilMeses: number,
): number {
  if (vidaUtilMeses <= 0) return 0
  return Math.round((valorAquisicao / vidaUtilMeses) * 100) / 100
}

// ── Período financeiro ──────────────────────────────────────────────────────

export function periodoToLabel(periodo: string): string {
  const map: Record<string, string> = {
    '7d': '7 dias',
    '30d': '30 dias',
    '90d': '90 dias',
    '365d': 'Ano',
  }
  return map[periodo] ?? '30 dias'
}

// ── Confianca AI (aliases compatíveis com spec dos testes) ──────────────────

/** Alias para getNivelConfianca — retorna nivel baseado em thresholds */
export function getConfidenceLevel(score: number): NivelConfianca {
  return getNivelConfianca(score)
}

/** Retorna cor semântica (verde/amarelo/vermelho) para o nivel */
export function getConfidenceColor(level: NivelConfianca | string): string {
  switch (level) {
    case 'alto':  return 'verde'
    case 'medio': return 'amarelo'
    case 'baixo': return 'vermelho'
    default:      return 'vermelho'
  }
}

// ── Contratos: validação de transição de status de parcela ─────────────────

/**
 * Valida transicao de status de parcela.
 * Transicoes validas:
 *   previsto → pendente
 *   pendente → liberado | cancelado
 *   liberado → pago | cancelado
 *   pago → (terminal)
 *   cancelado → (terminal)
 */
export function validarTransicaoParcela(
  statusAtual: string,
  novoStatus: string,
): boolean {
  const transicoes: Record<string, string[]> = {
    previsto:  ['pendente'],
    pendente:  ['liberado', 'cancelado'],
    liberado:  ['pago', 'cancelado'],
    pago:      [],
    cancelado: [],
  }
  return (transicoes[statusAtual] ?? []).includes(novoStatus)
}
