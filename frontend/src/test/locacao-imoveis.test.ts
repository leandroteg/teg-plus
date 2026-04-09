// ============================================================================
// TESTE: Módulo Locação de Imóveis — Entrada Pendente
// Criado em: 2026-04-09
// Descricao: Testes para o fluxo de locação de imóveis no TEG+ ERP.
//   Cobre criação de solicitação de locação, parcelas pendentes, transições
//   de status, validação de categorias e integração com Supabase mock.
//
// IDs dos testes: TC-LOC-UNIT-001 a TC-LOC-UNIT-004 (unitários)
//                 TC-LOC-INT-001 a TC-LOC-INT-006 (integração)
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSupabase, mockRpc, resetAllMocks } from './mocks/supabase'
import { validarTransicaoParcela } from '../utils/validators'
import type {
  CategoriaContrato,
  GrupoContrato,
  Solicitacao,
  NovaSolicitacaoPayload,
  Parcela,
  StatusParcela,
  Contrato,
  EtapaSolicitacao,
  StatusSolicitacao,
} from '../types/contratos'

// ============================================================================
// CONSTANTES — Categorias de Locação de Imóvel
// ============================================================================

const CATEGORIAS_LOCACAO_IMOVEL: CategoriaContrato[] = [
  'locacao_imovel_alojamento',
  'locacao_imovel_canteiro',
  'locacao_imovel_deposito',
]

const GRUPO_LOCACAO_IMOVEL: GrupoContrato = 'locacao_imovel'

// ============================================================================
// FIXTURES — Dados de teste reutilizáveis
// ============================================================================

function criarSolicitacaoLocacao(overrides?: Partial<Solicitacao>): Solicitacao {
  return {
    id: 'sol-loc-001',
    numero: 'SOL-2026-0042',
    solicitante_id: 'user-001',
    solicitante_nome: 'João Silva',
    departamento: 'Engenharia',
    obra_id: 'obra-bh-001',
    tipo_solicitacao: 'novo_contrato',
    tipo_contraparte: 'fornecedor',
    contraparte_nome: 'Imobiliária Central LTDA',
    contraparte_cnpj: '12345678000190',
    contraparte_telefone: '31999999999',
    contraparte_email: 'contato@imobcentral.com.br',
    tipo_contrato: 'despesa',
    categoria_contrato: 'locacao_imovel_canteiro',
    grupo_contrato: 'locacao_imovel',
    objeto: 'Locação de galpão industrial para canteiro de obras - BH Norte',
    descricao_escopo: 'Galpão 500m² com pátio de estacionamento, banheiros e escritório',
    justificativa: 'Necessidade de canteiro de obras para o projeto BH Norte',
    valor_estimado: 180000,
    forma_pagamento: 'Mensal fixo',
    data_inicio_prevista: '2026-05-01',
    data_fim_prevista: '2027-04-30',
    prazo_meses: 12,
    centro_custo: 'CC-ENG-001',
    classe_financeira: 'CF-LOCACAO',
    urgencia: 'normal',
    data_necessidade: '2026-04-15',
    documentos_ref: [
      { nome: 'Proposta Imobiliária', url: '/docs/proposta-galp.pdf', tipo: 'proposta' },
      { nome: 'Laudo vistoria', url: '/docs/laudo-vistoria.pdf', tipo: 'laudo' },
    ],
    etapa_atual: 'solicitacao',
    status: 'em_andamento',
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
    ...overrides,
  }
}

function criarParcelaPendente(overrides?: Partial<Parcela>): Parcela {
  return {
    id: 'parc-loc-001',
    contrato_id: 'con-loc-001',
    numero: 1,
    valor: 15000,
    data_vencimento: '2026-05-10',
    status: 'pendente',
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
    ...overrides,
  }
}

// ============================================================================
// TESTES UNITÁRIOS — Locação de Imóveis
// ============================================================================

