-- ============================================================
-- 009_admin_rls_fix.sql
-- Corrige RLS de sys_perfis para admin ver todos os perfis
-- Adiciona convite de usuários e melhorias de admin
-- ============================================================

-- 1. Remover policies conflitantes/duplicadas existentes
--    A policy admin_full_perfis (FOR ALL) conflita com perfil_ver_proprio (FOR SELECT)
--    porque ambas disputam o SELECT: o admin passa pelo admin_full mas o usuário normal
--    pode cair num conflito de WITH CHECK ausente em UPDATE via admin_full.
DROP POLICY IF EXISTS perfil_ver_proprio ON sys_perfis;
DROP POLICY IF EXISTS perfil_editar_proprio ON sys_perfis;
DROP POLICY IF EXISTS admin_full_perfis ON sys_perfis;
DROP POLICY IF EXISTS admin_read_all_perfis ON sys_perfis;
DROP POLICY IF EXISTS admin_update_all_perfis ON sys_perfis;

-- 2. Policy SELECT: admin vê todos, usuário normal vê só o próprio
CREATE POLICY admin_read_all_perfis ON sys_perfis
  FOR SELECT
  TO authenticated
  USING (
    -- Admin pode ver tudo
    EXISTS (
      SELECT 1 FROM sys_perfis p
      WHERE p.auth_id = auth.uid()
        AND p.role = 'admin'
        AND p.ativo = true
    )
    OR
    -- Usuário normal vê apenas o próprio
    auth_id = auth.uid()
  );

-- 3. Policy UPDATE: admin atualiza qualquer perfil, usuário edita apenas o próprio
CREATE POLICY admin_update_all_perfis ON sys_perfis
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sys_perfis p
      WHERE p.auth_id = auth.uid()
        AND p.role = 'admin'
        AND p.ativo = true
    )
    OR auth_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sys_perfis p
      WHERE p.auth_id = auth.uid()
        AND p.role = 'admin'
        AND p.ativo = true
    )
    OR auth_id = auth.uid()
  );

-- 4. Policy INSERT: apenas o próprio usuário insere o seu registro
--    (trigger handle_new_auth_user usa SECURITY DEFINER, portanto dispensa policy)
DROP POLICY IF EXISTS perfil_inserir_proprio ON sys_perfis;
CREATE POLICY perfil_inserir_proprio ON sys_perfis
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_id = auth.uid());

-- 5. Policy DELETE: somente admin pode deletar perfis
DROP POLICY IF EXISTS admin_delete_perfis ON sys_perfis;
CREATE POLICY admin_delete_perfis ON sys_perfis
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sys_perfis p
      WHERE p.auth_id = auth.uid()
        AND p.role = 'admin'
        AND p.ativo = true
    )
  );

-- 6. Garantir que a policy de convites também está correta
DROP POLICY IF EXISTS admin_full_convites ON sys_convites;
CREATE POLICY admin_full_convites ON sys_convites
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sys_perfis p
      WHERE p.auth_id = auth.uid()
        AND p.role = 'admin'
        AND p.ativo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sys_perfis p
      WHERE p.auth_id = auth.uid()
        AND p.role = 'admin'
        AND p.ativo = true
    )
  );

-- 7. Função helper para verificar se usuário autenticado é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sys_perfis
    WHERE auth_id = auth.uid()
      AND role = 'admin'
      AND ativo = true
  );
$$;

-- 8. Verificação final: listar policies ativas em sys_perfis
SELECT
  policyname,
  cmd,
  permissive,
  roles,
  qual::text AS using_expr
FROM pg_policies
WHERE tablename = 'sys_perfis'
ORDER BY cmd, policyname;
