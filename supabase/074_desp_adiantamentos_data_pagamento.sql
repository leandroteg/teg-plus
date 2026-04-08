-- Adiciona campo data_pagamento em desp_adiantamentos
-- Permite que o solicitante informe a data desejada para o pagamento
ALTER TABLE desp_adiantamentos
  ADD COLUMN IF NOT EXISTS data_pagamento date;

COMMENT ON COLUMN desp_adiantamentos.data_pagamento IS
  'Data desejada para o pagamento, informada pelo solicitante';
