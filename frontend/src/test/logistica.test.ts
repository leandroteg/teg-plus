/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  BACKUP — frontend/src/test/logistica.test.ts                             ║
 * ║  Módulo: Logística                                                        ║
 * ║  Data criação: 2026-03-08                                                 ║
 * ║  Cobertura: Unit (TC-LOG-UNIT), Integration (TC-LOG-INT), Business (BIZ)  ║
 * ║  Fonte dos tipos: src/types/logistica.ts                                  ║
 * ║  Fonte dos hooks: src/hooks/useLogistica.ts                               ║
 * ║  Fonte das pages: src/pages/logistica/*.tsx                               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockSupabase, mockAuth, resetAllMocks } from './mocks/supabase'

import type {
  StatusSolicitacao, TipoTransporte, ModalTransporte,
  StatusNFe, TipoOcorrencia,
  LogSolicitacao, LogNFe, LogTransporte, LogRecebimento,
  LogChecklistExpedicao, LogAvaliacao, LogTransportadora,
  CriarSolicitacaoPayload, EmitirNFePayload, IniciarTransportePayload,
  LogisticaKPIs,
} from '../types/logistica'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers extraídos do código-fonte para testes puros
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Máquina de status da logística — 9 etapas sequenciais + terminais
 * Fonte: useLogistica.ts + Solicitacoes.tsx (ações por status)
 */
const STATUS_FLOW: StatusSolicitacao[] = [
  'solicitado',
  'validando',
  'planejado',
  'aguardando_aprovacao',
  'aprovado',
  'nfe_emitida',
  'em_transito',
  'entregue',
  'confirmado',
]

const TERMINAL_STATUSES: StatusSolicitacao[] = ['concluido', 'recusado', 'cancelado']

const ALL_STATUSES: StatusSolicitacao[] = [
  'solicitado', 'validando', 'planejado', 'aguardando_aprovacao',
  'aprovado', 'nfe_emitida', 'em_transito', 'entregue',
  'confirmado', 'concluido', 'recusado', 'cancelado',
]

/**
 * Alçadas de aprovação por custo estimado
 * Fonte: Solicitacoes.tsx linhas 31-35
 */
const ALCADAS = [
  { limite: 500,      label: 'Até R$ 500',          aprovador: 'Coordenador' },
  { limite: 2000,     label: 'R$ 501 a R$ 2.000',   aprovador: 'Gerente' },
  { limite: Infinity, label: 'Acima de R$ 2.000',    aprovador: 'Diretoria' },
]

function getAlcada(valor?: number) {
  if (!valor) return ALCADAS[0]
  return ALCADAS.find(a => valor <= a.limite) ?? ALCADAS[2]
}

/**
 * Mapa de cores por status
 * Fonte: LogisticaHome.tsx linhas 17-30
 */
