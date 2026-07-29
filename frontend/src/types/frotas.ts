// ─────────────────────────────────────────────────────────────────────────────
// types/frotas.ts — Módulo Manutenção e Uso de Frotas
// ─────────────────────────────────────────────────────────────────────────────

// CategoriaVeiculo: re-exportada do arquivo central para preservar compatibilidade
// dos imports existentes. Nova categoria → adicionar em constants/categoriaVeiculo.ts.
import type { CategoriaVeiculo as _CategoriaVeiculo } from '../constants/categoriaVeiculo'
export type CategoriaVeiculo = _CategoriaVeiculo
export type CombustivelVeiculo = 'flex' | 'gasolina' | 'diesel' | 'etanol' | 'eletrico' | 'gnv'
export type PropriedadeVeiculo = 'propria' | 'locada' | 'cedida'
export type StatusVeiculo      = 'disponivel' | 'em_uso' | 'em_manutencao' | 'parado' | 'bloqueado' | 'baixado' | 'em_entrada' | 'aguardando_saida'
export type TipoOS             = 'preventiva' | 'corretiva' | 'sinistro' | 'revisao'
export type PrioridadeOS       = 'critica' | 'alta' | 'media' | 'baixa'
export type StatusOS           = 'pendente' | 'aberta' | 'em_cotacao' | 'aguardando_aprovacao' | 'aprovada' | 'em_execucao' | 'concluida' | 'rejeitada' | 'cancelada'
export type TipoItemOS         = 'peca' | 'mao_obra' | 'outros'
export type TipoPagamento      = 'cartao_frota' | 'dinheiro' | 'pix' | 'boleto'
export type TipoChecklist      = 'pre_viagem' | 'pos_viagem' | 'pos_manutencao'
export type TipoOcorrenciaTel  = 'excesso_velocidade' | 'frenagem_brusca' | 'aceleracao_brusca' | 'fora_horario' | 'fora_area' | 'parada_nao_autorizada' | 'outro'
export type StatusOcorrenciaTel = 'registrada' | 'analisada' | 'comunicado_rh' | 'encerrada'
export type TipoFornecedorFro  = 'oficina' | 'autopecas' | 'borracharia' | 'locadora' | 'outros'

// ── Entidades ─────────────────────────────────────────────────────────────────

export interface FroVeiculo {
  id: string
  placa: string
  renavam?: string
  marca: string
  modelo: string
  ano_fab?: number
  ano_mod?: number
  cor?: string
  categoria: CategoriaVeiculo
  combustivel: CombustivelVeiculo
  propriedade: PropriedadeVeiculo
  status: StatusVeiculo
  hodometro_atual: number
  capacidade_carga_kg?: number
  base_id?: string
  motorista_responsavel_id?: string
  valor_fipe?: number
  data_aquisicao?: string
  vencimento_crlv?: string
  vencimento_seguro?: string
  vencimento_tacografo?: string
  km_proxima_preventiva?: number
  data_proxima_preventiva?: string
  foto_url?: string
  observacoes?: string
  // novos campos (migration 068)
  tipo_ativo?: TipoAtivo
  numero_serie?: string
  horimetro_atual?: number
  pat_item_id?: string
  con_contrato_id?: string
  base_atual_id?: string
  responsavel_id?: string
  // Código interno legado (ex.: UTFRO000001, MUNCK000003 — vem do cadastro original)
  codigo_interno?: string
  // Mapeamento de IDs em sistemas externos (telemetria etc.) — ex.: { cobli: "...", mobi7: "..." }
  external_ids?: Record<string, string>
  created_at: string
  updated_at: string
}

export interface FroFornecedor {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  tipo: TipoFornecedorFro
  telefone?: string
  email?: string
  endereco?: string
  cidade?: string
  avaliacao_media: number
  ativo: boolean
  observacoes?: string
  created_at: string
  updated_at: string
}

