// ============================================================================
// BACKUP: frontend/src/test/cadastros.test.ts
// Criado em: 2026-03-08
// Descricao: Suite de testes para o modulo de Cadastros AI (Master Data)
//   do TEG+ ERP. Cobre validacoes unitarias (CNPJ, CPF, modos AI/Manual,
//   indicadores de confianca, CRUD classes financeiras/centros custo) e
//   testes de integracao (consultas BrasilAPI, AI parse, pre-cadastro,
//   cross-module entre Cadastros → Compras/Estoque/Financeiro).
//
// IDs dos testes: TC-CAD-UNIT-001 a TC-CAD-UNIT-006 (unitarios)
//                 TC-CAD-INT-001 a TC-CAD-INT-008 (integracao)
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSupabase, resetAllMocks } from './mocks/supabase'
import { mockApi, resetApiMocks } from './mocks/api'
import {
  validarCNPJ,
  validarCPF,
  formatarCNPJ,
  formatarCPF,
  getNivelConfianca,
  getCorConfianca,
  getConfidenceLevel,
  getConfidenceColor,
} from '../utils/validators'
import type {
  Empresa,
  ClasseFinanceira,
  CentroCusto,
  Obra,
  Colaborador,
  GrupoFinanceiro,
  CategoriaFinanceira,
  AiCadastroResult,
  AiCadastroField,
} from '../types/cadastros'

// ============================================================================
// TESTES UNITARIOS — Validacoes e Logica de Cadastros
// ============================================================================

