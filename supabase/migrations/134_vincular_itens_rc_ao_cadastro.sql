-- ─────────────────────────────────────────────────────────────────────────────
-- 134_vincular_itens_rc_ao_cadastro.sql
--
-- Resolve item órfão na RC (sem est_item_id) automaticamente quando:
--   1) admin aprova um pré-cadastro de item (sys_pre_cadastros)
--   2) admin/script cria um est_itens manualmente que casa por descrição
--   3) catch-up retroativo (RPC publica fn_catchup_vinculacao_itens_orfaos)
--
-- Match por descricao normalizada (UPPER + unaccent), trim. Mesmo padrão do
-- ItemAutocomplete (front) e do banner de pré-cadastros.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Função core: vincula RCs órfãs com a mesma descrição normalizada a um
--    item_id específico. Retorna a contagem de itens vinculados.
CREATE OR REPLACE FUNCTION public.fn_vincular_itens_rc_ao_cadastro(
  p_descricao text,
  p_item_id   uuid
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_codigo text;
  v_norm text;
  v_count int := 0;
BEGIN
  IF p_descricao IS NULL OR length(trim(p_descricao)) = 0 OR p_item_id IS NULL THEN
    RETURN 0;
  END IF;

  v_norm := upper(public.unaccent(trim(p_descricao)));

  -- Carrega codigo do item pra preencher est_item_codigo também
  SELECT codigo INTO v_codigo FROM est_itens WHERE id = p_item_id;

  UPDATE cmp_requisicao_itens ri
     SET est_item_id      = p_item_id,
         item_estoque_id  = p_item_id,
         est_item_codigo  = coalesce(ri.est_item_codigo, v_codigo)
   WHERE (ri.est_item_id IS NULL OR ri.item_estoque_id IS NULL)
     AND upper(public.unaccent(coalesce(ri.descricao, ''))) = v_norm;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- 2) Trigger: AFTER UPDATE em sys_pre_cadastros. Quando um pré-cadastro
--    de 'itens' vira 'aprovado', tenta achar o est_itens recém-criado
--    (mesma descricao normalizada) e dispara a vinculação retroativa.
CREATE OR REPLACE FUNCTION public.tg_pre_cadastro_item_aprovado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_desc text;
  v_norm text;
  v_item_id uuid;
BEGIN
  -- Só age na transição pra aprovado e em entidade='itens'
  IF NEW.entidade <> 'itens' THEN RETURN NEW; END IF;
  IF NEW.status <> 'aprovado' THEN RETURN NEW; END IF;
  IF OLD.status = 'aprovado' THEN RETURN NEW; END IF;

  v_desc := NEW.dados->>'descricao';
  IF v_desc IS NULL OR length(trim(v_desc)) = 0 THEN RETURN NEW; END IF;
  v_norm := upper(public.unaccent(trim(v_desc)));

  -- Tenta achar o est_itens correspondente. Quando a aprovação cria o item,
  -- ele aparece com a mesma descrição padronizada.
  SELECT id INTO v_item_id
    FROM est_itens
   WHERE upper(public.unaccent(coalesce(descricao, ''))) = v_norm
     AND coalesce(ativo, true) = true
   ORDER BY created_at DESC NULLS LAST
   LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    PERFORM public.fn_vincular_itens_rc_ao_cadastro(v_desc, v_item_id);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_pre_cadastro_item_aprovado ON public.sys_pre_cadastros;
CREATE TRIGGER tr_pre_cadastro_item_aprovado
  AFTER UPDATE OF status ON public.sys_pre_cadastros
  FOR EACH ROW
  WHEN (NEW.status = 'aprovado' AND NEW.entidade = 'itens')
  EXECUTE FUNCTION public.tg_pre_cadastro_item_aprovado();

-- 3) RPC pública de catch-up: varre todos os órfãos atuais e tenta match
--    com est_itens já cadastrados. Retorna {vinculados, restantes}.
--    Pra ser executada uma vez agora pra processar os 141 matches existentes
--    e disponível pra reexecuções futuras (idempotente — só age em órfãos).
CREATE OR REPLACE FUNCTION public.fn_catchup_vinculacao_itens_orfaos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_vinculados int := 0;
  v_restantes int := 0;
BEGIN
  -- Update direto via JOIN — uma query única, segura, idempotente.
  WITH alvos AS (
    SELECT ri.id, i.id AS item_id, i.codigo AS item_codigo
      FROM cmp_requisicao_itens ri
      JOIN est_itens i
        ON upper(public.unaccent(coalesce(i.descricao, ''))) =
           upper(public.unaccent(coalesce(ri.descricao, '')))
     WHERE (ri.est_item_id IS NULL OR ri.item_estoque_id IS NULL)
       AND coalesce(i.ativo, true) = true
  ),
  upd AS (
    UPDATE cmp_requisicao_itens ri
       SET est_item_id      = a.item_id,
           item_estoque_id  = a.item_id,
           est_item_codigo  = coalesce(ri.est_item_codigo, a.item_codigo)
      FROM alvos a
     WHERE ri.id = a.id
    RETURNING ri.id
  )
  SELECT count(*) INTO v_vinculados FROM upd;

  SELECT count(*) INTO v_restantes
    FROM cmp_requisicao_itens
   WHERE est_item_id IS NULL AND item_estoque_id IS NULL;

  RETURN jsonb_build_object('vinculados', v_vinculados, 'restantes', v_restantes);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_vincular_itens_rc_ao_cadastro(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_pre_cadastro_item_aprovado() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_catchup_vinculacao_itens_orfaos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_catchup_vinculacao_itens_orfaos() TO authenticated;

COMMENT ON FUNCTION public.fn_vincular_itens_rc_ao_cadastro(text, uuid) IS
  'Vincula RCs orfas (cmp_requisicao_itens com est_item_id NULL) ao item passado, casando por descricao normalizada (UPPER+unaccent).';
COMMENT ON FUNCTION public.tg_pre_cadastro_item_aprovado() IS
  'Trigger AFTER UPDATE em sys_pre_cadastros: ao aprovar um item, vincula RCs orfas com a mesma descricao.';
COMMENT ON FUNCTION public.fn_catchup_vinculacao_itens_orfaos() IS
  'Catch-up retroativo: varre cmp_requisicao_itens orfaos e tenta match com est_itens ja cadastrados. Idempotente.';
