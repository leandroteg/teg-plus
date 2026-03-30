-- ============================================================
-- 068b_rbac_v2_rollback.sql
-- Rollback operacional rapido do RBAC v2 (nao destrutivo por default)
-- ============================================================

-- 1) Desliga o RBAC v2 (fallback imediato para legado)
UPDATE sys_config
SET valor = 'false',
    updated_at = now()
WHERE chave = 'rbac_v2_enabled';

-- 2) Opcional (destrutivo): remover vinculos setoriais
-- DELETE FROM sys_perfil_setores;

-- 3) Opcional (destrutivo): remover estruturas RBAC v2
-- DROP TABLE IF EXISTS sys_perfil_setores CASCADE;
-- DROP TABLE IF EXISTS sys_setores CASCADE;
-- ALTER TABLE sys_perfis DROP COLUMN IF EXISTS papel_global;
-- DROP FUNCTION IF EXISTS can_approve_tecnico(TEXT, UUID);
-- DROP FUNCTION IF EXISTS can_access_modulo(TEXT, UUID);
-- DROP FUNCTION IF EXISTS get_user_papel_global(UUID);
-- DROP FUNCTION IF EXISTS get_feature_flag(TEXT, BOOLEAN);

