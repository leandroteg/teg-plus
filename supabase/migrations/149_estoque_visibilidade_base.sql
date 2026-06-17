-- ============================================================================
-- Visibilidade por base no Estoque
-- ============================================================================
-- Estrategia: helper can_see_base() + politicas RESTRITIVAS (AND com as
-- permissivas existentes). Usuario com sys_perfis.base_id NULL continua
-- enxergando tudo (grandfather pro rollout). Admin e triador tambem.
-- Quem tiver base_id setado fica restrito ao proprio polo.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_see_base(_base_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT
    _base_id IS NULL
    OR public.is_admin()
    OR public.is_triador()
    OR EXISTS (
      SELECT 1 FROM sys_perfis p
      WHERE p.auth_id = auth.uid()
        AND (p.base_id IS NULL OR p.base_id = _base_id)
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_see_base(uuid) TO authenticated;

COMMENT ON FUNCTION public.can_see_base(uuid) IS
  'Visibilidade por base. _base_id NULL => sempre visivel. Admin/triador => tudo. sys_perfis.base_id NULL => tudo (grandfather). sys_perfis.base_id setado => so quando bate.';

-- est_saldos
DROP POLICY IF EXISTS est_saldos_base_restrict ON est_saldos;
CREATE POLICY est_saldos_base_restrict ON est_saldos
  AS RESTRICTIVE FOR ALL
  USING (public.can_see_base(base_id))
  WITH CHECK (public.can_see_base(base_id));

-- est_localizacoes
DROP POLICY IF EXISTS est_localizacoes_base_restrict ON est_localizacoes;
CREATE POLICY est_localizacoes_base_restrict ON est_localizacoes
  AS RESTRICTIVE FOR ALL
  USING (public.can_see_base(base_id))
  WITH CHECK (public.can_see_base(base_id));

-- est_movimentacoes: transferencia visivel se origem OU destino batem
DROP POLICY IF EXISTS est_movs_base_restrict ON est_movimentacoes;
CREATE POLICY est_movs_base_restrict ON est_movimentacoes
  AS RESTRICTIVE FOR ALL
  USING (public.can_see_base(base_id) OR public.can_see_base(base_destino_id))
  WITH CHECK (public.can_see_base(base_id));

-- est_inventarios
DROP POLICY IF EXISTS est_inventarios_base_restrict ON est_inventarios;
CREATE POLICY est_inventarios_base_restrict ON est_inventarios
  AS RESTRICTIVE FOR ALL
  USING (public.can_see_base(base_id))
  WITH CHECK (public.can_see_base(base_id));

-- est_inventario_itens
DROP POLICY IF EXISTS est_inventario_itens_base_restrict ON est_inventario_itens;
CREATE POLICY est_inventario_itens_base_restrict ON est_inventario_itens
  AS RESTRICTIVE FOR ALL
  USING (public.can_see_base(base_id))
  WITH CHECK (public.can_see_base(base_id));

-- est_cautelas
DROP POLICY IF EXISTS est_cautelas_base_restrict ON est_cautelas;
CREATE POLICY est_cautelas_base_restrict ON est_cautelas
  AS RESTRICTIVE FOR ALL
  USING (public.can_see_base(base_id))
  WITH CHECK (public.can_see_base(base_id));

-- est_solicitacoes: solicitante sempre ve a propria; demais filtram por base_destino
DROP POLICY IF EXISTS est_sol_base_restrict ON est_solicitacoes;
CREATE POLICY est_sol_base_restrict ON est_solicitacoes
  AS RESTRICTIVE FOR ALL
  USING (
    solicitante_id = (SELECT id FROM sys_perfis WHERE auth_id = auth.uid() LIMIT 1)
    OR public.can_see_base(base_destino_id)
  )
  WITH CHECK (
    solicitante_id = (SELECT id FROM sys_perfis WHERE auth_id = auth.uid() LIMIT 1)
    OR public.can_see_base(base_destino_id)
  );

-- est_solicitacao_itens: restringe via join no pai
DROP POLICY IF EXISTS est_si_base_restrict ON est_solicitacao_itens;
CREATE POLICY est_si_base_restrict ON est_solicitacao_itens
  AS RESTRICTIVE FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM est_solicitacoes s
      WHERE s.id = est_solicitacao_itens.solicitacao_id
        AND (
          s.solicitante_id = (SELECT id FROM sys_perfis WHERE auth_id = auth.uid() LIMIT 1)
          OR public.can_see_base(s.base_destino_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM est_solicitacoes s
      WHERE s.id = est_solicitacao_itens.solicitacao_id
        AND (
          s.solicitante_id = (SELECT id FROM sys_perfis WHERE auth_id = auth.uid() LIMIT 1)
          OR public.can_see_base(s.base_destino_id)
        )
    )
  );
