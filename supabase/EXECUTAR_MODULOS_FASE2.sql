-- ══════════════════════════════════════════════════════════════════════════════
-- EXECUTAR_MODULOS_FASE2.sql — TEG+ ERP
-- Script master para aplicar TODOS os módulos pendentes
-- ══════════════════════════════════════════════════════════════════════════════
--
-- COMO EXECUTAR:
--   Opção A — Supabase SQL Editor:
--     Cole este arquivo no SQL Editor do Dashboard e clique em Run
--
--   Opção B — Linha de comando (máquina local):
--     psql "postgresql://postgres:SENHA@db.uzfjfucrinokeuwpbeie.supabase.co:5432/postgres" \
--          -f supabase/EXECUTAR_MODULOS_FASE2.sql
--
--   Opção C — Arquivo por arquivo (recomendado se der erro):
--     psql "..." -f supabase/011_schema_financeiro.sql
--     psql "..." -f supabase/012_fix_rls_perfis.sql
--     ... (continua abaixo)
--
-- ORDEM OBRIGATÓRIA (respeitar dependências):
-- ══════════════════════════════════════════════════════════════════════════════

-- ── FASE 1: Módulos já existentes no repo mas NÃO aplicados no banco ─────────
-- (verificar se já existem antes de rodar — usar: SELECT * FROM fin_contas_pagar LIMIT 1)

\echo '════════════════════════════════════════════'
\echo 'Aplicando 011_schema_financeiro.sql...'
\echo '════════════════════════════════════════════'
\ir 011_schema_financeiro.sql

\echo '════════════════════════════════════════════'
\echo 'Aplicando 012_fix_rls_perfis.sql...'
\echo '════════════════════════════════════════════'
\ir 012_fix_rls_perfis.sql

\echo '════════════════════════════════════════════'
\echo 'Aplicando 013_omie_integracao.sql...'
\echo '════════════════════════════════════════════'
\ir 013_omie_integracao.sql

\echo '════════════════════════════════════════════'
\echo 'Aplicando 014_fluxo_pagamento.sql...'
\echo '════════════════════════════════════════════'
\ir 014_fluxo_pagamento.sql

\echo '════════════════════════════════════════════'
\echo 'Aplicando 015_estoque_patrimonial.sql...'
\echo '════════════════════════════════════════════'
\ir 015_estoque_patrimonial.sql

\echo '════════════════════════════════════════════'
\echo 'Aplicando 016_logistica_transportes.sql...'
\echo '════════════════════════════════════════════'
\ir 016_logistica_transportes.sql

\echo '════════════════════════════════════════════'
\echo 'Aplicando 017_frotas_manutencao.sql...'
\echo '════════════════════════════════════════════'
\ir 017_frotas_manutencao.sql

\echo '════════════════════════════════════════════'
\echo 'Aplicando 018_mural_recados.sql...'
\echo '════════════════════════════════════════════'
\ir 018_mural_recados.sql

-- ── FASE 2: Novos módulos criados ─────────────────────────────────────────────

\echo '════════════════════════════════════════════'
\echo 'Aplicando 019_rh.sql (RH + Colaboradores)...'
\echo '════════════════════════════════════════════'
\ir 019_rh.sql

\echo '════════════════════════════════════════════'
\echo 'Aplicando 020_hht.sql (Homens-Hora Campo)...'
\echo '════════════════════════════════════════════'
\ir 020_hht.sql

\echo '════════════════════════════════════════════'
\echo 'Aplicando 021_ssma.sql (Segurança/SSMA)...'
\echo '════════════════════════════════════════════'
\ir 021_ssma.sql

\echo '════════════════════════════════════════════'
\echo 'Aplicando 022_contratos.sql (Contratos)...'
\echo '════════════════════════════════════════════'
\ir 022_contratos.sql

\echo '════════════════════════════════════════════'
\echo 'Aplicando 023_controladoria.sql (DRE/CEO)...'
\echo '════════════════════════════════════════════'
\ir 023_controladoria.sql

\echo '══════════════════════════════════════════════════'
\echo '✅ TODOS OS MÓDULOS APLICADOS COM SUCESSO!'
\echo '══════════════════════════════════════════════════'

-- ── Verificação final: lista tabelas criadas por módulo ───────────────────────
SELECT
  CASE
    WHEN table_name LIKE 'cmp_%' THEN '📦 Compras'
    WHEN table_name LIKE 'fin_%' THEN '💰 Financeiro'
    WHEN table_name LIKE 'est_%' THEN '🏭 Estoque'
    WHEN table_name LIKE 'pat_%' THEN '🏗️  Patrimonial'
    WHEN table_name LIKE 'log_%' THEN '🚚 Logística'
    WHEN table_name LIKE 'fro_%' THEN '🚗 Frotas'
    WHEN table_name LIKE 'mural_%' THEN '📢 Mural'
    WHEN table_name LIKE 'rh_%'  THEN '👥 RH'
    WHEN table_name LIKE 'hht_%' THEN '⏱️  HHt'
    WHEN table_name LIKE 'ssm_%' THEN '🦺 SSMA'
    WHEN table_name LIKE 'con_%' THEN '📋 Contratos'
    WHEN table_name LIKE 'ctrl_%' THEN '📊 Controladoria'
    WHEN table_name LIKE 'sys_%' THEN '⚙️  Sistema'
    WHEN table_name LIKE 'apr_%' THEN '✅ Aprovações'
    ELSE '❓ Outros'
  END AS modulo,
  COUNT(*) AS tabelas
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
GROUP BY modulo
ORDER BY modulo;
