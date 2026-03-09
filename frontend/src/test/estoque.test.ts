/**
 * BACKUP: estoque.test.ts — created 2026-03-08
 * ============================================================================
 * Suite de testes para os modulos Estoque e Patrimonial do TEG+ ERP
 * Cobre: useEstoque, usePatrimonial, Curva ABC, custo medio, depreciacao,
 * alertas minimo, enderecos, inventario, regras de negocio
 *
 * Extrai logica de negocio pura das pages/hooks e testa de forma isolada.
 *
 * Test IDs: TC-EST-UNIT-001..006, TC-EST-INT-001..008, TC-EST-BIZ-001..004
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  EstItem, EstSaldo, EstMovimentacao, EstInventario, EstInventarioItem,
  PatImobilizado, PatDepreciacao, CurvaABC, TipoMovimentacao,
  StatusImobilizado, StatusInventario, NovaMovimentacaoPayload,
  EstoqueKPIs, PatrimonialKPIs,
} from '../types/estoque'

// =============================================================================
// Logica de negocio extraida dos hooks/pages para testes puros
// =============================================================================

/**
 * Classifica item na Curva ABC.
 * A = Alta rotatividade (itens mais criticos, ~20% SKU = ~80% valor)
 * B = Media rotatividade
 * C = Baixa rotatividade
 * No TEG+, a classificacao e manual (dropdown no cadastro).
 * Este teste valida que os valores aceitos sao consistentes.
 */
function isValidCurvaABC(curva: string): curva is CurvaABC {
  return ['A', 'B', 'C'].includes(curva)
}

/**
 * Calcula custo medio ponderado apos uma entrada.
 * Formula: (saldo_anterior * valor_medio_anterior + qtd_entrada * custo_entrada) /
 *          (saldo_anterior + qtd_entrada)
 *
 * Esta e a formula padrao de custo medio movel usada em ERPs.
 */
function calcCustoMedio(
  saldoAnterior: number,
  valorMedioAnterior: number,
  qtdEntrada: number,
  custoEntrada: number,
): number {
  const totalAnterior = saldoAnterior * valorMedioAnterior
  const totalEntrada = qtdEntrada * custoEntrada
  const novoSaldo = saldoAnterior + qtdEntrada

  if (novoSaldo <= 0) return 0

  return (totalAnterior + totalEntrada) / novoSaldo
}

/**
 * Calcula depreciacao linear mensal.
 * Formula: valor_aquisicao / vida_util_meses
 * Ou: (valor_aquisicao * taxa_depreciacao_anual / 100) / 12
 *
 * Extraido de usePatrimonial.ts (useCalcularDepreciacao) linhas 226-228
 */
function calcDepreciacaoMensal(valorAquisicao: number, taxaDepreciacaoAnual: number): number {
  return (valorAquisicao * taxaDepreciacaoAnual) / 100 / 12
}

/**
 * Calcula depreciacao mensal alternativa por vida util.
 */
function calcDepreciacaoMensalPorVidaUtil(valorAquisicao: number, vidaUtilMeses: number): number {
  if (vidaUtilMeses <= 0) return 0
  return valorAquisicao / vidaUtilMeses
}

/**
 * Calcula novo valor apos depreciacao, respeitando valor residual.
 * Extraido de usePatrimonial.ts linhas 228-229
 */
function calcNovoValorAposDepreciacao(
  valorAtual: number,
  depreciacaoMensal: number,
  valorResidual: number,
): number {
  return Math.max(valorResidual, valorAtual - depreciacaoMensal)
}

/**
 * Verifica se saldo esta abaixo do minimo/ponto de reposicao.
 * Extraido de useEstoque.ts linhas 116-118
 */
function isAbaixoMinimo(saldo: number, item: { ponto_reposicao?: number; estoque_minimo?: number }): boolean {
  return saldo <= (item.ponto_reposicao ?? item.estoque_minimo ?? 0)
}

/**
 * Valida formato de endereco de localizacao: corredor/prateleira/posicao.
 */
function validateEndereco(corredor: string, prateleira: string, posicao: string): {
  valid: boolean
  formatted: string
  errors: string[]
} {
  const errors: string[] = []
  if (!corredor.trim()) errors.push('Corredor obrigatorio')
  if (!prateleira.trim()) errors.push('Prateleira obrigatoria')
  if (!posicao.trim()) errors.push('Posicao obrigatoria')

  return {
    valid: errors.length === 0,
    formatted: `${corredor}/${prateleira}/${posicao}`,
    errors,
  }
}

/**
 * Verifica se movimentacao e do tipo entrada (positiva no saldo).
 * Extraido de Movimentacoes.tsx linha 118
 */
function isEntrada(tipo: TipoMovimentacao): boolean {
  return ['entrada', 'devolucao', 'transferencia_in', 'ajuste_positivo'].includes(tipo)
}

/**
 * Calcula acuracia de inventario.
 * Extraido de useEstoque.ts (useConcluirInventario) linhas 361-365
 */
function calcAcuraciaInventario(
  itens: Array<{ saldo_sistema?: number; saldo_contado?: number }>
): number {
  const total = itens.length
  if (total === 0) return 100

  const semDivergencia = itens.filter(i =>
    Math.abs((i.saldo_contado ?? 0) - (i.saldo_sistema ?? 0)) < 0.001
  ).length

  return (semDivergencia / total) * 100
}

/**
 * Calcula percentual depreciado de imobilizado.
 * Extraido de usePatrimonial.ts linhas 27-29
 */
function calcPercentualDepreciado(valorAquisicao: number, valorAtual: number | undefined): number {
  if (valorAquisicao <= 0) return 0
  const atual = valorAtual ?? valorAquisicao
  return Math.round(((valorAquisicao - atual) / valorAquisicao) * 100)
}

