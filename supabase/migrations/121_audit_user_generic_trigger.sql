-- =====================================================================
-- Auditoria de usuário (criado_por_nome / atualizado_por_nome) genérica
-- Aplicada nos módulos go-live: cmp_*, fin_*, con_*, ti_*
-- =====================================================================

CREATE OR REPLACE FUNCTION public._audit_user_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nome
  FROM public.sys_perfis
  WHERE auth_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public._tg_stamp_audit_user()
RETURNS trigger
LANGUAGE plpgsql
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

DO $$
DECLARE
  r record;
  v_trigger_name text;
BEGIN
  FOR r IN
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND (t.table_name LIKE 'cmp_%'
        OR t.table_name LIKE 'fin_%'
        OR t.table_name LIKE 'con_%'
        OR t.table_name LIKE 'ti_%')
    ORDER BY t.table_name
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS criado_por_nome text', r.table_name);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS atualizado_por_nome text', r.table_name);

    v_trigger_name := 'tg_audit_user_' || r.table_name;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_trigger_name, r.table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public._tg_stamp_audit_user()',
      v_trigger_name, r.table_name
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public._audit_user_name IS
  'Retorna sys_perfis.nome do auth.uid() corrente. SECURITY DEFINER para contornar RLS de sys_perfis.';
COMMENT ON FUNCTION public._tg_stamp_audit_user IS
  'Trigger BEFORE INSERT/UPDATE: estampa criado_por_nome e atualizado_por_nome automaticamente nas tabelas dos módulos go-live.';