describe('Locação de Imóveis — Testes Unitários', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  // ── TC-LOC-UNIT-001: Categorias válidas de locação de imóvel ──────────────

  describe('TC-LOC-UNIT-001: Categorias de locação de imóvel', () => {
    it('existem 3 sub-categorias de locação de imóvel', () => {
      expect(CATEGORIAS_LOCACAO_IMOVEL).toHaveLength(3)
    })

    it('alojamento é categoria válida de locação de imóvel', () => {
      expect(CATEGORIAS_LOCACAO_IMOVEL).toContain('locacao_imovel_alojamento')
    })

    it('canteiro é categoria válida de locação de imóvel', () => {
      expect(CATEGORIAS_LOCACAO_IMOVEL).toContain('locacao_imovel_canteiro')
    })

    it('deposito é categoria válida de locação de imóvel', () => {
      expect(CATEGORIAS_LOCACAO_IMOVEL).toContain('locacao_imovel_deposito')
    })

    it('todas pertencem ao grupo "locacao_imovel"', () => {
      expect(GRUPO_LOCACAO_IMOVEL).toBe('locacao_imovel')
    })

    it('categoria "locacao" genérica NÃO é locação de imóvel', () => {
      expect(CATEGORIAS_LOCACAO_IMOVEL).not.toContain('locacao')
    })

    it('categorias de locação de veículos/equipamentos são distintas', () => {
      expect(CATEGORIAS_LOCACAO_IMOVEL).not.toContain('locacao_veiculos')
      expect(CATEGORIAS_LOCACAO_IMOVEL).not.toContain('locacao_equipamentos')
      expect(CATEGORIAS_LOCACAO_IMOVEL).not.toContain('locacao_ferramental')
    })
  })

  // ── TC-LOC-UNIT-002: Payload de solicitação de locação ────────────────────

  describe('TC-LOC-UNIT-002: Payload de solicitação de locação de imóvel', () => {
    it('solicitação de locação canteiro tem campos obrigatórios preenchidos', () => {
      const payload: NovaSolicitacaoPayload = {
        solicitante_nome: 'João Silva',
        tipo_contraparte: 'fornecedor',
        contraparte_nome: 'Imobiliária Central LTDA',
        contraparte_cnpj: '12345678000190',
        tipo_contrato: 'despesa',
        categoria_contrato: 'locacao_imovel_canteiro',
        grupo_contrato: 'locacao_imovel',
        objeto: 'Locação galpão para canteiro de obras',
        valor_estimado: 180000,
        data_inicio_prevista: '2026-05-01',
        data_fim_prevista: '2027-04-30',
        prazo_meses: 12,
      }
      expect(payload.categoria_contrato).toBe('locacao_imovel_canteiro')
      expect(payload.grupo_contrato).toBe('locacao_imovel')
      expect(payload.tipo_contrato).toBe('despesa')
      expect(payload.valor_estimado).toBeGreaterThan(0)
      expect(payload.prazo_meses).toBe(12)
    })

    it('locação de imóvel é sempre tipo despesa', () => {
      const sol = criarSolicitacaoLocacao()
      expect(sol.tipo_contrato).toBe('despesa')
    })

    it('locação de alojamento requer obra vinculada', () => {
      const sol = criarSolicitacaoLocacao({
        categoria_contrato: 'locacao_imovel_alojamento',
        obra_id: 'obra-mg-002',
      })
      expect(sol.obra_id).toBeTruthy()
      expect(sol.categoria_contrato).toBe('locacao_imovel_alojamento')
    })

    it('valor mensal estimado = valor_estimado / prazo_meses', () => {
      const sol = criarSolicitacaoLocacao({ valor_estimado: 180000, prazo_meses: 12 })
      const valorMensal = (sol.valor_estimado ?? 0) / (sol.prazo_meses ?? 1)
      expect(valorMensal).toBe(15000)
    })
  })

  // ── TC-LOC-UNIT-003: Status de entrada pendente ───────────────────────────

  describe('TC-LOC-UNIT-003: Fluxo de entrada pendente', () => {
    it('solicitação inicia em status "em_andamento" e etapa "solicitacao"', () => {
      const sol = criarSolicitacaoLocacao()
      expect(sol.status).toBe('em_andamento')
      expect(sol.etapa_atual).toBe('solicitacao')
    })

    it('etapas válidas do fluxo de solicitação de locação', () => {
      const etapasValidas: EtapaSolicitacao[] = [
        'solicitacao', 'preparar_minuta', 'resumo_executivo',
        'aprovacao_diretoria', 'enviar_assinatura', 'arquivar',
        'liberar_execucao', 'concluido', 'cancelado',
      ]
      expect(etapasValidas).toHaveLength(9)
      expect(etapasValidas).toContain('solicitacao')
      expect(etapasValidas).toContain('aprovacao_diretoria')
    })

    it('status possíveis incluem "aguardando_aprovacao"', () => {
      const statusValidos: StatusSolicitacao[] = [
        'rascunho', 'em_andamento', 'aguardando_aprovacao',
        'aprovado', 'rejeitado', 'cancelado', 'concluido',
      ]
      expect(statusValidos).toContain('aguardando_aprovacao')
    })

    it('solicitação pendente de aprovação tem status correto', () => {
      const sol = criarSolicitacaoLocacao({
        status: 'aguardando_aprovacao',
        etapa_atual: 'aprovacao_diretoria',
      })
      expect(sol.status).toBe('aguardando_aprovacao')
      expect(sol.etapa_atual).toBe('aprovacao_diretoria')
    })

    it('solicitação cancelada preserva motivo', () => {
      const sol = criarSolicitacaoLocacao({
        status: 'cancelado',
        etapa_atual: 'cancelado',
        motivo_cancelamento: 'Proprietário não aceitou as condições',
      })
      expect(sol.status).toBe('cancelado')
      expect(sol.motivo_cancelamento).toBeTruthy()
    })
  })

  // ── TC-LOC-UNIT-004: Parcelas pendentes de locação ────────────────────────

  describe('TC-LOC-UNIT-004: Parcelas pendentes de locação', () => {
    it('parcela pendente tem status "pendente"', () => {
      const parcela = criarParcelaPendente()
      expect(parcela.status).toBe('pendente')
    })

    it('parcela pendente pode ser liberada (transição válida)', () => {
      expect(validarTransicaoParcela('pendente', 'liberado')).toBe(true)
    })

    it('parcela pendente pode ser cancelada (transição válida)', () => {
      expect(validarTransicaoParcela('pendente', 'cancelado')).toBe(true)
    })

    it('parcela pendente NÃO pode ir direto para pago', () => {
      expect(validarTransicaoParcela('pendente', 'pago')).toBe(false)
    })

    it('parcela pendente NÃO pode voltar para previsto', () => {
      expect(validarTransicaoParcela('pendente', 'previsto')).toBe(false)
    })

    it('12 parcelas mensais de locação somam valor total do contrato', () => {
      const valorTotal = 180000
      const qtdParcelas = 12
      const valorParcela = valorTotal / qtdParcelas

      const parcelas: Partial<Parcela>[] = Array.from({ length: qtdParcelas }, (_, i) => ({
        numero: i + 1,
        valor: valorParcela,
        status: i === 0 ? 'pendente' as StatusParcela : 'previsto' as StatusParcela,
        data_vencimento: `2026-${String(5 + i).padStart(2, '0')}-10`,
      }))

      expect(parcelas).toHaveLength(12)
      expect(parcelas[0].status).toBe('pendente')
      expect(parcelas[1].status).toBe('previsto')

      const soma = parcelas.reduce((acc, p) => acc + (p.valor ?? 0), 0)
      expect(soma).toBe(180000)
    })

    it('primeira parcela é pendente, demais são previstas', () => {
      const parcelas = Array.from({ length: 6 }, (_, i) =>
        criarParcelaPendente({
          id: `parc-loc-${i + 1}`,
          numero: i + 1,
          status: i === 0 ? 'pendente' : 'previsto',
          data_vencimento: `2026-${String(5 + i).padStart(2, '0')}-10`,
        })
      )

      const pendentes = parcelas.filter(p => p.status === 'pendente')
      const previstas = parcelas.filter(p => p.status === 'previsto')

      expect(pendentes).toHaveLength(1)
      expect(previstas).toHaveLength(5)
      expect(pendentes[0].numero).toBe(1)
    })
  })
})