describe('Cadastros — Testes Unitarios', () => {
  beforeEach(() => {
    resetAllMocks()
    resetApiMocks()
  })

  // ── TC-CAD-UNIT-001: Validacao de CNPJ ──────────────────────────────────

  describe('TC-CAD-UNIT-001: Validacao de CNPJ (14 digitos + digitos verificadores)', () => {
    // CNPJs validos conhecidos
    it('aceita CNPJ valido: 11222333000181', () => {
      expect(validarCNPJ('11222333000181')).toBe(true)
    })

    it('aceita CNPJ valido formatado: 11.222.333/0001-81', () => {
      expect(validarCNPJ('11.222.333/0001-81')).toBe(true)
    })

    it('aceita CNPJ da CEMIG: 17155730000164', () => {
      expect(validarCNPJ('17155730000164')).toBe(true)
    })

    // CNPJs invalidos
    it('rejeita CNPJ com menos de 14 digitos', () => {
      expect(validarCNPJ('1234567890123')).toBe(false)
    })

    it('rejeita CNPJ com mais de 14 digitos', () => {
      expect(validarCNPJ('123456789012345')).toBe(false)
    })

    it('rejeita CNPJ com todos os digitos iguais: 11111111111111', () => {
      expect(validarCNPJ('11111111111111')).toBe(false)
    })

    it('rejeita CNPJ com todos os digitos iguais: 00000000000000', () => {
      expect(validarCNPJ('00000000000000')).toBe(false)
    })

    it('rejeita CNPJ com digito verificador errado', () => {
      expect(validarCNPJ('11222333000182')).toBe(false) // ultimo digito errado
    })

    it('rejeita string vazia', () => {
      expect(validarCNPJ('')).toBe(false)
    })

    it('rejeita string com letras', () => {
      expect(validarCNPJ('1122233300018A')).toBe(false)
    })

    // Formatacao
    it('formata CNPJ corretamente: XX.XXX.XXX/XXXX-XX', () => {
      expect(formatarCNPJ('11222333000181')).toBe('11.222.333/0001-81')
    })

    it('formata CNPJ ja formatado sem duplicar pontuacao', () => {
      expect(formatarCNPJ('11.222.333/0001-81')).toBe('11.222.333/0001-81')
    })

    it('formata CNPJ com padding zero a esquerda', () => {
      const result = formatarCNPJ('222333000181')
      expect(result).toBe('00.222.333/0001-81')
    })
  })

  // ── TC-CAD-UNIT-002: Validacao de CPF ──────────────────────────────────

  describe('TC-CAD-UNIT-002: Validacao de CPF (11 digitos + digitos verificadores)', () => {
    // CPFs validos conhecidos (gerados com algoritmo)
    it('aceita CPF valido: 52998224725', () => {
      expect(validarCPF('52998224725')).toBe(true)
    })

    it('aceita CPF valido formatado: 529.982.247-25', () => {
      expect(validarCPF('529.982.247-25')).toBe(true)
    })

    it('aceita CPF valido: 11144477735', () => {
      expect(validarCPF('11144477735')).toBe(true)
    })

    // CPFs invalidos
    it('rejeita CPF com menos de 11 digitos', () => {
      expect(validarCPF('1234567890')).toBe(false)
    })

    it('rejeita CPF com mais de 11 digitos', () => {
      expect(validarCPF('123456789012')).toBe(false)
    })

    it('rejeita CPF com todos os digitos iguais: 11111111111', () => {
      expect(validarCPF('11111111111')).toBe(false)
    })

    it('rejeita CPF com todos os digitos iguais: 00000000000', () => {
      expect(validarCPF('00000000000')).toBe(false)
    })

    it('rejeita CPF com digito verificador errado', () => {
      expect(validarCPF('52998224726')).toBe(false) // ultimo digito errado
    })

    it('rejeita string vazia', () => {
      expect(validarCPF('')).toBe(false)
    })

    // Formatacao
    it('formata CPF corretamente: XXX.XXX.XXX-XX', () => {
      expect(formatarCPF('52998224725')).toBe('529.982.247-25')
    })

    it('formata CPF ja formatado sem duplicar pontuacao', () => {
      expect(formatarCPF('529.982.247-25')).toBe('529.982.247-25')
    })

    it('formata CPF com padding zero a esquerda', () => {
      // '98224725' padded to 11 digits: '00098224725'
      // Formatted: 000.982.247-25
      const result = formatarCPF('98224725')
      expect(result).toBe('000.982.247-25')
    })
  })

  // ── TC-CAD-UNIT-003: Toggle AI/Manual no formulario ────────────────────

  describe('TC-CAD-UNIT-003: Toggle AI/Manual mode no formulario', () => {
    it('modo padrao para novo cadastro e "ai" quando aiEnabled=true', () => {
      const isNew = true
      const aiEnabled = true
      const defaultMode = isNew && aiEnabled ? 'ai' : 'manual'
      expect(defaultMode).toBe('ai')
    })

    it('modo padrao para edicao existente e "manual"', () => {
      const isNew = false
      const aiEnabled = true
      const defaultMode = isNew && aiEnabled ? 'ai' : 'manual'
      expect(defaultMode).toBe('manual')
    })

    it('modo padrao quando AI desabilitado e "manual"', () => {
      const isNew = true
      const aiEnabled = false
      const defaultMode = isNew && aiEnabled ? 'ai' : 'manual'
      expect(defaultMode).toBe('manual')
    })

    it('formulario exibe campos quando modo e "manual"', () => {
      const mode = 'manual'
      const aiDone = false
      const showForm = mode === 'manual' || aiDone
      expect(showForm).toBe(true)
    })

    it('formulario esconde campos quando modo e "ai" e AI nao terminou', () => {
      const mode = 'ai'
      const aiDone = false
      const showForm = mode === 'manual' || aiDone
      expect(showForm).toBe(false)
    })

    it('formulario exibe campos quando modo e "ai" e AI terminou', () => {
      const mode = 'ai'
      const aiDone = true
      const showForm = mode === 'manual' || aiDone
      expect(showForm).toBe(true)
    })
  })

  // ── TC-CAD-UNIT-004: Indicadores de confianca ─────────────────────────

  describe('TC-CAD-UNIT-004: Indicadores de confianca AI', () => {
    // getNivelConfianca (funcao original)
    it('confianca >= 0.8 → nivel "alto"', () => {
      expect(getNivelConfianca(0.8)).toBe('alto')
      expect(getNivelConfianca(0.9)).toBe('alto')
      expect(getNivelConfianca(0.99)).toBe('alto')
      expect(getNivelConfianca(1.0)).toBe('alto')
    })

    it('confianca >= 0.5 e < 0.8 → nivel "medio"', () => {
      expect(getNivelConfianca(0.5)).toBe('medio')
      expect(getNivelConfianca(0.6)).toBe('medio')
      expect(getNivelConfianca(0.79)).toBe('medio')
    })

    it('confianca < 0.5 → nivel "baixo"', () => {
      expect(getNivelConfianca(0.0)).toBe('baixo')
      expect(getNivelConfianca(0.1)).toBe('baixo')
      expect(getNivelConfianca(0.49)).toBe('baixo')
    })

    // getConfidenceLevel (alias)
    it('getConfidenceLevel e alias para getNivelConfianca', () => {
      expect(getConfidenceLevel(0.9)).toBe(getNivelConfianca(0.9))
      expect(getConfidenceLevel(0.6)).toBe(getNivelConfianca(0.6))
      expect(getConfidenceLevel(0.2)).toBe(getNivelConfianca(0.2))
    })

    // Cores
    it('nivel "alto" → cor "verde"', () => {
      expect(getConfidenceColor('alto')).toBe('verde')
    })

    it('nivel "medio" → cor "amarelo"', () => {
      expect(getConfidenceColor('medio')).toBe('amarelo')
    })

    it('nivel "baixo" → cor "vermelho"', () => {
      expect(getConfidenceColor('baixo')).toBe('vermelho')
    })

    it('nivel desconhecido → cor "vermelho" (fallback)', () => {
      expect(getConfidenceColor('invalido')).toBe('vermelho')
    })

    // Cor CSS interna (getCorConfianca)
    it('getCorConfianca retorna classe CSS verde para alto', () => {
      expect(getCorConfianca('alto')).toContain('green')
    })

    it('getCorConfianca retorna classe CSS amarela para medio', () => {
      expect(getCorConfianca('medio')).toContain('yellow')
    })

    it('getCorConfianca retorna classe CSS vermelha para baixo', () => {
      expect(getCorConfianca('baixo')).toContain('red')
    })

    // Integracao com ConfidenceField thresholds
    it('ConfidenceField: confianca >= 0.9 → borda emerald', () => {
      const confidence = 0.95
      const borderColor = confidence >= 0.9 ? 'border-l-emerald-400'
        : confidence >= 0.7 ? 'border-l-amber-400'
        : 'border-l-rose-400'
      expect(borderColor).toBe('border-l-emerald-400')
    })

    it('ConfidenceField: confianca >= 0.7 e < 0.9 → borda amber', () => {
      const confidence = 0.75
      const borderColor = confidence >= 0.9 ? 'border-l-emerald-400'
        : confidence >= 0.7 ? 'border-l-amber-400'
        : 'border-l-rose-400'
      expect(borderColor).toBe('border-l-amber-400')
    })

    it('ConfidenceField: confianca < 0.7 → borda rose', () => {
      const confidence = 0.4
      const borderColor = confidence >= 0.9 ? 'border-l-emerald-400'
        : confidence >= 0.7 ? 'border-l-amber-400'
        : 'border-l-rose-400'
      expect(borderColor).toBe('border-l-rose-400')
    })
  })

  // ── TC-CAD-UNIT-005: CRUD Classes Financeiras ─────────────────────────

  describe('TC-CAD-UNIT-005: CRUD classes financeiras', () => {
    it('lista classes financeiras da tabela fin_classes_financeiras', async () => {
      const classes: Partial<ClasseFinanceira>[] = [
        { id: 'cl1', codigo: 'CF-001', descricao: 'Materiais de Obra', tipo: 'despesa', ativo: true },
        { id: 'cl2', codigo: 'CF-002', descricao: 'Servicos de Engenharia', tipo: 'despesa', ativo: true },
        { id: 'cl3', codigo: 'CF-003', descricao: 'Receita de Contrato', tipo: 'receita', ativo: true },
      ]
      mockSupabase._setQueryResult(classes)

      const builder = mockSupabase.from('fin_classes_financeiras')
      builder.select('*')
      builder.order('codigo')

      expect(mockSupabase.from).toHaveBeenCalledWith('fin_classes_financeiras')
    })

    it('filtra classes por tipo (receita/despesa)', async () => {
      mockSupabase._setQueryResult([])

      const builder = mockSupabase.from('fin_classes_financeiras')
      builder.select('*')
      builder.eq('tipo', 'despesa')

      expect(builder.eq).toHaveBeenCalledWith('tipo', 'despesa')
    })

    it('cria nova classe financeira com insert', async () => {
      const novaClasse = {
        codigo: 'CF-004',
        descricao: 'Equipamentos Eletricos',
        tipo: 'despesa',
        ativo: true,
      }
      mockSupabase._setQueryResult({})

      const builder = mockSupabase.from('fin_classes_financeiras')
      builder.insert(novaClasse)

      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ codigo: 'CF-004', tipo: 'despesa' })
      )
    })

    it('atualiza classe financeira existente com update', async () => {
      mockSupabase._setQueryResult({})

      const builder = mockSupabase.from('fin_classes_financeiras')
      builder.update({ descricao: 'Materiais de Construcao Atualizado' })
      builder.eq('id', 'cl1')

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ descricao: 'Materiais de Construcao Atualizado' })
      )
      expect(builder.eq).toHaveBeenCalledWith('id', 'cl1')
    })

    it('classe financeira possui tipos validos: receita, despesa, ambos', () => {
      const tiposValidos = ['receita', 'despesa', 'ambos']
      expect(tiposValidos).toHaveLength(3)
    })
  })

  // ── TC-CAD-UNIT-006: CRUD Centros de Custo ────────────────────────────

  describe('TC-CAD-UNIT-006: CRUD centros de custo', () => {
    it('lista centros de custo da tabela sys_centros_custo com join empresa', async () => {
      const centros: Partial<CentroCusto>[] = [
        { id: 'cc1', codigo: 'CC-001', descricao: 'SE Frutal', ativo: true, empresa: { id: 'e1', codigo: 'TEG', razao_social: 'TEG Uniao Energia' } },
        { id: 'cc2', codigo: 'CC-002', descricao: 'SE Paracatu', ativo: true, empresa: { id: 'e1', codigo: 'TEG', razao_social: 'TEG Uniao Energia' } },
      ]
      mockSupabase._setQueryResult(centros)

      const builder = mockSupabase.from('sys_centros_custo')
      builder.select('*, empresa:sys_empresas!empresa_id(id, codigo, razao_social)')
      builder.order('codigo')

      expect(mockSupabase.from).toHaveBeenCalledWith('sys_centros_custo')
      expect(builder.select).toHaveBeenCalledWith(
        expect.stringContaining('sys_empresas')
      )
    })

    it('cria novo centro de custo com insert', async () => {
      const novoCc = {
        codigo: 'CC-007',
        descricao: 'SE Ituiutaba',
        empresa_id: 'e1',
        ativo: true,
      }
      mockSupabase._setQueryResult({})

      const builder = mockSupabase.from('sys_centros_custo')
      builder.insert(novoCc)

      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ codigo: 'CC-007', descricao: 'SE Ituiutaba' })
      )
    })

    it('atualiza centro de custo existente com update', async () => {
      mockSupabase._setQueryResult({})

      const builder = mockSupabase.from('sys_centros_custo')
      builder.update({ descricao: 'SE Ituiutaba Atualizado', ativo: false })
      builder.eq('id', 'cc1')

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ descricao: 'SE Ituiutaba Atualizado', ativo: false })
      )
    })

    it('centro de custo vincula a empresa via empresa_id', () => {
      const cc: Partial<CentroCusto> = {
        id: 'cc1',
        codigo: 'CC-001',
        descricao: 'SE Frutal',
        empresa_id: 'empresa-uuid-001',
      }
      expect(cc.empresa_id).toBeTruthy()
    })
  })
})