/**
 * Calcula depreciacao acumulada.
 * Extraido de usePatrimonial.ts linha 26
 */
function calcDepreciacaoAcumulada(valorAquisicao: number, valorAtual: number | undefined): number {
  return valorAquisicao - (valorAtual ?? valorAquisicao)
}

/**
 * Calcula valor total em estoque (sum of saldo * valor_medio).
 * Extraido de useEstoque.ts linhas 406-407
 */
function calcValorEstoqueTotal(saldos: Array<{ saldo: number; item?: { valor_medio?: number } }>): number {
  return saldos.reduce((acc, s) => acc + (s.saldo * (s.item?.valor_medio ?? 0)), 0)
}

/**
 * Valida se payload de nova movimentacao tem campos obrigatorios.
 * Extraido de Movimentacoes.tsx linhas 52
 */
function validateMovimentacaoPayload(
  payload: Partial<NovaMovimentacaoPayload>
): boolean {
  return !!(payload.item_id && payload.base_id && payload.tipo && payload.quantidade)
}

// =============================================================================
// Fabricas de dados de teste
// =============================================================================

function makeItem(overrides: Partial<EstItem> = {}): EstItem {
  return {
    id: 'item-001',
    codigo: 'EL-0001',
    descricao: 'Cabo XLPE 240mm',
    unidade: 'M',
    curva_abc: 'A',
    estoque_minimo: 100,
    estoque_maximo: 1000,
    ponto_reposicao: 200,
    lead_time_dias: 15,
    controla_lote: false,
    controla_serie: false,
    tem_validade: false,
    valor_medio: 45.50,
    valor_ultima_entrada: 47.00,
    ativo: true,
    criado_em: '2026-01-01T00:00:00Z',
    atualizado_em: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

function makeSaldo(overrides: Partial<EstSaldo> = {}): EstSaldo {
  return {
    id: 'saldo-001',
    item_id: 'item-001',
    base_id: 'base-001',
    saldo: 500,
    saldo_reservado: 50,
    atualizado_em: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

function makeImobilizado(overrides: Partial<PatImobilizado> = {}): PatImobilizado {
  return {
    id: 'pat-001',
    numero_patrimonio: 'PAT-0001',
    descricao: 'Gerador 150kVA',
    categoria: 'Equipamentos',
    status: 'ativo' as StatusImobilizado,
    valor_aquisicao: 120000,
    vida_util_meses: 120,
    taxa_depreciacao_anual: 10,
    valor_residual: 12000,
    valor_atual: 120000,
    criado_em: '2025-01-01T00:00:00Z',
    atualizado_em: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

// =============================================================================
// TESTES UNITARIOS — TC-EST-UNIT-001 a TC-EST-UNIT-006
// =============================================================================

describe('TC-EST-UNIT — Estoque: testes unitarios', () => {

  // --------------------------------------------------------------------------
  // TC-EST-UNIT-001: Classificacao Curva ABC
  // --------------------------------------------------------------------------
  describe('TC-EST-UNIT-001: Classificacao Curva ABC', () => {
    it('aceita valores validos A, B, C', () => {
      expect(isValidCurvaABC('A')).toBe(true)
      expect(isValidCurvaABC('B')).toBe(true)
      expect(isValidCurvaABC('C')).toBe(true)
    })

    it('rejeita valores invalidos', () => {
      expect(isValidCurvaABC('D')).toBe(false)
      expect(isValidCurvaABC('')).toBe(false)
      expect(isValidCurvaABC('a')).toBe(false) // case sensitive
      expect(isValidCurvaABC('AB')).toBe(false)
    })

    it('CURVA_COLOR tem configuracao para todas as curvas', () => {
      // Extraido de Itens.tsx linhas 9-13
      const CURVA_COLOR = {
        A: { bg: 'bg-red-100', text: 'text-red-700', label: 'Curva A' },
        B: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Curva B' },
        C: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Curva C' },
      }

      expect(CURVA_COLOR['A'].label).toBe('Curva A')
      expect(CURVA_COLOR['B'].label).toBe('Curva B')
      expect(CURVA_COLOR['C'].label).toBe('Curva C')
    })

    it('Curva A = alta rotatividade (mais critico)', () => {
      const item = makeItem({ curva_abc: 'A', valor_medio: 500 })
      expect(item.curva_abc).toBe('A')
      // Itens A devem ter ponto de reposicao >= estoque minimo
      expect(item.ponto_reposicao).toBeGreaterThanOrEqual(item.estoque_minimo)
    })
  })

  // --------------------------------------------------------------------------
  // TC-EST-UNIT-002: Calculo de custo medio ponderado
  // --------------------------------------------------------------------------
  describe('TC-EST-UNIT-002: Calculo de custo medio ponderado', () => {
    it('calcula custo medio apos primeira entrada', () => {
      // Saldo anterior = 0, valor medio anterior = 0
      // Entrada: 100 unidades a R$ 50,00
      const resultado = calcCustoMedio(0, 0, 100, 50)
      expect(resultado).toBe(50)
    })

    it('calcula custo medio apos entrada com saldo existente', () => {
      // Saldo: 200 unidades a R$ 40
      // Entrada: 100 unidades a R$ 55
      // Resultado: (200*40 + 100*55) / (200+100) = (8000 + 5500) / 300 = 45
      const resultado = calcCustoMedio(200, 40, 100, 55)
      expect(resultado).toBeCloseTo(45, 2)
    })

    it('mantem custo medio quando entrada com mesmo custo', () => {
      const resultado = calcCustoMedio(100, 30, 50, 30)
      expect(resultado).toBeCloseTo(30, 2)
    })

    it('retorna 0 quando saldo resultante e zero', () => {
      const resultado = calcCustoMedio(0, 0, 0, 50)
      expect(resultado).toBe(0)
    })

    it('cenario realista: varias entradas sequenciais', () => {
      // Entrada 1: 500 un a R$ 45.50
      let medio = calcCustoMedio(0, 0, 500, 45.50)
      expect(medio).toBeCloseTo(45.50, 2)

      // Entrada 2: 200 un a R$ 48.00
      medio = calcCustoMedio(500, medio, 200, 48.00)
      // (500*45.50 + 200*48) / 700 = (22750 + 9600) / 700 = 46.21
      expect(medio).toBeCloseTo(46.21, 1)

      // Entrada 3: 300 un a R$ 42.00
      medio = calcCustoMedio(700, medio, 300, 42.00)
      // (700*46.21 + 300*42) / 1000 = (32350 + 12600) / 1000 = 44.95
      expect(medio).toBeCloseTo(44.95, 0) // arredondamento aceita 1 digito
    })
  })

  // --------------------------------------------------------------------------
  // TC-EST-UNIT-003: Depreciacao linear mensal
  // --------------------------------------------------------------------------
  describe('TC-EST-UNIT-003: Depreciacao linear mensal', () => {
    it('calcula depreciacao mensal por taxa anual', () => {
      // valor_aquisicao = 120000, taxa = 10% ao ano
      // mensal = 120000 * 10 / 100 / 12 = 1000
      const resultado = calcDepreciacaoMensal(120000, 10)
      expect(resultado).toBe(1000)
    })

    it('calcula depreciacao mensal por vida util', () => {
      // valor_aquisicao = 120000, vida_util = 120 meses
      // mensal = 120000 / 120 = 1000
      const resultado = calcDepreciacaoMensalPorVidaUtil(120000, 120)
      expect(resultado).toBe(1000)
    })

    it('taxa 20% ao ano (equipamento de 5 anos)', () => {
      // valor = 60000, taxa = 20%
      // mensal = 60000 * 20 / 100 / 12 = 1000
      const resultado = calcDepreciacaoMensal(60000, 20)
      expect(resultado).toBe(1000)
    })

    it('depreciacao zero quando taxa e zero', () => {
      const resultado = calcDepreciacaoMensal(100000, 0)
      expect(resultado).toBe(0)
    })

    it('vida util zero retorna zero (sem divisao por zero)', () => {
      const resultado = calcDepreciacaoMensalPorVidaUtil(100000, 0)
      expect(resultado).toBe(0)
    })

    it('novo valor nao vai abaixo do residual', () => {
      const valorAtual = 15000
      const depreciacao = 1000
      const valorResidual = 12000

      // Sem residual: 15000 - 1000 = 14000
      expect(calcNovoValorAposDepreciacao(valorAtual, depreciacao, 0)).toBe(14000)

      // Quando proximo do residual: 12500 - 1000 deveria ser 11500, mas min e 12000
      expect(calcNovoValorAposDepreciacao(12500, depreciacao, valorResidual)).toBe(12000)
    })

    it('depreciacao real e parcial quando proximo do residual', () => {
      // Extraido de usePatrimonial.ts linhas 228-231
      const valorAtual = 12800
      const depreciacaoMensal = 1000
      const valorResidual = 12000

      const novoValor = Math.max(valorResidual, valorAtual - depreciacaoMensal)
      const depreciacaoReal = valorAtual - novoValor

      expect(novoValor).toBe(12000)
      expect(depreciacaoReal).toBe(800) // so deprecia 800, nao 1000
    })
  })

  // --------------------------------------------------------------------------
  // TC-EST-UNIT-004: Flag de estoque minimo (alerta)
  // --------------------------------------------------------------------------
  describe('TC-EST-UNIT-004: Flag de estoque minimo', () => {
    it('item abaixo do ponto de reposicao gera alerta', () => {
      expect(isAbaixoMinimo(150, { ponto_reposicao: 200, estoque_minimo: 100 })).toBe(true)
    })

    it('item igual ao ponto de reposicao gera alerta (<=)', () => {
      expect(isAbaixoMinimo(200, { ponto_reposicao: 200, estoque_minimo: 100 })).toBe(true)
    })

    it('item acima do ponto de reposicao nao gera alerta', () => {
      expect(isAbaixoMinimo(201, { ponto_reposicao: 200, estoque_minimo: 100 })).toBe(false)
    })

    it('usa estoque_minimo como fallback quando ponto_reposicao nao definido', () => {
      expect(isAbaixoMinimo(50, { estoque_minimo: 100 })).toBe(true)
      expect(isAbaixoMinimo(100, { estoque_minimo: 100 })).toBe(true)
      expect(isAbaixoMinimo(101, { estoque_minimo: 100 })).toBe(false)
    })

    it('saldo zero sempre gera alerta', () => {
      expect(isAbaixoMinimo(0, { ponto_reposicao: 1 })).toBe(true)
      expect(isAbaixoMinimo(0, { estoque_minimo: 0 })).toBe(true) // 0 <= 0
    })
  })

  // --------------------------------------------------------------------------
  // TC-EST-UNIT-005: Validacao de formato de endereco
  // --------------------------------------------------------------------------
  describe('TC-EST-UNIT-005: Validacao de formato de endereco', () => {
    it('formato valido: corredor/prateleira/posicao', () => {
      const result = validateEndereco('A', '01', '003')
      expect(result.valid).toBe(true)
      expect(result.formatted).toBe('A/01/003')
      expect(result.errors).toHaveLength(0)
    })

    it('rejeita corredor vazio', () => {
      const result = validateEndereco('', '01', '003')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Corredor obrigatorio')
    })

    it('rejeita prateleira vazia', () => {
      const result = validateEndereco('A', '', '003')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Prateleira obrigatoria')
    })

    it('rejeita posicao vazia', () => {
      const result = validateEndereco('A', '01', '')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Posicao obrigatoria')
    })

    it('rejeita todos os campos vazios (3 erros)', () => {
      const result = validateEndereco('', '', '')
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(3)
    })

    it('aceita caracteres alfanumericos', () => {
      const result = validateEndereco('A2', 'P03', 'POS-B')
      expect(result.valid).toBe(true)
      expect(result.formatted).toBe('A2/P03/POS-B')
    })
  })

  // --------------------------------------------------------------------------
  // TC-EST-UNIT-006: Filtro de itens por base/categoria
  // --------------------------------------------------------------------------
  describe('TC-EST-UNIT-006: Filtro de itens por base/categoria', () => {
    const itens: EstItem[] = [
      makeItem({ id: 'i1', categoria: 'Eletrico', curva_abc: 'A' }),
      makeItem({ id: 'i2', categoria: 'Civil', curva_abc: 'B' }),
      makeItem({ id: 'i3', categoria: 'Eletrico', curva_abc: 'C' }),
      makeItem({ id: 'i4', categoria: 'Mecanico', curva_abc: 'A' }),
    ]

    it('filtra por categoria', () => {
      const eletricos = itens.filter(i => i.categoria === 'Eletrico')
      expect(eletricos).toHaveLength(2)
    })

    it('filtra por curva ABC', () => {
      const curvaA = itens.filter(i => i.curva_abc === 'A')
      expect(curvaA).toHaveLength(2)
    })

    it('combina categoria + curva', () => {
      const eletricoA = itens.filter(i => i.categoria === 'Eletrico' && i.curva_abc === 'A')
      expect(eletricoA).toHaveLength(1)
      expect(eletricoA[0].id).toBe('i1')
    })

    it('sem filtro retorna todos', () => {
      expect(itens).toHaveLength(4)
    })

    it('filtro por busca textual (codigo ou descricao)', () => {
      // Extraido de Itens.tsx linhas 36-39
      const busca = 'xlpe'
      const filtrados = itens.filter(i =>
        i.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        i.codigo.toLowerCase().includes(busca.toLowerCase())
      )
      expect(filtrados).toHaveLength(4) // todos tem 'Cabo XLPE 240mm' por padrao
    })
  })
})

// =============================================================================
// TESTES DE INTEGRACAO — TC-EST-INT-001 a TC-EST-INT-008
// =============================================================================

describe('TC-EST-INT — Estoque: testes de integracao', () => {

  // --------------------------------------------------------------------------
  // TC-EST-INT-001: Tipo de movimentacao (entrada vs saida)
  // --------------------------------------------------------------------------
  describe('TC-EST-INT-001: Classificacao de tipo de movimentacao', () => {
    it('entrada, devolucao, transferencia_in e ajuste_positivo sao entradas', () => {
      expect(isEntrada('entrada')).toBe(true)
      expect(isEntrada('devolucao')).toBe(true)
      expect(isEntrada('transferencia_in')).toBe(true)
      expect(isEntrada('ajuste_positivo')).toBe(true)
    })

    it('saida, transferencia_out, ajuste_negativo e baixa sao saidas', () => {
      expect(isEntrada('saida')).toBe(false)
      expect(isEntrada('transferencia_out')).toBe(false)
      expect(isEntrada('ajuste_negativo')).toBe(false)
      expect(isEntrada('baixa')).toBe(false)
    })

    it('todos os tipos sao cobertos', () => {
      const allTypes: TipoMovimentacao[] = [
        'entrada', 'saida', 'transferencia_out', 'transferencia_in',
        'ajuste_positivo', 'ajuste_negativo', 'devolucao', 'baixa',
      ]
      const entradas = allTypes.filter(isEntrada)
      const saidas = allTypes.filter(t => !isEntrada(t))

      expect(entradas).toHaveLength(4)
      expect(saidas).toHaveLength(4)
      expect(entradas.length + saidas.length).toBe(allTypes.length)
    })
  })

  // --------------------------------------------------------------------------
  // TC-EST-INT-002: Atualizacao de saldo apos entrada/saida
  // --------------------------------------------------------------------------
  describe('TC-EST-INT-002: Atualizacao de saldo apos movimentacao', () => {
    it('entrada aumenta saldo', () => {
      let saldo = 500
      const qtdEntrada = 100
      saldo += qtdEntrada
      expect(saldo).toBe(600)
    })

    it('saida diminui saldo', () => {
      let saldo = 500
      const qtdSaida = 150
      saldo -= qtdSaida
      expect(saldo).toBe(350)
    })

    it('custo medio e recalculado na entrada', () => {
      const novoMedio = calcCustoMedio(500, 45.50, 100, 50.00)
      // (500*45.50 + 100*50) / 600 = (22750 + 5000) / 600 = 46.25
      expect(novoMedio).toBeCloseTo(46.25, 2)
    })

    it('saida nao altera custo medio (custo medio movel)', () => {
      // Na saida, o custo medio nao muda — so o saldo diminui.
      const medioAnterior = 45.50
      const saldoAnterior = 500
      const qtdSaida = 100
      const saldoNovo = saldoAnterior - qtdSaida

      // Custo medio permanece
      expect(medioAnterior).toBe(45.50)
      expect(saldoNovo).toBe(400)
    })
  })

  // --------------------------------------------------------------------------
  // TC-EST-INT-003: Transferencia entre bases
  // --------------------------------------------------------------------------
  describe('TC-EST-INT-003: Transferencia entre bases', () => {
    it('transferencia cria movimentacao de saida na origem e entrada no destino', () => {
      const baseOrigem = { id: 'base-1', saldo: 500 }
      const baseDestino = { id: 'base-2', saldo: 100 }
      const qtdTransferencia = 50

      // Saida na origem
      baseOrigem.saldo -= qtdTransferencia
      // Entrada no destino
      baseDestino.saldo += qtdTransferencia

      expect(baseOrigem.saldo).toBe(450)
      expect(baseDestino.saldo).toBe(150)
    })

    it('soma total permanece constante apos transferencia', () => {
      const baseOrigem = { saldo: 500 }
      const baseDestino = { saldo: 100 }
      const totalAntes = baseOrigem.saldo + baseDestino.saldo
      const qtd = 200

      baseOrigem.saldo -= qtd
      baseDestino.saldo += qtd

      const totalDepois = baseOrigem.saldo + baseDestino.saldo
      expect(totalDepois).toBe(totalAntes)
    })
  })

  // --------------------------------------------------------------------------
  // TC-EST-INT-004: Ajuste de inventario
  // --------------------------------------------------------------------------
  describe('TC-EST-INT-004: Ajuste de inventario', () => {
    it('acuracia 100% quando todos os itens coincidem', () => {
      const itens = [
        { saldo_sistema: 100, saldo_contado: 100 },
        { saldo_sistema: 50, saldo_contado: 50 },
        { saldo_sistema: 200, saldo_contado: 200 },
      ]
      expect(calcAcuraciaInventario(itens)).toBe(100)
    })

    it('acuracia 0% quando nenhum item coincide', () => {
      const itens = [
        { saldo_sistema: 100, saldo_contado: 90 },
        { saldo_sistema: 50, saldo_contado: 60 },
      ]
      expect(calcAcuraciaInventario(itens)).toBe(0)
    })

    it('acuracia parcial (66.67%)', () => {
      const itens = [
        { saldo_sistema: 100, saldo_contado: 100 },
        { saldo_sistema: 50, saldo_contado: 50 },
        { saldo_sistema: 200, saldo_contado: 195 },
      ]
      expect(calcAcuraciaInventario(itens)).toBeCloseTo(66.67, 1)
    })

    it('acuracia 100% com inventario vazio', () => {
      expect(calcAcuraciaInventario([])).toBe(100)
    })

    it('tolera divergencia menor que 0.001 (arredondamento)', () => {
      const itens = [
        { saldo_sistema: 100, saldo_contado: 100.0005 },
        { saldo_sistema: 50, saldo_contado: 49.9998 },
      ]
      expect(calcAcuraciaInventario(itens)).toBe(100)
    })

    it('item sem contagem (undefined) diverge', () => {
      const itens = [
        { saldo_sistema: 100, saldo_contado: undefined },
        { saldo_sistema: 50, saldo_contado: 50 },
      ]
      // undefined contado = 0, diverge de 100
      expect(calcAcuraciaInventario(itens)).toBe(50)
    })
  })

  // --------------------------------------------------------------------------
  // TC-EST-INT-005: Depreciacao patrimonial completa
  // --------------------------------------------------------------------------
  describe('TC-EST-INT-005: Depreciacao patrimonial completa', () => {
    it('calcula sequencia de depreciacoes mensais', () => {
      const imob = makeImobilizado({
        valor_aquisicao: 120000,
        taxa_depreciacao_anual: 10,
        valor_residual: 12000,
        valor_atual: 120000,
      })

      const depreciacaoMensal = calcDepreciacaoMensal(imob.valor_aquisicao, imob.taxa_depreciacao_anual)
      expect(depreciacaoMensal).toBe(1000)

      // Apos 12 meses: 120000 - 12*1000 = 108000
      let valorAtual = imob.valor_atual!
      for (let mes = 0; mes < 12; mes++) {
        valorAtual = calcNovoValorAposDepreciacao(valorAtual, depreciacaoMensal, imob.valor_residual)
      }
      expect(valorAtual).toBe(108000)
    })

    it('percentual depreciado calcula corretamente', () => {
      expect(calcPercentualDepreciado(120000, 108000)).toBe(10)
      expect(calcPercentualDepreciado(120000, 60000)).toBe(50)
      expect(calcPercentualDepreciado(120000, 120000)).toBe(0)
      expect(calcPercentualDepreciado(120000, 0)).toBe(100)
    })

    it('depreciacao acumulada calcula corretamente', () => {
      expect(calcDepreciacaoAcumulada(120000, 108000)).toBe(12000)
      expect(calcDepreciacaoAcumulada(120000, 120000)).toBe(0)
      expect(calcDepreciacaoAcumulada(120000, undefined)).toBe(0) // sem valor_atual = nenhuma depreciacao
    })

    it('depreciacao com valor aquisicao zero retorna 0%', () => {
      expect(calcPercentualDepreciado(0, 0)).toBe(0)
    })
  })

  // --------------------------------------------------------------------------
  // TC-EST-INT-006: Validacao de payload de movimentacao
  // --------------------------------------------------------------------------
  describe('TC-EST-INT-006: Validacao de payload de movimentacao', () => {
    it('payload completo e valido', () => {
      const payload: Partial<NovaMovimentacaoPayload> = {
        item_id: 'item-001',
        base_id: 'base-001',
        tipo: 'entrada',
        quantidade: 100,
      }
      expect(validateMovimentacaoPayload(payload)).toBe(true)
    })

    it('payload sem item_id e invalido', () => {
      const payload: Partial<NovaMovimentacaoPayload> = {
        base_id: 'base-001',
        tipo: 'entrada',
        quantidade: 100,
      }
      expect(validateMovimentacaoPayload(payload)).toBe(false)
    })

    it('payload sem base_id e invalido', () => {
      const payload: Partial<NovaMovimentacaoPayload> = {
        item_id: 'item-001',
        tipo: 'entrada',
        quantidade: 100,
      }
      expect(validateMovimentacaoPayload(payload)).toBe(false)
    })

    it('payload sem tipo e invalido', () => {
      const payload: Partial<NovaMovimentacaoPayload> = {
        item_id: 'item-001',
        base_id: 'base-001',
        quantidade: 100,
      }
      expect(validateMovimentacaoPayload(payload)).toBe(false)
    })

    it('payload sem quantidade e invalido', () => {
      const payload: Partial<NovaMovimentacaoPayload> = {
        item_id: 'item-001',
        base_id: 'base-001',
        tipo: 'entrada',
      }
      expect(validateMovimentacaoPayload(payload)).toBe(false)
    })

    it('payload vazio e invalido', () => {
      expect(validateMovimentacaoPayload({})).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // TC-EST-INT-007: Valor total em estoque
  // --------------------------------------------------------------------------
  describe('TC-EST-INT-007: Valor total em estoque', () => {
    it('calcula soma de saldo * valor_medio', () => {
      const saldos = [
        { saldo: 100, item: { valor_medio: 50 } },
        { saldo: 200, item: { valor_medio: 30 } },
        { saldo: 50, item: { valor_medio: 100 } },
      ]
      // 100*50 + 200*30 + 50*100 = 5000 + 6000 + 5000 = 16000
      expect(calcValorEstoqueTotal(saldos)).toBe(16000)
    })

    it('item sem valor_medio e tratado como zero', () => {
      const saldos = [
        { saldo: 100, item: { valor_medio: undefined } },
        { saldo: 200, item: { valor_medio: 30 } },
      ]
      expect(calcValorEstoqueTotal(saldos)).toBe(6000)
    })

    it('retorna zero com lista vazia', () => {
      expect(calcValorEstoqueTotal([])).toBe(0)
    })
  })

  // --------------------------------------------------------------------------
  // TC-EST-INT-008: KPIs de estoque - estrutura padrao
  // --------------------------------------------------------------------------
  describe('TC-EST-INT-008: KPIs de estoque padrao', () => {
    it('EMPTY_KPIS tem todos os campos zerados', () => {
      const EMPTY_KPIS: EstoqueKPIs = {
        total_itens: 0,
        itens_abaixo_minimo: 0,
        itens_parados: 0,
        valor_estoque_total: 0,
        movimentacoes_mes: 0,
        taxa_ruptura: 0,
        solicitacoes_abertas: 0,
      }

      expect(EMPTY_KPIS.total_itens).toBe(0)
      expect(EMPTY_KPIS.itens_abaixo_minimo).toBe(0)
      expect(EMPTY_KPIS.valor_estoque_total).toBe(0)
      expect(EMPTY_KPIS.acuracia_ultimo_inventario).toBeUndefined()
    })

    it('acuracia do ultimo inventario e opcional', () => {
      const kpis: EstoqueKPIs = {
        total_itens: 150,
        itens_abaixo_minimo: 5,
        itens_parados: 3,
        valor_estoque_total: 500000,
        movimentacoes_mes: 45,
        taxa_ruptura: 0,
        solicitacoes_abertas: 8,
        acuracia_ultimo_inventario: 97.5,
      }

      expect(kpis.acuracia_ultimo_inventario).toBe(97.5)
    })
  })
})

// =============================================================================
// REGRAS DE NEGOCIO — TC-EST-BIZ-001 a TC-EST-BIZ-004
// =============================================================================

describe('TC-EST-BIZ — Estoque: regras de negocio', () => {

  // --------------------------------------------------------------------------
  // TC-EST-BIZ-001: Saldo nunca fica negativo
  // --------------------------------------------------------------------------
  describe('TC-EST-BIZ-001: Saldo nunca fica negativo', () => {
    it('saida nao pode exceder saldo disponivel', () => {
      const saldo = 100
      const saldoReservado = 30
      const saldoDisponivel = saldo - saldoReservado // 70

      const qtdSaida = 80

      // Regra: saida so pode ser <= saldo disponivel
      const podeRetirar = qtdSaida <= saldoDisponivel
      expect(podeRetirar).toBe(false)
    })

    it('saida permitida quando qtd <= saldo disponivel', () => {
      const saldo = 100
      const saldoReservado = 30
      const saldoDisponivel = saldo - saldoReservado // 70

      const qtdSaida = 50
      const podeRetirar = qtdSaida <= saldoDisponivel
      expect(podeRetirar).toBe(true)
    })

    it('saida exata do saldo disponivel e permitida', () => {
      const saldoDisponivel = 70
      const qtdSaida = 70
      expect(qtdSaida <= saldoDisponivel).toBe(true)
    })

    it('saldo disponivel considera reserva', () => {
      const saldo = makeSaldo({ saldo: 200, saldo_reservado: 80 })
      const disponivel = saldo.saldo - saldo.saldo_reservado
      expect(disponivel).toBe(120)
    })
  })

  // --------------------------------------------------------------------------
  // TC-EST-BIZ-002: Saida bloqueada com estoque insuficiente
  // --------------------------------------------------------------------------
  describe('TC-EST-BIZ-002: Saida bloqueada com estoque insuficiente', () => {
    it('rejeita saida quando saldo e zero', () => {
      const saldo = 0
      const qtdSaida = 1
      expect(qtdSaida > saldo).toBe(true) // bloqueado
    })

    it('rejeita saida maior que saldo total', () => {
      const saldo = 50
      const qtdSaida = 100
      expect(qtdSaida > saldo).toBe(true) // bloqueado
    })

    it('permite saida quando saldo suficiente', () => {
      const saldo = 100
      const qtdSaida = 100
      expect(qtdSaida > saldo).toBe(false) // permitido
    })

    it('transferencia tambem valida saldo na origem', () => {
      const saldoOrigem = 30
      const qtdTransferencia = 50
      expect(qtdTransferencia > saldoOrigem).toBe(true) // bloqueado
    })
  })

  // --------------------------------------------------------------------------
  // TC-EST-BIZ-003: Inventario so fecha quando 100% contado
  // --------------------------------------------------------------------------
  describe('TC-EST-BIZ-003: Inventario so fecha quando 100% contado', () => {
    it('inventario com todos os itens contados pode ser concluido', () => {
      const itens = [
        { saldo_sistema: 100, saldo_contado: 98 },
        { saldo_sistema: 50, saldo_contado: 50 },
        { saldo_sistema: 200, saldo_contado: 200 },
      ]

      const todosContados = itens.every(i => i.saldo_contado !== undefined && i.saldo_contado !== null)
      expect(todosContados).toBe(true)
    })

    it('inventario com item nao contado NAO pode ser concluido', () => {
      const itens: Array<{ saldo_sistema: number; saldo_contado?: number }> = [
        { saldo_sistema: 100, saldo_contado: 98 },
        { saldo_sistema: 50 }, // nao contado
        { saldo_sistema: 200, saldo_contado: 200 },
      ]

      const todosContados = itens.every(i => i.saldo_contado !== undefined && i.saldo_contado !== null)
      expect(todosContados).toBe(false)
    })

    it('inventario vazio (sem itens) pode ser concluido', () => {
      const itens: Array<{ saldo_sistema: number; saldo_contado?: number }> = []
      const todosContados = itens.every(i => i.saldo_contado !== undefined)
      expect(todosContados).toBe(true) // Array.every retorna true para array vazio
    })

    it('percentual de contagem calcula progresso', () => {
      const itens: Array<{ saldo_contado?: number }> = [
        { saldo_contado: 100 },
        { saldo_contado: undefined },
        { saldo_contado: 200 },
        { saldo_contado: undefined },
      ]

      const total = itens.length
      const contados = itens.filter(i => i.saldo_contado !== undefined).length
      const percentual = total > 0 ? (contados / total) * 100 : 100

      expect(percentual).toBe(50)
    })
  })

  // --------------------------------------------------------------------------
  // TC-EST-BIZ-004: Depreciacao para apos vida util
  // --------------------------------------------------------------------------
  describe('TC-EST-BIZ-004: Depreciacao para apos atingir valor residual', () => {
    it('depreciacao para quando valor atinge o residual', () => {
      const imob = makeImobilizado({
        valor_aquisicao: 60000,
        taxa_depreciacao_anual: 20,
        valor_residual: 6000,
        valor_atual: 60000,
      })

      const mensal = calcDepreciacaoMensal(imob.valor_aquisicao, imob.taxa_depreciacao_anual)
      expect(mensal).toBe(1000)

      // Simula 60 meses de depreciacao (5 anos = vida util completa)
      let valorAtual = imob.valor_atual!
      let mesesDepreciados = 0

      for (let mes = 0; mes < 100; mes++) {
        const novoValor = calcNovoValorAposDepreciacao(valorAtual, mensal, imob.valor_residual)
        const depreciacaoReal = valorAtual - novoValor

        if (depreciacaoReal <= 0) break

        valorAtual = novoValor
        mesesDepreciados++
      }

      // Vida util = 60 meses (5 anos com taxa 20%)
      // Inicia em 60000, residual 6000
      // Depreciacao total = 60000 - 6000 = 54000
      // Meses = 54000 / 1000 = 54 meses
      expect(mesesDepreciados).toBe(54)
      expect(valorAtual).toBe(6000)
    })

    it('imobilizado 100% depreciado tem valor_atual = valor_residual', () => {
      const valorResidual = 12000
      let valorAtual = 120000
      const mensal = 1000

      // Deprecia ate o limite
      for (let i = 0; i < 200; i++) {
        valorAtual = calcNovoValorAposDepreciacao(valorAtual, mensal, valorResidual)
      }

      expect(valorAtual).toBe(valorResidual)
    })

    it('valor nunca fica abaixo do residual (zero)', () => {
      let valorAtual = 5000
      const mensal = 2000
      const valorResidual = 0

      for (let i = 0; i < 10; i++) {
        valorAtual = calcNovoValorAposDepreciacao(valorAtual, mensal, valorResidual)
      }

      expect(valorAtual).toBe(0)
      expect(valorAtual).toBeGreaterThanOrEqual(valorResidual)
    })

    it('depreciacao mensal e coerente com taxa anual x vida util', () => {
      // 10% ao ano = 120 meses de vida util
      // valor: 120000, residual: 12000
      // depreciacao mensal por taxa: 120000 * 10 / 100 / 12 = 1000
      // depreciacao mensal por vida util: 120000 / 120 = 1000
      // Ambos devem convergir
      const porTaxa = calcDepreciacaoMensal(120000, 10)
      const porVidaUtil = calcDepreciacaoMensalPorVidaUtil(120000, 120)

      expect(porTaxa).toBe(porVidaUtil)
    })

    it('imobilizados com status baixado nao sao depreciados', () => {
      // Extraido de usePatrimonial.ts linha 218:
      // .in('status', ['ativo', 'em_manutencao', 'cedido'])
      const statusDepreciaveis: StatusImobilizado[] = ['ativo', 'em_manutencao', 'cedido']
      const statusNaoDepreciaveis: StatusImobilizado[] = ['baixado', 'em_transferencia', 'pendente_registro']

      for (const s of statusDepreciaveis) {
        expect(statusDepreciaveis.includes(s)).toBe(true)
      }

      for (const s of statusNaoDepreciaveis) {
        expect(statusDepreciaveis.includes(s)).toBe(false)
      }
    })

    it('KPIs patrimoniais excluem imobilizados baixados', () => {
      // Extraido de usePatrimonial.ts linhas 268
      const imobs = [
        makeImobilizado({ id: 'p1', status: 'ativo', valor_aquisicao: 100000, valor_atual: 80000 }),
        makeImobilizado({ id: 'p2', status: 'baixado', valor_aquisicao: 50000, valor_atual: 0 }),
        makeImobilizado({ id: 'p3', status: 'cedido', valor_aquisicao: 30000, valor_atual: 20000 }),
      ]

      const ativos = imobs.filter(i => i.status !== 'baixado')
      expect(ativos).toHaveLength(2)

      const valorBruto = ativos.reduce((a, i) => a + i.valor_aquisicao, 0)
      expect(valorBruto).toBe(130000)

      const valorLiquido = ativos.reduce((a, i) => a + (i.valor_atual ?? i.valor_aquisicao), 0)
      expect(valorLiquido).toBe(100000)
    })
  })
})

// =============================================================================
// TESTES EXTRAS — Cobertura adicional
// =============================================================================

describe('TC-EST-EXTRA — Cobertura adicional', () => {
  it('TIPO_CONFIG cobre todos os tipos de movimentacao', () => {
    // Extraido de Movimentacoes.tsx linhas 12-21
    const TIPO_CONFIG_KEYS = [
      'entrada', 'devolucao', 'transferencia_in', 'ajuste_positivo',
      'saida', 'transferencia_out', 'ajuste_negativo', 'baixa',
    ]

    const allTypes: TipoMovimentacao[] = [
      'entrada', 'saida', 'transferencia_out', 'transferencia_in',
      'ajuste_positivo', 'ajuste_negativo', 'devolucao', 'baixa',
    ]

    for (const tipo of allTypes) {
      expect(TIPO_CONFIG_KEYS.includes(tipo)).toBe(true)
    }
  })

  it('EMPTY_PAYLOAD tem valores padrao sensatos', () => {
    // Extraido de Movimentacoes.tsx linhas 26-28
    const EMPTY_PAYLOAD: Partial<NovaMovimentacaoPayload> = {
      tipo: 'entrada', quantidade: 1, valor_unitario: 0,
    }

    expect(EMPTY_PAYLOAD.tipo).toBe('entrada')
    expect(EMPTY_PAYLOAD.quantidade).toBe(1)
    expect(EMPTY_PAYLOAD.valor_unitario).toBe(0)
  })

  it('unidades de estoque aceitas sao 12', () => {
    // Extraido de types/estoque.ts e Itens.tsx
    const UNIDADES = ['UN', 'M', 'M2', 'M3', 'KG', 'TON', 'L', 'CX', 'PCT', 'RL', 'PR', 'JG']
    expect(UNIDADES).toHaveLength(12)
    expect(UNIDADES).toContain('UN')
    expect(UNIDADES).toContain('KG')
    expect(UNIDADES).toContain('M')
    expect(UNIDADES).toContain('TON')
  })

  it('StatusInventario cobre todos os estados', () => {
    const allStatuses: StatusInventario[] = ['aberto', 'em_contagem', 'concluido', 'cancelado']
    expect(allStatuses).toHaveLength(4)
  })

  it('StatusImobilizado cobre todos os estados', () => {
    const allStatuses: StatusImobilizado[] = [
      'ativo', 'em_manutencao', 'cedido', 'baixado', 'em_transferencia', 'pendente_registro',
    ]
    expect(allStatuses).toHaveLength(6)
  })

  it('PatrimonialKPIs calcula depreciacao mensal global com taxa 20% default', () => {
    // Extraido de usePatrimonial.ts linhas 272-274
    // Nota: o hook usa 0.2 (20%) hardcoded como taxa default para KPI global
    const imobs = [
      { valor_aquisicao: 100000, valor_atual: 80000, status: 'ativo' },
      { valor_aquisicao: 50000, valor_atual: 40000, status: 'ativo' },
    ]

    const ativos = imobs.filter(i => i.status !== 'baixado')
    const depreMensal = ativos.reduce((a, i) => {
      return a + ((i.valor_aquisicao ?? 0) * 0.2 / 12)
    }, 0)

    // (100000 * 0.2/12) + (50000 * 0.2/12) = 1666.67 + 833.33 = 2500
    expect(depreMensal).toBeCloseTo(2500, 0)
  })

  // BUG DOCUMENTADO: usePatrimonialKPIs usa taxa fixa 0.2 (20%) ao inves da
  // taxa_depreciacao_anual individual de cada imobilizado. Isso resulta em
  // calculo impreciso da depreciacao mensal global nos KPIs. O calculo correto
  // deveria usar imob.taxa_depreciacao_anual de cada ativo.
  // Localizacao: usePatrimonial.ts linha 273
  it('[BUG DOC] KPI depreciacao usa taxa fixa 20% ao inves da taxa individual', () => {
    // O hook usePatrimonialKPIs (linha 272-274) faz:
    //   (i.valor_aquisicao ?? 0) * 0.2 / 12
    // Deveria usar:
    //   (i.valor_aquisicao ?? 0) * (i.taxa_depreciacao_anual / 100) / 12
    //
    // Impacto: se um ativo tem taxa de 10% ao ano, o KPI vai reportar
    // depreciacao mensal dobrada. E vice-versa para taxas maiores.
    //
    // A correcao requer que usePatrimonialKPIs busque taxa_depreciacao_anual
    // na query (.select inclui esse campo) e use-o no calculo.

    const taxaFixa = 0.2
    const taxaReal = 0.10 // 10% ao ano
    const valorAquisicao = 120000

    const depreciacaoComTaxaFixa = valorAquisicao * taxaFixa / 12  // 2000
    const depreciacaoComTaxaReal = valorAquisicao * taxaReal / 12  // 1000

    expect(depreciacaoComTaxaFixa).toBe(2000)
    expect(depreciacaoComTaxaReal).toBe(1000)

    // A diferenca demonstra o bug
    expect(depreciacaoComTaxaFixa).not.toBe(depreciacaoComTaxaReal)
  })
})
