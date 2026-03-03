-- ══════════════════════════════════════════════════════════════════════════════
-- 012_fix_rls_perfis.sql
-- Corrige recursão infinita nas policies de sys_perfis.
--
-- PROBLEMA: admin_read_all_perfis e admin_update_all_perfis fazem um EXISTS
-- (SELECT 1 FROM sys_perfis ...) dentro de uma policy DE sys_perfis.
-- Isso pode causar "infinite recursion detected in policy for relation sys_perfis"
-- no Postgres, resultando em perfil = null no frontend (mostra "Usuário").
--
-- SOLUÇÃO: Substituir o EXISTS inline pela função is_admin() que usa
-- SECURITY DEFINER (bypassa RLS ao consultar sys_perfis internamente).
-- A função is_admin() já existe — criada em 009_admin_rls_fix.sql.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Remover policies problemáticas
DROP POLICY IF EXISTS admin_read_all_perfis  ON sys_perfis;
DROP POLICY IF EXISTS admin_update_all_perfis ON sys_perfis;
DROP POLICY IF EXISTS admin_delete_perfis    ON sys_perfis;
DROP POLICY IF EXISTS perfil_ver_proprio     ON sys_perfis;
DROP POLICY IF EXISTS perfil_editar_proprio  ON sys_perfis;
DROP POLICY IF EXISTS admin_full_perfis      ON sys_perfis;

-- 2. SELECT: admin vê todos, usuário normal vê apenas o próprio
--    Usa is_admin() (SECURITY DEFINER) → sem recursão
CREATE POLICY rls_perfis_select ON sys_perfis
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR auth_id = auth.uid()
  );

-- 3. UPDATE: admin atualiza qualquer um, usuário edita apenas o próprio
CREATE POLICY rls_perfis_update ON sys_perfis
  FOR UPDATE TO authenticated
  USING (is_admin() OR auth_id = auth.uid())
  WITH CHECK (is_admin() OR auth_id = auth.uid());

-- 4. INSERT: usuário insere apenas o próprio (trigger usa SECURITY DEFINER, dispensa)
DROP POLICY IF EXISTS perfil_inserir_proprio ON sys_perfis;
CREATE POLICY rls_perfis_insert ON sys_perfis
  FOR INSERT TO authenticated
  WITH CHECK (auth_id = auth.uid());

-- 5. DELETE: somente admin
CREATE POLICY rls_perfis_delete ON sys_perfis
  FOR DELETE TO authenticated
  USING (is_admin());

-- 6. Corrigir convites da mesma forma
DROP POLICY IF EXISTS admin_full_convites ON sys_convites;
CREATE POLICY rls_convites_all ON sys_convites
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Verificação
SELECT policyname, cmd, qual::text AS using_expr
FROM pg_policies
WHERE tablename = 'sys_perfis'
ORDER BY cmd, policyname;
