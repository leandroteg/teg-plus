/**
 * API (n8n webhook) mock for unit/integration tests.
 */
import { vi } from 'vitest'

export const mockApi = {
  criarRequisicao: vi.fn().mockResolvedValue({ numero: 'RC-202603-0001', status: 'pendente' }),
  parseRequisicaoAi: vi.fn().mockResolvedValue({
    itens: [{ descricao: 'Cabo XLPE 10mm²', quantidade: 5, unidade: 'un', valor_unitario_estimado: 150 }],
    obra_sugerida: 'SE Frutal',
    urgencia_sugerida: 'normal',
    categoria_sugerida: 'materiais_obra',
    comprador_sugerido: { id: 'lauany', nome: 'Lauany' },
    confianca: 0.85,
  }),
  processarAprovacao: vi.fn().mockResolvedValue({ success: true }),
  submeterCotacao: vi.fn().mockResolvedValue({ success: true }),
  parseCotacaoFile: vi.fn().mockResolvedValue({
    success: true,
    fornecedores: [{
      fornecedor_nome: 'Teste Ltda',
      valor_total: 5000,
      prazo_entrega_dias: 15,
    }],
  }),
  getDashboard: vi.fn().mockResolvedValue({
    total: 42,
    pendentes: 8,
    aprovadas: 20,
    valor_total: 250000,
  }),
  consultarCNPJ: vi.fn().mockResolvedValue({
    cnpj: '12345678000190',
    razao_social: 'Empresa Teste LTDA',
    nome_fantasia: 'Teste',
    situacao: 'ATIVA',
    endereco: { cep: '30130000', logradouro: 'Rua Teste', numero: '100', complemento: '', bairro: 'Centro', cidade: 'BH', uf: 'MG' },
    telefone: '31999999999',
    email: 'teste@teste.com',
  }),
  consultarCEP: vi.fn().mockResolvedValue({
    cep: '30130000',
    logradouro: 'Rua da Bahia',
    bairro: 'Centro',
    cidade: 'Belo Horizonte',
    uf: 'MG',
  }),
}

vi.mock('../../services/api', () => ({
  api: mockApi,
}))

export function resetApiMocks() {
  vi.clearAllMocks()
}
