-- ══════════════════════════════════════════════════════════════════
-- TEG+ ERP · 006b_auth_fix_perfil.sql
-- Corrige: usuários criados antes do trigger + policy de INSERT
-- ══════════════════════════════════════════════════════════════════

-- 1. Permite que usuários autenticados insiram o próprio perfil
--    (necessário para auto-provisionamento no frontend)
DROP POLICY IF EXISTS "perfil_inserir_proprio" ON sys_perfis;
CREATE POLICY "perfil_inserir_proprio" ON sys_perfis
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = auth_id);


-- 2. Cria perfil para TODOS os usuários auth que ainda não têm sys_perfis
--    (corrige usuários existentes criados antes do trigger)
INSERT INTO public.sys_perfis (auth_id, nome, email, role, alcada_nivel, modulos)
SELECT
  u.id,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'nome'), ''),
    split_part(u.email, '@', 1)
  ) AS nome,
  u.email,
  'requisitante',
  0,
  '{"compras": true}'::jsonb
FROM auth.users u
LEFT JOIN public.sys_perfis p ON p.auth_id = u.id
WHERE p.id IS NULL   -- apenas quem ainda não tem perfil
  AND u.deleted_at IS NULL;


-- 3. Promove SEU usuário a admin (troque o email abaixo!)
-- ⚠️  EDITE O EMAIL ANTES DE RODAR ESTA PARTE:
-- UPDATE sys_perfis
-- SET role = 'admin',
--     alcada_nivel = 4,
--     modulos = '{"compras":true,"financeiro":true,"rh":true,"ssma":true,"estoque":true,"contratos":true}'::jsonb
-- WHERE email = 'SEU_EMAIL@teguniao.com.br';


-- Verificação: mostra todos os perfis criados
SELECT id, nome, email, role, alcada_nivel, ativo, created_at
FROM sys_perfis
ORDER BY created_at;
