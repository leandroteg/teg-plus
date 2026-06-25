-- Status por meta/KR: acompanhamento (check-in) e resultado (revisão). Aditivo.
ALTER TABLE sgi_metas ADD COLUMN IF NOT EXISTS status_checkin text NOT NULL DEFAULT 'aberto'
  CHECK (status_checkin IN ('aberto','encerrado','cancelado'));
ALTER TABLE sgi_metas ADD COLUMN IF NOT EXISTS status_revisao text
  CHECK (status_revisao IN ('atingida','parcial','nao_atingida','cancelada'));
