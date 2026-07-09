-- =====================================================================
-- 20260708100003_consolida_updated_at_triggers.sql
-- Consolida ~14 funções de trigger `updated_at` idênticas em UMA única
-- função canônica public.fn_set_updated_at() (que já atende 28 triggers).
-- NÃO APLICAR EM PRODUÇÃO ANTES DE VALIDAR EM HOMOLOGAÇÃO.
--
-- Corpo idêntico confirmado via pg_proc:  BEGIN NEW.updated_at = now(); RETURN NEW; END;
-- Não toca em funções com lógica extra (orc_before_*, ti_chamados_set_timestamps, fn_con_*, etc.).
-- Idempotente (DROP TRIGGER IF EXISTS / DROP FUNCTION IF EXISTS).
-- Rollback completo ao final (comentado).
-- =====================================================================
BEGIN;

-- 1) Re-apontar cada trigger para a função canônica fn_set_updated_at
DROP TRIGGER IF EXISTS tr_cmp_cotacoes_updated ON public.cmp_cotacoes;
CREATE TRIGGER tr_cmp_cotacoes_updated BEFORE UPDATE ON public.cmp_cotacoes FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS cmp_pedidos_updated_at ON public.cmp_pedidos;
CREATE TRIGGER cmp_pedidos_updated_at BEFORE UPDATE ON public.cmp_pedidos FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS tr_cmp_requisicoes_updated ON public.cmp_requisicoes;
CREATE TRIGGER tr_cmp_requisicoes_updated BEFORE UPDATE ON public.cmp_requisicoes FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.con_assinaturas;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.con_assinaturas FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trg_con_clientes_updated ON public.con_clientes;
CREATE TRIGGER trg_con_clientes_updated BEFORE UPDATE ON public.con_clientes FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trg_con_contratos_updated ON public.con_contratos;
CREATE TRIGGER trg_con_contratos_updated BEFORE UPDATE ON public.con_contratos FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_con_minutas ON public.con_minutas;
CREATE TRIGGER set_updated_at_con_minutas BEFORE UPDATE ON public.con_minutas FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.con_modelos_contrato;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.con_modelos_contrato FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trg_con_parcelas_updated ON public.con_parcelas;
CREATE TRIGGER trg_con_parcelas_updated BEFORE UPDATE ON public.con_parcelas FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_con_resumos ON public.con_resumos_executivos;
CREATE TRIGGER set_updated_at_con_resumos BEFORE UPDATE ON public.con_resumos_executivos FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_con_solicitacoes ON public.con_solicitacoes;
CREATE TRIGGER set_updated_at_con_solicitacoes BEFORE UPDATE ON public.con_solicitacoes FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trg_apontamentos_updated_at ON public.fin_apontamentos_cartao;
CREATE TRIGGER trg_apontamentos_updated_at BEFORE UPDATE ON public.fin_apontamentos_cartao FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trg_cartoes_updated_at ON public.fin_cartoes_credito;
CREATE TRIGGER trg_cartoes_updated_at BEFORE UPDATE ON public.fin_cartoes_credito FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trg_fin_classes_updated ON public.fin_classes_financeiras;
CREATE TRIGGER trg_fin_classes_updated BEFORE UPDATE ON public.fin_classes_financeiras FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trg_fis_sol_nf_updated ON public.fis_solicitacoes_nf;
CREATE TRIGGER trg_fis_sol_nf_updated BEFORE UPDATE ON public.fis_solicitacoes_nf FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_fro_fornecedores ON public.fro_fornecedores;
CREATE TRIGGER trg_updated_at_fro_fornecedores BEFORE UPDATE ON public.fro_fornecedores FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_fro_itens_manutencao ON public.fro_itens_manutencao;
CREATE TRIGGER trg_updated_at_fro_itens_manutencao BEFORE UPDATE ON public.fro_itens_manutencao FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_fro_os ON public.fro_ordens_servico;
CREATE TRIGGER trg_updated_at_fro_os BEFORE UPDATE ON public.fro_ordens_servico FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_fro_veiculos ON public.fro_veiculos;
CREATE TRIGGER trg_updated_at_fro_veiculos BEFORE UPDATE ON public.fro_veiculos FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trig_updated_at_log_recebimentos ON public.log_recebimentos;
CREATE TRIGGER trig_updated_at_log_recebimentos BEFORE UPDATE ON public.log_recebimentos FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trig_updated_at_log_solicitacoes ON public.log_solicitacoes;
CREATE TRIGGER trig_updated_at_log_solicitacoes BEFORE UPDATE ON public.log_solicitacoes FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trig_updated_at_log_transportes ON public.log_transportes;
CREATE TRIGGER trig_updated_at_log_transportes BEFORE UPDATE ON public.log_transportes FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_viagens ON public.log_viagens;
CREATE TRIGGER trg_updated_at_viagens BEFORE UPDATE ON public.log_viagens FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_mural ON public.mural_banners;
CREATE TRIGGER trg_updated_at_mural BEFORE UPDATE ON public.mural_banners FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trg_rh_colaboradores_updated ON public.rh_colaboradores;
CREATE TRIGGER trg_rh_colaboradores_updated BEFORE UPDATE ON public.rh_colaboradores FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trg_sys_centros_custo_updated ON public.sys_centros_custo;
CREATE TRIGGER trg_sys_centros_custo_updated BEFORE UPDATE ON public.sys_centros_custo FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS tr_sys_obras_updated ON public.sys_obras;
CREATE TRIGGER tr_sys_obras_updated BEFORE UPDATE ON public.sys_obras FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS sys_perfis_updated_at ON public.sys_perfis;
CREATE TRIGGER sys_perfis_updated_at BEFORE UPDATE ON public.sys_perfis FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS trg_sys_pre_cadastros_updated_at ON public.sys_pre_cadastros;
CREATE TRIGGER trg_sys_pre_cadastros_updated_at BEFORE UPDATE ON public.sys_pre_cadastros FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS sys_roles_updated_at ON public.sys_roles;
CREATE TRIGGER sys_roles_updated_at BEFORE UPDATE ON public.sys_roles FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
DROP TRIGGER IF EXISTS tr_sys_usuarios_updated ON public.sys_usuarios;
CREATE TRIGGER tr_sys_usuarios_updated BEFORE UPDATE ON public.sys_usuarios FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- 2) Dropar as funções duplicadas (agora sem triggers) + a órfã update_rag_pa_updated_at
DROP FUNCTION IF EXISTS public.cad_set_updated_at();
DROP FUNCTION IF EXISTS public.con_set_updated_at();
DROP FUNCTION IF EXISTS public.fin_set_updated_at_cartao();
DROP FUNCTION IF EXISTS public.fis_sol_nf_updated_at();
DROP FUNCTION IF EXISTS public.fn_set_updated_at_fro();
DROP FUNCTION IF EXISTS public.fn_set_updated_at_log();
DROP FUNCTION IF EXISTS public.fn_set_updated_at_mural();
DROP FUNCTION IF EXISTS public.push_subscriptions_updated_at();
DROP FUNCTION IF EXISTS public.set_sys_pre_cadastros_updated_at();
DROP FUNCTION IF EXISTS public.set_updated_at();
DROP FUNCTION IF EXISTS public.sys_update_updated_at();
DROP FUNCTION IF EXISTS public.trg_sys_roles_updated_at();
DROP FUNCTION IF EXISTS public.trigger_set_updated_at();
DROP FUNCTION IF EXISTS public.update_rag_pa_updated_at();

