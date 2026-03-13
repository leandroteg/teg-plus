// =============================================================================
// Módulo Estoque e Patrimonial — Types
// =============================================================================

export type CurvaABC = 'A' | 'B' | 'C'
export type UnidadeEstoque = 'UN' | 'M' | 'M2' | 'M3' | 'KG' | 'TON' | 'L' | 'CX' | 'PCT' | 'RL' | 'PR' | 'JG'
export type TipoMovimentacao =
  | 'entrada'
  | 'saida'
  | 'transferencia_out'
  | 'transferencia_in'
  | 'ajuste_positivo'
  | 'ajuste_negativo'
  | 'devolucao'
  | 'baixa'

export type StatusSolicitacao = 'aberta' | 'aprovada' | 'em_separacao' | 'atendida' | 'parcial' | 'cancelada'
export type TipoInventario = 'ciclico' | 'periodico' | 'surpresa'
export type StatusInventario = 'aberto' | 'em_contagem' | 'concluido' | 'cancelado'
export type StatusImobilizado = 'ativo' | 'em_manutencao' | 'cedido' | 'baixado' | 'em_transferencia' | 'pendente_registro'

// ── Bases ─────────────────────────────────────────────────────────────────────
export interface EstBase {
  id: string
  codigo: string
  nome: string
  endereco?: string
  responsavel?: string
  ativa: boolean
  criado_em: string
}

// ── Localizações ──────────────────────────────────────────────────────────────
export interface EstLocalizacao {
  id: string
  base_id: string
  corredor: string
  prateleira: string
  posicao: string
  descricao?: string
  ativa: boolean
}

// ── Itens ─────────────────────────────────────────────────────────────────────
export interface EstItem {
  id: string
  codigo: string
  descricao: string
  descricao_complementar?: string
  categoria?: string
  subcategoria?: string
  unidade: UnidadeEstoque
  curva_abc: CurvaABC
  estoque_minimo: number
  estoque_maximo: number
  ponto_reposicao: number
  lead_time_dias: number
  controla_lote: boolean
  controla_serie: boolean
  tem_validade: boolean
  valor_medio: number
  valor_ultima_entrada: number
  totvs_codigo?: string
  ncm?: string
  ativo: boolean
  criado_em: string
  atualizado_em: string
  // Joins
  saldos?: EstSaldo[]
  saldo_total?: number  // calculado
}

// ── Saldos ────────────────────────────────────────────────────────────────────
export interface EstSaldo {
  id: string
  item_id: string
  base_id: string
  saldo: number
  saldo_reservado: number
  saldo_disponivel?: number // saldo - saldo_reservado
  ultima_entrada?: string
  ultima_saida?: string
  atualizado_em: string
  // Joins
  item?: Pick<EstItem, 'codigo' | 'descricao' | 'unidade' | 'curva_abc' | 'estoque_minimo' | 'ponto_reposicao'>
  base?: Pick<EstBase, 'codigo' | 'nome'>
}

// ── Movimentações ─────────────────────────────────────────────────────────────
export interface EstMovimentacao {
  id: string
  item_id: string
  base_id: string
  base_destino_id?: string
  localizacao_id?: string
  tipo: TipoMovimentacao
  quantidade: number
  valor_unitario: number
  valor_total: number
  obra_nome?: string
  centro_custo?: string
  solicitacao_id?: string
  nf_numero?: string
  fornecedor_nome?: string
  lote?: string
  numero_serie?: string
  data_validade?: string
  inventario_id?: string
  responsavel_nome?: string
  observacao?: string
  documento_url?: string
  criado_em: string
  // Joins
  item?: Pick<EstItem, 'codigo' | 'descricao' | 'unidade'>
  base?: Pick<EstBase, 'codigo' | 'nome'>
}

export interface NovaMovimentacaoPayload {
  item_id: string
  base_id: string
  tipo: TipoMovimentacao
  quantidade: number
  valor_unitario?: number
  obra_nome?: string
  centro_custo?: string
  nf_numero?: string
  fornecedor_nome?: string
  lote?: string
  numero_serie?: string
  data_validade?: string
  responsavel_nome?: string
  observacao?: string
  documento_url?: string
  base_destino_id?: string // para transferência
}

// ── Solicitações ──────────────────────────────────────────────────────────────
export interface EstSolicitacaoItem {
  id: string
  solicitacao_id: string
  item_id?: string
  descricao_livre?: string
  quantidade: number
  quantidade_atendida: number
  unidade?: string
  observacao?: string
  item?: Pick<EstItem, 'codigo' | 'descricao' | 'unidade'>
}

export interface EstSolicitacao {
  id: string
  numero: string
  solicitante_nome: string
  obra_nome: string
  centro_custo?: string
  urgencia: 'normal' | 'urgente' | 'critica'
  status: StatusSolicitacao
  observacao?: string
  aprovado_por?: string
  aprovado_em?: string
  criado_em: string
  atualizado_em: string
  itens?: EstSolicitacaoItem[]
}

// ── Inventários ───────────────────────────────────────────────────────────────
export interface EstInventarioItem {
  id: string
  inventario_id: string
  item_id: string
  base_id: string
  saldo_sistema?: number
  saldo_contado?: number
  saldo_recontado?: number
  divergencia: number
  divergencia_pct?: number
  contado_por?: string
  causa_raiz?: string
  acao_corretiva?: string
  ajuste_aplicado: boolean
  observacao?: string
  contado_em?: string
  item?: Pick<EstItem, 'codigo' | 'descricao' | 'unidade' | 'curva_abc'>
}

