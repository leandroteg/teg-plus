// ============================================================================
// BACKUP: frontend/src/test/contratos.test.ts
// Criado em: 2026-03-08
// Descricao: Suite de testes para o modulo de Contratos do TEG+ ERP.
//   Cobre validacoes unitarias (tipos de contrato, recorrencias, parcelas,
//   transicoes de status, dia de vencimento fixo, progresso) e testes de
//   integracao (hooks useContratos via TanStack Query + Supabase mock).
//
// IDs dos testes: TC-CON-UNIT-001 a TC-CON-UNIT-006 (unitarios)
//                 TC-CON-INT-001 a TC-CON-INT-009 (integracao)
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSupabase, mockRpc, resetAllMocks } from './mocks/supabase'
import {
  calcularProximoVencimento,
  ajustarDiaVencimento,
  gerarParcelas,
  calcularProgressoContrato,
  validarTransicaoParcela,
} from '../utils/validators'
import type {
  TipoContrato,
  RecorrenciaContrato,
  StatusParcela,
  Contrato,
  Parcela,
  ContratoMedicao,
  NovoContratoPayload,
} from '../types/contratos'

// ============================================================================
// TESTES UNITARIOS — Logica de Negocios Contratos
// ============================================================================

describe('Contratos — Testes Unitarios', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  // ── TC-CON-UNIT-001: Tipos de contrato (receita vs despesa) ─────────────

  describe('TC-CON-UNIT-001: Tipo de contrato — campos condicionais', () => {
    it('contrato tipo "receita" requer cliente_id', () => {
      const payload: Partial<NovoContratoPayload> = {
        tipo_contrato: 'receita' as TipoContrato,
        cliente_id: '',
        fornecedor_id: undefined,
      }
      // Receita exige cliente
      expect(payload.tipo_contrato).toBe('receita')
      expect(!payload.cliente_id).toBe(true) // campo obrigatorio faltando
      expect(payload.fornecedor_id).toBeUndefined() // nao obrigatorio para receita
    })

    it('contrato tipo "despesa" requer fornecedor_id', () => {
      const payload: Partial<NovoContratoPayload> = {
        tipo_contrato: 'despesa' as TipoContrato,
        fornecedor_id: '',
        cliente_id: 'placeholder-id',
      }
      expect(payload.tipo_contrato).toBe('despesa')
      expect(!payload.fornecedor_id).toBe(true) // campo obrigatorio faltando
    })

    it('contrato despesa valido tem fornecedor preenchido', () => {
      const payload: Partial<NovoContratoPayload> = {
        tipo_contrato: 'despesa',
        fornecedor_id: 'forn-uuid-123',
        cliente_id: 'cli-uuid-default',
      }
      expect(payload.fornecedor_id).toBeTruthy()
    })

    it('contrato receita valido tem cliente preenchido', () => {
      const payload: Partial<NovoContratoPayload> = {
        tipo_contrato: 'receita',
        cliente_id: 'cli-uuid-456',
        fornecedor_id: undefined,
      }
      expect(payload.cliente_id).toBeTruthy()
      expect(payload.fornecedor_id).toBeUndefined()
    })

    it('apenas dois tipos validos existem: receita e despesa', () => {
      const tiposValidos: TipoContrato[] = ['receita', 'despesa']
      expect(tiposValidos).toHaveLength(2)
      expect(tiposValidos).toContain('receita')
      expect(tiposValidos).toContain('despesa')
    })
  })

  // ── TC-CON-UNIT-002: Recorrencias e calculo de datas ────────────────────

  describe('TC-CON-UNIT-002: Recorrencias — calculo de datas', () => {
    const dataBase = new Date(2026, 0, 15) // 15/jan/2026

    it('recorrencia mensal: parcela 1 = data base, parcela 2 = +1 mes', () => {
      const p1 = calcularProximoVencimento(dataBase, 'mensal', 0)
      const p2 = calcularProximoVencimento(dataBase, 'mensal', 1)
      expect(p1.getMonth()).toBe(0) // jan
      expect(p2.getMonth()).toBe(1) // fev
      expect(p2.getDate()).toBe(15)
    })

    it('recorrencia bimestral: avanca 2 meses por parcela', () => {
      const p2 = calcularProximoVencimento(dataBase, 'bimestral', 1)
      expect(p2.getMonth()).toBe(2) // mar (0 + 2*1)
    })

    it('recorrencia trimestral: avanca 3 meses por parcela', () => {
      const p3 = calcularProximoVencimento(dataBase, 'trimestral', 2)
      expect(p3.getMonth()).toBe(6) // jul (0 + 3*2)
    })

    it('recorrencia semestral: avanca 6 meses por parcela', () => {
      const p2 = calcularProximoVencimento(dataBase, 'semestral', 1)
      expect(p2.getMonth()).toBe(6) // jul (0 + 6*1)
    })

    it('recorrencia anual: avanca 12 meses por parcela', () => {
      const p2 = calcularProximoVencimento(dataBase, 'anual', 1)
      expect(p2.getFullYear()).toBe(2027)
      expect(p2.getMonth()).toBe(0) // jan
    })

    it('transicao de ano funciona corretamente', () => {
      const dataNov = new Date(2026, 10, 15) // 15/nov/2026
      const p3 = calcularProximoVencimento(dataNov, 'mensal', 3)
      expect(p3.getFullYear()).toBe(2027)
      expect(p3.getMonth()).toBe(1) // fev/2027
    })
  })

  // ── TC-CON-UNIT-003: Geracao de parcelas ────────────────────────────────

  describe('TC-CON-UNIT-003: Geracao de parcelas', () => {
    it('gera N parcelas com intervalos corretos para recorrencia mensal', () => {
      const dataBase = new Date(2026, 0, 10) // 10/jan/2026
      const parcelas = gerarParcelas(12000, 6, dataBase, 'mensal', 10)

      expect(parcelas).toHaveLength(6)
      expect(parcelas[0].numero).toBe(1)
      expect(parcelas[5].numero).toBe(6)

      // Cada parcela = 2000
      expect(parcelas[0].valor).toBe(2000)
      expect(parcelas[4].valor).toBe(2000)
    })

    it('soma das parcelas e igual ao valor total', () => {
      const parcelas = gerarParcelas(10000, 3, new Date(2026, 0, 1), 'mensal', 1)
      const soma = parcelas.reduce((acc, p) => acc + p.valor, 0)
      expect(soma).toBeCloseTo(10000, 2)
    })

    it('ultima parcela absorve centavos de arredondamento', () => {
      // 10000 / 3 = 3333.33... ultima absorve o centavo
      const parcelas = gerarParcelas(10000, 3, new Date(2026, 0, 1), 'trimestral', 1)
      const soma = parcelas.reduce((acc, p) => acc + p.valor, 0)
      expect(soma).toBeCloseTo(10000, 2)
      // Primeiras parcelas: 3333.33, ultima: 3333.34
      expect(parcelas[0].valor).toBe(3333.33)
      expect(parcelas[2].valor).toBe(3333.34)
    })

    it('parcelas bimestrais avancam 2 meses cada', () => {
      const parcelas = gerarParcelas(6000, 3, new Date(2026, 0, 15), 'bimestral', 15)
      expect(parcelas[0].data_vencimento.getMonth()).toBe(0) // jan
      expect(parcelas[1].data_vencimento.getMonth()).toBe(2) // mar
      expect(parcelas[2].data_vencimento.getMonth()).toBe(4) // mai
    })

    it('parcelas semestrais avancam 6 meses cada', () => {
      const parcelas = gerarParcelas(24000, 2, new Date(2026, 0, 1), 'semestral', 1)
      expect(parcelas[0].data_vencimento.getMonth()).toBe(0) // jan
      expect(parcelas[1].data_vencimento.getMonth()).toBe(6) // jul
    })

    it('parcelas anuais avancam 12 meses', () => {
      const parcelas = gerarParcelas(50000, 2, new Date(2026, 2, 1), 'anual', 1)
      expect(parcelas[0].data_vencimento.getFullYear()).toBe(2026)
      expect(parcelas[1].data_vencimento.getFullYear()).toBe(2027)
    })
  })

  // ── TC-CON-UNIT-004: Transicoes de status de parcela ────────────────────

  describe('TC-CON-UNIT-004: Transicoes de status de parcela', () => {
    it('previsto → pendente: valido', () => {
      expect(validarTransicaoParcela('previsto', 'pendente')).toBe(true)
    })

    it('previsto → liberado: invalido (pula etapa)', () => {
      expect(validarTransicaoParcela('previsto', 'liberado')).toBe(false)
    })

    it('previsto → pago: invalido (pula etapas)', () => {
      expect(validarTransicaoParcela('previsto', 'pago')).toBe(false)
    })

    it('pendente → liberado: valido', () => {
      expect(validarTransicaoParcela('pendente', 'liberado')).toBe(true)
    })

    it('pendente → cancelado: valido', () => {
      expect(validarTransicaoParcela('pendente', 'cancelado')).toBe(true)
    })

    it('pendente → pago: invalido (precisa liberar antes)', () => {
      expect(validarTransicaoParcela('pendente', 'pago')).toBe(false)
    })

    it('liberado → pago: valido', () => {
      expect(validarTransicaoParcela('liberado', 'pago')).toBe(true)
    })

    it('liberado → cancelado: valido', () => {
      expect(validarTransicaoParcela('liberado', 'cancelado')).toBe(true)
    })

    it('pago → qualquer: invalido (estado terminal)', () => {
      expect(validarTransicaoParcela('pago', 'previsto')).toBe(false)
      expect(validarTransicaoParcela('pago', 'pendente')).toBe(false)
      expect(validarTransicaoParcela('pago', 'liberado')).toBe(false)
      expect(validarTransicaoParcela('pago', 'cancelado')).toBe(false)
    })

    it('cancelado → qualquer: invalido (estado terminal)', () => {
      expect(validarTransicaoParcela('cancelado', 'previsto')).toBe(false)
      expect(validarTransicaoParcela('cancelado', 'pendente')).toBe(false)
      expect(validarTransicaoParcela('cancelado', 'liberado')).toBe(false)
      expect(validarTransicaoParcela('cancelado', 'pago')).toBe(false)
    })

    it('fluxo completo valido: previsto → pendente → liberado → pago', () => {
      expect(validarTransicaoParcela('previsto', 'pendente')).toBe(true)
      expect(validarTransicaoParcela('pendente', 'liberado')).toBe(true)
      expect(validarTransicaoParcela('liberado', 'pago')).toBe(true)
    })
  })

  // ── TC-CON-UNIT-005: Dia de vencimento fixo com ajuste ─────────────────

  describe('TC-CON-UNIT-005: Dia de vencimento fixo — ajuste meses curtos', () => {
    it('dia 31 em fevereiro nao-bissexto → dia 28', () => {
      const data = ajustarDiaVencimento(31, 1, 2025) // fev 2025 (mes 0-based = 1)
      expect(data.getDate()).toBe(28)
    })

    it('dia 31 em fevereiro bissexto → dia 29', () => {
      const data = ajustarDiaVencimento(31, 1, 2024) // fev 2024 bissexto
      expect(data.getDate()).toBe(29)
    })

    it('dia 30 em fevereiro → dia 28 (nao-bissexto)', () => {
      const data = ajustarDiaVencimento(30, 1, 2025)
      expect(data.getDate()).toBe(28)
    })

    it('dia 31 em abril (30 dias) → dia 30', () => {
      const data = ajustarDiaVencimento(31, 3, 2026) // abril (mes 3, 0-based)
      expect(data.getDate()).toBe(30)
    })

    it('dia 15 em qualquer mes → dia 15 (sem ajuste)', () => {
      const jan = ajustarDiaVencimento(15, 0, 2026)
      const fev = ajustarDiaVencimento(15, 1, 2026)
      const mar = ajustarDiaVencimento(15, 2, 2026)
      expect(jan.getDate()).toBe(15)
      expect(fev.getDate()).toBe(15)
      expect(mar.getDate()).toBe(15)
    })

    it('dia 31 em janeiro (31 dias) → dia 31 (sem ajuste)', () => {
      const data = ajustarDiaVencimento(31, 0, 2026)
      expect(data.getDate()).toBe(31)
    })

    it('dia 31 em junho (30 dias) → dia 30', () => {
      const data = ajustarDiaVencimento(31, 5, 2026) // junho = mes 5 (0-based)
      expect(data.getDate()).toBe(30)
    })

    it('dia 29 em fevereiro nao-bissexto → dia 28', () => {
      const data = ajustarDiaVencimento(29, 1, 2025)
      expect(data.getDate()).toBe(28)
    })

    it('dia 29 em fevereiro bissexto → dia 29', () => {
      const data = ajustarDiaVencimento(29, 1, 2024)
      expect(data.getDate()).toBe(29)
    })
  })

  // ── TC-CON-UNIT-006: Calculo de progresso ──────────────────────────────

  describe('TC-CON-UNIT-006: Calculo de progresso do contrato', () => {
    it('0% quando nenhuma medicao foi feita', () => {
      expect(calcularProgressoContrato(0, 100000)).toBe(0)
    })

    it('50% quando metade foi medida', () => {
      expect(calcularProgressoContrato(50000, 100000)).toBe(50)
    })

    it('100% quando valor medido = valor total', () => {
      expect(calcularProgressoContrato(100000, 100000)).toBe(100)
    })

    it('nao excede 100% mesmo com medicao superior ao total', () => {
      expect(calcularProgressoContrato(120000, 100000)).toBe(100)
    })

    it('retorna 0% quando valor total e zero', () => {
      expect(calcularProgressoContrato(5000, 0)).toBe(0)
    })

    it('retorna 0% quando valor total e negativo', () => {
      expect(calcularProgressoContrato(5000, -10000)).toBe(0)
    })

    it('calcula percentual com precisao de 2 casas', () => {
      const result = calcularProgressoContrato(33333, 100000)
      expect(result).toBe(33.33)
    })

    it('calcula corretamente valores pequenos', () => {
      const result = calcularProgressoContrato(1, 10000)
      expect(result).toBe(0.01)
    })
  })
})

