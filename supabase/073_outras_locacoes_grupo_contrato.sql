-- Contratos: inclui o grupo "outras_locacoes" e normaliza legados "Locação Geral"

-- 1) Permitir novo grupo nas tabelas de fluxo de contratos
ALTER TABLE con_solicitacoes
  DROP CONSTRAINT IF EXISTS chk_con_sol_grupo_contrato;

ALTER TABLE con_solicitacoes
  ADD CONSTRAINT chk_con_sol_grupo_contrato CHECK (
    grupo_contrato IN (
      'locacao_imovel',
      'locacao_veiculos',
      'locacao_equipamentos',
      'outras_locacoes',
      'equipe_pj',
      'prestacao_servicos',
      'servico_recorrente',
      'aquisicao',
      'subcontratacao_empreitada',
      'consultoria_juridico',
      'apoio_operacional',
      'seguros',
      'outro'
    )
  );

ALTER TABLE con_modelos_contrato
  DROP CONSTRAINT IF EXISTS chk_con_mod_grupo_contrato;

ALTER TABLE con_modelos_contrato
  ADD CONSTRAINT chk_con_mod_grupo_contrato CHECK (
    grupo_contrato IN (
      'locacao_imovel',
      'locacao_veiculos',
      'locacao_equipamentos',
      'outras_locacoes',
      'equipe_pj',
      'prestacao_servicos',
      'servico_recorrente',
      'aquisicao',
      'subcontratacao_empreitada',
      'consultoria_juridico',
      'apoio_operacional',
      'seguros',
      'outro'
    )
  );

-- 2) Normalização dos contratos que vieram com "Locação Geral"
UPDATE con_contratos
SET grupo_contrato = 'locacao_veiculos'
WHERE grupo_contrato ILIKE '%loca%geral%'
  AND (
    contraparte_nome ILIKE '%LOCALIZA FLEET%'
    OR contraparte_nome ILIKE '%TARCIANA%'
    OR contraparte_nome ILIKE '%TS LOCA%'
  );

UPDATE con_contratos
SET grupo_contrato = 'locacao_imovel'
WHERE grupo_contrato ILIKE '%loca%geral%'
  AND contraparte_nome ILIKE '%SILMA GORETE%';

UPDATE con_contratos
SET grupo_contrato = 'outras_locacoes'
WHERE grupo_contrato ILIKE '%loca%geral%';
