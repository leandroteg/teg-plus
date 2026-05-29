-- Hardening das funções de auditoria (migration 121):
-- 1) Fixa search_path em _tg_stamp_audit_user
-- 2) Torna _tg_stamp_audit_user SECURITY DEFINER (preserva chamada interna a
--    _audit_user_name mesmo após revoke)
-- 3) Revoga EXECUTE de PUBLIC/anon/authenticated nas duas funções: elas são
--    auxiliares internas, não devem aparecer no /rest/v1/rpc

CREATE OR REPLACE FUNCTION public._tg_stamp_audit_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  v_name := public._audit_user_name();

  IF TG_OP = 'INSERT' THEN
    IF NEW.criado_por_nome IS NULL THEN
      NEW.criado_por_nome := v_name;
    END IF;
    IF NEW.atualizado_por_nome IS NULL THEN
      NEW.atualizado_por_nome := v_name;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.atualizado_por_nome := COALESCE(v_name, NEW.atualizado_por_nome);
    IF NEW.criado_por_nome IS NULL AND OLD.criado_por_nome IS NOT NULL THEN
      NEW.criado_por_nome := OLD.criado_por_nome;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._audit_user_name()    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._audit_user_name()    FROM anon;
REVOKE EXECUTE ON FUNCTION public._audit_user_name()    FROM authenticated;

REVOKE EXECUTE ON FUNCTION public._tg_stamp_audit_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._tg_stamp_audit_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public._tg_stamp_audit_user() FROM authenticated;