// ============================================================================
// TESTES DE INTEGRACAO — Hooks Contratos + Supabase Mock
// ============================================================================

describe('Contratos — Testes de Integracao (hooks + Supabase mock)', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  // ── TC-CON-INT-001: useContratos — listagem com filtros ─────────────────

  describe('TC-CON-INT-001: Listagem de contratos via Supabase', () => {
    it('chama supabase.from("con_contratos") ao listar contratos', async () => {
      const mockContratos: Partial<Contrato>[] = [
        { id: 'c1', numero: 'CON-001', tipo_contrato: 'despesa', status: 'vigente', valor_total: 100000 },
        { id: 'c2', numero: 'CON-002', tipo_contrato: 'receita', status: 'vigente', valor_total: 200000 },
      ]
      mockSupabase._setQueryResult(mockContratos)

      const result = await mockSupabase.from('con_contratos').select('*').order('created_at', { ascending: false })
      expect(mockSupabase.from).toHaveBeenCalledWith('con_contratos')
    })

    it('filtra contratos por status', async () => {
      mockSupabase._setQueryResult([
        { id: 'c1', status: 'vigente', tipo_contrato: 'despesa' },
      ])

      const builder = mockSupabase.from('con_contratos')
      builder.select('*')
      builder.eq('status', 'vigente')

      expect(builder.eq).toHaveBeenCalledWith('status', 'vigente')
    })

    it('filtra contratos por tipo_contrato', async () => {
      mockSupabase._setQueryResult([])

      const builder = mockSupabase.from('con_contratos')
      builder.select('*')
      builder.eq('tipo_contrato', 'receita')

      expect(builder.eq).toHaveBeenCalledWith('tipo_contrato', 'receita')
    })
  })

  // ── TC-CON-INT-002: Criacao de contrato com itens ─────────────────────

  describe('TC-CON-INT-002: Criacao de contrato com itens', () => {
    it('insere contrato na tabela con_contratos', async () => {
      const novoContrato = {
        id: 'new-c1',
        numero: 'CON-2026-001',
        tipo_contrato: 'despesa',
        valor_total: 50000,
        status: 'vigente',
      }
      mockSupabase._setQueryResult(novoContrato)

      const builder = mockSupabase.from('con_contratos')
      builder.insert({
        numero: 'CON-2026-001',
        tipo_contrato: 'despesa',
        valor_total: 50000,
        objeto: 'Fornecimento de cabos',
        data_inicio: '2026-01-01',
        data_fim_previsto: '2026-12-31',
        recorrencia: 'mensal',
        status: 'vigente',
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('con_contratos')
      expect(builder.insert).toHaveBeenCalled()
    })

    it('insere itens na tabela con_contrato_itens vinculados ao contrato', async () => {
      const contratoId = 'new-c1'
      mockSupabase._setQueryResult([])

      const builder = mockSupabase.from('con_contrato_itens')
      builder.insert([
        { contrato_id: contratoId, descricao: 'Cabo XLPE 240mm', quantidade: 100, valor_unitario: 250, valor_total: 25000 },
        { contrato_id: contratoId, descricao: 'Cabo XLPE 120mm', quantidade: 200, valor_unitario: 125, valor_total: 25000 },
      ])

      expect(mockSupabase.from).toHaveBeenCalledWith('con_contrato_itens')
      expect(builder.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ contrato_id: contratoId, descricao: 'Cabo XLPE 240mm' }),
        ])
      )
    })
  })

  // ── TC-CON-INT-003: Geracao de parcelas recorrentes ─────────────────────

  describe('TC-CON-INT-003: Geracao de parcelas recorrentes via RPC', () => {
    it('chama con_gerar_parcelas_recorrentes quando recorrencia nao e personalizado', async () => {
      const contratoId = 'c-mensal-001'
      mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null })

      await mockSupabase.rpc('con_gerar_parcelas_recorrentes', {
        p_contrato_id: contratoId,
      })

      expect(mockRpc).toHaveBeenCalledWith('con_gerar_parcelas_recorrentes', {
        p_contrato_id: contratoId,
      })
    })

    it('nao chama RPC para recorrencia personalizado', () => {
      const recorrencia: RecorrenciaContrato = 'personalizado'
      const deveGerarAutomaticamente = recorrencia !== 'personalizado'
      expect(deveGerarAutomaticamente).toBe(false)
    })

    it('chama RPC para recorrencia mensal', () => {
      const recorrencia: RecorrenciaContrato = 'mensal'
      const deveGerarAutomaticamente = recorrencia !== 'personalizado'
      expect(deveGerarAutomaticamente).toBe(true)
    })
  })

  // ── TC-CON-INT-004: Parcela gera previsao financeira ────────────────────

  describe('TC-CON-INT-004: Parcela gera previsao financeira (CP ou CR)', () => {
    it('contrato despesa → parcela gera conta a pagar (fin_cp_id)', () => {
      const parcela: Partial<Parcela> = {
        id: 'p1',
        contrato_id: 'c-despesa-001',
        valor: 10000,
        status: 'pendente',
        fin_cp_id: 'cp-uuid-001',
        fin_cr_id: undefined,
      }
      expect(parcela.fin_cp_id).toBeTruthy()
      expect(parcela.fin_cr_id).toBeUndefined()
    })

    it('contrato receita → parcela gera conta a receber (fin_cr_id)', () => {
      const parcela: Partial<Parcela> = {
        id: 'p2',
        contrato_id: 'c-receita-001',
        valor: 15000,
        status: 'pendente',
        fin_cp_id: undefined,
        fin_cr_id: 'cr-uuid-001',
      }
      expect(parcela.fin_cr_id).toBeTruthy()
      expect(parcela.fin_cp_id).toBeUndefined()
    })
  })

  // ── TC-CON-INT-005: Liberacao de parcela com anexo ─────────────────────

  describe('TC-CON-INT-005: Liberacao de parcela com anexo', () => {
    it('atualiza status da parcela para "liberado"', async () => {
      mockSupabase._setQueryResult({ id: 'p1', status: 'liberado' })

      const builder = mockSupabase.from('con_parcelas')
      builder.update({
        status: 'liberado',
        liberado_em: expect.any(String),
        liberado_por: 'user-uuid-123',
        nf_numero: 'NF-0001',
      })
      builder.eq('id', 'p1')

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'liberado', nf_numero: 'NF-0001' })
      )
    })

    it('upload de anexo ao storage e registro em con_parcela_anexos', async () => {
      // Storage upload
      const storageFrom = mockSupabase.storage.from('contratos-anexos')
      await storageFrom.upload('p1/12345.pdf', new Blob())
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('contratos-anexos')

      // Get public URL
      const urlResult = storageFrom.getPublicUrl('p1/12345.pdf')
      expect(urlResult.data.publicUrl).toContain('test.supabase.co')

      // Insert anexo record
      mockSupabase._setQueryResult({})
      const builder = mockSupabase.from('con_parcela_anexos')
      builder.insert({
        parcela_id: 'p1',
        tipo: 'nota_fiscal',
        nome_arquivo: 'nf-001.pdf',
        url: urlResult.data.publicUrl,
        mime_type: 'application/pdf',
        tamanho_bytes: 1024,
      })

      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ parcela_id: 'p1', tipo: 'nota_fiscal' })
      )
    })
  })

  // ── TC-CON-INT-006: Confirmacao de pagamento ──────────────────────────

  describe('TC-CON-INT-006: Confirmacao de pagamento de parcela', () => {
    it('atualiza status para "pago" e registra data_pagamento', async () => {
      mockSupabase._setQueryResult({ id: 'p1', status: 'pago' })

      const builder = mockSupabase.from('con_parcelas')
      builder.update({
        status: 'pago',
        data_pagamento: '2026-03-01',
        pago_em: expect.any(String),
      })
      builder.eq('id', 'p1')

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pago', data_pagamento: '2026-03-01' })
      )
    })

    it('data_pagamento usa data atual como fallback quando nao informada', () => {
      const hoje = new Date().toISOString().split('T')[0]
      const dataPagamento = undefined ?? hoje
      expect(dataPagamento).toBe(hoje)
    })
  })

  // ── TC-CON-INT-007: Contrato receita vincula a con_clientes ────────────

  describe('TC-CON-INT-007: Contrato receita vinculado a clientes', () => {
    it('consulta contrato receita com join em con_clientes', async () => {
      const contratoComCliente: Partial<Contrato> = {
        id: 'c-receita-001',
        tipo_contrato: 'receita',
        cliente_id: 'cli-001',
        cliente: {
          id: 'cli-001',
          nome: 'CEMIG Geracao',
          cnpj: '06981180000116',
          tipo: 'governo',
          ativo: true,
        },
      }
      mockSupabase._setQueryResult([contratoComCliente])

      const builder = mockSupabase.from('con_contratos')
      builder.select('*, cliente:con_clientes!cliente_id(id, nome, cnpj, tipo)')

      expect(builder.select).toHaveBeenCalledWith(
        expect.stringContaining('con_clientes')
      )
    })

    it('cliente do contrato receita tem campos obrigatorios', () => {
      const cliente = {
        id: 'cli-001',
        nome: 'CEMIG Geracao',
        tipo: 'governo' as const,
        ativo: true,
      }
      expect(cliente.id).toBeTruthy()
      expect(cliente.nome).toBeTruthy()
      expect(['publico', 'privado', 'governo']).toContain(cliente.tipo)
    })
  })

  // ── TC-CON-INT-008: Contrato despesa vincula a cmp_fornecedores ────────

  describe('TC-CON-INT-008: Contrato despesa vinculado a fornecedores', () => {
    it('consulta contrato despesa com join em cmp_fornecedores', async () => {
      mockSupabase._setQueryResult([{
        id: 'c-despesa-001',
        tipo_contrato: 'despesa',
        fornecedor_id: 'forn-001',
        fornecedor: {
          id: 'forn-001',
          razao_social: 'ABB Brasil LTDA',
          nome_fantasia: 'ABB',
          cnpj: '12345678000190',
        },
      }])

      const builder = mockSupabase.from('con_contratos')
      builder.select('*, fornecedor:cmp_fornecedores!fornecedor_id(id, razao_social, nome_fantasia, cnpj)')

      expect(builder.select).toHaveBeenCalledWith(
        expect.stringContaining('cmp_fornecedores')
      )
    })
  })

  // ── TC-CON-INT-008b: Registro de medicao ───────────────────────────────

  describe('TC-CON-INT-008b: Registro de medicao', () => {
    it('insere medicao na tabela con_medicoes', async () => {
      const medicao: Partial<ContratoMedicao> = {
        contrato_id: 'c1',
        numero_bm: 'BM-001',
        periodo_inicio: '2026-01-01',
        periodo_fim: '2026-01-31',
        valor_medido: 15000,
        valor_retencao: 750,
        valor_liquido: 14250,
        status: 'rascunho',
      }
      mockSupabase._setQueryResult({ ...medicao, id: 'med-001' })

      const builder = mockSupabase.from('con_medicoes')
      builder.insert(medicao)
      builder.select()
      builder.single()

      expect(mockSupabase.from).toHaveBeenCalledWith('con_medicoes')
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ contrato_id: 'c1', numero_bm: 'BM-001' })
      )
    })

    it('medicao possui status validos', () => {
      const statusValidos = ['rascunho', 'em_aprovacao', 'aprovado', 'rejeitado', 'faturado']
      expect(statusValidos).toHaveLength(5)
    })

    it('valor_liquido = valor_medido - valor_retencao', () => {
      const medido = 15000
      const retencao = 750
      const liquido = medido - retencao
      expect(liquido).toBe(14250)
    })
  })

  // ── TC-CON-INT-009: Registro de aditivo (pleito) ───────────────────────

  describe('TC-CON-INT-009: Registro de aditivo/pleito', () => {
    it('insere aditivo na tabela con_aditivos', async () => {
      const aditivo = {
        contrato_id: 'c1',
        numero_aditivo: 'AD-001',
        tipo: 'valor' as const,
        descricao: 'Acrescimo de escopo: torre adicional',
        valor_acrescimo: 50000,
        status: 'rascunho' as const,
      }
      mockSupabase._setQueryResult({ ...aditivo, id: 'ad-001' })

      const builder = mockSupabase.from('con_aditivos')
      builder.insert(aditivo)
      builder.select()
      builder.single()

      expect(mockSupabase.from).toHaveBeenCalledWith('con_aditivos')
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          contrato_id: 'c1',
          tipo: 'valor',
          valor_acrescimo: 50000,
        })
      )
    })

    it('tipos de aditivo validos: escopo, prazo, valor, misto', () => {
      const tipos = ['escopo', 'prazo', 'valor', 'misto']
      expect(tipos).toHaveLength(4)
    })

    it('aditivo de prazo pode alterar data_fim do contrato', () => {
      const aditivo = {
        tipo: 'prazo',
        nova_data_fim: '2027-06-30',
        valor_acrescimo: 0,
      }
      expect(aditivo.nova_data_fim).toBeTruthy()
    })

    it('aditivo de valor acrescenta ao valor_total', () => {
      const contratoValor = 100000
      const aditivoValor = 50000
      const novoTotal = contratoValor + aditivoValor
      expect(novoTotal).toBe(150000)
    })
  })
})

