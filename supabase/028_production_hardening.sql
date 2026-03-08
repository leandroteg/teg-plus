-- ============================================================================
-- Migration 028: Production Hardening
-- Date: 2026-03-08
-- Description: Comprehensive production hardening migration covering:
--   Part A: Indexes on all unindexed foreign keys (58 indexes)
--   Part B: Security invoker on all views (4 views)
--   Part C: SET search_path on all public functions (31 functions)
--   Part D: VACUUM ANALYZE on all public tables (78 tables)
-- ============================================================================

-- ============================================================================
-- PART A: CREATE INDEX IF NOT EXISTS for every unindexed foreign key
-- Naming convention: idx_{table}_{column}
-- ============================================================================

BEGIN;

-- apr_alcadas
CREATE INDEX IF NOT EXISTS idx_apr_alcadas_aprovador_padrao_id
  ON public.apr_alcadas (aprovador_padrao_id);

-- apr_aprovacoes
CREATE INDEX IF NOT EXISTS idx_apr_aprovacoes_alcada_id
  ON public.apr_aprovacoes (alcada_id);
CREATE INDEX IF NOT EXISTS idx_apr_aprovacoes_aprovador_id
  ON public.apr_aprovacoes (aprovador_id);

-- cmp_compradores
CREATE INDEX IF NOT EXISTS idx_cmp_compradores_usuario_id
  ON public.cmp_compradores (usuario_id);

-- cmp_cotacoes
CREATE INDEX IF NOT EXISTS idx_cmp_cotacoes_fornecedor_selecionado_id
  ON public.cmp_cotacoes (fornecedor_selecionado_id);

-- cmp_pedidos
CREATE INDEX IF NOT EXISTS idx_cmp_pedidos_comprador_id
  ON public.cmp_pedidos (comprador_id);
CREATE INDEX IF NOT EXISTS idx_cmp_pedidos_cotacao_id
  ON public.cmp_pedidos (cotacao_id);
