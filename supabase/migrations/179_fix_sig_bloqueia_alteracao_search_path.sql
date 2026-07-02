-- 179_fix_sig_bloqueia_alteracao_search_path.sql
-- sig_bloqueia_alteracao (trigger do modulo de assinatura, criado em 02/07)
-- ficou sem search_path fixo (advisor: function_search_path_mutable).
ALTER FUNCTION public.sig_bloqueia_alteracao() SET search_path = public;
