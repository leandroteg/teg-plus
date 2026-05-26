-- 107: triagem CD para RC (fase 1 - schema + seed)
-- RCs de categorias com passa_por_cd=true passam por triagem do CD Araxa
-- antes de seguir para validacao tecnica. Atendimento parcial item a item.

ALTER TABLE cmp_categorias
  ADD COLUMN IF NOT EXISTS passa_por_cd boolean NOT NULL DEFAULT false;

ALTER TABLE cmp_requisicao_itens
  ADD COLUMN IF NOT EXISTS qtd_atendida_cd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS atendimento_cd_em timestamptz;

-- Enum values em_triagem_cd e atendida_cd: aplicados via ALTER TYPE
-- (Postgres exige rodar fora de transacao -> migration manual).

UPDATE cmp_categorias
SET passa_por_cd = true
WHERE codigo IN (
  'ACO','ALIMENTACAO_CANTEIRO','CONCRETO','EPI_EPC_UNIFORME','EQUIPAMENTOS',
  'FERRAMENTAS','ITENS_ALOJAMENTO','MAT_ESCRITORIO_CD','OUTROS_MAT_OBRA',
  'PRODUTOS_LIMPEZA','MANUT_FROTA',
  'ALIMENTACAO','ALOJAMENTO','CENTRO_DIST','EPI_EPC','FERRAMENTAL',
  'FROTA_EQUIP','LOCACAO','MATERIAIS_OBRA','MOBILIZACAO'
);