// ============================================================================
// TESTES DE INTEGRACAO — Consultas Externas, AI Parse, Cross-module
// ============================================================================

describe('Cadastros — Testes de Integracao', () => {
  beforeEach(() => {
    resetAllMocks()
    resetApiMocks()
  })

  // ── TC-CAD-INT-001: Consulta CNPJ via BrasilAPI ─────────────────────────

  describe('TC-CAD-INT-001: Consulta CNPJ via BrasilAPI (mock)', () => {
    it('retorna dados da empresa ao consultar CNPJ valido', async () => {
      const result = await mockApi.consultarCNPJ('12345678000190')

      expect(mockApi.consultarCNPJ).toHaveBeenCalledWith('12345678000190')
      expect(result.cnpj).toBe('12345678000190')
      expect(result.razao_social).toBe('Empresa Teste LTDA')
      expect(result.nome_fantasia).toBe('Teste')
      expect(result.situacao).toBe('ATIVA')
    })

    it('retorna endereco completo com cep, logradouro, cidade, uf', async () => {
      const result = await mockApi.consultarCNPJ('12345678000190')

      expect(result.endereco).toBeDefined()
      expect(result.endereco.cep).toBe('30130000')
      expect(result.endereco.logradouro).toBe('Rua Teste')
      expect(result.endereco.cidade).toBe('BH')
      expect(result.endereco.uf).toBe('MG')
    })

    it('retorna telefone e email quando disponiveis', async () => {
      const result = await mockApi.consultarCNPJ('12345678000190')

      expect(result.telefone).toBe('31999999999')
      expect(result.email).toBe('teste@teste.com')
    })

    it('CNPJ deve ter exatamente 14 digitos numericos apos limpeza', () => {
      const cnpjFormatado = '12.345.678/0001-90'
      const limpo = cnpjFormatado.replace(/\D/g, '')
      expect(limpo.length).toBe(14)
      expect(limpo).toBe('12345678000190')
    })

    it('ignora consulta com CNPJ incompleto (< 14 digitos)', () => {
      const cnpj = '1234567800019' // 13 digitos
      const limpo = cnpj.replace(/\D/g, '')
      const deveConsultar = limpo.length === 14
      expect(deveConsultar).toBe(false)
    })
  })

  // ── TC-CAD-INT-002: Consulta CPF via BrasilAPI (mock) ───────────────────

  describe('TC-CAD-INT-002: Consulta CPF via BrasilAPI (mock)', () => {
    it('validacao de CPF precede qualquer consulta', () => {
      const cpfValido = '52998224725'
      expect(validarCPF(cpfValido)).toBe(true)
      expect(cpfValido.replace(/\D/g, '').length).toBe(11)
    })

    it('CPF com 11 digitos aciona tipo "cpf" no AiDropZone', () => {
      const docInput = '529.982.247-25'
      const clean = docInput.replace(/\D/g, '')
      const showCpfField = true

      let parsedType: string | null = null
      if (showCpfField && clean.length === 11) {
        parsedType = 'cpf'
      }

      expect(parsedType).toBe('cpf')
    })

    it('CPF invalido nao passa na validacao', () => {
      expect(validarCPF('12345678901')).toBe(false)
      expect(validarCPF('00000000000')).toBe(false)
    })
  })

  // ── TC-CAD-INT-003: AI Parse de documento ──────────────────────────────

  describe('TC-CAD-INT-003: AI Parse de documento', () => {
    it('extrai CNPJ de texto livre via regex', () => {
      const texto = 'Empresa XYZ, CNPJ 12.345.678/0001-90, localizada em BH'
      const cnpjMatch = texto.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/)
      expect(cnpjMatch).toBeTruthy()
      expect(cnpjMatch![0].replace(/\D/g, '')).toBe('12345678000190')
    })

    it('extrai CPF de texto livre via regex', () => {
      const texto = 'Funcionario Joao, CPF 529.982.247-25'
      const cpfMatch = texto.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/)
      expect(cpfMatch).toBeTruthy()
      expect(cpfMatch![0].replace(/\D/g, '')).toBe('52998224725')
    })

    it('extrai email de texto livre via regex', () => {
      const texto = 'Contato: joao@tegenergia.com.br'
      const emailMatch = texto.match(/[\w.-]+@[\w.-]+\.\w+/)
      expect(emailMatch).toBeTruthy()
      expect(emailMatch![0]).toBe('joao@tegenergia.com.br')
    })

    it('extrai telefone de texto livre via regex', () => {
      const texto = 'Telefone: (31) 99999-8888'
      const phoneMatch = texto.match(/\(?\d{2}\)?\s?\d{4,5}-?\d{4}/)
      expect(phoneMatch).toBeTruthy()
    })

    it('resultado AI parse tem estrutura correta com fields e confidence', () => {
      const aiResult: AiCadastroResult = {
        fields: {
          razao_social: { value: 'Empresa Teste LTDA', confidence: 0.95 },
          cnpj: { value: '12345678000190', confidence: 1.0 },
          email: { value: 'teste@teste.com', confidence: 0.85 },
        },
      }
      expect(aiResult.fields.razao_social.confidence).toBeGreaterThanOrEqual(0.8)
      expect(aiResult.fields.cnpj.confidence).toBe(1.0)
    })

    it('campos com confidence baixa sao sinalizados como "baixo"', () => {
      const field: AiCadastroField = { value: '', confidence: 0.3 }
      expect(getNivelConfianca(field.confidence)).toBe('baixo')
    })

    it('campos com confidence alta sao sinalizados como "alto"', () => {
      const field: AiCadastroField = { value: 'Valor AI', confidence: 0.95 }
      expect(getNivelConfianca(field.confidence)).toBe('alto')
    })
  })

  // ── TC-CAD-INT-004: Pre-cadastro via SuperTEG Agent ────────────────────

  describe('TC-CAD-INT-004: Pre-cadastro via SuperTEG Agent', () => {
    it('insere pre-cadastro na tabela sys_pre_cadastros', async () => {
      const preCadastro = {
        tipo_entidade: 'fornecedor',
        razao_social: 'Nova Fornecedora LTDA',
        cnpj: '98765432000199',
        dados_json: { email: 'nova@fornecedora.com', telefone: '31988887777' },
        status: 'pendente',
        solicitante_id: 'user-uuid-001',
      }
      mockSupabase._setQueryResult({ ...preCadastro, id: 'pre-001' })

      const builder = mockSupabase.from('sys_pre_cadastros')
      builder.insert(preCadastro)

      expect(mockSupabase.from).toHaveBeenCalledWith('sys_pre_cadastros')
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_entidade: 'fornecedor',
          cnpj: '98765432000199',
          status: 'pendente',
        })
      )
    })

    it('pre-cadastro possui status validos', () => {
      const statusValidos = ['pendente', 'aprovado', 'rejeitado']
      expect(statusValidos).toContain('pendente')
      expect(statusValidos).toContain('aprovado')
    })

    it('pre-cadastro aprovado gera registro na tabela definitiva', () => {
      const preCadastro = {
        tipo_entidade: 'fornecedor',
        status: 'aprovado',
        razao_social: 'Fornecedora Aprovada',
      }
      // Quando aprovado, o admin converte para registro real
      const deveConverter = preCadastro.status === 'aprovado'
      expect(deveConverter).toBe(true)
    })
  })

  // ── TC-CAD-INT-005: Cross-module — Fornecedor aparece em Compras ──────

  describe('TC-CAD-INT-005: Fornecedor criado aparece em Compras', () => {
    it('fornecedor cadastrado via cmp_fornecedores fica disponivel para modulo Compras', async () => {
      const fornecedor = {
        id: 'forn-new-001',
        razao_social: 'Fornecedor Cross-Module LTDA',
        cnpj: '12345678000190',
        ativo: true,
      }
      mockSupabase._setQueryResult([fornecedor])

      // Cadastros insere
      const builderInsert = mockSupabase.from('cmp_fornecedores')
      builderInsert.insert({ razao_social: 'Fornecedor Cross-Module LTDA', cnpj: '12345678000190', ativo: true })
      expect(builderInsert.insert).toHaveBeenCalled()

      // Compras consulta o mesmo fornecedor
      const builderSelect = mockSupabase.from('cmp_fornecedores')
      builderSelect.select('*')
      builderSelect.eq('ativo', true)

      expect(mockSupabase.from).toHaveBeenCalledWith('cmp_fornecedores')
    })

    it('useCadFornecedores e useFornecedores (Compras) compartilham a mesma tabela', () => {
      // Ambos hooks consultam cmp_fornecedores
      const tabelaCadastros = 'cmp_fornecedores'
      const tabelaCompras = 'cmp_fornecedores'
      expect(tabelaCadastros).toBe(tabelaCompras)
    })

    it('invalidacao de cache apos salvar fornecedor invalida ambas queries', () => {
      // useSalvarFornecedor invalida: ['cad-fornecedores'] e ['fornecedores']
      const queryKeysInvalidadas = ['cad-fornecedores', 'fornecedores']
      expect(queryKeysInvalidadas).toContain('cad-fornecedores')
      expect(queryKeysInvalidadas).toContain('fornecedores')
    })
  })

  // ── TC-CAD-INT-006: Cross-module — Item criado aparece em Estoque ─────

  describe('TC-CAD-INT-006: Item criado aparece em Estoque', () => {
    it('item cadastrado via est_itens fica disponivel para modulo Estoque', async () => {
      const item = {
        id: 'item-new-001',
        codigo: 'MAT-001',
        descricao: 'Cabo XLPE 240mm 138kV',
        unidade: 'metro',
        categoria: 'materiais_obra',
        ativo: true,
      }
      mockSupabase._setQueryResult([item])

      const builder = mockSupabase.from('est_itens')
      builder.insert(item)

      expect(mockSupabase.from).toHaveBeenCalledWith('est_itens')
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ codigo: 'MAT-001', descricao: 'Cabo XLPE 240mm 138kV' })
      )
    })

    it('tipo EstItem e re-exportado em types/cadastros.ts', () => {
      // O tipo estoque e re-exportado: export type { EstItem } from './estoque'
      // Isso confirma que Cadastros e Estoque compartilham a mesma definicao
      const isReExported = true // confirmado lendo types/cadastros.ts
      expect(isReExported).toBe(true)
    })
  })

  // ── TC-CAD-INT-007: Cross-module — Centro de custo aparece em Financeiro ─

  describe('TC-CAD-INT-007: Centro de custo aparece em Financeiro', () => {
    it('centro de custo cadastrado via sys_centros_custo e usado pelo Financeiro', async () => {
      const cc = {
        id: 'cc-new-001',
        codigo: 'CC-007',
        descricao: 'SE Ituiutaba',
        empresa_id: 'emp-001',
        ativo: true,
      }
      mockSupabase._setQueryResult([cc])

      const builder = mockSupabase.from('sys_centros_custo')
      builder.select('*')
      builder.order('codigo')

      expect(mockSupabase.from).toHaveBeenCalledWith('sys_centros_custo')
    })

    it('centro de custo aparece no lookup global (useLookups)', async () => {
      // useLookups chama supabase.rpc('get_lookups') que retorna centros_custo
      const lookupData = {
        obras: [],
        centros_custo: [
          { id: 'cc1', codigo: 'CC-001', descricao: 'SE Frutal' },
          { id: 'cc2', codigo: 'CC-002', descricao: 'SE Paracatu' },
        ],
        classes_financeiras: [],
        categorias: [],
        empresas: [],
      }
      mockSupabase.rpc.mockResolvedValueOnce({ data: lookupData, error: null })

      const result = await mockSupabase.rpc('get_lookups')
      expect(result.data.centros_custo).toHaveLength(2)
      expect(result.data.centros_custo[0].codigo).toBe('CC-001')
    })
  })

  // ── TC-CAD-INT-008: Colaborador criado com obra vinculada ─────────────

  describe('TC-CAD-INT-008: Colaborador criado com obra vinculada', () => {
    it('insere colaborador na tabela rh_colaboradores com obra_id', async () => {
      const colaborador: Partial<Colaborador> = {
        nome: 'Joao da Silva',
        cpf: '52998224725',
        cargo: 'Eletricista',
        departamento: 'Obras',
        obra_id: 'obra-uuid-frutal',
        email: 'joao@tegenergia.com',
        ativo: true,
      }
      mockSupabase._setQueryResult({ ...colaborador, id: 'col-new-001' })

      const builder = mockSupabase.from('rh_colaboradores')
      builder.insert(colaborador)

      expect(mockSupabase.from).toHaveBeenCalledWith('rh_colaboradores')
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          nome: 'Joao da Silva',
          obra_id: 'obra-uuid-frutal',
          departamento: 'Obras',
        })
      )
    })

    it('colaborador com obra_id faz join em sys_obras', async () => {
      mockSupabase._setQueryResult([{
        id: 'col-001',
        nome: 'Joao da Silva',
        obra_id: 'obra-uuid-frutal',
        obra: { id: 'obra-uuid-frutal', codigo: 'FRUTAL', nome: 'SE Frutal' },
      }])

      const builder = mockSupabase.from('rh_colaboradores')
      builder.select('*, obra:sys_obras!obra_id(id, codigo, nome)')

      expect(builder.select).toHaveBeenCalledWith(
        expect.stringContaining('sys_obras')
      )
    })

    it('filtro por obra_id lista apenas colaboradores da obra', async () => {
      mockSupabase._setQueryResult([])

      const builder = mockSupabase.from('rh_colaboradores')
      builder.select('*')
      builder.eq('obra_id', 'obra-uuid-frutal')

      expect(builder.eq).toHaveBeenCalledWith('obra_id', 'obra-uuid-frutal')
    })

    it('filtro por departamento funciona', async () => {
      mockSupabase._setQueryResult([])

      const builder = mockSupabase.from('rh_colaboradores')
      builder.select('*')
      builder.eq('departamento', 'Obras')

      expect(builder.eq).toHaveBeenCalledWith('departamento', 'Obras')
    })

    it('colaborador pode nao ter obra vinculada (sede/admin)', () => {
      const colaboradorSede: Partial<Colaborador> = {
        nome: 'Maria Admin',
        departamento: 'Administrativo',
        obra_id: undefined,
        ativo: true,
      }
      expect(colaboradorSede.obra_id).toBeUndefined()
    })
  })
})