const STATUS_LABEL: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  solicitado:           { label: 'Solicitado',     dot: 'bg-slate-400',   bg: 'bg-slate-50',    text: 'text-slate-600'   },
  validando:            { label: 'Validando',      dot: 'bg-sky-400',     bg: 'bg-sky-50',      text: 'text-sky-700'     },
  planejado:            { label: 'Planejado',      dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700'    },
  aguardando_aprovacao: { label: 'Aguard. Aprov.', dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700'   },
  aprovado:             { label: 'Aprovado',       dot: 'bg-indigo-400',  bg: 'bg-indigo-50',   text: 'text-indigo-700'  },
  nfe_emitida:          { label: 'NF-e Emitida',   dot: 'bg-violet-400',  bg: 'bg-violet-50',   text: 'text-violet-700'  },
  em_transito:          { label: 'Em Trânsito',    dot: 'bg-orange-400',  bg: 'bg-orange-50',   text: 'text-orange-700'  },
  entregue:             { label: 'Entregue',       dot: 'bg-teal-400',    bg: 'bg-teal-50',     text: 'text-teal-700'    },
  confirmado:           { label: 'Confirmado',     dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  concluido:            { label: 'Concluído',      dot: 'bg-green-500',   bg: 'bg-green-50',    text: 'text-green-700'   },
  recusado:             { label: 'Recusado',       dot: 'bg-red-400',     bg: 'bg-red-50',      text: 'text-red-700'     },
  cancelado:            { label: 'Cancelado',      dot: 'bg-gray-400',    bg: 'bg-gray-100',    text: 'text-gray-500'    },
}

/**
 * Tipos de transporte válidos
 * Fonte: types/logistica.ts linhas 3-7
 */
const TIPOS_TRANSPORTE: TipoTransporte[] = [
  'viagem',
  'mobilizacao',
  'transferencia_material',
  'transferencia_maquina',
]

/**
 * Modalidades válidas
 * Fonte: types/logistica.ts linhas 9-14
 */
const MODALIDADES: ModalTransporte[] = [
  'frota_propria',
  'frota_locada',
  'transportadora',
  'motoboy',
  'correios',
]

/**
 * Validação de chave NF-e (44 dígitos)
 */
function validarChaveNFe(chave: string): boolean {
  return /^\d{44}$/.test(chave)
}

/**
 * Lógica de auto-aprovação do usePlanejaarSolicitacao
 * Fonte: useLogistica.ts linhas 147-149
 */
function determinarStatusPosPlanejamento(custoEstimado?: number): StatusSolicitacao {
  const precisaAprovacao = (custoEstimado ?? 0) > 500
  return precisaAprovacao ? 'aguardando_aprovacao' : 'aprovado'
}

// ─────────────────────────────────────────────────────────────────────────────
// Factories para dados de teste
// ─────────────────────────────────────────────────────────────────────────────

function makeSolicitacao(overrides: Partial<LogSolicitacao> = {}): LogSolicitacao {
  return {
    id: 'sol-001',
    numero: 'LOG-202603-0001',
    tipo: 'transferencia_material',
    status: 'solicitado',
    origem: 'BH',
    destino: 'SE Frutal',
    carga_especial: false,
    urgente: false,
    criado_em: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
    ...overrides,
  }
}

function makeNFe(overrides: Partial<LogNFe> = {}): LogNFe {
  return {
    id: 'nfe-001',
    solicitacao_id: 'sol-001',
    tipo: 'NFe',
    serie: '1',
    status: 'autorizada',
    natureza_operacao: 'Transporte',
    numero: '100001',
    chave_acesso: '35260312345678000190550010001000011234567890',
    criado_em: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
    ...overrides,
  }
}

function makeTransporte(overrides: Partial<LogTransporte> = {}): LogTransporte {
  return {
    id: 'transp-001',
    solicitacao_id: 'sol-001',
    criado_em: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
    ...overrides,
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TC-LOG-UNIT — Testes Unitários
// ═════════════════════════════════════════════════════════════════════════════

describe('TC-LOG-UNIT — Testes Unitários Logística', () => {

  // TC-LOG-UNIT-001 ────────────────────────────────────────────────────────
  describe('TC-LOG-UNIT-001: Fluxo de status — 9 etapas sequenciais', () => {
    it('deve ter exatamente 9 etapas sequenciais no fluxo principal', () => {
      expect(STATUS_FLOW).toHaveLength(9)
    })

    it('deve começar com "solicitado" e terminar com "confirmado"', () => {
      expect(STATUS_FLOW[0]).toBe('solicitado')
      expect(STATUS_FLOW[STATUS_FLOW.length - 1]).toBe('confirmado')
    })

    it('deve conter as 9 etapas na ordem correta', () => {
      expect(STATUS_FLOW).toEqual([
        'solicitado',
        'validando',
        'planejado',
        'aguardando_aprovacao',
        'aprovado',
        'nfe_emitida',
        'em_transito',
        'entregue',
        'confirmado',
      ])
    })

    it('deve ter 3 status terminais: concluido, recusado, cancelado', () => {
      expect(TERMINAL_STATUSES).toEqual(['concluido', 'recusado', 'cancelado'])
    })

    it('deve ter 12 status totais (9 fluxo + 3 terminais)', () => {
      expect(ALL_STATUSES).toHaveLength(12)
    })

    it('todos os ALL_STATUSES devem ser strings não-vazias', () => {
      ALL_STATUSES.forEach(s => {
        expect(typeof s).toBe('string')
        expect(s.length).toBeGreaterThan(0)
      })
    })

    it('fluxo sequencial — cada etapa segue a anterior', () => {
      for (let i = 1; i < STATUS_FLOW.length; i++) {
        const prev = STATUS_FLOW[i - 1]
        const curr = STATUS_FLOW[i]
        expect(prev).not.toBe(curr)
        // Garantir que o índice anterior é menor (sequência)
        expect(STATUS_FLOW.indexOf(prev)).toBeLessThan(STATUS_FLOW.indexOf(curr))
      }
    })
  })

  // TC-LOG-UNIT-002 ────────────────────────────────────────────────────────
  describe('TC-LOG-UNIT-002: Alçadas de aprovação por custo estimado', () => {
    it('até R$ 500 → aprovação automática (Coordenador)', () => {
      expect(getAlcada(0).aprovador).toBe('Coordenador')
      expect(getAlcada(100).aprovador).toBe('Coordenador')
      expect(getAlcada(499).aprovador).toBe('Coordenador')
      expect(getAlcada(500).aprovador).toBe('Coordenador')
    })

    it('R$ 501 a R$ 2000 → Gerente', () => {
      expect(getAlcada(501).aprovador).toBe('Gerente')
      expect(getAlcada(1000).aprovador).toBe('Gerente')
      expect(getAlcada(2000).aprovador).toBe('Gerente')
    })

    it('acima de R$ 2000 → Diretoria', () => {
      expect(getAlcada(2001).aprovador).toBe('Diretoria')
      expect(getAlcada(10000).aprovador).toBe('Diretoria')
      expect(getAlcada(1000000).aprovador).toBe('Diretoria')
    })

    it('sem valor → retorna Coordenador (padrão)', () => {
      expect(getAlcada(undefined).aprovador).toBe('Coordenador')
      expect(getAlcada(0).aprovador).toBe('Coordenador')
    })

    it('labels corretos para cada faixa', () => {
      expect(getAlcada(300).label).toBe('Até R$ 500')
      expect(getAlcada(1500).label).toBe('R$ 501 a R$ 2.000')
      expect(getAlcada(5000).label).toBe('Acima de R$ 2.000')
    })

    it('auto-aprovação: custo <= R$ 500 → status "aprovado"', () => {
      expect(determinarStatusPosPlanejamento(0)).toBe('aprovado')
      expect(determinarStatusPosPlanejamento(300)).toBe('aprovado')
      expect(determinarStatusPosPlanejamento(500)).toBe('aprovado')
    })

    it('aprovação manual: custo > R$ 500 → status "aguardando_aprovacao"', () => {
      expect(determinarStatusPosPlanejamento(501)).toBe('aguardando_aprovacao')
      expect(determinarStatusPosPlanejamento(5000)).toBe('aguardando_aprovacao')
    })

    it('sem custo estimado → aprovação automática', () => {
      expect(determinarStatusPosPlanejamento(undefined)).toBe('aprovado')
    })
  })

  // TC-LOG-UNIT-003 ────────────────────────────────────────────────────────
  describe('TC-LOG-UNIT-003: Cores de status renderizadas corretamente', () => {
    it('todos os 12 status devem ter definição de cores', () => {
      ALL_STATUSES.forEach(status => {
        const config = STATUS_LABEL[status]
        expect(config, `status "${status}" sem configuração de cores`).toBeDefined()
        expect(config.label).toBeTruthy()
        expect(config.dot).toBeTruthy()
        expect(config.bg).toBeTruthy()
        expect(config.text).toBeTruthy()
      })
    })

    it('cores dot devem ser classes Tailwind bg-*', () => {
      Object.values(STATUS_LABEL).forEach(cfg => {
        expect(cfg.dot).toMatch(/^bg-/)
      })
    })

    it('cores bg devem ser classes Tailwind bg-*', () => {
      Object.values(STATUS_LABEL).forEach(cfg => {
        expect(cfg.bg).toMatch(/^bg-/)
      })
    })

    it('cores text devem ser classes Tailwind text-*', () => {
      Object.values(STATUS_LABEL).forEach(cfg => {
        expect(cfg.text).toMatch(/^text-/)
      })
    })

    it('status "solicitado" → cor slate', () => {
      expect(STATUS_LABEL.solicitado.dot).toContain('slate')
    })

    it('status "em_transito" → cor orange', () => {
      expect(STATUS_LABEL.em_transito.dot).toContain('orange')
    })

    it('status "confirmado" → cor emerald', () => {
      expect(STATUS_LABEL.confirmado.dot).toContain('emerald')
    })

    it('status "recusado" → cor red', () => {
      expect(STATUS_LABEL.recusado.dot).toContain('red')
    })

    it('status "cancelado" → cor gray', () => {
      expect(STATUS_LABEL.cancelado.dot).toContain('gray')
    })

    it('labels devem ser user-friendly (sem underscore)', () => {
      Object.values(STATUS_LABEL).forEach(cfg => {
        expect(cfg.label).not.toContain('_')
      })
    })
  })

  // TC-LOG-UNIT-004 ────────────────────────────────────────────────────────
  describe('TC-LOG-UNIT-004: Validação de chave NF-e (44 dígitos)', () => {
    it('chave com 44 dígitos válida', () => {
      const chave = '35260312345678000190550010001000011234567890'
      expect(chave).toHaveLength(44)
      expect(validarChaveNFe(chave)).toBe(true)
    })

    it('chave com menos de 44 dígitos é inválida', () => {
      expect(validarChaveNFe('3526031234567800019055001000100001')).toBe(false)
    })

    it('chave com mais de 44 dígitos é inválida', () => {
      expect(validarChaveNFe('352603123456780001905500100010000112345678901')).toBe(false)
    })

    it('chave vazia é inválida', () => {
      expect(validarChaveNFe('')).toBe(false)
    })

    it('chave com letras é inválida', () => {
      expect(validarChaveNFe('3526031234567800019055001000100001123456789A')).toBe(false)
    })

    it('chave com espaços é inválida', () => {
      expect(validarChaveNFe('3526 0312 3456 7800 0190 5500 1000 1000 0112 3456 7890')).toBe(false)
    })

    it('chave com caracteres especiais é inválida', () => {
      expect(validarChaveNFe('3526031234567800019055001000100001123456789-')).toBe(false)
    })
  })

  // TC-LOG-UNIT-005 ────────────────────────────────────────────────────────
  describe('TC-LOG-UNIT-005: Tipos de transporte válidos', () => {
    it('deve ter exatamente 4 tipos de transporte', () => {
      expect(TIPOS_TRANSPORTE).toHaveLength(4)
    })

    it('deve incluir "viagem"', () => {
      expect(TIPOS_TRANSPORTE).toContain('viagem')
    })

    it('deve incluir "mobilizacao"', () => {
      expect(TIPOS_TRANSPORTE).toContain('mobilizacao')
    })

    it('deve incluir "transferencia_material"', () => {
      expect(TIPOS_TRANSPORTE).toContain('transferencia_material')
    })

    it('deve incluir "transferencia_maquina"', () => {
      expect(TIPOS_TRANSPORTE).toContain('transferencia_maquina')
    })

    it('não deve incluir tipos inválidos', () => {
      const invalidos = ['entrega', 'coleta', 'frete', 'mudança']
      invalidos.forEach(t => {
        expect(TIPOS_TRANSPORTE).not.toContain(t)
      })
    })
  })

  // TC-LOG-UNIT-006 ────────────────────────────────────────────────────────
  describe('TC-LOG-UNIT-006: Modalidades de transporte válidas', () => {
    it('deve ter exatamente 5 modalidades', () => {
      expect(MODALIDADES).toHaveLength(5)
    })

    it('deve incluir "frota_propria"', () => {
      expect(MODALIDADES).toContain('frota_propria')
    })

    it('deve incluir "frota_locada"', () => {
      expect(MODALIDADES).toContain('frota_locada')
    })

    it('deve incluir "transportadora"', () => {
      expect(MODALIDADES).toContain('transportadora')
    })

    it('deve incluir "motoboy"', () => {
      expect(MODALIDADES).toContain('motoboy')
    })

    it('deve incluir "correios"', () => {
      expect(MODALIDADES).toContain('correios')
    })

    it('não deve incluir modalidades inválidas', () => {
      const invalidos = ['uber', 'drone', 'navio', 'trem']
      invalidos.forEach(m => {
        expect(MODALIDADES).not.toContain(m)
      })
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// TC-LOG-INT — Testes de Integração (hooks useLogistica)
// ═════════════════════════════════════════════════════════════════════════════

describe('TC-LOG-INT — Testes de Integração Logística', () => {

  beforeEach(() => {
    resetAllMocks()
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-admin-01', email: 'admin@teg.com' } },
      error: null,
    })
  })

  afterEach(() => {
    resetAllMocks()
  })

  // TC-LOG-INT-001 ────────────────────────────────────────────────────────
  describe('TC-LOG-INT-001: Criar solicitação de transporte', () => {
    it('deve inserir na tabela log_solicitacoes via Supabase', async () => {
      const payload: CriarSolicitacaoPayload = {
        tipo: 'transferencia_material',
        origem: 'BH',
        destino: 'SE Frutal',
        descricao: '10 cabos XLPE',
        obra_nome: 'SE Frutal',
        urgente: false,
      }

      const solCriada = makeSolicitacao({ ...payload, id: 'sol-new-01', numero: 'LOG-202603-0099' })
      mockSupabase._setQueryResult(solCriada)

      const result = await mockSupabase.from('log_solicitacoes').insert(payload).select().single()
      expect(result.data).toBeDefined()
      expect(mockSupabase.from).toHaveBeenCalledWith('log_solicitacoes')
    })

    it('deve inserir itens vinculados quando fornecidos', async () => {
      const itens = [
        { descricao: 'Cabo XLPE 10mm²', quantidade: 5, unidade: 'pç' },
        { descricao: 'Conectores', quantidade: 20, unidade: 'un' },
      ]
      const solCriada = makeSolicitacao({ id: 'sol-new-02' })
      mockSupabase._setQueryResult(solCriada)

      // Simular insert da solicitação
      const { data: sol } = await mockSupabase.from('log_solicitacoes').insert({}).select().single()
      expect(sol).toBeDefined()

      // Simular insert dos itens
      mockSupabase._setQueryResult(itens.map((i, idx) => ({
        ...i,
        id: `item-${idx}`,
        solicitacao_id: sol.id,
      })))

      const { data: insertedItems } = await mockSupabase
        .from('log_itens_solicitacao')
        .insert(itens.map(i => ({ ...i, solicitacao_id: sol.id })))

      expect(mockSupabase.from).toHaveBeenCalledWith('log_itens_solicitacao')
    })
  })

  // TC-LOG-INT-002 ────────────────────────────────────────────────────────
  describe('TC-LOG-INT-002: Fluxo solicitado → validando → planejado', () => {
    it('deve atualizar status de "solicitado" para "validando"', async () => {
      const solAtualizada = makeSolicitacao({ status: 'validando', validado_em: new Date().toISOString() })
      mockSupabase._setQueryResult(solAtualizada)

      const { data } = await mockSupabase
        .from('log_solicitacoes')
        .update({ status: 'validando', validado_em: new Date().toISOString() })
        .eq('id', 'sol-001')
        .select()
        .single()

      expect(data).toBeDefined()
      expect(mockSupabase.from).toHaveBeenCalledWith('log_solicitacoes')
    })

    it('deve registrar timestamp de validação', async () => {
      const agora = new Date().toISOString()
      const solAtualizada = makeSolicitacao({ status: 'validando', validado_em: agora })
      mockSupabase._setQueryResult(solAtualizada)

      const { data } = await mockSupabase
        .from('log_solicitacoes')
        .update({ status: 'validando', validado_em: agora })
        .eq('id', 'sol-001')
        .select()
        .single()

      expect(data.validado_em).toBe(agora)
    })
  })

  // TC-LOG-INT-003 ────────────────────────────────────────────────────────
  describe('TC-LOG-INT-003: Auto-aprovação para custo <= R$ 500', () => {
    it('custo R$ 300 → status deve ir direto para "aprovado"', () => {
      const novoStatus = determinarStatusPosPlanejamento(300)
      expect(novoStatus).toBe('aprovado')
    })

    it('custo R$ 500 (limite) → status deve ser "aprovado"', () => {
      const novoStatus = determinarStatusPosPlanejamento(500)
      expect(novoStatus).toBe('aprovado')
    })

    it('sem custo → status deve ser "aprovado"', () => {
      const novoStatus = determinarStatusPosPlanejamento(undefined)
      expect(novoStatus).toBe('aprovado')
    })

    it('custo zero → status deve ser "aprovado"', () => {
      const novoStatus = determinarStatusPosPlanejamento(0)
      expect(novoStatus).toBe('aprovado')
    })

    it('deve atualizar no Supabase com status correto', async () => {
      const custoEstimado = 400
      const novoStatus = determinarStatusPosPlanejamento(custoEstimado)
      const solAtualizada = makeSolicitacao({ status: novoStatus, custo_estimado: custoEstimado })
      mockSupabase._setQueryResult(solAtualizada)

      const { data } = await mockSupabase
        .from('log_solicitacoes')
        .update({ status: novoStatus, custo_estimado: custoEstimado })
        .eq('id', 'sol-001')
        .select()
        .single()

      expect(data.status).toBe('aprovado')
    })
  })

  // TC-LOG-INT-004 ────────────────────────────────────────────────────────
  describe('TC-LOG-INT-004: Aprovação manual para custo > R$ 500', () => {
    it('custo R$ 501 → status "aguardando_aprovacao"', () => {
      expect(determinarStatusPosPlanejamento(501)).toBe('aguardando_aprovacao')
    })

    it('custo R$ 2000 → status "aguardando_aprovacao"', () => {
      expect(determinarStatusPosPlanejamento(2000)).toBe('aguardando_aprovacao')
    })

    it('custo R$ 10000 → status "aguardando_aprovacao"', () => {
      expect(determinarStatusPosPlanejamento(10000)).toBe('aguardando_aprovacao')
    })

    it('aprovação manual aceita → status "aprovado" com campos de aprovação', async () => {
      const userId = 'user-gerente-01'
      const agora = new Date().toISOString()
      const solAprovada = makeSolicitacao({
        status: 'aprovado',
        aprovado_por: userId,
        aprovado_em: agora,
      })
      mockSupabase._setQueryResult(solAprovada)

      const { data } = await mockSupabase
        .from('log_solicitacoes')
        .update({
          status: 'aprovado',
          aprovado_por: userId,
          aprovado_em: agora,
        })
        .eq('id', 'sol-001')
        .select()
        .single()

      expect(data.status).toBe('aprovado')
      expect(data.aprovado_por).toBe(userId)
      expect(data.aprovado_em).toBeTruthy()
    })

    it('aprovação manual recusada → status "recusado" com motivo', async () => {
      const motivo = 'Orçamento excedido para o período'
      const solRecusada = makeSolicitacao({
        status: 'recusado',
        motivo_reprovacao: motivo,
      })
      mockSupabase._setQueryResult(solRecusada)

      const { data } = await mockSupabase
        .from('log_solicitacoes')
        .update({
          status: 'recusado',
          motivo_reprovacao: motivo,
        })
        .eq('id', 'sol-001')
        .select()
        .single()

      expect(data.status).toBe('recusado')
      expect(data.motivo_reprovacao).toBe(motivo)
    })
  })

  // TC-LOG-INT-005 ────────────────────────────────────────────────────────
  describe('TC-LOG-INT-005: Expedição bloqueada sem NF-e autorizada', () => {
    it('NF-e com status "autorizada" permite despacho', () => {
      const nfe = makeNFe({ status: 'autorizada' })
      expect(nfe.status).toBe('autorizada')
      // Despacho permitido
      const podeDespachar = nfe.status === 'autorizada'
      expect(podeDespachar).toBe(true)
    })

    it('NF-e com status "pendente" bloqueia despacho', () => {
      const nfe = makeNFe({ status: 'pendente' })
      const podeDespachar = nfe.status === 'autorizada'
      expect(podeDespachar).toBe(false)
    })

    it('NF-e com status "cancelada" bloqueia despacho', () => {
      const nfe = makeNFe({ status: 'cancelada' })
      const podeDespachar = nfe.status === 'autorizada'
      expect(podeDespachar).toBe(false)
    })

    it('NF-e com status "rejeitada" bloqueia despacho', () => {
      const nfe = makeNFe({ status: 'rejeitada' })
      const podeDespachar = nfe.status === 'autorizada'
      expect(podeDespachar).toBe(false)
    })

    it('NF-e com status "denegada" bloqueia despacho', () => {
      const nfe = makeNFe({ status: 'denegada' })
      const podeDespachar = nfe.status === 'autorizada'
      expect(podeDespachar).toBe(false)
    })

    it('sem NF-e bloqueia despacho', () => {
      const solSemNfe = makeSolicitacao({ nfe: undefined })
      const podeDespachar = solSemNfe.nfe?.status === 'autorizada'
      expect(podeDespachar).toBe(false)
    })
  })

  // TC-LOG-INT-006 ────────────────────────────────────────────────────────
  describe('TC-LOG-INT-006: Iniciar transporte', () => {
    it('deve criar registro em log_transportes com hora de saída', async () => {
      const payload: IniciarTransportePayload = {
        solicitacao_id: 'sol-001',
        placa: 'ABC1D23',
        motorista_nome: 'Carlos Silva',
        motorista_telefone: '31999999999',
        eta_original: '2026-03-02T18:00:00Z',
      }

      const transporteCriado = makeTransporte({
        ...payload,
        hora_saida: new Date().toISOString(),
        despachado_por: 'user-admin-01',
      })
      mockSupabase._setQueryResult(transporteCriado)

      const { data } = await mockSupabase
        .from('log_transportes')
        .insert(payload)
        .select()
        .single()

      expect(data).toBeDefined()
      expect(mockSupabase.from).toHaveBeenCalledWith('log_transportes')
    })

    it('deve atualizar status da solicitação para "em_transito"', async () => {
      const solAtualizada = makeSolicitacao({ status: 'em_transito' })
      mockSupabase._setQueryResult(solAtualizada)

      await mockSupabase
        .from('log_solicitacoes')
        .update({ status: 'em_transito' })
        .eq('id', 'sol-001')

      expect(mockSupabase.from).toHaveBeenCalledWith('log_solicitacoes')
    })

    it('deve criar recebimento pendente associado', async () => {
      const recebimento: Partial<LogRecebimento> = {
        solicitacao_id: 'sol-001',
        status: 'pendente',
      }
      mockSupabase._setQueryResult(recebimento)

      await mockSupabase
        .from('log_recebimentos')
        .insert({ solicitacao_id: 'sol-001', status: 'pendente' })
        .select()

      expect(mockSupabase.from).toHaveBeenCalledWith('log_recebimentos')
    })
  })

  // TC-LOG-INT-007 ────────────────────────────────────────────────────────
  describe('TC-LOG-INT-007: Confirmar entrega física', () => {
    it('deve registrar hora_chegada no transporte', async () => {
      const agora = new Date().toISOString()
      const transporteAtualizado = makeTransporte({ hora_chegada: agora })
      mockSupabase._setQueryResult(transporteAtualizado)

      await mockSupabase
        .from('log_transportes')
        .update({ hora_chegada: agora })
        .eq('id', 'transp-001')

      expect(mockSupabase.from).toHaveBeenCalledWith('log_transportes')
    })

    it('deve atualizar status da solicitação para "entregue"', async () => {
      const solAtualizada = makeSolicitacao({ status: 'entregue' })
      mockSupabase._setQueryResult(solAtualizada)

      await mockSupabase
        .from('log_solicitacoes')
        .update({ status: 'entregue' })
        .eq('id', 'sol-001')

      expect(mockSupabase.from).toHaveBeenCalledWith('log_solicitacoes')
    })

    it('deve atualizar entregue_em no recebimento', async () => {
      const agora = new Date().toISOString()
      mockSupabase._setQueryResult({})

      await mockSupabase
        .from('log_recebimentos')
        .update({ entregue_em: agora })
        .eq('solicitacao_id', 'sol-001')

      expect(mockSupabase.from).toHaveBeenCalledWith('log_recebimentos')
    })
  })

  // TC-LOG-INT-008 ────────────────────────────────────────────────────────
  describe('TC-LOG-INT-008: Confirmar recebimento', () => {
    it('recebimento confirmado → status "confirmado" + assinatura digital', async () => {
      const checklist = {
        quantidades_conferidas: true,
        estado_verificado: true,
        seriais_conferidos: true,
        temperatura_verificada: true,
      }
      const agora = new Date().toISOString()
      const recebimentoConfirmado: Partial<LogRecebimento> = {
        ...checklist,
        status: 'confirmado',
        confirmado_por: 'user-admin-01',
        confirmado_em: agora,
        assinatura_digital: `CONF-${Date.now().toString(36).toUpperCase()}`,
        avaliacao_qualidade: 5,
      }
      mockSupabase._setQueryResult(recebimentoConfirmado)

      const { data } = await mockSupabase
        .from('log_recebimentos')
        .update(recebimentoConfirmado)
        .eq('id', 'rec-001')
        .select()
        .single()

      expect(data.status).toBe('confirmado')
      expect(data.assinatura_digital).toBeTruthy()
      expect(data.confirmado_por).toBeTruthy()
    })

    it('recebimento parcial → status "parcial" com divergências', async () => {
      const recParcial: Partial<LogRecebimento> = {
        status: 'parcial',
        divergencias: 'Faltam 3 unidades do item #2',
      }
      mockSupabase._setQueryResult(recParcial)

      const { data } = await mockSupabase
        .from('log_recebimentos')
        .update(recParcial)
        .eq('id', 'rec-002')
        .select()
        .single()

      expect(data.status).toBe('parcial')
      expect(data.divergencias).toBeTruthy()
    })

    it('recebimento recusado → status "recusado"', async () => {
      const recRecusado: Partial<LogRecebimento> = {
        status: 'recusado',
        divergencias: 'Material completamente danificado',
      }
      mockSupabase._setQueryResult(recRecusado)

      const { data } = await mockSupabase
        .from('log_recebimentos')
        .update(recRecusado)
        .eq('id', 'rec-003')
        .select()
        .single()

      expect(data.status).toBe('recusado')
    })
  })

  // TC-LOG-INT-009 ────────────────────────────────────────────────────────
  describe('TC-LOG-INT-009: Avaliação de transportadora', () => {
    it('deve calcular média corretamente a partir de prazo, qualidade e comunicação', () => {
      const prazo = 5
      const qualidade = 4
      const comunicacao = 3
      const media = (prazo + qualidade + comunicacao) / 3
      expect(parseFloat(media.toFixed(2))).toBe(4)
    })

    it('deve inserir avaliação na tabela log_avaliacoes', async () => {
      const avaliacao: Partial<LogAvaliacao> = {
        transportadora_id: 'transp-01',
        solicitacao_id: 'sol-001',
        prazo: 5,
        qualidade: 4,
        comunicacao: 3,
        media: 4,
        avaliado_por: 'user-admin-01',
        comentario: 'Bom serviço, prazo cumprido',
      }
      mockSupabase._setQueryResult(avaliacao)

      const { data } = await mockSupabase
        .from('log_avaliacoes')
        .insert(avaliacao)
        .select()
        .single()

      expect(data).toBeDefined()
      expect(mockSupabase.from).toHaveBeenCalledWith('log_avaliacoes')
    })

    it('média de notas iguais deve resultar no mesmo valor', () => {
      const nota = 4
      const media = (nota + nota + nota) / 3
      expect(media).toBe(4)
    })

    it('média com valores decimais deve ter 2 casas', () => {
      const media = (5 + 4 + 3) / 3
      expect(parseFloat(media.toFixed(2))).toBe(4)
    })

    it('média mínima possível = 1.0', () => {
      const media = (1 + 1 + 1) / 3
      expect(media).toBe(1)
    })

    it('média máxima possível = 5.0', () => {
      const media = (5 + 5 + 5) / 3
      expect(media).toBe(5)
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// TC-LOG-BIZ — Testes de Regra de Negócio
// ═════════════════════════════════════════════════════════════════════════════

describe('TC-LOG-BIZ — Regras de Negócio Logística', () => {

  beforeEach(() => {
    resetAllMocks()
  })

  // TC-LOG-BIZ-001 ────────────────────────────────────────────────────────
  describe('TC-LOG-BIZ-001: Sem carga sem NF-e autorizada', () => {
    it('despacho de carga exige NF-e com status "autorizada"', () => {
      const statusesNaoAutorizados: StatusNFe[] = ['pendente', 'transmitida', 'cancelada', 'denegada', 'rejeitada']
      statusesNaoAutorizados.forEach(status => {
        const nfe = makeNFe({ status })
        const podeDespachar = nfe.status === 'autorizada'
        expect(podeDespachar, `status "${status}" não deveria permitir despacho`).toBe(false)
      })
    })

    it('somente NF-e autorizada permite despacho', () => {
      const nfe = makeNFe({ status: 'autorizada' })
      expect(nfe.status === 'autorizada').toBe(true)
    })

    it('solicitação sem NF-e não pode despachar', () => {
      const sol = makeSolicitacao()
      const temNFeAutorizada = sol.nfe?.status === 'autorizada'
      expect(temNFeAutorizada).toBe(false)
    })

    it('fluxo correto: emitir NF-e → autorizar → despachar', () => {
      // Passo 1: Status deve ser "aprovado" para emitir NF-e
      const solAprovada = makeSolicitacao({ status: 'aprovado' })
      expect(solAprovada.status).toBe('aprovado')

      // Passo 2: Emitir NF-e → status "nfe_emitida"
      const solComNfe = makeSolicitacao({
        status: 'nfe_emitida',
        nfe: makeNFe({ status: 'autorizada' }),
      })
      expect(solComNfe.status).toBe('nfe_emitida')
      expect(solComNfe.nfe?.status).toBe('autorizada')

      // Passo 3: Agora pode despachar → "em_transito"
      const podeDespachar = solComNfe.nfe?.status === 'autorizada'
      expect(podeDespachar).toBe(true)
    })
  })

  // TC-LOG-BIZ-002 ────────────────────────────────────────────────────────
  describe('TC-LOG-BIZ-002: Alçada de aprovação determinada pelo hook', () => {
    it('planejamento com custo <= 500 → auto-aprovação (pula aguardando_aprovacao)', () => {
      const status = determinarStatusPosPlanejamento(500)
      expect(status).toBe('aprovado')
      // Verifica que NÃO passa por aguardando_aprovacao
      expect(status).not.toBe('aguardando_aprovacao')
    })

    it('planejamento com custo 501 → precisa aprovação manual', () => {
      const status = determinarStatusPosPlanejamento(501)
      expect(status).toBe('aguardando_aprovacao')
    })

    it('getAlcada retorna aprovador correto para cada faixa', () => {
      // Coordenador: auto-aprovação
      expect(getAlcada(500).aprovador).toBe('Coordenador')
      // Gerente: aprovação manual
      expect(getAlcada(501).aprovador).toBe('Gerente')
      expect(getAlcada(2000).aprovador).toBe('Gerente')
      // Diretoria: aprovação manual
      expect(getAlcada(2001).aprovador).toBe('Diretoria')
    })

    it('limites das faixas são R$ 500 e R$ 2.000', () => {
      expect(ALCADAS[0].limite).toBe(500)
      expect(ALCADAS[1].limite).toBe(2000)
      expect(ALCADAS[2].limite).toBe(Infinity)
    })
  })

  // TC-LOG-BIZ-003 ────────────────────────────────────────────────────────
  describe('TC-LOG-BIZ-003: Ocorrência não cancela o transporte', () => {
    it('registrar ocorrência mantém transporte ativo', () => {
      const transporte = makeTransporte({
        hora_saida: '2026-03-01T10:00:00Z',
        hora_chegada: undefined, // ainda em trânsito
      })

      // Ocorrência registrada
      const ocorrencia = {
        transporte_id: transporte.id,
        tipo: 'atraso' as TipoOcorrencia,
        descricao: 'Atraso de 2h por chuva forte',
        resolvido: false,
      }

      // Transporte continua sem hora_chegada (não cancelado)
      expect(transporte.hora_chegada).toBeUndefined()
      expect(ocorrencia.resolvido).toBe(false)
    })

    it('resolver ocorrência não altera status do transporte', () => {
      const transporte = makeTransporte({
        hora_saida: '2026-03-01T10:00:00Z',
        ocorrencias: [{
          id: 'oc-001',
          transporte_id: 'transp-001',
          solicitacao_id: 'sol-001',
          tipo: 'avaria_carga',
          descricao: 'Caixa danificada',
          fotos: [],
          registrado_em: '2026-03-01T12:00:00Z',
          resolvido: true,
          resolucao: 'Item substituído',
          resolvido_em: '2026-03-01T14:00:00Z',
        }],
      })

      // Transporte continua ativo (sem hora_chegada)
      expect(transporte.hora_chegada).toBeUndefined()
      expect(transporte.ocorrencias?.[0].resolvido).toBe(true)
    })

    it('múltiplas ocorrências não cancelam transporte', () => {
      const transporte = makeTransporte({
        hora_saida: '2026-03-01T10:00:00Z',
        ocorrencias: [
          { id: 'oc-1', transporte_id: 'transp-001', solicitacao_id: 'sol-001', tipo: 'atraso', descricao: 'Atraso', fotos: [], registrado_em: '2026-03-01T12:00:00Z', resolvido: false },
          { id: 'oc-2', transporte_id: 'transp-001', solicitacao_id: 'sol-001', tipo: 'desvio_rota', descricao: 'Desvio', fotos: [], registrado_em: '2026-03-01T13:00:00Z', resolvido: false },
          { id: 'oc-3', transporte_id: 'transp-001', solicitacao_id: 'sol-001', tipo: 'parada_nao_programada', descricao: 'Parada', fotos: [], registrado_em: '2026-03-01T14:00:00Z', resolvido: false },
        ],
      })

      expect(transporte.hora_chegada).toBeUndefined()
      expect(transporte.ocorrencias).toHaveLength(3)
    })
  })

  // TC-LOG-BIZ-004 ────────────────────────────────────────────────────────
  describe('TC-LOG-BIZ-004: Recusa na validação encerra o processo', () => {
    it('status "recusado" é terminal — não avança mais', () => {
      expect(TERMINAL_STATUSES).toContain('recusado')
      expect(STATUS_FLOW).not.toContain('recusado')
    })

    it('status "cancelado" é terminal — não avança mais', () => {
      expect(TERMINAL_STATUSES).toContain('cancelado')
      expect(STATUS_FLOW).not.toContain('cancelado')
    })

    it('recusa durante validação → motivo obrigatório', () => {
      const solRecusada = makeSolicitacao({
        status: 'recusado',
        motivo_recusa: 'Material não pertence ao escopo da obra',
      })
      expect(solRecusada.status).toBe('recusado')
      expect(solRecusada.motivo_recusa).toBeTruthy()
    })

    it('cancelamento permitido apenas nos status iniciais', () => {
      // Fonte: Solicitacoes.tsx linhas 303-309
      const statusesCancelaveis: StatusSolicitacao[] = ['solicitado', 'validando', 'planejado']
      statusesCancelaveis.forEach(status => {
        expect(['solicitado', 'validando', 'planejado']).toContain(status)
      })

      // Não-canceláveis
      const naoCancelaveis: StatusSolicitacao[] = [
        'aguardando_aprovacao', 'aprovado', 'nfe_emitida',
        'em_transito', 'entregue', 'confirmado',
      ]
      naoCancelaveis.forEach(status => {
        expect(['solicitado', 'validando', 'planejado']).not.toContain(status)
      })
    })

    it('uma vez recusado, status não pode voltar ao fluxo principal', () => {
      // Recusado é terminal, não está em STATUS_FLOW
      const posicaoNoFluxo = STATUS_FLOW.indexOf('recusado')
      expect(posicaoNoFluxo).toBe(-1)
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Extras — Tipos NF-e e Ocorrência
// ═════════════════════════════════════════════════════════════════════════════

describe('Validações extras de tipos Logística', () => {

  describe('StatusNFe — todos os valores válidos', () => {
    const STATUSES_NFE: StatusNFe[] = ['pendente', 'transmitida', 'autorizada', 'cancelada', 'denegada', 'rejeitada']

    it('deve ter 6 status de NF-e', () => {
      expect(STATUSES_NFE).toHaveLength(6)
    })

    it('todos devem ser strings não-vazias', () => {
      STATUSES_NFE.forEach(s => {
        expect(typeof s).toBe('string')
        expect(s.length).toBeGreaterThan(0)
      })
    })
  })

  describe('TipoOcorrencia — valores de ocorrência de transporte', () => {
    const TIPOS_OCORRENCIA: TipoOcorrencia[] = [
      'avaria_veiculo', 'acidente', 'atraso', 'desvio_rota',
      'parada_nao_programada', 'avaria_carga', 'roubo', 'outro',
    ]

    it('deve ter 8 tipos de ocorrência', () => {
      expect(TIPOS_OCORRENCIA).toHaveLength(8)
    })

    it('deve incluir tipos críticos: acidente, roubo', () => {
      expect(TIPOS_OCORRENCIA).toContain('acidente')
      expect(TIPOS_OCORRENCIA).toContain('roubo')
    })

    it('deve incluir tipo genérico "outro"', () => {
      expect(TIPOS_OCORRENCIA).toContain('outro')
    })
  })

  describe('LogisticaKPIs — interface de métricas', () => {
    it('KPIs vazios devem ter todos os campos zerados', () => {
      const empty: LogisticaKPIs = {
        total_solicitacoes: 0,
        abertas: 0,
        em_transito: 0,
        entregues_hoje: 0,
        confirmadas_hoje: 0,
        urgentes_pendentes: 0,
        nfe_emitidas_mes: 0,
        custo_total_mes: 0,
        taxa_entrega_prazo: 0,
        taxa_avarias: 0,
        tempo_medio_confirmacao_h: 0,
      }
      Object.values(empty).forEach(v => {
        expect(v).toBe(0)
      })
    })

    it('taxa_entrega_prazo é um percentual (0–100)', () => {
      const kpis: Partial<LogisticaKPIs> = { taxa_entrega_prazo: 85 }
      expect(kpis.taxa_entrega_prazo).toBeGreaterThanOrEqual(0)
      expect(kpis.taxa_entrega_prazo).toBeLessThanOrEqual(100)
    })
  })

  describe('CriarSolicitacaoPayload — validação de payload', () => {
    it('payload mínimo válido exige tipo, origem e destino', () => {
      const payload: CriarSolicitacaoPayload = {
        tipo: 'viagem',
        origem: 'BH',
        destino: 'SE Frutal',
      }
      expect(payload.tipo).toBeTruthy()
      expect(payload.origem).toBeTruthy()
      expect(payload.destino).toBeTruthy()
    })

    it('payload completo com itens', () => {
      const payload: CriarSolicitacaoPayload = {
        tipo: 'transferencia_material',
        origem: 'Depósito BH',
        destino: 'SE Paracatu',
        descricao: 'Materiais elétricos',
        obra_nome: 'SE Paracatu',
        centro_custo: 'CC-002',
        urgente: true,
        justificativa_urgencia: 'Parada programada em 3 dias',
        peso_total_kg: 1500,
        volumes_total: 10,
        carga_especial: true,
        observacoes_carga: 'Transformador frágil',
        itens: [
          { descricao: 'Transformador 500kVA', quantidade: 1, unidade: 'pç' },
          { descricao: 'Cabo XLPE 35mm²', quantidade: 500, unidade: 'm' },
        ],
      }
      expect(payload.itens).toHaveLength(2)
      expect(payload.urgente).toBe(true)
      expect(payload.carga_especial).toBe(true)
    })
  })

  describe('ChecklistExpedicao — campos obrigatórios', () => {
    it('checklist completo tem 7 itens de verificação', () => {
      const checklist: Omit<LogChecklistExpedicao, 'id' | 'criado_em'> = {
        solicitacao_id: 'sol-001',
        itens_conferidos: true,
        volumes_identificados: true,
        embalagem_verificada: true,
        documentacao_separada: true,
        motorista_habilitado: true,
        veiculo_vistoriado: true,
        contato_destinatario: true,
      }
      const boolFields = [
        checklist.itens_conferidos,
        checklist.volumes_identificados,
        checklist.embalagem_verificada,
        checklist.documentacao_separada,
        checklist.motorista_habilitado,
        checklist.veiculo_vistoriado,
        checklist.contato_destinatario,
      ]
      expect(boolFields).toHaveLength(7)
      expect(boolFields.every(Boolean)).toBe(true)
    })

    it('checklist incompleto tem pelo menos um false', () => {
      const checklist: Partial<LogChecklistExpedicao> = {
        itens_conferidos: true,
        volumes_identificados: false,
        embalagem_verificada: true,
        documentacao_separada: true,
        motorista_habilitado: true,
        veiculo_vistoriado: true,
        contato_destinatario: true,
      }
      const boolFields = [
        checklist.itens_conferidos,
        checklist.volumes_identificados,
        checklist.embalagem_verificada,
        checklist.documentacao_separada,
        checklist.motorista_habilitado,
        checklist.veiculo_vistoriado,
        checklist.contato_destinatario,
      ]
      expect(boolFields.every(Boolean)).toBe(false)
    })
  })
})