export interface FroOrdemServico {
  id: string
  numero_os?: string
  veiculo_id: string
  tipo: TipoOS
  prioridade: PrioridadeOS
  status: StatusOS
  hodometro_entrada?: number
  hodometro_saida?: number
  data_abertura: string
  data_previsao?: string
  data_entrada_oficina?: string
  data_conclusao?: string
  fornecedor_id?: string
  descricao_problema: string
  descricao_servico?: string
  valor_orcado?: number
  valor_aprovado?: number
  valor_final?: number
  aprovado_por?: string
  aprovado_em?: string
  rejeitado_por?: string
  motivo_rejeicao?: string
  analista_id?: string
  checklist_saida_ok: boolean
  foto_antes_url?: string
  foto_depois_url?: string
  observacoes?: string
  /** Sub-status livre durante a execução (ex: "Aguardando peça"). Lido pelo Painel de Disponibilidade. */
  status_detalhe?: string
  /** Parecer técnico da abertura — obrigatório na corretiva/sinistro (SUP-PRO-001). */
  parecer_tecnico?: string
  /** Envio a Suprimentos: inicia o SLA de 5 dias da categoria Manutenção de Frota. */
  data_envio_cotacao?: string
  /** Data programada de entrada na oficina (etapa Programação). */
  data_programada_entrada?: string
  /** Justificativa quando a OS segue com menos de 2 orçamentos. */
  justificativa_excecao?: string
  created_at: string
  updated_at: string
  // joined
  veiculo?: Pick<FroVeiculo, 'id' | 'placa' | 'marca' | 'modelo' | 'status'>
  fornecedor?: FornecedorRefOS
  itens?: FroItemOS[]
  cotacoes?: FroCotacaoOS[]
}

/**
 * Fornecedor resolvido a partir do cadastro corporativo `cmp_fornecedores`
 * (o mesmo de Contas a Pagar, NF e Contratos). Não tem `tipo` nem avaliação —
 * a antiga `fro_fornecedores` tinha, mas nasceu paralela e ficou vazia.
 */
export interface FornecedorRefOS {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  cidade?: string
  uf?: string
}

export interface FroItemOS {
  id: string
  os_id: string
  tipo: TipoItemOS
  descricao: string
  quantidade: number
  valor_unitario: number
  garantia_km?: number
  garantia_dias?: number
  /** Vínculo com o catálogo de materiais (est_itens), quando o item veio de lá. */
  est_item_id?: string
  created_at: string
}

export interface FroCotacaoOS {
  id: string
  os_id: string
  fornecedor_id: string
  valor_total: number
  prazo_execucao_dias?: number
  validade_orcamento?: string
  observacoes?: string
  selecionado: boolean
  created_at: string
  fornecedor?: FornecedorRefOS
}

export interface FroChecklist {
  id: string
  veiculo_id: string
  motorista_id?: string
  data_checklist: string
  tipo: TipoChecklist
  nivel_oleo_ok: boolean
  nivel_agua_ok: boolean
  calibragem_pneus_ok: boolean
  lanternas_ok: boolean
  freios_ok: boolean
  documentacao_ok: boolean
  limpeza_ok: boolean
  hodometro?: number
  observacoes?: string
  assinado_em?: string
  liberado: boolean
  created_at: string
  veiculo?: Pick<FroVeiculo, 'id' | 'placa' | 'marca' | 'modelo'>
}

export interface FroAbastecimento {
  id: string
  veiculo_id: string
  motorista_id?: string
  data_abastecimento: string
  posto?: string
  combustivel: CombustivelVeiculo
  hodometro: number
  litros: number
  valor_litro: number
  valor_total: number
  forma_pagamento: TipoPagamento
  numero_cupom?: string
  km_litro?: number
  desvio_detectado: boolean
  percentual_desvio?: number
  autorizado_por?: string
  observacoes?: string
  created_at: string
  veiculo?: Pick<FroVeiculo, 'id' | 'placa' | 'marca' | 'modelo'>
}

export interface FroOcorrenciaTel {
  id: string
  veiculo_id: string
  motorista_id?: string
  tipo_ocorrencia: TipoOcorrenciaTel
  velocidade?: number
  intensidade?: number
  latitude?: number
  longitude?: number
  endereco?: string
  data_ocorrencia: string
  status: StatusOcorrenciaTel
  analista_id?: string
  analisado_em?: string
  rh_comunicado_em?: string
  encerrado_em?: string
  observacoes?: string
  created_at: string
  veiculo?: Pick<FroVeiculo, 'id' | 'placa' | 'marca' | 'modelo'>
}

export interface FroAvaliacaoFornecedor {
  id: string
  fornecedor_id: string
  os_id?: string
  prazo: number
  qualidade: number
  preco: number
  avaliador_id?: string
  observacoes?: string
  created_at: string
}

