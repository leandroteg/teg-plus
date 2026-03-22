-- Add grupo_contrato to con_contratos for filtering/tracking
ALTER TABLE con_contratos ADD COLUMN IF NOT EXISTS grupo_contrato TEXT DEFAULT 'outro';

UPDATE con_contratos SET grupo_contrato = CASE
  WHEN tipo_categoria IN ('locacao','locacao_imovel_alojamento','locacao_imovel_canteiro','locacao_imovel_deposito') THEN 'locacao_imovel'
  WHEN tipo_categoria = 'locacao_veiculos' THEN 'locacao_veiculos'
  WHEN tipo_categoria IN ('locacao_equipamentos','locacao_ferramental') THEN 'locacao_equipamentos'
  WHEN tipo_categoria = 'pj_pessoa_fisica' THEN 'equipe_pj'
  WHEN tipo_categoria = 'prestacao_servico' THEN 'prestacao_servicos'
  WHEN tipo_categoria IN ('vigilancia_monitoramento','software_ti','contabilidade','internet_telefonia','servicos_medicos') THEN 'servico_recorrente'
  WHEN tipo_categoria IN ('fornecimento','aquisicao_equipamentos','aquisicao_ferramental','aquisicao_imovel','aquisicao_veiculos') THEN 'aquisicao'
  WHEN tipo_categoria IN ('subcontratacao','empreitada') THEN 'subcontratacao_empreitada'
  WHEN tipo_categoria IN ('consultoria','juridico_advocacia') THEN 'consultoria_juridico'
  WHEN tipo_categoria IN ('alimentacao_restaurante','hospedagem','frete_transportes') THEN 'apoio_operacional'
  WHEN tipo_categoria = 'seguros' THEN 'seguros'
  ELSE 'outro'
END
WHERE grupo_contrato IS NULL OR grupo_contrato = 'outro';

-- Inherit from solicitacao when available
UPDATE con_contratos c SET grupo_contrato = s.grupo_contrato
FROM con_solicitacoes s WHERE c.solicitacao_id = s.id AND c.grupo_contrato = 'outro';

CREATE INDEX IF NOT EXISTS idx_con_contratos_grupo ON con_contratos(grupo_contrato);
