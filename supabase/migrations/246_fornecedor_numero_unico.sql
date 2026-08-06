-- 245_fornecedor_numero_unico.sql
-- Numeracao de fornecedor colidia: em 06/08 CINCO numeros (FOR-01633/34/36/37/38)
-- foram entregues em duplicidade — a geracao le o max() no cliente, e duas telas
-- (ou tela + importacao) pegam o mesmo numero antes de gravar. As duplicatas
-- foram renumeradas na mao (FOR-01643..47).
--
-- Indice unico impede a proxima colisao; o trigger gera o numero NO BANCO
-- quando vier vazio, eliminando a corrida (max() e atribuicao na mesma
-- transacao do insert).

CREATE UNIQUE INDEX IF NOT EXISTS uq_cmp_fornecedores_numero_cadastro
  ON public.cmp_fornecedores (numero_cadastro)
  WHERE numero_cadastro IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_trg_fornecedor_numero_cadastro()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_prox int;
BEGIN
  IF NEW.numero_cadastro IS NULL OR btrim(NEW.numero_cadastro) = '' THEN
    SELECT coalesce(max(substring(numero_cadastro from 5)::int), 0) + 1 INTO v_prox
    FROM cmp_fornecedores
    WHERE numero_cadastro ~ '^FOR-[0-9]+$';
    NEW.numero_cadastro := 'FOR-' || lpad(v_prox::text, 5, '0');
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_fornecedor_numero_cadastro ON public.cmp_fornecedores;
CREATE TRIGGER trg_fornecedor_numero_cadastro
  BEFORE INSERT ON public.cmp_fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_fornecedor_numero_cadastro();
