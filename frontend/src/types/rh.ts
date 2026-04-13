// ─────────────────────────────────────────────────────────────────────────────
// types/rh.ts — Tipos do módulo Gestão de Colaboradores (RH)
// ─────────────────────────────────────────────────────────────────────────────

export interface RHColaborador {
  id: string
  nome: string
  cpf?: string
  matricula?: string
  cargo?: string
  departamento?: string
  setor?: string
  obra_id?: string
  email?: string
  telefone?: string
  foto_url?: string

  // Dados pessoais
  data_nascimento?: string
  naturalidade?: string
  estado_civil?: string
  genero?: string
  nacionalidade?: string

  // Documentos
  rg?: string
  rg_orgao?: string
  rg_uf?: string
  pis_pasep?: string
  ctps_numero?: string
  ctps_serie?: string
  ctps_uf?: string

  // Endereço
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  cep?: string

  // Dados bancários
  banco?: string
  agencia?: string
  conta?: string
  tipo_conta?: string
  pix_chave?: string

  // Contrato
  tipo_contrato?: string   // CLT | PJ | Estagiário | Temporário | Aprendiz
  cnpj_pj?: string
  salario?: number
  data_admissao?: string
  data_demissao?: string
  motivo_demissao?: string
  status_admissao?: string

  // Vínculos
  gestor_id?: string
  perfil_id?: string
  observacoes?: string
  ativo: boolean

  created_at: string
  updated_at: string

  // Joins
  obra?: { id: string; codigo: string; nome: string }
  gestor?: { id: string; nome: string }
}

export interface RHDependente {
  id: string
  colaborador_id: string
  nome: string
  parentesco: string
  data_nascimento?: string
  cpf?: string
  ir_dependente?: boolean
  created_at: string
  updated_at: string
}

export interface RHDocumento {
  id: string
  colaborador_id: string
  tipo: string
  descricao?: string
  arquivo_url: string
  arquivo_nome?: string
  validade?: string
  created_at: string
}

export type TipoMovimentacao =
  | 'promocao'
  | 'transferencia'
  | 'reajuste'
  | 'mudanca_cargo'
  | 'mudanca_departamento'
  | 'mudanca_obra'
  | 'advertencia'
  | 'suspensao'
  | 'outro'

export interface RHMovimentacao {
  id: string
  colaborador_id: string
  tipo: TipoMovimentacao
  data_efetivacao: string
  cargo_anterior?: string
  cargo_novo?: string
  departamento_anterior?: string
  departamento_novo?: string
  setor_anterior?: string
  setor_novo?: string
  obra_anterior_id?: string
  obra_nova_id?: string
  salario_anterior?: number
  salario_novo?: number
  motivo?: string
  observacoes?: string
  registrado_por?: string
  created_at: string

  // Joins
  colaborador?: { id: string; nome: string; cargo?: string; matricula?: string; foto_url?: string }
  obra_anterior?: { id: string; codigo: string; nome: string }
  obra_nova?: { id: string; codigo: string; nome: string }
}

export type StatusAdmissao = 'pendente' | 'avaliacao_documentos' | 'aguardando_cadastro' | 'concluida' | 'cancelada'

export interface RHAdmissao {
  id: string
  colaborador_id?: string
  nome_candidato: string
  cpf?: string
  cargo_previsto?: string
  departamento_previsto?: string
  obra_prevista_id?: string
  tipo_contrato?: string
  salario_previsto?: number
  data_prevista_inicio?: string
  status: StatusAdmissao
  documentos_pendentes?: string[]
  documentos_recebidos?: string[]
  observacoes?: string
  registrado_por?: string
  created_at: string
  updated_at: string

  // Joins
  obra_prevista?: { id: string; codigo: string; nome: string }
  colaborador?: { id: string; nome: string }
}

export type TipoDesligamento = 'sem_justa_causa' | 'com_justa_causa' | 'pedido_demissao' | 'acordo_mutuo' | 'termino_contrato'
export type StatusDesligamento = 'em_andamento' | 'concluido' | 'cancelado'

export interface RHDesligamento {
  id: string
  colaborador_id: string
  tipo: TipoDesligamento
  data_aviso?: string
  data_desligamento: string
  motivo?: string
  cumpriu_aviso?: boolean
  observacoes?: string
  checklist?: Record<string, boolean>
  registrado_por?: string
  status: StatusDesligamento
  created_at: string
  updated_at: string

