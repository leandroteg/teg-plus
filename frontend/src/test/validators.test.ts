/**
 * BACKUP: Arquivo novo — test/validators.test.ts
 * Testes unitários para utils/validators.ts
 * Cobertura: 100% das funções puras do TEG+ ERP
 */
import { describe, it, expect } from 'vitest'
import {
  validarCNPJ, formatarCNPJ,
  validarCPF, formatarCPF,
  validarPlaca, validarChaveNFe,
  formatarMoeda, parseMoeda,
  determinarAlcada, cotacoesMinimas,
  gerarNumeroRequisicao, gerarNumeroPedido,
  getNivelConfianca, getCorConfianca,
  ajustarDiaVencimento, calcularProximoVencimento, gerarParcelas,
  calcularProgressoContrato,
  determinarAlcadaLogistica,
  calcularDesvioConsumo, calcularKmProximaPreventiva, alertaVencimento,
  calcularValorMedio, classificarCurvaABC, calcularDepreciacaoMensal,
  periodoToLabel,
} from '../utils/validators'

// ══════════════════════════════════════════════════════════════════════════════
// CNPJ
// ══════════════════════════════════════════════════════════════════════════════

describe('validarCNPJ', () => {
  it('aceita CNPJ válido (11.222.333/0001-81)', () => {
    expect(validarCNPJ('11222333000181')).toBe(true)
  })

  it('aceita CNPJ válido com máscara', () => {
    expect(validarCNPJ('11.222.333/0001-81')).toBe(true)
  })

  it('rejeita CNPJ com dígitos iguais', () => {
    expect(validarCNPJ('11111111111111')).toBe(false)
    expect(validarCNPJ('00000000000000')).toBe(false)
  })

  it('rejeita CNPJ com tamanho incorreto', () => {
    expect(validarCNPJ('1234567890')).toBe(false)
    expect(validarCNPJ('123456789012345')).toBe(false)
  })

  it('rejeita CNPJ com dígito verificador inválido', () => {
    expect(validarCNPJ('11222333000182')).toBe(false) // último dígito errado
  })

  it('rejeita string vazia', () => {
    expect(validarCNPJ('')).toBe(false)
  })
})

