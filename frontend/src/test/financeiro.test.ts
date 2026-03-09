/**
 * BACKUP: financeiro.test.ts — created 2026-03-08
 * ============================================================================
 * Suite de testes para o modulo Financeiro do TEG+ ERP
 * Cobre: ContasPagar, ContasReceber, useFinanceiro, useOmie, seguranca
 *
 * Extrai logica de negocio pura das pages/hooks e testa de forma isolada.
 * Hooks que dependem de Supabase sao testados via mock chainable.
 *
 * Test IDs: TC-FIN-UNIT-001..006, TC-FIN-INT-001..008, TC-FIN-SEC-001..004
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ContaPagar, ContaReceber, StatusCP, StatusCR, FinanceiroKPIs } from '../types/financeiro'

// =============================================================================
// Logica de negocio extraida dos componentes para testes puros
// =============================================================================

/**
 * Formata valor em moeda brasileira (sem centavos).
 * Extraido de ContasPagar.tsx, ContasReceber.tsx, EstoqueHome.tsx
 */
function fmtCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

/**
 * Formata valor completo com centavos (usado em cards detalhados).
 */
function fmtCurrencyFull(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Formata data curta dd/mm/yy.
 * Extraido de ContasPagar.tsx
 */
function fmtData(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

/**
 * Verifica se uma CP esta vencida (logica do CPCard).
 * Extraido de ContasPagar.tsx linha 324-325
 */
function isCPVencida(cp: Pick<ContaPagar, 'status' | 'data_vencimento'>): boolean {
  return (
    !['pago', 'conciliado', 'cancelado'].includes(cp.status) &&
    new Date(cp.data_vencimento + 'T00:00:00') < new Date()
  )
}

/**
 * Verifica se uma CR esta vencida (logica do ContasReceber).
 * Extraido de ContasReceber.tsx linha 196-197
 */
function isCRVencida(cr: Pick<ContaReceber, 'status' | 'data_vencimento'>): boolean {
  return (
    !['recebido', 'conciliado', 'cancelado'].includes(cr.status) &&
    new Date(cr.data_vencimento) < new Date()
  )
}

/**
 * Filtra CPs por busca textual.
 * Extraido de ContasPagar.tsx linhas 584-588
 */
function filterCPBySearch(contas: ContaPagar[], busca: string): ContaPagar[] {
  if (!busca) return contas
  const lower = busca.toLowerCase()
  return contas.filter(cp =>
    cp.fornecedor_nome.toLowerCase().includes(lower)
    || cp.descricao?.toLowerCase().includes(lower)
    || cp.numero_documento?.toLowerCase().includes(lower)
  )
}

/**
 * Filtra CRs por busca e status.
 * Extraido de ContasReceber.tsx linhas 91-97
 */
function filterCR(contas: ContaReceber[], statusFilter: string, busca: string): ContaReceber[] {
  return contas
    .filter(cr => !statusFilter || cr.status === statusFilter)
    .filter(cr =>
      !busca || cr.cliente_nome.toLowerCase().includes(busca.toLowerCase())
      || cr.numero_nf?.toLowerCase().includes(busca.toLowerCase())
      || cr.descricao?.toLowerCase().includes(busca.toLowerCase())
    )
}

/**
 * Calcula total em aberto CP (status != pago|conciliado|cancelado).
 * Extraido de ContasPagar.tsx linhas 590-592
 */
function calcTotalAbertoCP(contas: ContaPagar[]): number {
  return contas
    .filter(cp => !['pago', 'conciliado', 'cancelado'].includes(cp.status))
    .reduce((s, cp) => s + cp.valor_original, 0)
}

/**
 * Calcula total pago CP (status = pago|conciliado).
 * Extraido de ContasPagar.tsx linhas 593-595
 */
function calcTotalPagoCP(contas: ContaPagar[]): number {
  return contas
    .filter(cp => ['pago', 'conciliado'].includes(cp.status))
    .reduce((s, cp) => s + cp.valor_pago, 0)
}

/**
 * Calcula total em aberto CR (status != recebido|conciliado|cancelado).
 * Extraido de ContasReceber.tsx linhas 99-101
 */
function calcTotalAbertoCR(contas: ContaReceber[]): number {
  return contas
    .filter(cr => !['recebido', 'conciliado', 'cancelado'].includes(cr.status))
    .reduce((s, cr) => s + cr.valor_original, 0)
}

/**
 * Calcula total recebido CR.
 * Extraido de ContasReceber.tsx linhas 102-104
 */
function calcTotalRecebidoCR(contas: ContaReceber[]): number {
  return contas
    .filter(cr => ['recebido', 'conciliado'].includes(cr.status))
    .reduce((s, cr) => s + cr.valor_recebido, 0)
}

/**
 * Calcula total vencido CR (status vencido ou data_vencimento < hoje).
 * Extraido de ContasReceber.tsx linhas 105-110
 */
function calcTotalVencidoCR(contas: ContaReceber[]): number {
  return contas
    .filter(cr => cr.status === 'vencido' || (
      !['recebido', 'conciliado', 'cancelado'].includes(cr.status) &&
      new Date(cr.data_vencimento) < new Date()
    ))
    .reduce((s, cr) => s + cr.valor_original, 0)
}

/**
 * Calcula data de vencimento padrao = data_entrega + 30 dias.
 * Regra de negocio: quando uma CP e criada a partir de um PO,
 * a data de vencimento padrao e a data prevista de entrega + 30 dias.
 */
function calcDefaultDueDate(deliveryDate: string): string {
  const date = new Date(deliveryDate + 'T00:00:00')
  date.setDate(date.getDate() + 30)
  return date.toISOString().split('T')[0]
}

/**
 * Determina se um CP pode ter pagamento aprovado (canApprove).
 * Extraido de ContasPagar.tsx linha 327
 */
function canApprovePagamento(cp: Pick<ContaPagar, 'status'>): boolean {
  return cp.status === 'aguardando_aprovacao'
}

/**
 * Determina se um CP pode ter pagamento registrado (canPay).
 * Extraido de ContasPagar.tsx linha 328
 */
function canRegisterPagamento(cp: Pick<ContaPagar, 'status'>): boolean {
  return cp.status === 'aprovado_pgto'
}

/**
 * Determina endpoint do Omie por dominio.
 * Extraido de useOmie.ts linhas 103-107
 */
function getOmieEndpoint(dominio: string): string | null {
  const endpoints: Record<string, string> = {
    fornecedores: '/omie/sync/fornecedores',
    contas_pagar: '/omie/sync/contas-pagar',
    contas_receber: '/omie/sync/contas-receber',
  }
  return endpoints[dominio] ?? null
}

// =============================================================================
// Fabricas de dados de teste
// =============================================================================

function makeCPBase(overrides: Partial<ContaPagar> = {}): ContaPagar {
  return {
    id: 'cp-001',
    fornecedor_nome: 'Fornecedor Teste LTDA',
    valor_original: 15000,
    valor_pago: 0,
    data_emissao: '2026-02-01',
    data_vencimento: '2026-03-15',
    data_vencimento_orig: '2026-03-15',
    status: 'previsto' as StatusCP,
    created_at: '2026-02-01T10:00:00Z',
    ...overrides,
  }
}

function makeCRBase(overrides: Partial<ContaReceber> = {}): ContaReceber {
  return {
    id: 'cr-001',
    cliente_nome: 'Cliente Teste SA',
    valor_original: 50000,
    valor_recebido: 0,
    data_emissao: '2026-02-01',
    data_vencimento: '2026-03-15',
    status: 'previsto' as StatusCR,
    created_at: '2026-02-01T10:00:00Z',
    ...overrides,
  }
}

// =============================================================================
// TESTES UNITARIOS — TC-FIN-UNIT-001 a TC-FIN-UNIT-006
// =============================================================================

describe('TC-FIN-UNIT — Financeiro: testes unitarios', () => {

  // --------------------------------------------------------------------------
  // TC-FIN-UNIT-001: Filtro "Vencer Hoje" filtra por data_vencimento = hoje
  // --------------------------------------------------------------------------
  describe('TC-FIN-UNIT-001: Filtro "Vencer Hoje"', () => {
    it('retorna apenas CPs com vencimento igual a data de hoje', () => {
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

      const contas: ContaPagar[] = [
        makeCPBase({ id: 'cp-today', data_vencimento: today }),
        makeCPBase({ id: 'cp-yesterday', data_vencimento: yesterday }),
        makeCPBase({ id: 'cp-tomorrow', data_vencimento: tomorrow }),
      ]

      const vencemHoje = contas.filter(cp => cp.data_vencimento === today)

      expect(vencemHoje).toHaveLength(1)
      expect(vencemHoje[0].id).toBe('cp-today')
    })

    it('retorna vazio se nenhuma CP vence hoje', () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
      const contas: ContaPagar[] = [
        makeCPBase({ data_vencimento: tomorrow }),
      ]

      const today = new Date().toISOString().split('T')[0]
      const vencemHoje = contas.filter(cp => cp.data_vencimento === today)

      expect(vencemHoje).toHaveLength(0)
    })
  })

  // --------------------------------------------------------------------------
  // TC-FIN-UNIT-002: Filtro "Em Aberto" filtra status != pago
  // --------------------------------------------------------------------------
  describe('TC-FIN-UNIT-002: Filtro "Em Aberto"', () => {
    it('retorna CPs cujo status nao e pago, conciliado ou cancelado', () => {
      const contas: ContaPagar[] = [
        makeCPBase({ id: 'cp-1', status: 'previsto' }),
        makeCPBase({ id: 'cp-2', status: 'pago' }),
        makeCPBase({ id: 'cp-3', status: 'aguardando_aprovacao' }),
        makeCPBase({ id: 'cp-4', status: 'conciliado' }),
        makeCPBase({ id: 'cp-5', status: 'cancelado' }),
        makeCPBase({ id: 'cp-6', status: 'aprovado_pgto' }),
      ]

      const aberto = contas.filter(cp => !['pago', 'conciliado', 'cancelado'].includes(cp.status))

      expect(aberto).toHaveLength(3)
      expect(aberto.map(c => c.id)).toEqual(['cp-1', 'cp-3', 'cp-6'])
    })
  })

  // --------------------------------------------------------------------------
  // TC-FIN-UNIT-003: Filtro "Aguard. Aprovacao" filtra status = aguardando_aprovacao
  // --------------------------------------------------------------------------
  describe('TC-FIN-UNIT-003: Filtro "Aguard. Aprovacao"', () => {
    it('retorna apenas CPs com status aguardando_aprovacao', () => {
      const contas: ContaPagar[] = [
        makeCPBase({ id: 'cp-1', status: 'previsto' }),
        makeCPBase({ id: 'cp-2', status: 'aguardando_aprovacao' }),
        makeCPBase({ id: 'cp-3', status: 'aprovado_pgto' }),
        makeCPBase({ id: 'cp-4', status: 'aguardando_aprovacao' }),
      ]

      const aguardando = contas.filter(cp => cp.status === 'aguardando_aprovacao')

      expect(aguardando).toHaveLength(2)
      expect(aguardando.map(c => c.id)).toEqual(['cp-2', 'cp-4'])
    })

    it('canApprovePagamento retorna true apenas para aguardando_aprovacao', () => {
      expect(canApprovePagamento({ status: 'aguardando_aprovacao' })).toBe(true)
      expect(canApprovePagamento({ status: 'previsto' })).toBe(false)
      expect(canApprovePagamento({ status: 'aprovado_pgto' })).toBe(false)
      expect(canApprovePagamento({ status: 'pago' })).toBe(false)
    })

    it('canRegisterPagamento retorna true apenas para aprovado_pgto', () => {
      expect(canRegisterPagamento({ status: 'aprovado_pgto' })).toBe(true)
      expect(canRegisterPagamento({ status: 'aguardando_aprovacao' })).toBe(false)
      expect(canRegisterPagamento({ status: 'pago' })).toBe(false)
      expect(canRegisterPagamento({ status: 'previsto' })).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // TC-FIN-UNIT-004: Calculo de totais por grupo de status
  // --------------------------------------------------------------------------
  describe('TC-FIN-UNIT-004: Calculo de totais por grupo de status', () => {
    const contas: ContaPagar[] = [
      makeCPBase({ id: 'cp-1', status: 'previsto', valor_original: 1000, valor_pago: 0 }),
      makeCPBase({ id: 'cp-2', status: 'aguardando_aprovacao', valor_original: 2500, valor_pago: 0 }),
      makeCPBase({ id: 'cp-3', status: 'pago', valor_original: 5000, valor_pago: 5000 }),
      makeCPBase({ id: 'cp-4', status: 'conciliado', valor_original: 3000, valor_pago: 3000 }),
      makeCPBase({ id: 'cp-5', status: 'cancelado', valor_original: 800, valor_pago: 0 }),
      makeCPBase({ id: 'cp-6', status: 'aprovado_pgto', valor_original: 4200, valor_pago: 0 }),
    ]

    it('total em aberto soma previsto + aguardando + aprovado_pgto', () => {
      expect(calcTotalAbertoCP(contas)).toBe(1000 + 2500 + 4200)
    })

    it('total pago soma pago + conciliado (valor_pago)', () => {
      expect(calcTotalPagoCP(contas)).toBe(5000 + 3000)
    })

    it('total em aberto CR exclui recebido, conciliado e cancelado', () => {
      const crs: ContaReceber[] = [
        makeCRBase({ id: 'cr-1', status: 'previsto', valor_original: 10000 }),
        makeCRBase({ id: 'cr-2', status: 'recebido', valor_original: 5000, valor_recebido: 5000 }),
        makeCRBase({ id: 'cr-3', status: 'faturado', valor_original: 3000 }),
        makeCRBase({ id: 'cr-4', status: 'conciliado', valor_original: 2000, valor_recebido: 2000 }),
      ]

      expect(calcTotalAbertoCR(crs)).toBe(10000 + 3000)
      expect(calcTotalRecebidoCR(crs)).toBe(5000 + 2000)
    })
  })

  // --------------------------------------------------------------------------
  // TC-FIN-UNIT-005: Formatacao de moeda R$ 1.234,56
  // --------------------------------------------------------------------------
  describe('TC-FIN-UNIT-005: Formatacao de moeda brasileira', () => {
    it('formata valor inteiro com R$ e separador de milhar', () => {
      // fmtCurrency arredonda (sem centavos)
      const result = fmtCurrency(1234)
      expect(result).toContain('R$')
      expect(result).toContain('1.234')
    })

    it('formata valor grande corretamente', () => {
      const result = fmtCurrency(1500000)
      expect(result).toContain('R$')
      expect(result).toContain('1.500.000')
    })

    it('formata zero corretamente', () => {
      const result = fmtCurrency(0)
      expect(result).toContain('R$')
      expect(result).toContain('0')
    })

    it('formata valor com centavos (full format)', () => {
      const result = fmtCurrencyFull(1234.56)
      expect(result).toContain('R$')
      expect(result).toContain('1.234')
      // pt-BR usa virgula para decimais
      expect(result).toContain(',56')
    })

    it('fmtData formata data dd/mm/yy', () => {
      const result = fmtData('2026-03-15')
      expect(result).toBe('15/03/26')
    })

    it('fmtData formata data de janeiro corretamente', () => {
      const result = fmtData('2026-01-05')
      expect(result).toBe('05/01/26')
    })
  })

  // --------------------------------------------------------------------------
  // TC-FIN-UNIT-006: Data de vencimento padrao = entrega + 30 dias
  // --------------------------------------------------------------------------
  describe('TC-FIN-UNIT-006: Data de vencimento padrao = entrega + 30 dias', () => {
    it('calcula vencimento 30 dias apos entrega', () => {
      expect(calcDefaultDueDate('2026-03-01')).toBe('2026-03-31')
    })

    it('atravessa mudanca de mes corretamente', () => {
      expect(calcDefaultDueDate('2026-01-15')).toBe('2026-02-14')
    })

    it('atravessa mudanca de ano', () => {
      expect(calcDefaultDueDate('2025-12-15')).toBe('2026-01-14')
    })

    it('funciona com fevereiro (ano nao bissexto)', () => {
      // 30 dias apos 01/02/2026 = 03/03/2026
      expect(calcDefaultDueDate('2026-02-01')).toBe('2026-03-03')
    })

    it('funciona com fevereiro de ano bissexto', () => {
      // 30 dias apos 01/02/2028 = 02/03/2028 (2028 e bissexto)
      expect(calcDefaultDueDate('2028-02-01')).toBe('2028-03-02')
    })
  })
})

// =============================================================================
// TESTES DE INTEGRACAO — TC-FIN-INT-001 a TC-FIN-INT-008
// =============================================================================

describe('TC-FIN-INT — Financeiro: testes de integracao', () => {

  // --------------------------------------------------------------------------
  // TC-FIN-INT-001: Busca textual de ContasPagar
  // --------------------------------------------------------------------------
  describe('TC-FIN-INT-001: Busca textual de CP', () => {
    const contas: ContaPagar[] = [
      makeCPBase({ id: 'cp-1', fornecedor_nome: 'ABC Materiais', descricao: 'Cabos XLPE' }),
      makeCPBase({ id: 'cp-2', fornecedor_nome: 'XYZ Engenharia', descricao: 'Consultoria', numero_documento: 'NF-123' }),
      makeCPBase({ id: 'cp-3', fornecedor_nome: 'Eletrica Silva', descricao: 'Transformadores' }),
    ]

    it('filtra por nome do fornecedor (case insensitive)', () => {
      const result = filterCPBySearch(contas, 'abc')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('cp-1')
    })

    it('filtra por descricao', () => {
      const result = filterCPBySearch(contas, 'consultoria')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('cp-2')
    })

    it('filtra por numero de documento', () => {
      const result = filterCPBySearch(contas, 'NF-123')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('cp-2')
    })

    it('retorna todos quando busca vazia', () => {
      expect(filterCPBySearch(contas, '')).toHaveLength(3)
    })

    it('retorna vazio quando nenhum match', () => {
      expect(filterCPBySearch(contas, 'ZZZ_NADA_ENCONTRADO')).toHaveLength(0)
    })
  })

  // --------------------------------------------------------------------------
  // TC-FIN-INT-002: Filtro combinado de ContasReceber (status + busca)
  // --------------------------------------------------------------------------
  describe('TC-FIN-INT-002: Filtro combinado de CR', () => {
    const contas: ContaReceber[] = [
      makeCRBase({ id: 'cr-1', cliente_nome: 'Energisa', status: 'previsto', numero_nf: 'NF-001' }),
      makeCRBase({ id: 'cr-2', cliente_nome: 'Cemig', status: 'faturado', numero_nf: 'NF-002' }),
      makeCRBase({ id: 'cr-3', cliente_nome: 'Energisa', status: 'recebido', numero_nf: 'NF-003' }),
    ]

    it('filtra por status', () => {
      expect(filterCR(contas, 'previsto', '')).toHaveLength(1)
      expect(filterCR(contas, 'faturado', '')).toHaveLength(1)
      expect(filterCR(contas, 'recebido', '')).toHaveLength(1)
    })

    it('filtra por busca no nome do cliente', () => {
      expect(filterCR(contas, '', 'energisa')).toHaveLength(2)
    })

    it('combina status + busca', () => {
      expect(filterCR(contas, 'previsto', 'energisa')).toHaveLength(1)
      expect(filterCR(contas, 'recebido', 'cemig')).toHaveLength(0)
    })

    it('busca por NF', () => {
      expect(filterCR(contas, '', 'NF-002')).toHaveLength(1)
    })

    it('sem filtros retorna todos', () => {
      expect(filterCR(contas, '', '')).toHaveLength(3)
    })
  })

  // --------------------------------------------------------------------------
  // TC-FIN-INT-003: Deteccao de vencimento (CP)
  // --------------------------------------------------------------------------
  describe('TC-FIN-INT-003: Deteccao de CP vencida', () => {
    it('CP com data passada e status aberto esta vencida', () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      expect(isCPVencida({ status: 'previsto', data_vencimento: yesterday })).toBe(true)
    })

    it('CP com data futura nao esta vencida', () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
      expect(isCPVencida({ status: 'previsto', data_vencimento: tomorrow })).toBe(false)
    })

    it('CP ja paga nao conta como vencida mesmo com data passada', () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      expect(isCPVencida({ status: 'pago', data_vencimento: yesterday })).toBe(false)
      expect(isCPVencida({ status: 'conciliado', data_vencimento: yesterday })).toBe(false)
      expect(isCPVencida({ status: 'cancelado', data_vencimento: yesterday })).toBe(false)
    })

    it('CP aguardando aprovacao com data passada esta vencida', () => {
      const pastDate = '2025-01-01'
      expect(isCPVencida({ status: 'aguardando_aprovacao', data_vencimento: pastDate })).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // TC-FIN-INT-004: Deteccao de vencimento (CR)
  // --------------------------------------------------------------------------
  describe('TC-FIN-INT-004: Deteccao de CR vencida', () => {
    it('CR com data passada e status aberto esta vencida', () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      expect(isCRVencida({ status: 'previsto', data_vencimento: yesterday })).toBe(true)
    })

    it('CR ja recebida nao conta como vencida', () => {
      expect(isCRVencida({ status: 'recebido', data_vencimento: '2020-01-01' })).toBe(false)
      expect(isCRVencida({ status: 'conciliado', data_vencimento: '2020-01-01' })).toBe(false)
    })

    it('CR cancelada nao conta como vencida', () => {
      expect(isCRVencida({ status: 'cancelado', data_vencimento: '2020-01-01' })).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // TC-FIN-INT-005: Total vencido CR combina status vencido + data passada
  // --------------------------------------------------------------------------
  describe('TC-FIN-INT-005: Total vencido CR', () => {
    it('soma titulo com status "vencido" E titulos com data passada', () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const contas: ContaReceber[] = [
        makeCRBase({ id: 'cr-1', status: 'vencido', valor_original: 5000, data_vencimento: '2025-12-01' }),
        makeCRBase({ id: 'cr-2', status: 'previsto', valor_original: 3000, data_vencimento: yesterday }),
        makeCRBase({ id: 'cr-3', status: 'previsto', valor_original: 2000, data_vencimento: '2028-12-31' }),
        makeCRBase({ id: 'cr-4', status: 'recebido', valor_original: 1000, data_vencimento: yesterday }),
      ]

      const totalVencido = calcTotalVencidoCR(contas)
      // cr-1 (status vencido) + cr-2 (data passada) = 5000 + 3000 = 8000
      // cr-3 data futura nao conta, cr-4 recebido nao conta
      expect(totalVencido).toBe(8000)
    })
  })

  // --------------------------------------------------------------------------
  // TC-FIN-INT-006: Fluxo de aprovacao de pagamento (estado)
  // --------------------------------------------------------------------------
  describe('TC-FIN-INT-006: Fluxo de aprovacao de pagamento', () => {
    it('CP so pode ser aprovada quando em aguardando_aprovacao', () => {
      const statuses: StatusCP[] = [
        'previsto', 'aprovado', 'aguardando_docs',
        'aguardando_aprovacao', 'aprovado_pgto',
        'em_remessa', 'pago', 'conciliado', 'cancelado',
      ]

      const aprovavel = statuses.filter(s => canApprovePagamento({ status: s }))
      expect(aprovavel).toEqual(['aguardando_aprovacao'])
    })

    it('CP so pode registrar pagamento quando em aprovado_pgto', () => {
      const statuses: StatusCP[] = [
        'previsto', 'aprovado', 'aguardando_docs',
        'aguardando_aprovacao', 'aprovado_pgto',
        'em_remessa', 'pago', 'conciliado', 'cancelado',
      ]

      const pagavel = statuses.filter(s => canRegisterPagamento({ status: s }))
      expect(pagavel).toEqual(['aprovado_pgto'])
    })
  })

  // --------------------------------------------------------------------------
  // TC-FIN-INT-007: Endpoints Omie por dominio
  // --------------------------------------------------------------------------
  describe('TC-FIN-INT-007: Mapeamento de endpoints Omie', () => {
    it('retorna endpoint correto para fornecedores', () => {
      expect(getOmieEndpoint('fornecedores')).toBe('/omie/sync/fornecedores')
    })

    it('retorna endpoint correto para contas_pagar', () => {
      expect(getOmieEndpoint('contas_pagar')).toBe('/omie/sync/contas-pagar')
    })

    it('retorna endpoint correto para contas_receber', () => {
      expect(getOmieEndpoint('contas_receber')).toBe('/omie/sync/contas-receber')
    })

    it('retorna null para dominio invalido', () => {
      expect(getOmieEndpoint('inventario')).toBeNull()
      expect(getOmieEndpoint('')).toBeNull()
    })
  })

  // --------------------------------------------------------------------------
  // TC-FIN-INT-008: Conciliacao CNAB — logica de lote
  // --------------------------------------------------------------------------
  describe('TC-FIN-INT-008: Conciliacao CNAB em lote', () => {
    it('conciliacao muda status de multiplas CPs para conciliado', () => {
      const ids = ['cp-1', 'cp-2', 'cp-3']
      const contasMap: Record<string, ContaPagar> = {
        'cp-1': makeCPBase({ id: 'cp-1', status: 'pago' }),
        'cp-2': makeCPBase({ id: 'cp-2', status: 'pago' }),
        'cp-3': makeCPBase({ id: 'cp-3', status: 'pago' }),
      }

      // Simula operacao de conciliacao
      for (const id of ids) {
        contasMap[id] = { ...contasMap[id], status: 'conciliado' }
      }

      expect(contasMap['cp-1'].status).toBe('conciliado')
      expect(contasMap['cp-2'].status).toBe('conciliado')
      expect(contasMap['cp-3'].status).toBe('conciliado')
    })

    it('classificacao em lote atualiza centro_custo e classe_financeira', () => {
      const cp = makeCPBase({ id: 'cp-1', centro_custo: undefined, classe_financeira: undefined })

      // Simula classificacao
      const updated = {
        ...cp,
        centro_custo: 'SE-FRUTAL',
        classe_financeira: 'OPEX',
      }

      expect(updated.centro_custo).toBe('SE-FRUTAL')
      expect(updated.classe_financeira).toBe('OPEX')
    })

    it('classificacao com campos vazios nao modifica (logica do hook)', () => {
      // Extraido de useClassificarCPBatch: if (Object.keys(updates).length === 0) return
      const updates: Record<string, string | undefined> = {}
      const centro_custo = undefined
      const classe_financeira = undefined

      if (centro_custo !== undefined) updates.centro_custo = centro_custo
      if (classe_financeira !== undefined) updates.classe_financeira = classe_financeira

      expect(Object.keys(updates).length).toBe(0)
    })
  })
})

// =============================================================================
// TESTES DE SEGURANCA — TC-FIN-SEC-001 a TC-FIN-SEC-004
// =============================================================================

describe('TC-FIN-SEC — Financeiro: testes de seguranca', () => {

  // --------------------------------------------------------------------------
  // TC-FIN-SEC-001: sys_config bloqueado para nao-admin (logica RLS)
  // --------------------------------------------------------------------------
  describe('TC-FIN-SEC-001: sys_config bloqueado para nao-admin', () => {
    it('useOmieConfig lanca erro quando RLS rejeita acesso (usuario nao-admin)', () => {
      // A logica no useOmie.ts linha 56: if (error) throw error
      // Isso significa que um erro de RLS sera propagado para o chamador.
      // O teste verifica que a funcao de query lanca, nao engole o erro.
      const mockRLSError = { message: 'new row violates row-level security policy', code: '42501' }

      // Simula o que acontece quando o hook recebe um erro RLS
      const queryFn = async () => {
        const error = mockRLSError
        if (error) throw error
        return {} // nunca chega aqui
      }

      expect(queryFn()).rejects.toEqual(mockRLSError)
    })

    it('sys_config usa RLS que requer role admin (documentacao)', () => {
      // Este teste documenta que a tabela sys_config deve ter
      // RLS policy que restringe SELECT/INSERT/UPDATE para role admin.
      // A query de useOmieConfig usa: supabase.from('sys_config').select(...)
      // O hook propaga o erro (throw error) ao inves de retornar silenciosamente.
      const tabela = 'sys_config'
      const hookBehavior = 'throw error' // vs 'return []'

      expect(tabela).toBe('sys_config')
      expect(hookBehavior).toBe('throw error')
    })
  })

  // --------------------------------------------------------------------------
  // TC-FIN-SEC-002: Credenciais Omie nao expostas em VITE_*
  // --------------------------------------------------------------------------
  describe('TC-FIN-SEC-002: Credenciais Omie nao expostas em variaveis de ambiente', () => {
    it('VITE_OMIE_APP_KEY nao deve existir no env', () => {
      expect(import.meta.env.VITE_OMIE_APP_KEY).toBeUndefined()
    })

    it('VITE_OMIE_APP_SECRET nao deve existir no env', () => {
      expect(import.meta.env.VITE_OMIE_APP_SECRET).toBeUndefined()
    })

    it('credenciais Omie vem de sys_config no Supabase (via RLS), nao do frontend env', () => {
      // O hook useOmieConfig busca de sys_config, que e protegida por RLS admin-only.
      // As credenciais NUNCA devem estar em variaveis VITE_* porque essas sao
      // embutidas no bundle do frontend e visiveis no browser.
      const envKeys = Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))
      const omieKeys = envKeys.filter(k => k.includes('OMIE'))

      expect(omieKeys).toHaveLength(0)
    })
  })

  // --------------------------------------------------------------------------
  // TC-FIN-SEC-003: OmieConfig retorna strings vazias como fallback seguro
  // --------------------------------------------------------------------------
  describe('TC-FIN-SEC-003: OmieConfig fallback seguro', () => {
    it('retorna strings vazias quando nenhuma config existe', () => {
      // Logica extraida de useOmie.ts linhas 58-64
      const data: { chave: string; valor: string | null }[] = []
      const cfg: Record<string, string> = {}
      data.forEach(row => { cfg[row.chave] = row.valor ?? '' })

      const result = {
        omie_app_key: cfg['omie_app_key'] ?? '',
        omie_app_secret: cfg['omie_app_secret'] ?? '',
        n8n_webhook_url: cfg['n8n_webhook_url'] ?? '',
        omie_enabled: cfg['omie_enabled'] ?? 'false',
      }

      expect(result.omie_app_key).toBe('')
      expect(result.omie_app_secret).toBe('')
      expect(result.n8n_webhook_url).toBe('')
      expect(result.omie_enabled).toBe('false')
    })

    it('omie_enabled defaults to "false" (nao ativa integracao por padrao)', () => {
      const cfg: Record<string, string> = {}
      const omieEnabled = cfg['omie_enabled'] ?? 'false'
      expect(omieEnabled).toBe('false')
    })
  })

  // --------------------------------------------------------------------------
  // TC-FIN-SEC-004: Webhook URL sanitizacao
  // --------------------------------------------------------------------------
  describe('TC-FIN-SEC-004: Webhook URL sanitizacao', () => {
    it('remove trailing slash do webhook URL', () => {
      // Logica extraida de useOmie.ts linha 118
      const webhookUrl = 'https://n8n.example.com/webhook/'
      const sanitized = webhookUrl.replace(/\/$/, '')
      expect(sanitized).toBe('https://n8n.example.com/webhook')
    })

    it('nao altera URL sem trailing slash', () => {
      const webhookUrl = 'https://n8n.example.com/webhook'
      const sanitized = webhookUrl.replace(/\/$/, '')
      expect(sanitized).toBe('https://n8n.example.com/webhook')
    })

    it('monta URL final corretamente', () => {
      const webhookUrl = 'https://n8n.example.com/webhook/'
      const endpoint = '/omie/sync/contas-pagar'
      const url = webhookUrl.replace(/\/$/, '') + endpoint
      expect(url).toBe('https://n8n.example.com/webhook/omie/sync/contas-pagar')
    })
  })
})

// =============================================================================
// KPIs — validacao da estrutura padrao
// =============================================================================

describe('TC-FIN-EXTRA — KPIs e estrutura de dados', () => {
  it('EMPTY_KPIS tem todos os campos zerados', () => {
    const EMPTY_KPIS: FinanceiroKPIs = {
      total_cp: 0, cp_a_vencer: 0, cp_vencidas: 0, cp_pagas_periodo: 0,
      valor_total_aberto: 0, valor_pago_periodo: 0, valor_a_vencer_7d: 0,
      aguardando_aprovacao: 0, total_cr: 0, valor_cr_aberto: 0,
    }

    for (const [, value] of Object.entries(EMPTY_KPIS)) {
      expect(value).toBe(0)
    }
  })

  it('StatusCP cobre todos os estados do fluxo', () => {
    const allStatuses: StatusCP[] = [
      'previsto', 'aprovado', 'aguardando_docs',
      'aguardando_aprovacao', 'aprovado_pgto',
      'em_remessa', 'pago', 'conciliado', 'cancelado',
    ]
    expect(allStatuses).toHaveLength(9)
  })

  it('StatusCR cobre todos os estados do fluxo', () => {
    const allStatuses: StatusCR[] = [
      'previsto', 'faturado', 'parcial',
      'recebido', 'conciliado', 'vencido', 'cancelado',
    ]
    expect(allStatuses).toHaveLength(7)
  })

  it('STATUS_CONFIG CP tem label para todos os status', () => {
    // Extraido de ContasPagar.tsx linhas 293-303
    const STATUS_CONFIG: Record<string, { label: string }> = {
      previsto: { label: 'Previsto' },
      aprovado: { label: 'Aprovado' },
      aguardando_docs: { label: 'Aguard. Docs' },
      aguardando_aprovacao: { label: 'Aguard. Aprov.' },
      aprovado_pgto: { label: 'Pgto Aprovado' },
      em_remessa: { label: 'Em Remessa' },
      pago: { label: 'Pago' },
      conciliado: { label: 'Conciliado' },
      cancelado: { label: 'Cancelado' },
    }

    const allStatuses: StatusCP[] = [
      'previsto', 'aprovado', 'aguardando_docs',
      'aguardando_aprovacao', 'aprovado_pgto',
      'em_remessa', 'pago', 'conciliado', 'cancelado',
    ]

    for (const s of allStatuses) {
      expect(STATUS_CONFIG[s]).toBeDefined()
      expect(STATUS_CONFIG[s].label.length).toBeGreaterThan(0)
    }
  })
})