  // Joins
  colaborador?: { id: string; nome: string; cargo?: string; matricula?: string; departamento?: string; data_admissao?: string; foto_url?: string }
}

// ── Filtros ──────────────────────────────────────────────────────────────────

export interface FiltrosColaboradores {
  busca?: string
  tipo_contrato?: string
  ativo?: boolean
  departamento?: string
  setor?: string
  obra_id?: string
  idade_min?: number
  idade_max?: number
  tempo_empresa_min?: number  // em meses
  tempo_empresa_max?: number
}

// ── Constantes ───────────────────────────────────────────────────────────────

export const TIPOS_CONTRATO = [
  { value: 'CLT', label: 'CLT' },
  { value: 'PJ', label: 'Equipe PJ' },
  { value: 'estagiario', label: 'Estagiário' },
  { value: 'temporario', label: 'Temporário' },
  { value: 'aprendiz', label: 'Aprendiz' },
]

export const TIPOS_MOVIMENTACAO = [
  { value: 'promocao', label: 'Promoção', icon: '🚀' },
  { value: 'transferencia', label: 'Transferência', icon: '🔄' },
  { value: 'reajuste', label: 'Reajuste Salarial', icon: '💰' },
  { value: 'mudanca_cargo', label: 'Mudança de Cargo', icon: '📋' },
  { value: 'mudanca_departamento', label: 'Mudança de Departamento', icon: '🏢' },
  { value: 'mudanca_obra', label: 'Mudança de Obra', icon: '🏗️' },
  { value: 'advertencia', label: 'Advertência', icon: '⚠️' },
  { value: 'suspensao', label: 'Suspensão', icon: '🚫' },
  { value: 'outro', label: 'Outro', icon: '📝' },
]

export const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável']
export const GENEROS = ['Masculino', 'Feminino', 'Não informado']
export const PARENTESCOS = ['Cônjuge', 'Filho(a)', 'Pai', 'Mãe', 'Irmão(ã)', 'Outro']
export const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

export const TIPOS_DESLIGAMENTO = [
  { value: 'sem_justa_causa', label: 'Demissão sem justa causa' },
  { value: 'com_justa_causa', label: 'Demissão com justa causa' },
  { value: 'pedido_demissao', label: 'Pedido de demissão' },
  { value: 'acordo_mutuo', label: 'Acordo mútuo' },
  { value: 'termino_contrato', label: 'Término de contrato' },
]

export const DOCUMENTOS_ADMISSAO = [
  'RG', 'CPF', 'CTPS', 'PIS/PASEP', 'Título de Eleitor', 'Certidão de Nascimento/Casamento',
  'Comprovante de Residência', 'Comprovante Escolaridade', 'Certidão de Reservista',
  'Foto 3x4', 'Exame Admissional (ASO)', 'Conta Bancária',
]

export const CHECKLIST_DESLIGAMENTO: Record<string, string> = {
  aviso_previo: 'Aviso prévio comunicado',
  exame_demissional: 'Exame demissional realizado',
  devolucao_equipamentos: 'Equipamentos devolvidos',
  devolucao_crachas: 'Crachás/chaves devolvidos',
  rescisao_calculada: 'Rescisão calculada',
  baixa_ctps: 'Baixa na CTPS',
  homologacao: 'Homologação realizada',
  revogacao_acessos: 'Acessos revogados no sistema',
  entrega_documentos: 'Documentos entregues ao colaborador',
}

// ── Endomarketing ────────────────────────────────────────────────────────────

export interface IdentidadeVisual {
  id: string
  logo_url: string | null
  cor_primaria: string
  cor_secundaria: string
  cor_fundo: string
  cor_texto: string
  fonte_titulo: string
  fonte_corpo: string
  slogan: string | null
  updated_at: string
}

export type TipoComunicado = 'aviso_geral' | 'aniversariante' | 'boas_vindas' | 'reconhecimento' | 'evento' | 'treinamento' | 'seguranca' | 'resultado' | 'campanha_interna' | 'personalizado'

export type FormatoComunicado = 'story' | 'feed' | 'paisagem' | 'a4'

export interface Comunicado {
  id: string
  tipo: TipoComunicado
  titulo: string
  subtitulo: string | null
  conteudo_texto: string | null
  conteudo_html: string | null
  imagem_url: string | null
  formato: FormatoComunicado
  largura: number
  altura: number
  input_usuario: string | null
  criado_por: string | null
  created_at: string
  updated_at: string
}