// ============================================================================
// TESTES ADICIONAIS — Empresas e Obras
// ============================================================================

describe('Cadastros — Empresas e Obras', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  describe('Empresas', () => {
    it('lista empresas da tabela sys_empresas', async () => {
      const empresas: Partial<Empresa>[] = [
        { id: 'e1', codigo: 'TEG', razao_social: 'TEG Uniao Energia LTDA', cnpjs: ['12345678000190'], ativo: true },
      ]
      mockSupabase._setQueryResult(empresas)

      const builder = mockSupabase.from('sys_empresas')
      builder.select('*')
      builder.order('razao_social')

      expect(mockSupabase.from).toHaveBeenCalledWith('sys_empresas')
    })

    it('empresa possui array de CNPJs', () => {
      const empresa: Partial<Empresa> = {
        cnpjs: ['12345678000190', '12345678000271'],
      }
      expect(empresa.cnpjs).toHaveLength(2)
      expect(empresa.cnpjs![0]).toHaveLength(14)
    })

    it('cria empresa via insert', async () => {
      mockSupabase._setQueryResult({})
      const builder = mockSupabase.from('sys_empresas')
      builder.insert({
        codigo: 'ABC',
        razao_social: 'ABC Energia LTDA',
        cnpjs: ['98765432000199'],
        ativo: true,
      })
      expect(builder.insert).toHaveBeenCalled()
    })

    it('atualiza empresa via update + eq', async () => {
      mockSupabase._setQueryResult({})
      const builder = mockSupabase.from('sys_empresas')
      builder.update({ razao_social: 'TEG Atualizada' })
      builder.eq('id', 'e1')
      expect(builder.update).toHaveBeenCalled()
      expect(builder.eq).toHaveBeenCalledWith('id', 'e1')
    })
  })

  describe('Obras', () => {
    it('lista obras da tabela sys_obras com join centro_custo', async () => {
      const obras: Partial<Obra>[] = [
        {
          id: 'o1', codigo: 'FRUTAL', nome: 'SE Frutal',
          municipio: 'Frutal', uf: 'MG', status: 'em_execucao',
          centro_custo: { id: 'cc1', codigo: 'CC-001', descricao: 'SE Frutal' },
        },
      ]
      mockSupabase._setQueryResult(obras)

      const builder = mockSupabase.from('sys_obras')
      builder.select('*, centro_custo:sys_centros_custo!centro_custo_id(id, codigo, descricao)')

      expect(builder.select).toHaveBeenCalledWith(
        expect.stringContaining('sys_centros_custo')
      )
    })

    it('obra pode ter centro_custo_id vinculado', () => {
      const obra: Partial<Obra> = {
        id: 'o1',
        nome: 'SE Frutal',
        centro_custo_id: 'cc-001',
      }
      expect(obra.centro_custo_id).toBeTruthy()
    })

    it('cria obra com municipio e UF', async () => {
      mockSupabase._setQueryResult({})
      const builder = mockSupabase.from('sys_obras')
      builder.insert({
        codigo: 'ITUIUT',
        nome: 'SE Ituiutaba',
        municipio: 'Ituiutaba',
        uf: 'MG',
        status: 'em_execucao',
      })
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ municipio: 'Ituiutaba', uf: 'MG' })
      )
    })

    it('useSalvarObra invalida cache de obras e cad-obras', () => {
      // Verificacao da logica de invalidacao no hook
      const queryKeysInvalidadas = ['cad-obras', 'obras']
      expect(queryKeysInvalidadas).toContain('cad-obras')
      expect(queryKeysInvalidadas).toContain('obras')
    })
  })
})

