-- =============================================================================
-- 063 · Corrige trigger fin_assign_numero_apontamento (WHERE id = 1 obrigatório)
-- =============================================================================

CREATE OR REPLACE FUNCTION fin_assign_numero_apontamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_numero     integer;
BEGIN
  -- Busca empresa do usuário via sys_perfis
  SELECT p.empresa_id INTO v_empresa_id
  FROM sys_perfis p
  WHERE p.auth_id = NEW.user_id
    AND p.ativo = true
  LIMIT 1;

  NEW.empresa_id := v_empresa_id;

  IF v_empresa_id IS NOT NULL THEN
    -- Incremento atômico por empresa
    INSERT INTO fin_seq_apontamentos (empresa_id, ultimo_numero)
    VALUES (v_empresa_id, 1)
    ON CONFLICT (empresa_id) DO UPDATE
      SET ultimo_numero = fin_seq_apontamentos.ultimo_numero + 1
    RETURNING ultimo_numero INTO v_numero;
  ELSE
    -- WHERE id = 1 obrigatório: Supabase bloqueia UPDATE sem WHERE clause
    UPDATE fin_seq_apontamentos_geral
    SET ultimo_numero = ultimo_numero + 1
    WHERE id = 1
    RETURNING ultimo_numero INTO v_numero;
  END IF;

  NEW.numero := v_numero;
  RETURN NEW;
END;
$$;