CREATE INDEX IF NOT EXISTS idx_cmp_pedidos_fornecedor_id
  ON public.cmp_pedidos (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_cmp_pedidos_projeto_id
  ON public.cmp_pedidos (projeto_id);

-- cmp_recebimento_itens
CREATE INDEX IF NOT EXISTS idx_cmp_recebimento_itens_item_estoque_id
  ON public.cmp_recebimento_itens (item_estoque_id);

-- cmp_recebimentos
CREATE INDEX IF NOT EXISTS idx_cmp_recebimentos_recebido_por
  ON public.cmp_recebimentos (recebido_por);

-- cmp_requisicoes
CREATE INDEX IF NOT EXISTS idx_cmp_requisicoes_projeto_id
  ON public.cmp_requisicoes (projeto_id);

-- con_contrato_itens
CREATE INDEX IF NOT EXISTS idx_con_contrato_itens_contrato_id
  ON public.con_contrato_itens (contrato_id);

-- con_contratos
CREATE INDEX IF NOT EXISTS idx_con_contratos_fornecedor_id
  ON public.con_contratos (fornecedor_id);

-- con_parcela_anexos
CREATE INDEX IF NOT EXISTS idx_con_parcela_anexos_parcela_id
  ON public.con_parcela_anexos (parcela_id);

-- con_parcelas
CREATE INDEX IF NOT EXISTS idx_con_parcelas_fin_cp_id
  ON public.con_parcelas (fin_cp_id);
CREATE INDEX IF NOT EXISTS idx_con_parcelas_fin_cr_id
  ON public.con_parcelas (fin_cr_id);

-- est_inventario_itens
CREATE INDEX IF NOT EXISTS idx_est_inventario_itens_base_id
  ON public.est_inventario_itens (base_id);
CREATE INDEX IF NOT EXISTS idx_est_inventario_itens_inventario_id
  ON public.est_inventario_itens (inventario_id);
CREATE INDEX IF NOT EXISTS idx_est_inventario_itens_item_id
  ON public.est_inventario_itens (item_id);

-- est_inventarios
CREATE INDEX IF NOT EXISTS idx_est_inventarios_base_id
  ON public.est_inventarios (base_id);

-- est_movimentacoes
CREATE INDEX IF NOT EXISTS idx_est_movimentacoes_base_destino_id
  ON public.est_movimentacoes (base_destino_id);
CREATE INDEX IF NOT EXISTS idx_est_movimentacoes_localizacao_id
  ON public.est_movimentacoes (localizacao_id);

-- est_solicitacao_itens
CREATE INDEX IF NOT EXISTS idx_est_solicitacao_itens_item_id
  ON public.est_solicitacao_itens (item_id);
CREATE INDEX IF NOT EXISTS idx_est_solicitacao_itens_solicitacao_id
  ON public.est_solicitacao_itens (solicitacao_id);

-- fin_categorias_financeiras
CREATE INDEX IF NOT EXISTS idx_fin_categorias_financeiras_grupo_id
  ON public.fin_categorias_financeiras (grupo_id);

-- fin_classes_financeiras
CREATE INDEX IF NOT EXISTS idx_fin_classes_financeiras_categoria_id
  ON public.fin_classes_financeiras (categoria_id);

-- fin_contas_pagar
CREATE INDEX IF NOT EXISTS idx_fin_contas_pagar_requisicao_id
  ON public.fin_contas_pagar (requisicao_id);

-- fin_contas_receber
CREATE INDEX IF NOT EXISTS idx_fin_contas_receber_projeto_id
  ON public.fin_contas_receber (projeto_id);

-- fis_notas_fiscais
CREATE INDEX IF NOT EXISTS idx_fis_notas_fiscais_conta_pagar_id
  ON public.fis_notas_fiscais (conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_fis_notas_fiscais_contrato_id
  ON public.fis_notas_fiscais (contrato_id);
CREATE INDEX IF NOT EXISTS idx_fis_notas_fiscais_obra_id
  ON public.fis_notas_fiscais (obra_id);

-- fis_solicitacoes_nf
CREATE INDEX IF NOT EXISTS idx_fis_solicitacoes_nf_nota_fiscal_id
  ON public.fis_solicitacoes_nf (nota_fiscal_id);

-- fro_avaliacoes_fornecedor
CREATE INDEX IF NOT EXISTS idx_fro_avaliacoes_fornecedor_fornecedor_id
  ON public.fro_avaliacoes_fornecedor (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_fro_avaliacoes_fornecedor_os_id
  ON public.fro_avaliacoes_fornecedor (os_id);

-- fro_cotacoes_os
CREATE INDEX IF NOT EXISTS idx_fro_cotacoes_os_fornecedor_id
  ON public.fro_cotacoes_os (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_fro_cotacoes_os_os_id
  ON public.fro_cotacoes_os (os_id);

-- fro_itens_os
CREATE INDEX IF NOT EXISTS idx_fro_itens_os_os_id
  ON public.fro_itens_os (os_id);

-- fro_ocorrencias_telemetria
CREATE INDEX IF NOT EXISTS idx_fro_ocorrencias_telemetria_veiculo_id
  ON public.fro_ocorrencias_telemetria (veiculo_id);

-- fro_ordens_servico
CREATE INDEX IF NOT EXISTS idx_fro_ordens_servico_fornecedor_id
  ON public.fro_ordens_servico (fornecedor_id);

-- fro_planos_preventiva
CREATE INDEX IF NOT EXISTS idx_fro_planos_preventiva_veiculo_id
  ON public.fro_planos_preventiva (veiculo_id);

-- log_avaliacoes
CREATE INDEX IF NOT EXISTS idx_log_avaliacoes_solicitacao_id
  ON public.log_avaliacoes (solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_log_avaliacoes_transportadora_id
  ON public.log_avaliacoes (transportadora_id);

-- log_itens_solicitacao
CREATE INDEX IF NOT EXISTS idx_log_itens_solicitacao_solicitacao_id
  ON public.log_itens_solicitacao (solicitacao_id);

-- log_ocorrencias
CREATE INDEX IF NOT EXISTS idx_log_ocorrencias_solicitacao_id
  ON public.log_ocorrencias (solicitacao_id);

-- log_rotas
CREATE INDEX IF NOT EXISTS idx_log_rotas_transportadora_id
  ON public.log_rotas (transportadora_id);

-- log_solicitacoes
CREATE INDEX IF NOT EXISTS idx_log_solicitacoes_rota_id
  ON public.log_solicitacoes (rota_id);
CREATE INDEX IF NOT EXISTS idx_log_solicitacoes_rota_planejada_id
  ON public.log_solicitacoes (rota_planejada_id);

-- pat_movimentacoes
CREATE INDEX IF NOT EXISTS idx_pat_movimentacoes_base_destino_id
  ON public.pat_movimentacoes (base_destino_id);
CREATE INDEX IF NOT EXISTS idx_pat_movimentacoes_base_origem_id
  ON public.pat_movimentacoes (base_origem_id);
CREATE INDEX IF NOT EXISTS idx_pat_movimentacoes_imobilizado_id
  ON public.pat_movimentacoes (imobilizado_id);

-- pat_termos_responsabilidade
CREATE INDEX IF NOT EXISTS idx_pat_termos_responsabilidade_imobilizado_id
  ON public.pat_termos_responsabilidade (imobilizado_id);

-- sys_centros_custo
CREATE INDEX IF NOT EXISTS idx_sys_centros_custo_empresa_id
  ON public.sys_centros_custo (empresa_id);

-- sys_convites
CREATE INDEX IF NOT EXISTS idx_sys_convites_convidado_por
  ON public.sys_convites (convidado_por);

-- sys_log_atividades
CREATE INDEX IF NOT EXISTS idx_sys_log_atividades_usuario_id
  ON public.sys_log_atividades (usuario_id);

-- sys_obras
CREATE INDEX IF NOT EXISTS idx_sys_obras_centro_custo_id
  ON public.sys_obras (centro_custo_id);

-- sys_usuarios
CREATE INDEX IF NOT EXISTS idx_sys_usuarios_obra_id
  ON public.sys_usuarios (obra_id);

-- sys_whatsapp_log
CREATE INDEX IF NOT EXISTS idx_sys_whatsapp_log_perfil_id
  ON public.sys_whatsapp_log (perfil_id);

-- ============================================================================
-- PART B: ALTER VIEW ... SET (security_invoker = on)
-- Ensures views respect the calling user's RLS policies
-- ============================================================================

ALTER VIEW public.mural_banners_vigentes SET (security_invoker = on);
ALTER VIEW public.vw_cmp_dashboard_status SET (security_invoker = on);
ALTER VIEW public.vw_cmp_por_obra SET (security_invoker = on);
ALTER VIEW public.vw_cmp_requisicoes_completas SET (security_invoker = on);

-- ============================================================================
-- PART C: SET search_path on all public functions
-- Prevents search_path hijacking attacks (CWE-426)
-- ============================================================================

-- Trigger / utility functions (no arguments)
ALTER FUNCTION public.atualizar_cp_ao_liberar_pagamento() SET search_path = public;
ALTER FUNCTION public.cad_set_updated_at() SET search_path = public;
ALTER FUNCTION public.cmp_gerar_numero_requisicao() SET search_path = public;
ALTER FUNCTION public.con_set_updated_at() SET search_path = public;
ALTER FUNCTION public.criar_cp_ao_emitir_pedido() SET search_path = public;
ALTER FUNCTION public.fis_sol_nf_on_emitida() SET search_path = public;
ALTER FUNCTION public.fis_sol_nf_updated_at() SET search_path = public;
ALTER FUNCTION public.fn_atualiza_avaliacao_transportadora() SET search_path = public;
ALTER FUNCTION public.fn_atualiza_saldo_estoque() SET search_path = public;
ALTER FUNCTION public.fn_avaliacao_fro_fornecedor() SET search_path = public;
ALTER FUNCTION public.fn_numero_log_solicitacao() SET search_path = public;
ALTER FUNCTION public.fn_numero_os() SET search_path = public;
ALTER FUNCTION public.fn_processar_recebimento_item() SET search_path = public;
ALTER FUNCTION public.fn_registrar_historico_status() SET search_path = public;
ALTER FUNCTION public.fn_set_updated_at_fro() SET search_path = public;
ALTER FUNCTION public.fn_set_updated_at_log() SET search_path = public;
ALTER FUNCTION public.fn_set_updated_at_mural() SET search_path = public;
ALTER FUNCTION public.gerar_numero_inventario() SET search_path = public;
ALTER FUNCTION public.gerar_numero_solicitacao() SET search_path = public;
ALTER FUNCTION public.log_audit_changes() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.sync_nf_from_pedido_anexo() SET search_path = public;
ALTER FUNCTION public.sys_update_updated_at() SET search_path = public;
ALTER FUNCTION public.trg_pre_cadastros_updated() SET search_path = public;
ALTER FUNCTION public.get_dashboard_contratos_gestao() SET search_path = public;
ALTER FUNCTION public.get_omie_config() SET search_path = public;

-- Functions with arguments
ALTER FUNCTION public.apr_determinar_alcada(p_valor numeric) SET search_path = public;
ALTER FUNCTION public.con_gerar_parcelas_recorrentes(p_contrato_id uuid) SET search_path = public;
ALTER FUNCTION public.get_alerta_cotacao(p_requisicao_id uuid) SET search_path = public;
ALTER FUNCTION public.get_dashboard_compras(p_periodo text, p_obra_id uuid) SET search_path = public;
ALTER FUNCTION public.get_dashboard_financeiro(p_periodo text) SET search_path = public;

COMMIT;

-- ============================================================================
-- PART D: VACUUM ANALYZE on all public tables
-- Must run outside of a transaction block
-- Updates planner statistics and reclaims dead tuple space
-- ============================================================================

VACUUM ANALYZE public.apr_alcadas;
VACUUM ANALYZE public.apr_aprovacoes;
VACUUM ANALYZE public.cache_consultas;
VACUUM ANALYZE public.cmp_anexos;
VACUUM ANALYZE public.cmp_categorias;
VACUUM ANALYZE public.cmp_compradores;
VACUUM ANALYZE public.cmp_cotacao_fornecedores;
VACUUM ANALYZE public.cmp_cotacoes;
VACUUM ANALYZE public.cmp_fornecedores;
VACUUM ANALYZE public.cmp_historico_status;
VACUUM ANALYZE public.cmp_pedidos;
VACUUM ANALYZE public.cmp_pedidos_anexos;
VACUUM ANALYZE public.cmp_recebimento_itens;
VACUUM ANALYZE public.cmp_recebimentos;
VACUUM ANALYZE public.cmp_requisicao_itens;
VACUUM ANALYZE public.cmp_requisicoes;
VACUUM ANALYZE public.con_clientes;
VACUUM ANALYZE public.con_contrato_itens;
VACUUM ANALYZE public.con_contratos;
VACUUM ANALYZE public.con_parcela_anexos;
VACUUM ANALYZE public.con_parcelas;
VACUUM ANALYZE public.est_bases;
VACUUM ANALYZE public.est_inventario_itens;
VACUUM ANALYZE public.est_inventarios;
VACUUM ANALYZE public.est_itens;
VACUUM ANALYZE public.est_localizacoes;
VACUUM ANALYZE public.est_movimentacoes;
VACUUM ANALYZE public.est_saldos;
VACUUM ANALYZE public.est_solicitacao_itens;
VACUUM ANALYZE public.est_solicitacoes;
VACUUM ANALYZE public.fin_categorias_financeiras;
VACUUM ANALYZE public.fin_classes_financeiras;
VACUUM ANALYZE public.fin_contas_pagar;
VACUUM ANALYZE public.fin_contas_receber;
VACUUM ANALYZE public.fin_documentos;
VACUUM ANALYZE public.fin_grupos_financeiros;
VACUUM ANALYZE public.fin_sync_log;
VACUUM ANALYZE public.fis_notas_fiscais;
VACUUM ANALYZE public.fis_solicitacoes_nf;
VACUUM ANALYZE public.fro_abastecimentos;
VACUUM ANALYZE public.fro_avaliacoes_fornecedor;
VACUUM ANALYZE public.fro_checklists;
VACUUM ANALYZE public.fro_cotacoes_os;
VACUUM ANALYZE public.fro_fornecedores;
VACUUM ANALYZE public.fro_itens_os;
VACUUM ANALYZE public.fro_ocorrencias_telemetria;
VACUUM ANALYZE public.fro_ordens_servico;
VACUUM ANALYZE public.fro_planos_preventiva;
VACUUM ANALYZE public.fro_veiculos;
VACUUM ANALYZE public.log_avaliacoes;
VACUUM ANALYZE public.log_checklists_expedicao;
VACUUM ANALYZE public.log_itens_solicitacao;
VACUUM ANALYZE public.log_nfe;
VACUUM ANALYZE public.log_ocorrencias;
VACUUM ANALYZE public.log_recebimentos;
VACUUM ANALYZE public.log_rotas;
VACUUM ANALYZE public.log_solicitacoes;
VACUUM ANALYZE public.log_transportadoras;
VACUUM ANALYZE public.log_transportes;
VACUUM ANALYZE public.mural_banners;
VACUUM ANALYZE public.n8n_chat_histories;
VACUUM ANALYZE public.pat_depreciacoes;
VACUUM ANALYZE public.pat_imobilizados;
VACUUM ANALYZE public.pat_movimentacoes;
VACUUM ANALYZE public.pat_termos_responsabilidade;
VACUUM ANALYZE public.rh_colaboradores;
VACUUM ANALYZE public.sys_centros_custo;
VACUUM ANALYZE public.sys_config;
VACUUM ANALYZE public.sys_configuracoes;
VACUUM ANALYZE public.sys_convites;
VACUUM ANALYZE public.sys_empresas;
VACUUM ANALYZE public.sys_feedbacks;
VACUUM ANALYZE public.sys_log_atividades;
VACUUM ANALYZE public.sys_obras;
VACUUM ANALYZE public.sys_perfis;
VACUUM ANALYZE public.sys_pre_cadastros;
VACUUM ANALYZE public.sys_usuarios;
VACUUM ANALYZE public.sys_whatsapp_log;