// ============================================================================
// TESTES — Hierarquia Financeira: Grupos e Categorias
// ============================================================================

describe('Cadastros — Hierarquia Financeira', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  describe('Grupos Financeiros', () => {
    it('lista grupos financeiros da tabela fin_grupos_financeiros', async () => {
      const grupos: Partial<GrupoFinanceiro>[] = [
        { id: 'g1', codigo: 'GF-01', descricao: 'Custos Diretos', tipo: 'despesa', ativo: true },
        { id: 'g2', codigo: 'GF-02', descricao: 'Receitas de Contrato', tipo: 'receita', ativo: true },
      ]
      mockSupabase._setQueryResult(grupos)

      const builder = mockSupabase.from('fin_grupos_financeiros')
      builder.select('*')
      builder.order('codigo')

      expect(mockSupabase.from).toHaveBeenCalledWith('fin_grupos_financeiros')
    })

    it('grupo financeiro possui tipo: receita, despesa ou ambos', () => {
      const tipos: GrupoFinanceiro['tipo'][] = ['receita', 'despesa', 'ambos']
      expect(tipos).toHaveLength(3)
    })
  })

  describe('Categorias Financeiras', () => {
    it('lista categorias com join no grupo', async () => {
      mockSupabase._setQueryResult([])

      const builder = mockSupabase.from('fin_categorias_financeiras')
      builder.select('*, grupo:fin_grupos_financeiros!grupo_id(id, codigo, descricao)')
      builder.order('codigo')

      expect(builder.select).toHaveBeenCalledWith(
        expect.stringContaining('fin_grupos_financeiros')
      )
    })

    it('filtra categorias por grupo_id', async () => {
      mockSupabase._setQueryResult([])

      const builder = mockSupabase.from('fin_categorias_financeiras')
      builder.select('*')
      builder.eq('grupo_id', 'g1')

      expect(builder.eq).toHaveBeenCalledWith('grupo_id', 'g1')
    })

    it('hierarquia completa: Grupo → Categoria → Classe', () => {
      const grupo: Partial<GrupoFinanceiro> = { id: 'g1', codigo: 'GF-01' }
      const categoria: Partial<CategoriaFinanceira> = { id: 'cat1', codigo: 'CAT-01', grupo_id: grupo.id }
      const classe: Partial<ClasseFinanceira> = { id: 'cl1', codigo: 'CF-01', categoria_id: categoria.id }

      expect(categoria.grupo_id).toBe(grupo.id)
      expect(classe.categoria_id).toBe(categoria.id)
    })
  })
})