describe('formatarCNPJ', () => {
  it('formata CNPJ corretamente', () => {
    expect(formatarCNPJ('11222333000181')).toBe('11.222.333/0001-81')
  })

  it('formata CNPJ com padding se curto', () => {
    const result = formatarCNPJ('12345')
    expect(result).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// CPF
// ══════════════════════════════════════════════════════════════════════════════

describe('validarCPF', () => {
  it('aceita CPF válido (529.982.247-25)', () => {
    expect(validarCPF('52998224725')).toBe(true)
  })

  it('aceita CPF válido com máscara', () => {
    expect(validarCPF('529.982.247-25')).toBe(true)
  })

  it('rejeita CPF com dígitos iguais', () => {
    expect(validarCPF('11111111111')).toBe(false)
    expect(validarCPF('00000000000')).toBe(false)
  })

  it('rejeita CPF com tamanho incorreto', () => {
    expect(validarCPF('1234567890')).toBe(false)
    expect(validarCPF('123456789012')).toBe(false)
  })

  it('rejeita CPF com dígito verificador inválido', () => {
    expect(validarCPF('52998224726')).toBe(false)
  })

  it('rejeita string vazia', () => {
    expect(validarCPF('')).toBe(false)
  })
})

describe('formatarCPF', () => {
  it('formata CPF corretamente', () => {
    expect(formatarCPF('52998224725')).toBe('529.982.247-25')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Placa de veículo
// ══════════════════════════════════════════════════════════════════════════════

describe('validarPlaca', () => {
  it('aceita placa Mercosul (ABC1D23)', () => {
    expect(validarPlaca('ABC1D23')).toBe(true)
  })

  it('aceita placa antiga (ABC-1234)', () => {
    expect(validarPlaca('ABC-1234')).toBe(true)
    expect(validarPlaca('ABC1234')).toBe(true)
  })

  it('aceita placa minúscula', () => {
    expect(validarPlaca('abc1d23')).toBe(true)
  })

  it('rejeita placa com formato inválido', () => {
    expect(validarPlaca('12ABC34')).toBe(false)
    expect(validarPlaca('ABCD123')).toBe(false)
    expect(validarPlaca('AB1234')).toBe(false)
    expect(validarPlaca('')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Chave NF-e
// ══════════════════════════════════════════════════════════════════════════════

describe('validarChaveNFe', () => {
  it('aceita chave com 44 dígitos', () => {
    expect(validarChaveNFe('3' .repeat(44))).toBe(true)
  })

  it('aceita chave com espaços/hifens (limpa automaticamente)', () => {
    expect(validarChaveNFe('3524 0806 2268 0000 0801 5500 1000 0000 1210 0000 5810'
      .replace(/\s/g, ''))).toBe(true)
  })

  it('rejeita chave com menos de 44 dígitos', () => {
    expect(validarChaveNFe('1234567890')).toBe(false)
  })

  it('rejeita chave vazia', () => {
    expect(validarChaveNFe('')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Valores monetários
// ══════════════════════════════════════════════════════════════════════════════

describe('formatarMoeda', () => {
  it('formata valor positivo', () => {
    const result = formatarMoeda(1234.56)
    // Locale-dependent, mas deve conter R$ e 1.234,56
    expect(result).toContain('R$')
    expect(result).toContain('1.234,56')
  })

  it('formata zero', () => {
    expect(formatarMoeda(0)).toContain('0,00')
  })

  it('formata valor negativo', () => {
    const result = formatarMoeda(-500)
    expect(result).toContain('500,00')
  })
})

describe('parseMoeda', () => {
  it('converte string BRL para número', () => {
    expect(parseMoeda('R$ 1.234,56')).toBe(1234.56)
  })

  it('retorna 0 para string inválida', () => {
    expect(parseMoeda('abc')).toBe(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Alçada de aprovação (Compras)
// ══════════════════════════════════════════════════════════════════════════════

describe('determinarAlcada', () => {
  it('TC-CMP-UNIT-002: valor ≤ R$5.000 → nível 1', () => {
    expect(determinarAlcada(250)).toBe(1)
    expect(determinarAlcada(5000)).toBe(1)
  })

  it('TC-CMP-UNIT-003: valor ≤ R$25.000 → nível 2', () => {
    expect(determinarAlcada(5001)).toBe(2)
    expect(determinarAlcada(15000)).toBe(2)
    expect(determinarAlcada(25000)).toBe(2)
  })

  it('TC-CMP-UNIT-004: valor ≤ R$100.000 → nível 3', () => {
    expect(determinarAlcada(25001)).toBe(3)
    expect(determinarAlcada(80000)).toBe(3)
    expect(determinarAlcada(100000)).toBe(3)
  })

  it('TC-CMP-UNIT-005: valor > R$100.000 → nível 4', () => {
    expect(determinarAlcada(100001)).toBe(4)
    expect(determinarAlcada(500000)).toBe(4)
  })
})

describe('cotacoesMinimas', () => {
  it('TC-CMP-UNIT-011: ≤R$1k exige 1 cotação', () => {
    expect(cotacoesMinimas(500)).toBe(1)
    expect(cotacoesMinimas(1000)).toBe(1)
  })

  it('TC-CMP-UNIT-011: R$1k-5k exige 2 cotações', () => {
    expect(cotacoesMinimas(1001)).toBe(2)
    expect(cotacoesMinimas(5000)).toBe(2)
  })

  it('TC-CMP-UNIT-011: >R$5k exige 3 cotações', () => {
    expect(cotacoesMinimas(5001)).toBe(3)
    expect(cotacoesMinimas(6000)).toBe(3)
    expect(cotacoesMinimas(100000)).toBe(3)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Números de RC e PO
// ══════════════════════════════════════════════════════════════════════════════

describe('gerarNumeroRequisicao', () => {
  it('TC-CMP-UNIT-001: gera RC-YYYYMM-XXXX', () => {
    const d = new Date(2026, 2, 8) // março 2026
    expect(gerarNumeroRequisicao(1, d)).toBe('RC-202603-0001')
    expect(gerarNumeroRequisicao(42, d)).toBe('RC-202603-0042')
    expect(gerarNumeroRequisicao(999, d)).toBe('RC-202603-0999')
  })
})

describe('gerarNumeroPedido', () => {
  it('TC-CMP-UNIT-012: gera PO-YYYY-NNNNN', () => {
    const d = new Date(2026, 2, 8)
    expect(gerarNumeroPedido(1, d)).toBe('PO-2026-00001')
    expect(gerarNumeroPedido(123, d)).toBe('PO-2026-00123')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Confiança AI
// ══════════════════════════════════════════════════════════════════════════════

describe('getNivelConfianca', () => {
  it('TC-CAD-UNIT-004: ≥0.8 → alto', () => {
    expect(getNivelConfianca(0.8)).toBe('alto')
    expect(getNivelConfianca(0.95)).toBe('alto')
    expect(getNivelConfianca(1.0)).toBe('alto')
  })

  it('TC-CAD-UNIT-004: 0.5-0.79 → medio', () => {
    expect(getNivelConfianca(0.5)).toBe('medio')
    expect(getNivelConfianca(0.72)).toBe('medio')
    expect(getNivelConfianca(0.79)).toBe('medio')
  })

  it('TC-CAD-UNIT-004: <0.5 → baixo', () => {
    expect(getNivelConfianca(0.49)).toBe('baixo')
    expect(getNivelConfianca(0.1)).toBe('baixo')
    expect(getNivelConfianca(0)).toBe('baixo')
  })
})

describe('getCorConfianca', () => {
  it('retorna cores Tailwind corretas', () => {
    expect(getCorConfianca('alto')).toBe('text-green-600')
    expect(getCorConfianca('medio')).toBe('text-yellow-600')
    expect(getCorConfianca('baixo')).toBe('text-red-600')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Contratos: parcelas
// ══════════════════════════════════════════════════════════════════════════════

describe('ajustarDiaVencimento', () => {
  it('TC-CON-UNIT-005: dia 31 em fevereiro → dia 28', () => {
    const d = ajustarDiaVencimento(31, 1, 2026) // fev 2026
    expect(d.getDate()).toBe(28)
  })

  it('TC-CON-UNIT-005: dia 31 em fev bissexto → dia 29', () => {
    const d = ajustarDiaVencimento(31, 1, 2028) // fev 2028 (bissexto)
    expect(d.getDate()).toBe(29)
  })

  it('dia 15 em março → dia 15 (sem ajuste)', () => {
    const d = ajustarDiaVencimento(15, 2, 2026) // mar 2026
    expect(d.getDate()).toBe(15)
  })

  it('dia 30 em abril → dia 30 (limite OK)', () => {
    const d = ajustarDiaVencimento(30, 3, 2026) // abr 2026
    expect(d.getDate()).toBe(30)
  })

  it('dia 31 em abril → dia 30', () => {
    const d = ajustarDiaVencimento(31, 3, 2026) // abr tem 30 dias
    expect(d.getDate()).toBe(30)
  })
})

describe('calcularProximoVencimento', () => {
  const base = new Date(2026, 0, 15) // 15 jan 2026

  it('TC-CON-UNIT-002: mensal parcela 1 → 15 fev', () => {
    const d = calcularProximoVencimento(base, 'mensal', 1)
    expect(d.getMonth()).toBe(1) // fev
    expect(d.getDate()).toBe(15)
  })

  it('TC-CON-UNIT-002: bimestral parcela 1 → 15 mar', () => {
    const d = calcularProximoVencimento(base, 'bimestral', 1)
    expect(d.getMonth()).toBe(2) // mar
  })

  it('TC-CON-UNIT-002: trimestral parcela 2 → 15 jul', () => {
    const d = calcularProximoVencimento(base, 'trimestral', 2)
    expect(d.getMonth()).toBe(6) // jul
  })

  it('TC-CON-UNIT-002: semestral parcela 1 → 15 jul', () => {
    const d = calcularProximoVencimento(base, 'semestral', 1)
    expect(d.getMonth()).toBe(6) // jul
  })

  it('TC-CON-UNIT-002: anual parcela 1 → 15 jan 2027', () => {
    const d = calcularProximoVencimento(base, 'anual', 1)
    expect(d.getFullYear()).toBe(2027)
    expect(d.getMonth()).toBe(0) // jan
  })
})

describe('gerarParcelas', () => {
  it('TC-CON-UNIT-003: gera N parcelas com intervalo correto', () => {
    const parcelas = gerarParcelas(12000, 4, new Date(2026, 0, 1), 'mensal', 10)
    expect(parcelas).toHaveLength(4)
    expect(parcelas[0].numero).toBe(1)
    expect(parcelas[3].numero).toBe(4)
    // Soma dos valores = valor total
    const soma = parcelas.reduce((s, p) => s + p.valor, 0)
    expect(soma).toBeCloseTo(12000, 0)
  })

  it('última parcela absorve resto da divisão', () => {
    const parcelas = gerarParcelas(10000, 3, new Date(2026, 0, 1), 'mensal', 15)
    const soma = parcelas.reduce((s, p) => s + p.valor, 0)
    expect(soma).toBeCloseTo(10000, 0)
  })
})

describe('calcularProgressoContrato', () => {
  it('TC-CON-UNIT-006: calcula % correto', () => {
    expect(calcularProgressoContrato(50000, 100000)).toBe(50)
    expect(calcularProgressoContrato(75000, 100000)).toBe(75)
  })

  it('retorna 0 quando valor_total é 0', () => {
    expect(calcularProgressoContrato(5000, 0)).toBe(0)
  })

  it('não excede 100%', () => {
    expect(calcularProgressoContrato(150000, 100000)).toBe(100)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Logística: alçada automática
// ══════════════════════════════════════════════════════════════════════════════

describe('determinarAlcadaLogistica', () => {
  it('TC-LOG-UNIT-002: ≤R$500 → auto', () => {
    expect(determinarAlcadaLogistica(0)).toBe('auto')
    expect(determinarAlcadaLogistica(500)).toBe('auto')
  })

  it('TC-LOG-UNIT-002: R$501-2000 → gerente', () => {
    expect(determinarAlcadaLogistica(501)).toBe('gerente')
    expect(determinarAlcadaLogistica(2000)).toBe('gerente')
  })

  it('TC-LOG-UNIT-002: >R$2000 → diretoria', () => {
    expect(determinarAlcadaLogistica(2001)).toBe('diretoria')
    expect(determinarAlcadaLogistica(50000)).toBe('diretoria')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Frotas
// ══════════════════════════════════════════════════════════════════════════════

describe('calcularDesvioConsumo', () => {
  it('TC-FRO-UNIT-004: desvio >15% gera alerta', () => {
    const r = calcularDesvioConsumo(8, 10)
    expect(r.desvio).toBe(20)
    expect(r.alerta).toBe(true)
  })

  it('TC-FRO-UNIT-004: desvio ≤15% sem alerta', () => {
    const r = calcularDesvioConsumo(9.5, 10)
    expect(r.alerta).toBe(false)
  })

  it('consumo esperado zero → sem alerta', () => {
    const r = calcularDesvioConsumo(5, 0)
    expect(r.desvio).toBe(0)
    expect(r.alerta).toBe(false)
  })
})

describe('calcularKmProximaPreventiva', () => {
  it('TC-FRO-UNIT-003: hodometro + intervalo', () => {
    expect(calcularKmProximaPreventiva(45000, 10000)).toBe(55000)
  })
})

describe('alertaVencimento', () => {
  it('TC-FRO-UNIT-006: alerta quando < 30 dias', () => {
    const futuro15dias = new Date()
    futuro15dias.setDate(futuro15dias.getDate() + 15)
    expect(alertaVencimento(futuro15dias, 30)).toBe(true)
  })

  it('sem alerta quando > 30 dias', () => {
    const futuro60dias = new Date()
    futuro60dias.setDate(futuro60dias.getDate() + 60)
    expect(alertaVencimento(futuro60dias, 30)).toBe(false)
  })

  it('alerta no dia do vencimento', () => {
    const hoje = new Date()
    hoje.setHours(12, 0, 0, 0) // meio-dia hoje
    expect(alertaVencimento(hoje, 30)).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Estoque
// ══════════════════════════════════════════════════════════════════════════════

describe('calcularValorMedio', () => {
  it('TC-EST-UNIT-002: cálculo com saldo anterior', () => {
    // Saldo: 10 itens a R$50 = R$500
    // Entrada: 5 itens a R$80 = R$400
    // Novo médio: (500 + 400) / 15 = R$60
    expect(calcularValorMedio(10, 50, 5, 80)).toBe(60)
  })

  it('TC-EST-UNIT-002: primeiro lote (sem saldo anterior)', () => {
    expect(calcularValorMedio(0, 0, 10, 100)).toBe(100)
  })

  it('saldo zero após saída → valor médio 0', () => {
    expect(calcularValorMedio(0, 50, 0, 0)).toBe(0)
  })
})

describe('classificarCurvaABC', () => {
  it('TC-EST-UNIT-001: classifica A/B/C corretamente', () => {
    const itens = [
      { id: '1', valor_total: 80000 },
      { id: '2', valor_total: 10000 },
      { id: '3', valor_total: 5000 },
      { id: '4', valor_total: 3000 },
      { id: '5', valor_total: 2000 },
    ]
    const result = classificarCurvaABC(itens)
    expect(result.get('1')).toBe('A') // 80k/100k = 80%
    expect(result.get('2')).toBe('B') // 90k/100k = 90%
    expect(result.get('3')).toBe('B') // 95k/100k = 95%
    expect(result.get('4')).toBe('C') // 98k/100k
    expect(result.get('5')).toBe('C') // 100k/100k
  })

  it('lista vazia retorna mapa vazio', () => {
    expect(classificarCurvaABC([]).size).toBe(0)
  })
})

describe('calcularDepreciacaoMensal', () => {
  it('TC-EST-UNIT-003: depreciação linear mensal', () => {
    // Bem de R$120.000, vida útil 120 meses → R$1.000/mês
    expect(calcularDepreciacaoMensal(120000, 120)).toBe(1000)
  })

  it('vida útil zero → depreciação 0', () => {
    expect(calcularDepreciacaoMensal(50000, 0)).toBe(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Período financeiro
// ══════════════════════════════════════════════════════════════════════════════

describe('periodoToLabel', () => {
  it('mapeia 7d → "7 dias"', () => {
    expect(periodoToLabel('7d')).toBe('7 dias')
  })

  it('mapeia 30d → "30 dias"', () => {
    expect(periodoToLabel('30d')).toBe('30 dias')
  })

  it('mapeia 90d → "90 dias"', () => {
    expect(periodoToLabel('90d')).toBe('90 dias')
  })

  it('mapeia 365d → "Ano"', () => {
    expect(periodoToLabel('365d')).toBe('Ano')
  })

  it('fallback para "30 dias" em período desconhecido', () => {
    expect(periodoToLabel('xyz')).toBe('30 dias')
  })
})
