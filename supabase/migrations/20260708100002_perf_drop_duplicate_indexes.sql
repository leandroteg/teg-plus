-- =====================================================================
-- 20260708100002_perf_drop_duplicate_indexes.sql
-- Remove índices redundantes (pares idênticos no schema public).
-- Em cada par, o índice do tipo `_key` pertence a uma CONSTRAINT UNIQUE e
-- já cobre as consultas; o índice `idx_*` avulso é redundante → dropado.
-- NÃO APLICAR EM PRODUÇÃO ANTES DE VALIDAR EM HOMOLOGAÇÃO.
--
-- Confirmado via pg_index (mesmo indrelid/indkey/indpred/indexprs).
-- Índices dos schemas auth/storage (gerenciados pelo Supabase) NÃO são tocados.
-- CONCURRENTLY → rodar fora de transação.
-- =====================================================================

DROP INDEX CONCURRENTLY IF EXISTS public.idx_apr_aprov_token;              -- dup de apr_aprovacoes_token_key
DROP INDEX CONCURRENTLY IF EXISTS public.idx_cmp_req_numero;               -- dup de cmp_requisicoes_numero_key
DROP INDEX CONCURRENTLY IF EXISTS public.idx_sys_perfis_auth_id;           -- dup de sys_perfis_auth_id_key
DROP INDEX CONCURRENTLY IF EXISTS public.idx_sys_config_chave;             -- dup de sys_config_chave_key
DROP INDEX CONCURRENTLY IF EXISTS public.idx_fornecedores_cnpj;            -- dup de cmp_fornecedores_cnpj_key
DROP INDEX CONCURRENTLY IF EXISTS public.idx_pat_imobilizados_receb_item;  -- dup de idx_pat_imob_recebimento (manter 1)
DROP INDEX CONCURRENTLY IF EXISTS public.idx_log_transp_solicitacao;       -- dup de log_transportes_solicitacao_id_key
DROP INDEX CONCURRENTLY IF EXISTS public.idx_cache_consultas_lookup;       -- dup de cache_consultas_tipo_chave_key
DROP INDEX CONCURRENTLY IF EXISTS public.idx_obr_rdo_obra_data;            -- dup de obr_rdo_obra_id_data_key
DROP INDEX CONCURRENTLY IF EXISTS public.idx_log_viagens_numero;           -- dup de log_viagens_numero_key
DROP INDEX CONCURRENTLY IF EXISTS public.idx_portalteg_subs_endpoint;      -- dup de portalteg_push_subscriptions_endpoint_key

-- =====================================================================
-- ROLLBACK (recriar os índices avulsos, se necessário):
-- =====================================================================
/*
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apr_aprov_token ON public.apr_aprovacoes (token);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cmp_req_numero ON public.cmp_requisicoes (numero);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sys_perfis_auth_id ON public.sys_perfis (auth_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sys_config_chave ON public.sys_config (chave);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fornecedores_cnpj ON public.cmp_fornecedores (cnpj);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pat_imobilizados_receb_item ON public.pat_imobilizados (recebimento_item_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log_transp_solicitacao ON public.log_transportes (solicitacao_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_consultas_lookup ON public.cache_consultas (tipo, chave);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_obr_rdo_obra_data ON public.obr_rdo (obra_id, data);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log_viagens_numero ON public.log_viagens (numero);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portalteg_subs_endpoint ON public.portalteg_push_subscriptions (endpoint);
*/