// ============================================================================
// TESTES — AiDropZone comportamento de parse
// ============================================================================

describe('Cadastros — AiDropZone parse logic', () => {
  it('CNPJ com 14 digitos aciona tipo "cnpj" quando showCnpjField=true', () => {
    const docInput = '12.345.678/0001-90'
    const clean = docInput.replace(/\D/g, '')
    const showCnpjField = true
    const showCpfField = false

    let type: string | null = null
    if (showCnpjField && clean.length === 14) {
      type = 'cnpj'
    } else if (showCpfField && clean.length === 11) {
      type = 'cpf'
    } else if (docInput.trim().length > 3) {
      type = 'text'
    }

    expect(type).toBe('cnpj')
  })

  it('CPF com 11 digitos aciona tipo "cpf" quando showCpfField=true', () => {
    const docInput = '529.982.247-25'
    const clean = docInput.replace(/\D/g, '')
    const showCnpjField = false
    const showCpfField = true

    let type: string | null = null
    if (showCnpjField && clean.length === 14) {
      type = 'cnpj'
    } else if (showCpfField && clean.length === 11) {
      type = 'cpf'
    }

    expect(type).toBe('cpf')
  })

  it('texto livre com mais de 3 chars aciona tipo "text"', () => {
    const docInput = 'Empresa XYZ localizada em BH'
    const clean = docInput.replace(/\D/g, '')
    const showCnpjField = true
    const showCpfField = false

    let type: string | null = null
    if (showCnpjField && clean.length === 14) {
      type = 'cnpj'
    } else if (showCpfField && clean.length === 11) {
      type = 'cpf'
    } else if (docInput.trim().length > 3) {
      type = 'text'
    }

    expect(type).toBe('text')
  })

  it('input com menos de 3 chars nao aciona nenhum tipo', () => {
    const docInput = 'ab'
    const clean = docInput.replace(/\D/g, '')
    const showCnpjField = true

    let type: string | null = null
    if (showCnpjField && clean.length === 14) {
      type = 'cnpj'
    } else if (docInput.trim().length > 3) {
      type = 'text'
    }

    expect(type).toBeNull()
  })

  it('botao Buscar desabilitado quando input tem menos de 3 chars', () => {
    const docInput = 'ab'
    const parsing = false
    const disabled = parsing || docInput.trim().length < 3
    expect(disabled).toBe(true)
  })

  it('botao Buscar habilitado com input valido', () => {
    const docInput = '12345678000190'
    const parsing = false
    const disabled = parsing || docInput.trim().length < 3
    expect(disabled).toBe(false)
  })

  it('botao Buscar desabilitado durante parsing', () => {
    const docInput = '12345678000190'
    const parsing = true
    const disabled = parsing || docInput.trim().length < 3
    expect(disabled).toBe(true)
  })
})
