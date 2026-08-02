-- Carimbo da ETAPA em que a RC foi devolvida ao solicitante, p/ nomenclatura
-- correta na UI: 'validacao_tecnica' (Sala Tecnica) ou 'cotacao' (comprador).
-- Legado fica NULL → rotulo neutro "Devolvida para Correcao".
ALTER TABLE public.cmp_requisicoes ADD COLUMN IF NOT EXISTS devolucao_etapa text;