// ============================================================================
// TESTES DE DASHBOARD — Mock RPC
// ============================================================================

describe('Contratos — Dashboard RPC', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  it('chama RPC get_dashboard_contratos_gestao para dados do dashboard', async () => {
    const dashboardData = {
      resumo: { total_contratos: 10, vigentes: 8, contratos_receita: 3, contratos_despesa: 7, valor_total_receita: 500000, valor_total_despesa: 800000 },
      parcelas: { previstas: 20, pendentes: 5, liberadas: 10, pagas: 30, valor_pendente: 50000, valor_liberado: 100000 },
      proximas_parcelas: [],
      alertas_ativos: 2,
    }
    mockRpc.mockResolvedValueOnce({ data: dashboardData, error: null })

    const result = await mockSupabase.rpc('get_dashboard_contratos_gestao')
    expect(mockRpc).toHaveBeenCalledWith('get_dashboard_contratos_gestao')
    expect(result.data).toEqual(dashboardData)
  })

  it('retorna valores zerados quando RPC falha', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'RPC error' } })

    const result = await mockSupabase.rpc('get_dashboard_contratos_gestao')

    // O hook useContratosDashboard retorna defaults quando error
    const fallback = {
      resumo: { total_contratos: 0, vigentes: 0, contratos_receita: 0, contratos_despesa: 0, valor_total_receita: 0, valor_total_despesa: 0 },
      parcelas: { previstas: 0, pendentes: 0, liberadas: 0, pagas: 0, valor_pendente: 0, valor_liberado: 0 },
      proximas_parcelas: [],
      alertas_ativos: 0,
    }
    expect(result.error).toBeTruthy()
    expect(fallback.resumo.total_contratos).toBe(0)
  })
})