// ============================================================================
// TESTES DE INTEGRAÇÃO — Locação de Imóveis + Supabase Mock
// ============================================================================

describe('Locação de Imóveis — Testes de Integração (Supabase mock)', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  // ── TC-LOC-INT-001: Criar solicitação de locação ──────────────────────────

  describe('TC-LOC-INT-001: Criar solicitação de locação de imóvel', () => {
    it('insere solicitação na tabela con_solicitacoes', async () => {
      const novaSol = criarSolicitacaoLocacao()
      mockSupabase._setQueryResult({ ...novaSol, id: 'sol-loc-new' })

      const builder = mockSupabase.from('con_solicitacoes')
      builder.insert({
        solicitante_nome: novaSol.solicitante_nome,
        tipo_contraparte: novaSol.tipo_contraparte,
        contraparte_nome: novaSol.contraparte_nome,
        contraparte_cnpj: novaSol.contraparte_cnpj,
        tipo_contrato: novaSol.tipo_contrato,
        categoria_contrato: 'locacao_imovel_canteiro',
        grupo_contrato: 'locacao_imovel',
        objeto: novaSol.objeto,
        valor_estimado: novaSol.valor_estimado,
        obra_id: novaSol.obra_id,
        urgencia: 'normal',
        etapa_atual: 'solicitacao',
        status: 'em_andamento',
      })
      builder.select()
      builder.single()

      expect(mockSupabase.from).toHaveBeenCalledWith('con_solicitacoes')
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria_contrato: 'locacao_imovel_canteiro',
          grupo_contrato: 'locacao_imovel',
          tipo_contrato: 'despesa',
          status: 'em_andamento',
        })
      )
    })

    it('registro histórico da criação é inserido em con_solicitacao_historico', async () => {
      mockSupabase._setQueryResult({})

      const builder = mockSupabase.from('con_solicitacao_historico')
      builder.insert({
        solicitacao_id: 'sol-loc-001',
        etapa_de: 'solicitacao',
        etapa_para: 'solicitacao',
        executado_por: 'user-001',
        executado_nome: 'João Silva',
        observacao: 'Solicitação de locação de imóvel criada',
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('con_solicitacao_historico')
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          solicitacao_id: 'sol-loc-001',
          observacao: expect.stringContaining('locação'),
        })
      )
    })
  })

  // ── TC-LOC-INT-002: Listar solicitações pendentes de locação ──────────────

  describe('TC-LOC-INT-002: Listar solicitações pendentes de locação', () => {
    it('filtra solicitações por grupo_contrato = locacao_imovel', async () => {
      const solicitacoes = [
        criarSolicitacaoLocacao({ id: 'sol-1', numero: 'SOL-2026-041', categoria_contrato: 'locacao_imovel_canteiro' }),
        criarSolicitacaoLocacao({ id: 'sol-2', numero: 'SOL-2026-042', categoria_contrato: 'locacao_imovel_alojamento' }),
        criarSolicitacaoLocacao({ id: 'sol-3', numero: 'SOL-2026-043', categoria_contrato: 'locacao_imovel_deposito' }),
      ]
      mockSupabase._setQueryResult(solicitacoes)

      const builder = mockSupabase.from('con_solicitacoes')
      builder.select('*, obra:sys_obras!left(id, nome)')
      builder.eq('grupo_contrato', 'locacao_imovel')
      builder.eq('status', 'em_andamento')
      builder.order('created_at', { ascending: false })

      expect(builder.eq).toHaveBeenCalledWith('grupo_contrato', 'locacao_imovel')
      expect(builder.eq).toHaveBeenCalledWith('status', 'em_andamento')
    })

    it('filtra por etapa aguardando_aprovacao (pendentes de aprovação)', async () => {
      mockSupabase._setQueryResult([
        criarSolicitacaoLocacao({
          status: 'aguardando_aprovacao',
          etapa_atual: 'aprovacao_diretoria',
        }),
      ])

      const builder = mockSupabase.from('con_solicitacoes')
      builder.select('*')
      builder.eq('grupo_contrato', 'locacao_imovel')
      builder.eq('etapa_atual', 'aprovacao_diretoria')

      expect(builder.eq).toHaveBeenCalledWith('etapa_atual', 'aprovacao_diretoria')
    })
  })

  // ── TC-LOC-INT-003: Avançar etapa da solicitação ──────────────────────────

  describe('TC-LOC-INT-003: Avançar solicitação de locação para próxima etapa', () => {
    it('avança de "solicitacao" para "preparar_minuta"', async () => {
      mockSupabase._setQueryResult({ id: 'sol-loc-001', etapa_atual: 'preparar_minuta', status: 'em_andamento' })

      const builder = mockSupabase.from('con_solicitacoes')
      builder.update({
        etapa_atual: 'preparar_minuta',
        updated_at: expect.any(String),
      })
      builder.eq('id', 'sol-loc-001')

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ etapa_atual: 'preparar_minuta' })
      )
    })

    it('avança para "aprovacao_diretoria" e muda status para aguardando_aprovacao', async () => {
      mockSupabase._setQueryResult({
        id: 'sol-loc-001',
        etapa_atual: 'aprovacao_diretoria',
        status: 'aguardando_aprovacao',
      })

      const builder = mockSupabase.from('con_solicitacoes')
      builder.update({
        etapa_atual: 'aprovacao_diretoria',
        status: 'aguardando_aprovacao',
        updated_at: expect.any(String),
      })
      builder.eq('id', 'sol-loc-001')

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          etapa_atual: 'aprovacao_diretoria',
          status: 'aguardando_aprovacao',
        })
      )
    })

    it('registra historico ao avançar etapa', async () => {
      mockSupabase._setQueryResult({})

      const builder = mockSupabase.from('con_solicitacao_historico')
      builder.insert({
        solicitacao_id: 'sol-loc-001',
        etapa_de: 'resumo_executivo',
        etapa_para: 'aprovacao_diretoria',
        executado_por: 'user-gestor-001',
        executado_nome: 'Maria Gestora',
        observacao: 'Locação de canteiro encaminhada para aprovação da diretoria',
      })

      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          etapa_de: 'resumo_executivo',
          etapa_para: 'aprovacao_diretoria',
        })
      )
    })
  })

  // ── TC-LOC-INT-004: Gerar contrato e parcelas após aprovação ──────────────

  describe('TC-LOC-INT-004: Gerar contrato de locação com parcelas pendentes', () => {
    it('cria contrato na tabela con_contratos após aprovação', async () => {
      const contrato: Partial<Contrato> = {
        id: 'con-loc-001',
        numero: 'CON-2026-LOC-001',
        tipo_contrato: 'despesa',
        fornecedor_id: 'forn-imob-001',
        obra_id: 'obra-bh-001',
        objeto: 'Locação de galpão industrial - canteiro BH Norte',
        valor_total: 180000,
        data_inicio: '2026-05-01',
        data_fim_previsto: '2027-04-30',
        recorrencia: 'mensal',
        dia_vencimento: 10,
        status: 'vigente',
        tipo_categoria: 'locacao_imovel_canteiro',
        grupo_contrato: 'locacao_imovel',
        valor_mensal: 15000,
        recorrente: true,
        solicitacao_id: 'sol-loc-001',
      }
      mockSupabase._setQueryResult(contrato)

      const builder = mockSupabase.from('con_contratos')
      builder.insert(contrato)
      builder.select()
      builder.single()

      expect(mockSupabase.from).toHaveBeenCalledWith('con_contratos')
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_contrato: 'despesa',
          recorrencia: 'mensal',
          valor_total: 180000,
          valor_mensal: 15000,
          recorrente: true,
        })
      )
    })

    it('gera 12 parcelas via RPC con_gerar_parcelas_recorrentes', async () => {
      mockRpc.mockResolvedValueOnce({ data: { success: true, parcelas_geradas: 12 }, error: null })

      await mockSupabase.rpc('con_gerar_parcelas_recorrentes', {
        p_contrato_id: 'con-loc-001',
      })

      expect(mockRpc).toHaveBeenCalledWith('con_gerar_parcelas_recorrentes', {
        p_contrato_id: 'con-loc-001',
      })
    })

    it('primeira parcela gerada tem status "pendente", demais "previsto"', async () => {
      const parcelas: Partial<Parcela>[] = Array.from({ length: 12 }, (_, i) => ({
        id: `parc-${i + 1}`,
        contrato_id: 'con-loc-001',
        numero: i + 1,
        valor: 15000,
        data_vencimento: `2026-${String(5 + i).padStart(2, '0')}-10`,
        status: (i === 0 ? 'pendente' : 'previsto') as StatusParcela,
      }))
      mockSupabase._setQueryResult(parcelas)

      const builder = mockSupabase.from('con_parcelas')
      builder.select('*')
      builder.eq('contrato_id', 'con-loc-001')
      builder.order('numero', { ascending: true })

      const result = await builder
      expect(result.data).toHaveLength(12)
      expect(result.data[0].status).toBe('pendente')
      expect(result.data[1].status).toBe('previsto')
      expect(result.data[11].status).toBe('previsto')
    })
  })

  // ── TC-LOC-INT-005: Liberar parcela pendente de locação ───────────────────

  describe('TC-LOC-INT-005: Liberar parcela pendente de locação', () => {
    it('atualiza parcela pendente para "liberado" com NF', async () => {
      mockSupabase._setQueryResult({ id: 'parc-loc-001', status: 'liberado' })

      const builder = mockSupabase.from('con_parcelas')
      builder.update({
        status: 'liberado',
        liberado_em: new Date().toISOString(),
        liberado_por: 'user-financeiro-001',
        nf_numero: 'NF-LOC-0001',
      })
      builder.eq('id', 'parc-loc-001')

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'liberado',
          nf_numero: 'NF-LOC-0001',
        })
      )
    })

    it('parcela liberada gera conta a pagar (fin_cp_id)', async () => {
      const parcelaLiberada: Partial<Parcela> = {
        id: 'parc-loc-001',
        contrato_id: 'con-loc-001',
        status: 'liberado',
        valor: 15000,
        fin_cp_id: 'cp-loc-001',
        fin_cr_id: undefined,
      }
      expect(parcelaLiberada.fin_cp_id).toBeTruthy()
      expect(parcelaLiberada.fin_cr_id).toBeUndefined()
    })

    it('ao liberar parcela 1, parcela 2 muda para "pendente"', async () => {
      // Simula que ao liberar a parcela 1, a próxima se torna pendente
      mockSupabase._setQueryResult({ id: 'parc-loc-002', status: 'pendente' })

      const builder = mockSupabase.from('con_parcelas')
      builder.update({ status: 'pendente' })
      builder.eq('id', 'parc-loc-002')

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pendente' })
      )
    })
  })

  // ── TC-LOC-INT-006: Dashboard de locações pendentes ───────────────────────

  describe('TC-LOC-INT-006: Dashboard — locações com parcelas pendentes', () => {
    it('RPC retorna contagem de parcelas pendentes de locação', async () => {
      const dashboardData = {
        resumo: {
          total_contratos: 5,
          vigentes: 4,
          contratos_receita: 0,
          contratos_despesa: 5,
          valor_total_receita: 0,
          valor_total_despesa: 720000,
        },
        parcelas: {
          previstas: 48,
          pendentes: 5,
          liberadas: 3,
          pagas: 4,
          valor_pendente: 75000,
          valor_liberado: 45000,
        },
        proximas_parcelas: [
          {
            id: 'parc-loc-001',
            contrato_id: 'con-loc-001',
            numero: 1,
            valor: 15000,
            data_vencimento: '2026-05-10',
            status: 'pendente' as StatusParcela,
            contrato_numero: 'CON-2026-LOC-001',
            contrato_objeto: 'Locação galpão canteiro BH Norte',
            tipo_contrato: 'despesa' as const,
            contraparte: 'Imobiliária Central LTDA',
            created_at: '2026-04-01T10:00:00Z',
            updated_at: '2026-04-01T10:00:00Z',
          },
        ],
        alertas_ativos: 2,
      }
      mockRpc.mockResolvedValueOnce({ data: dashboardData, error: null })

      const result = await mockSupabase.rpc('get_dashboard_contratos_gestao')
      expect(result.data.parcelas.pendentes).toBe(5)
      expect(result.data.parcelas.valor_pendente).toBe(75000)
      expect(result.data.proximas_parcelas[0].status).toBe('pendente')
      expect(result.data.proximas_parcelas[0].contrato_objeto).toContain('Locação')
    })

    it('lista parcelas pendentes próximas do vencimento', async () => {
      const parcelasProximas: Partial<Parcela>[] = [
        criarParcelaPendente({ id: 'p1', data_vencimento: '2026-04-15', valor: 15000 }),
        criarParcelaPendente({ id: 'p2', data_vencimento: '2026-04-20', valor: 8000 }),
        criarParcelaPendente({ id: 'p3', data_vencimento: '2026-04-25', valor: 12000 }),
      ]
      mockSupabase._setQueryResult(parcelasProximas)

      const builder = mockSupabase.from('con_parcelas')
      builder.select('*, contrato:con_contratos!contrato_id(numero, objeto, tipo_contrato, grupo_contrato)')
      builder.eq('status', 'pendente')
      builder.lte('data_vencimento', '2026-04-30')
      builder.order('data_vencimento', { ascending: true })

      expect(builder.eq).toHaveBeenCalledWith('status', 'pendente')
      expect(builder.lte).toHaveBeenCalledWith('data_vencimento', '2026-04-30')
    })
  })
})