export interface EstInventario {
  id: string
  numero: string
  tipo: TipoInventario
  base_id?: string
  curva_filtro?: CurvaABC
  status: StatusInventario
  data_abertura: string
  data_conclusao?: string
  responsavel?: string
  aprovado_por?: string
  observacao?: string
  acuracia?: number
  criado_em: string
  base?: Pick<EstBase, 'codigo' | 'nome'>
  itens?: EstInventarioItem[]
}

// ── KPIs Estoque ──────────────────────────────────────────────────────────────
export interface EstoqueKPIs {
  total_itens: number
  itens_abaixo_minimo: number
  itens_parados: number           // sem movimentação > 90 dias
  valor_estoque_total: number
  movimentacoes_mes: number
  taxa_ruptura: number            // % solicitações não atendidas
  acuracia_ultimo_inventario?: number
  solicitacoes_abertas: number
}

// =============================================================================
// Patrimonial Types
// =============================================================================

export interface PatImobilizado {
  id: string
  numero_patrimonio: string
  descricao: string
  categoria: string
  marca?: string
  modelo?: string
  numero_serie?: string
  base_id?: string
  base_nome?: string
  responsavel_nome?: string
  responsavel_id?: string
  status: StatusImobilizado
  valor_aquisicao: number
  data_aquisicao?: string
  fornecedor_nome?: string
  nf_compra_numero?: string
  nf_compra_url?: string
  vida_util_meses: number
  taxa_depreciacao_anual: number
  valor_residual: number
  valor_atual?: number
  observacoes?: string
  foto_url?: string
  baixado_em?: string
  motivo_baixa?: string
  laudo_baixa_url?: string
  criado_em: string
  atualizado_em: string
  // Calculados
  depreciacao_acumulada?: number
  percentual_depreciado?: number
}

export interface PatMovimentacao {
  id: string
  imobilizado_id: string
  tipo: 'transferencia' | 'manutencao' | 'cessao' | 'retorno' | 'baixa' | 'inventario'
  base_origem_id?: string
  base_destino_id?: string
  responsavel_origem?: string
  responsavel_destino?: string
  data_movimentacao: string
  nf_transferencia_numero?: string
  confirmado: boolean
  confirmado_em?: string
  confirmado_por?: string
  observacao?: string
  criado_em: string
  imobilizado?: Pick<PatImobilizado, 'numero_patrimonio' | 'descricao' | 'categoria'>
}

export interface PatTermoResponsabilidade {
  id: string
  imobilizado_id: string
  responsavel_nome: string
  responsavel_id?: string
  tipo: 'vinculacao' | 'devolucao'
  obra_nome?: string
  data_vigencia: string
  data_devolucao_prevista?: string
  assinado: boolean
  assinado_em?: string
  url_pdf?: string
  observacao?: string
  criado_em: string
}

export interface PatDepreciacao {
  id: string
  imobilizado_id: string
  competencia: string
  valor_depreciacao: number
  valor_anterior: number
  valor_apos: number
  exportado_totvs: boolean
  criado_em: string
}

export interface PatrimonialKPIs {
  total_imobilizados: number
  valor_total_bruto: number
  valor_total_liquido: number
  depreciacao_mensal: number
  imobilizados_em_manutencao: number
  imobilizados_cedidos: number
  imobilizados_depreciados: number  // 100% depreciados
  termos_pendentes: number
}

// =============================================================================
// Pipeline Estoque — Abas
// =============================================================================

export type EstoquePipelineTab = 'aguardando_entrada' | 'em_estoque' | 'em_movimentacao'

export interface EstoquePipelineStage {
  tab: EstoquePipelineTab
  label: string
  color: string
}

export const ESTOQUE_PIPELINE_STAGES: EstoquePipelineStage[] = [
  { tab: 'aguardando_entrada', label: 'Aguardando Entrada', color: 'slate'   },
  { tab: 'em_estoque',         label: 'Em Estoque',         color: 'emerald' },
  { tab: 'em_movimentacao',    label: 'Em Movimentação',    color: 'amber'   },
]

// ── Aggregated item for pipeline views ──────────────────────────────────────
export interface EstoqueEntradaItem {
  id: string
  item_id: string
  codigo: string
  descricao: string
  unidade: string
  quantidade: number
  tipo: TipoMovimentacao
  fornecedor_nome?: string
  nf_numero?: string
  base_nome?: string
  obra_nome?: string
  criado_em: string
}

export interface EstoqueMovimentacaoItem {
  id: string
  item_id: string
  codigo: string
  descricao: string
  unidade: string
  quantidade: number
  tipo: TipoMovimentacao
  base_nome?: string
  base_destino_nome?: string
  responsavel_nome?: string
  obra_nome?: string
  criado_em: string
}

// =============================================================================
// Recebimento Types (Compras ↔ Estoque ↔ Patrimonial)
// =============================================================================

export type TipoDestino = 'consumo' | 'patrimonial'

export interface CmpRecebimento {
  id: string
  pedido_id: string
  base_id?: string
  recebido_por?: string
  nf_numero?: string
  nf_chave?: string
  data_recebimento: string
  observacao?: string
  created_at: string
  // Joins
  base?: Pick<EstBase, 'codigo' | 'nome'>
  itens?: CmpRecebimentoItem[]
}

export interface CmpRecebimentoItem {
  id: string
  recebimento_id: string
  requisicao_item_id?: string
  item_estoque_id?: string
  descricao: string
  quantidade_esperada: number
  quantidade_recebida: number
  valor_unitario: number
  lote?: string
  numero_serie?: string
  data_validade?: string
  tipo_destino: TipoDestino
}

export interface RecebimentoItemForm {
  requisicao_item_id?: string
  item_estoque_id?: string
  descricao: string
  quantidade_esperada: number
  quantidade_recebida: number
  valor_unitario: number
  lote?: string
  numero_serie?: string
  data_validade?: string
  tipo_destino: TipoDestino
}