export interface FroPlanoPreventiva {
  id: string
  veiculo_id: string
  descricao: string
  intervalo_km?: number
  intervalo_dias?: number
  ultima_realizacao_km?: number
  ultima_realizacao_data?: string
  proxima_km?: number
  proxima_data?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

export interface FrotasKPIs {
  total_veiculos: number
  disponiveis: number
  em_manutencao: number
  parados: number
  em_uso: number
  bloqueados: number
  taxa_disponibilidade: number      // %
  os_abertas: number
  os_criticas: number
  /** OS não encerradas que passaram da previsão (ou sem previsão há mais de 15 dias). */
  os_atrasadas: number
  preventivas_vencidas: number
  preventivas_proximas_7d: number
  abastecimentos_mes: number
  custo_manutencao_mes: number
  custo_abastecimento_mes: number
  ocorrencias_abertas: number
}

// ── Payloads ──────────────────────────────────────────────────────────────────

export interface CriarOSPayload {
  veiculo_id: string
  tipo: TipoOS
  prioridade: PrioridadeOS
  descricao_problema: string
  hodometro_entrada?: number
  data_previsao?: string
  itens?: Array<{
    tipo: TipoItemOS
    descricao: string
    quantidade: number
    valor_unitario: number
    garantia_km?: number
    garantia_dias?: number
  }>
}

export interface CriarChecklistPayload {
  veiculo_id: string
  motorista_id?: string
  data_checklist?: string
  tipo: TipoChecklist
  nivel_oleo_ok: boolean
  nivel_agua_ok: boolean
  calibragem_pneus_ok: boolean
  lanternas_ok: boolean
  freios_ok: boolean
  documentacao_ok: boolean
  limpeza_ok: boolean
  hodometro?: number
  observacoes?: string
}

export interface RegistrarAbastecimentoPayload {
  veiculo_id: string
  motorista_id?: string
  data_abastecimento: string
  posto?: string
  combustivel: CombustivelVeiculo
  hodometro: number
  litros: number
  valor_litro: number
  forma_pagamento: TipoPagamento
  numero_cupom?: string
  observacoes?: string
}

// ─── Novos tipos (redesign Frotas & Máquinas) ─────────────────────────────────

export type TipoAtivo      = 'veiculo' | 'maquina'
export type StatusAlocacao = 'ativa' | 'encerrada' | 'cancelada'
export type TipoChecklist2 = 'pre_viagem' | 'pos_viagem' | 'entrega_locadora' | 'devolucao_locadora' | 'pre_manutencao' | 'pos_manutencao'
export type TipoMulta      = 'multa' | 'pedagio'
export type StatusMulta    = 'recebida' | 'contestada' | 'paga' | 'vencida' | 'cancelada'

export interface FroAcessorio {
  id: string
  nome: string
  descricao?: string
  ativo: boolean
  created_at: string
}

export interface FroVeiculoAcessorio {
  id: string
  veiculo_id: string
  acessorio_id: string
  observacoes?: string
  created_at: string
  acessorio?: FroAcessorio
}

export interface FroAlocacao {
  id: string
  veiculo_id: string
  obra_id?: string
  centro_custo_id?: string
  responsavel_id?: string
  responsavel_nome?: string
  data_saida: string
  data_retorno_prev?: string
  data_retorno_real?: string
  hodometro_saida?: number
  hodometro_retorno?: number
  horimetro_saida?: number
  horimetro_retorno?: number
  checklist_saida_id?: string
  checklist_retorno_id?: string
  status: StatusAlocacao
  observacoes?: string
  // ── Demanda Obras: próxima alocação solicitada ──
  proxima_obra_id?: string
  proxima_data_inicio?: string
  proxima_data_fim?: string
  proxima_observacoes?: string
  proxima_solicitada_por?: string
  proxima_solicitada_em?: string
  proxima_status?: 'rascunho' | 'publicado' | 'cancelado'
  created_at: string
  updated_at: string
  veiculo?: Pick<FroVeiculo, 'id' | 'placa' | 'modelo' | 'marca' | 'categoria'>
  obra?: { id: string; nome: string; codigo?: string }
  proxima_obra?: { id: string; nome: string; codigo?: string }
}

// ── Histórico de movimentações (fro_alocacoes_hist) ───────────────────────
export interface FroAlocacaoHist {
  id: string
  alocacao_id: string
  veiculo_id?: string
  acao: 'criada' | 'editada' | 'demanda_obras' | 'demanda_cancelada' | 'encerrada' | 'rejeitada' | 'automatica'
  obra_origem?: string
  obra_destino?: string
  payload_antes?: Record<string, unknown>
  payload_depois?: Record<string, unknown>
  feito_por?: string
  feito_em: string
  descricao?: string
  obra_origem_nome?: string
  obra_destino_nome?: string
  feito_por_nome?: string
}

export interface FroChecklistTemplate {
  id: string
  nome: string
  tipo: TipoChecklist2
  tipo_ativo: 'todos' | 'veiculo' | 'maquina'
  ativo: boolean
  created_at: string
  itens?: FroChecklistTemplateItem[]
}

export interface FroChecklistTemplateItem {
  id: string
  template_id: string
  ordem: number
  descricao: string
  obrigatorio: boolean
  permite_foto: boolean
}

// ── Checklist Vistoria (graded inspection) ──────────────────────────────────
export type EstadoItemVeiculo = 'otimo' | 'bom' | 'regular' | 'ruim' | 'nao_se_aplica'
export type NivelCombustivel = 'vazio' | '1/4' | '1/2' | '3/4' | 'cheio'

export interface FroChecklistFoto {
  id: string
  execucao_id: string
  item_id?: string
  url: string
  descricao?: string
  created_at: string
}

export interface FroChecklistExecucao {
  id: string
  template_id: string
  veiculo_id: string
  alocacao_id?: string
  hodometro?: number
  horimetro?: number
  responsavel_id?: string
  responsavel_nome?: string
  status: 'pendente' | 'em_andamento' | 'concluido'
  assinatura_url?: string
  observacoes?: string
  created_at: string
  concluido_at?: string
  observacoes_gerais?: string
  tem_pendencias?: boolean
  nivel_combustivel?: NivelCombustivel
  hodometro_registro?: number
  template?: FroChecklistTemplate
  veiculo?: Pick<FroVeiculo, 'id' | 'placa' | 'modelo'>
  itens?: FroChecklistExecucaoItem[]
}

export interface FroChecklistExecucaoItem {
  id: string
  execucao_id: string
  template_item_id: string
  conforme?: boolean
  foto_url?: string
  observacao?: string
  estado?: EstadoItemVeiculo
  template_item?: FroChecklistTemplateItem
}

export interface FroMulta {
  id: string
  veiculo_id: string
  tipo: TipoMulta
  data_infracao?: string
  data_vencimento?: string
  valor: number
  ait?: string
  descricao?: string
  local?: string
  responsavel_id?: string
  obra_id?: string
  status: StatusMulta
  data_pagamento?: string
  fin_cp_id?: string
  observacoes?: string
  created_at: string
  updated_at: string
  veiculo?: Pick<FroVeiculo, 'id' | 'placa' | 'modelo'>
  obra?: { id: string; nome: string }
}

// ── Indicadores avançados (RPCs) ─────────────────────────────────────────────

export interface FrotasCustoKm {
  veiculo_id: string
  placa: string
  marca: string
  modelo: string
  custo_total: number
  km_percorrido: number
  custo_por_km: number
}

export interface FrotasConsumoReal {
  veiculo_id: string
  placa: string
  km_percorrido: number
  litros_total: number
  km_por_litro: number
}

export interface ScoreMotorista {
  motorista_id: string
  nome: string
  total_ocorrencias: number
  ocorrencias_por_1000km: number
}

// ── Itens de Manutenção ─────────────────────────────────────────────────────

export type TipoItemManutencao =
  | 'oleo_motor' | 'filtro_oleo' | 'filtro_ar' | 'pneus' | 'bateria'
  | 'freios_pastilhas' | 'suspensao' | 'correia_dentada' | 'fluido_freio'

export interface FroIntervaloPreventiva {
  id: string
  tipo_item: TipoItemManutencao
  descricao: string
  intervalo_km: number
  intervalo_meses: number | null
}

export interface FroItemManutencao {
  id: string
  veiculo_id: string
  tipo_item: TipoItemManutencao
  km_ultima_troca: number
  data_ultima_troca: string | null
  km_proxima_troca: number | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

// ── Check-in diário (lançado no Portal TEG) ───────────────────────────────────

/** Avaliações são 1..5 — a mesma escala que o motorista vê no Portal. */
export interface FroCheckinDiario {
  id: string
  veiculo_id: string
  colaborador_id: string
  colaborador_nome: string | null
  created_at: string
  obra_id?: string | null
  obra_nome: string | null
  km_informado: number | null
  nivel_combustivel: string | null
  foto_painel_url: string | null
  aval_funcional: number | null
  aval_limpeza: number | null
  tem_avaria: boolean
  avarias_novas: string | null
  foto_avaria_url: string | null
  responsavel_nome?: string | null
  data_retorno_prev?: string | null
  obs_alocacao?: string | null
  qtd_passageiros: number
  passageiros?: unknown
}

// ── Log de Sincronização de Telemetria ──────────────────────────────────────
// Resumo por execução dos syncs (Mobi7, Cobli, ...), gravado pelos workflows n8n.
export interface FroTelSyncLog {
  id: number
  provider: string
  endpoint: string          // positions | behaviors
  ok: boolean
  veiculos: number | null
  inseridos: number | null
  falhas: number | null
  erro: string | null
  detalhe: unknown | null
  created_at: string
}
