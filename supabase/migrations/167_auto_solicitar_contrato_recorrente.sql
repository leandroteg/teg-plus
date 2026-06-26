-- Auto-roteamento de RC recorrente para Contratos.
--
-- Regra de negocio: se a RC foi marcada como compra_recorrente, ao concluir a
-- cotacao (RC -> cotacao_aprovada) ela deve ir DIRETO para o modulo Contratos,
-- sem o comprador clicar "Solicitar Contrato" na fila de emissao.
--
-- Este trigger, na transicao para cotacao_aprovada de uma RC recorrente:
--   1. cria a solicitacao de contrato via con_criar_solicitacao (idempotente —
--      reusa se ja existir, nao duplica), puxando fornecedor/valor da cotacao
--      concluida mais recente;
--   2. move o status direto para 'aguardando_contrato' (pula a fila de pedido).
--
-- Default de prazo: 12 meses (editavel na elaboracao do contrato), espelhando
-- o que o formulario manual (SolicitarContratoForm) ja produzia.

CREATE OR REPLACE FUNCTION public.fn_auto_solicitar_contrato_recorrente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cot   record;
  v_mensal numeric;
  v_prazo  int := 12;
BEGIN
  -- so na transicao PARA cotacao_aprovada de uma RC recorrente
  IF NEW.compra_recorrente IS NOT TRUE
     OR NEW.status <> 'cotacao_aprovada'
     OR OLD.status IS NOT DISTINCT FROM 'cotacao_aprovada' THEN
    RETURN NEW;
  END IF;

  -- fornecedor/valor da cotacao concluida mais recente
  SELECT valor_selecionado, fornecedor_selecionado_nome, fornecedor_selecionado_id
    INTO v_cot
  FROM cmp_cotacoes
  WHERE requisicao_id = NEW.id AND status = 'concluida'
  ORDER BY data_conclusao DESC NULLS LAST
  LIMIT 1;

  v_mensal := coalesce(v_cot.valor_selecionado, NEW.valor_estimado, 0);

  -- cria solicitacao de contrato (idempotente)
  PERFORM con_criar_solicitacao(jsonb_build_object(
    'objeto',               coalesce(NEW.descricao, 'Contrato recorrente'),
    'solicitante_id',       NEW.solicitante_id,
    'solicitante_nome',     coalesce(NEW.solicitante_nome, 'Sistema'),
    'tipo_contraparte',     'fornecedor',
    'contraparte_nome',     coalesce(v_cot.fornecedor_selecionado_nome, 'A definir'),
    'tipo_contrato',        'despesa',
    'categoria_contrato',   'prestacao_servico',
    'grupo_contrato',       'prestacao_servicos',
    'obra_id',              NEW.obra_id,
    'centro_custo',         NEW.centro_custo,
    'classe_financeira',    NEW.classe_financeira,
    'valor_mensal',         v_mensal,
    'valor_estimado',       round(v_mensal * v_prazo, 2),
    'prazo_meses',          v_prazo,
    'recorrente',           true,
    'urgencia',             'normal',
    'etapa_atual',          'solicitacao',
    'status',               'em_andamento',
    'requisicao_origem_id', NEW.id
  ));

  -- vai direto para aguardando_contrato (pula fila de emissao de pedido)
  NEW.status := 'aguardando_contrato';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_solicitar_contrato_recorrente ON public.cmp_requisicoes;
CREATE TRIGGER trg_auto_solicitar_contrato_recorrente
  BEFORE UPDATE ON public.cmp_requisicoes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_solicitar_contrato_recorrente();