COMMIT;

-- =====================================================================
-- ROLLBACK (executar manualmente para reverter):
-- =====================================================================
/*
BEGIN;
-- (recriar funções e re-apontar triggers de volta)
CREATE OR REPLACE FUNCTION public.cad_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.con_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.fin_set_updated_at_cartao() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.fis_sol_nf_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.fn_set_updated_at_fro() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.fn_set_updated_at_log() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.fn_set_updated_at_mural() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.push_subscriptions_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.set_sys_pre_cadastros_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.sys_update_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.trg_sys_roles_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_rag_pa_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS tr_cmp_cotacoes_updated ON public.cmp_cotacoes;
CREATE TRIGGER tr_cmp_cotacoes_updated BEFORE UPDATE ON public.cmp_cotacoes FOR EACH ROW EXECUTE FUNCTION public.sys_update_updated_at();
DROP TRIGGER IF EXISTS cmp_pedidos_updated_at ON public.cmp_pedidos;
CREATE TRIGGER cmp_pedidos_updated_at BEFORE UPDATE ON public.cmp_pedidos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS tr_cmp_requisicoes_updated ON public.cmp_requisicoes;
CREATE TRIGGER tr_cmp_requisicoes_updated BEFORE UPDATE ON public.cmp_requisicoes FOR EACH ROW EXECUTE FUNCTION public.sys_update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.con_assinaturas;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.con_assinaturas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_con_clientes_updated ON public.con_clientes;
CREATE TRIGGER trg_con_clientes_updated BEFORE UPDATE ON public.con_clientes FOR EACH ROW EXECUTE FUNCTION public.con_set_updated_at();
DROP TRIGGER IF EXISTS trg_con_contratos_updated ON public.con_contratos;
CREATE TRIGGER trg_con_contratos_updated BEFORE UPDATE ON public.con_contratos FOR EACH ROW EXECUTE FUNCTION public.con_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_con_minutas ON public.con_minutas;
CREATE TRIGGER set_updated_at_con_minutas BEFORE UPDATE ON public.con_minutas FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.con_modelos_contrato;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.con_modelos_contrato FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_con_parcelas_updated ON public.con_parcelas;
CREATE TRIGGER trg_con_parcelas_updated BEFORE UPDATE ON public.con_parcelas FOR EACH ROW EXECUTE FUNCTION public.con_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_con_resumos ON public.con_resumos_executivos;
CREATE TRIGGER set_updated_at_con_resumos BEFORE UPDATE ON public.con_resumos_executivos FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_con_solicitacoes ON public.con_solicitacoes;
CREATE TRIGGER set_updated_at_con_solicitacoes BEFORE UPDATE ON public.con_solicitacoes FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
DROP TRIGGER IF EXISTS trg_apontamentos_updated_at ON public.fin_apontamentos_cartao;
CREATE TRIGGER trg_apontamentos_updated_at BEFORE UPDATE ON public.fin_apontamentos_cartao FOR EACH ROW EXECUTE FUNCTION public.fin_set_updated_at_cartao();
DROP TRIGGER IF EXISTS trg_cartoes_updated_at ON public.fin_cartoes_credito;
CREATE TRIGGER trg_cartoes_updated_at BEFORE UPDATE ON public.fin_cartoes_credito FOR EACH ROW EXECUTE FUNCTION public.fin_set_updated_at_cartao();
DROP TRIGGER IF EXISTS trg_fin_classes_updated ON public.fin_classes_financeiras;
CREATE TRIGGER trg_fin_classes_updated BEFORE UPDATE ON public.fin_classes_financeiras FOR EACH ROW EXECUTE FUNCTION public.cad_set_updated_at();
DROP TRIGGER IF EXISTS trg_fis_sol_nf_updated ON public.fis_solicitacoes_nf;
CREATE TRIGGER trg_fis_sol_nf_updated BEFORE UPDATE ON public.fis_solicitacoes_nf FOR EACH ROW EXECUTE FUNCTION public.fis_sol_nf_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_fro_fornecedores ON public.fro_fornecedores;
CREATE TRIGGER trg_updated_at_fro_fornecedores BEFORE UPDATE ON public.fro_fornecedores FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_fro();
DROP TRIGGER IF EXISTS trg_updated_at_fro_itens_manutencao ON public.fro_itens_manutencao;
CREATE TRIGGER trg_updated_at_fro_itens_manutencao BEFORE UPDATE ON public.fro_itens_manutencao FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_fro();
DROP TRIGGER IF EXISTS trg_updated_at_fro_os ON public.fro_ordens_servico;
CREATE TRIGGER trg_updated_at_fro_os BEFORE UPDATE ON public.fro_ordens_servico FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_fro();
DROP TRIGGER IF EXISTS trg_updated_at_fro_veiculos ON public.fro_veiculos;
CREATE TRIGGER trg_updated_at_fro_veiculos BEFORE UPDATE ON public.fro_veiculos FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_fro();
DROP TRIGGER IF EXISTS trig_updated_at_log_recebimentos ON public.log_recebimentos;
CREATE TRIGGER trig_updated_at_log_recebimentos BEFORE UPDATE ON public.log_recebimentos FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_log();
DROP TRIGGER IF EXISTS trig_updated_at_log_solicitacoes ON public.log_solicitacoes;
CREATE TRIGGER trig_updated_at_log_solicitacoes BEFORE UPDATE ON public.log_solicitacoes FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_log();
DROP TRIGGER IF EXISTS trig_updated_at_log_transportes ON public.log_transportes;
CREATE TRIGGER trig_updated_at_log_transportes BEFORE UPDATE ON public.log_transportes FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_log();
DROP TRIGGER IF EXISTS trg_updated_at_viagens ON public.log_viagens;
CREATE TRIGGER trg_updated_at_viagens BEFORE UPDATE ON public.log_viagens FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_log();
DROP TRIGGER IF EXISTS trg_updated_at_mural ON public.mural_banners;
CREATE TRIGGER trg_updated_at_mural BEFORE UPDATE ON public.mural_banners FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_mural();
DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.push_subscriptions_updated_at();
DROP TRIGGER IF EXISTS trg_rh_colaboradores_updated ON public.rh_colaboradores;
CREATE TRIGGER trg_rh_colaboradores_updated BEFORE UPDATE ON public.rh_colaboradores FOR EACH ROW EXECUTE FUNCTION public.cad_set_updated_at();
DROP TRIGGER IF EXISTS trg_sys_centros_custo_updated ON public.sys_centros_custo;
CREATE TRIGGER trg_sys_centros_custo_updated BEFORE UPDATE ON public.sys_centros_custo FOR EACH ROW EXECUTE FUNCTION public.cad_set_updated_at();
DROP TRIGGER IF EXISTS tr_sys_obras_updated ON public.sys_obras;
CREATE TRIGGER tr_sys_obras_updated BEFORE UPDATE ON public.sys_obras FOR EACH ROW EXECUTE FUNCTION public.sys_update_updated_at();
DROP TRIGGER IF EXISTS sys_perfis_updated_at ON public.sys_perfis;
CREATE TRIGGER sys_perfis_updated_at BEFORE UPDATE ON public.sys_perfis FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_sys_pre_cadastros_updated_at ON public.sys_pre_cadastros;
CREATE TRIGGER trg_sys_pre_cadastros_updated_at BEFORE UPDATE ON public.sys_pre_cadastros FOR EACH ROW EXECUTE FUNCTION public.set_sys_pre_cadastros_updated_at();
DROP TRIGGER IF EXISTS sys_roles_updated_at ON public.sys_roles;
CREATE TRIGGER sys_roles_updated_at BEFORE UPDATE ON public.sys_roles FOR EACH ROW EXECUTE FUNCTION public.trg_sys_roles_updated_at();
DROP TRIGGER IF EXISTS tr_sys_usuarios_updated ON public.sys_usuarios;
CREATE TRIGGER tr_sys_usuarios_updated BEFORE UPDATE ON public.sys_usuarios FOR EACH ROW EXECUTE FUNCTION public.sys_update_updated_at();
COMMIT;
*/
