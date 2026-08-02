-- Sala Tecnica: nova etapa de analise de necessidade antes da triagem do CD.
-- Valor novo do enum em migration propria (nao pode ser usado na mesma transacao).
ALTER TYPE public.status_requisicao ADD VALUE IF NOT EXISTS 'em_analise_tecnica' BEFORE 'em_triagem_cd';
