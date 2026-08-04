-- 209_edita_previsao_fin.sql
-- Edição de Pagamento Previsto (natureza previsao_pagamento, status previsto)
-- liberada para a equipe do Financeiro (pedido do user 04/ago).
--
-- Papel não serve como regra: das 5 pessoas, 2 são 'requisitante', 1 'gestor/
-- supervisor', 1 'gestor/equipe' e 1 'administrador/ceo'. Segue o padrão de
-- flag por perfil já usado em aprova_cancelamento_fin.
--
-- RLS não muda: rls_go_live_fin_contas_pagar_module_write já permite UPDATE a
-- quem acessa o módulo financeiro. O enforço fino é no frontend, como nas
-- demais flags (a coluna é a fonte de verdade, editável no AdminUsuarios).
-- Idempotente.

ALTER TABLE public.sys_perfis
  ADD COLUMN IF NOT EXISTS edita_previsao_fin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sys_perfis.edita_previsao_fin IS
  'Pode editar Pagamentos Previstos (CP natureza=previsao_pagamento em status previsto): valor, vencimento, descrição, CC, natureza orçamentária, desconto/imposto e anexos.';

UPDATE public.sys_perfis SET edita_previsao_fin = true
WHERE lower(email) IN (
  'lauany.carrara@teguniao.com.br',
  'naira.machado@teguniao.com.br',
  'jackeline.freire@teguniao.com.br',
  'eduarda.almodi@teguniao.com.br',
  'patricia.alves@teguniao.com.br'
);
