-- =====================================================================
-- 20260708100006_review_anon_grants.sql
-- REVISÃO DE SEGURANÇA — funções SECURITY DEFINER executáveis por `anon`
-- (usuário NÃO autenticado) que NÃO fazem parte do portal público.
--
-- ⚠️ TODAS AS INSTRUÇÕES ESTÃO COMENTADAS DE PROPÓSITO.
-- Não aplicar em bloco. Revisar caso a caso: confirmar que a função não é
-- consumida pelo portal externo (portalteg PWA) nem por n8n antes de revogar.
-- SECURITY DEFINER + acesso anon = potencial exposição/mutação sem autenticação.
--
-- Verificado em produção via has_function_privilege('anon', ..., 'EXECUTE').
-- =====================================================================

-- --- LEITURA de dados sensíveis expostos a anon (provável exposição acidental) ---
-- REVOKE EXECUTE ON FUNCTION public.con_contrato_egp_resumo(uuid) FROM anon;
-- REVOKE EXECUTE ON FUNCTION public.con_recebiveis_egp()          FROM anon;
-- REVOKE EXECUTE ON FUNCTION public.fin_folha_projecao()          FROM anon;

-- --- ESCRITA/MUTAÇÃO executável por anon (risco alto — revisar com urgência) ---
-- REVOKE EXECUTE ON FUNCTION public.con_equipe_pj_recalcular()               FROM anon;
-- REVOKE EXECUTE ON FUNCTION public.fn_vincular_item_rc_manual(uuid, uuid)   FROM anon;
-- REVOKE EXECUTE ON FUNCTION public.rh_admissao_excluir(uuid)                FROM anon;

-- --- Provavelmente parte do fluxo Portal/n8n/assinatura — CONFIRMAR antes de mexer ---
-- (sig_prova_pin, sig_registrar_assinatura, rh_admissao_assinatura_docs,
--  rh_admissao_finalizar_registro, rh_mob_enviar_apresentacao, rh_folha_total,
--  rh_colaborador_missoes, rh_missao_enviar, rh_portalteg_pin_resetar,
--  rh_ponto_recalc_drenar, rh_ponto_recalc_semear, qsma_proximo_codigo,
--  sgi_proximo_codigo_documento, check_rate_limit)
-- => Se confirmado que só o portal/n8n autenticado via anon-key os usa, manter.
--    Caso contrário, restringir para authenticated/service_role.

-- =====================================================================
-- Também: 4 funções sem search_path fixado (lint mutable_search_path).
-- Baixo risco (não são SECURITY DEFINER), mas recomenda-se fixar:
-- =====================================================================
-- ALTER FUNCTION public.est_limpar_marca_descricao(text) SET search_path = public;
-- ALTER FUNCTION public.loc_cidade_sigla(text)           SET search_path = public;
-- ALTER FUNCTION public.loc_norm_txt(text)               SET search_path = public;
-- ALTER FUNCTION public.loc_rua_abrev(text)              SET search_path = public;
