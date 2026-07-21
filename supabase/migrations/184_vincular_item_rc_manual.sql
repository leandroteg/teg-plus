-- ─────────────────────────────────────────────────────────────────────────────
-- 184_vincular_item_rc_manual.sql
--
-- Vínculo MANUAL de item órfão de RC a um item do catálogo, escolhido pelo
-- comprador — SEM depender de match de descrição.
--
-- Contexto: RC com item de descrição livre fica em 'aguardando_catalogo' (mig
-- 165). O vínculo automático (gatilho mig 166 + catch-up mig 134) casa por
-- descrição normalizada EXATA (upper+unaccent). Isso falha estruturalmente
-- quando o solicitante escreve marca/modelo no texto livre e o catálogo é
-- padronizado SEM marca — o texto nunca bate, e o comprador fica preso no loop
-- "cadastrei mas continua pedindo cadastro".
--
-- Esta RPC deixa o comprador apontar a linha da RC para o item de catálogo
-- correto (por id), encerrando a dependência de igualdade de texto.
--
-- Escopo/segurança: SECURITY DEFINER (escrita em cmp_requisicao_itens sob RLS).
--   • só admin ou comprador (mesmo público que enxerga o painel de catálogo);
--   • só RC em 'aguardando_catalogo';
--   • item de catálogo precisa existir e estar ativo.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_vincular_item_rc_manual(
  p_ri_id   uuid,
  p_item_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_codigo text;
  v_desc   text;
  v_status text;
  v_uid    uuid := auth.uid();
BEGIN
  IF p_ri_id IS NULL OR p_item_id IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes';
  END IF;

  -- Autorização: admin ou comprador (mesmo gate do painel de aguardando_catalogo)
  IF NOT (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM sys_perfis p
       WHERE p.auth_id = v_uid AND coalesce(p.comprador, false) = true
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para vincular itens (requer admin ou comprador)';
  END IF;

  -- Item de catálogo precisa existir e estar ativo
  SELECT codigo, descricao INTO v_codigo, v_desc
    FROM est_itens
   WHERE id = p_item_id AND coalesce(ativo, true) = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de catálogo inexistente ou inativo';
  END IF;

  -- Linha precisa existir e a RC estar em aguardando_catalogo
  SELECT r.status INTO v_status
    FROM cmp_requisicao_itens ri
    JOIN cmp_requisicoes r ON r.id = ri.requisicao_id
   WHERE ri.id = p_ri_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da requisição não encontrado';
  END IF;
  IF v_status <> 'aguardando_catalogo' THEN
    RAISE EXCEPTION 'RC não está em aguardando_catalogo (status atual: %)', v_status;
  END IF;

  UPDATE cmp_requisicao_itens
     SET est_item_id     = p_item_id,
         item_estoque_id = p_item_id,
         est_item_codigo = v_codigo
   WHERE id = p_ri_id;

  RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'codigo', v_codigo, 'descricao', v_desc);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_vincular_item_rc_manual(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_vincular_item_rc_manual(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.fn_vincular_item_rc_manual(uuid, uuid) IS
  'Vincula manualmente uma linha de cmp_requisicao_itens a um est_itens escolhido pelo comprador (por id, sem match de descrição). Só admin/comprador, só RC em aguardando_catalogo.';
