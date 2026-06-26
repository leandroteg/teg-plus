-- Auto-vinculacao de itens orfaos quando o item de catalogo e cadastrado.
--
-- Contexto: RC criada com item de descricao livre fica em 'aguardando_catalogo'
-- (mig 165). Hoje o comprador cadastra o item no catalogo e PRECISA voltar e
-- clicar "Ja cadastrei - Atualizar vinculos" (fn_catchup_vinculacao_itens_orfaos).
-- Isso depende do usuario lembrar de clicar.
--
-- Este trigger faz o vinculo automaticamente no momento do cadastro: ao inserir
-- um est_item, varre as RCs em 'aguardando_catalogo' e vincula qualquer item
-- orfao cuja descricao normalizada (upper+unaccent) seja igual — mesma regra de
-- match do botao. A aba da RC reflete sozinha (refetchOnWindowFocus).
--
-- Escopo proposital: SO toca itens de RC em 'aguardando_catalogo' (o botao
-- catch-up e global; o trigger e conservador por rodar silenciosamente).

CREATE OR REPLACE FUNCTION public.fn_autovincular_orfaos_no_cadastro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Short-circuit barato: so processa se ha RC esperando catalogo
  IF coalesce(NEW.ativo, true) = false
     OR NEW.descricao IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.cmp_requisicoes WHERE status = 'aguardando_catalogo') THEN
    RETURN NEW;
  END IF;

  UPDATE public.cmp_requisicao_itens ri
     SET est_item_id     = NEW.id,
         item_estoque_id = NEW.id,
         est_item_codigo = coalesce(ri.est_item_codigo, NEW.codigo)
    FROM public.cmp_requisicoes r
   WHERE r.id = ri.requisicao_id
     AND r.status = 'aguardando_catalogo'
     AND (ri.est_item_id IS NULL OR ri.item_estoque_id IS NULL)
     AND upper(public.unaccent(coalesce(ri.descricao, ''))) =
         upper(public.unaccent(coalesce(NEW.descricao, '')));

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_autovincular_orfaos ON public.est_itens;
CREATE TRIGGER trg_autovincular_orfaos
  AFTER INSERT ON public.est_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_autovincular_orfaos_no_cadastro();
