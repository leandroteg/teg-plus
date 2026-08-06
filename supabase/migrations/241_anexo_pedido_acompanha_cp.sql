-- 241_anexo_pedido_acompanha_cp.sql
-- Anexo lancado na origem acompanha o documento ate o fim do processo.
--
-- Anexo do Pedido (NF, boleto, comprovante) ficava so em cmp_pedidos_anexos.
-- Quem paga, no Financeiro, nao via nada: em 06/08/2026 havia 40 pedidos com
-- anexo e apenas 1 CP com documento. Foi uma lacuna desse tipo que escondeu o
-- favorecido errado das faturas de agua/energia da Locacao — o beneficiario
-- estava impresso no boleto que nunca chegava a quem paga (ver mig 240).
--
-- Compras usa o bucket 'pedidos-anexos', que e PUBLICO: basta referenciar a
-- mesma URL em fin_documentos, sem duplicar arquivo. A Locacao precisa copiar o
-- arquivo, porque 'locacao-faturas' e privado — isso fica na edge function
-- loc-boleto-para-cp, chamada pelo envio de faturas ao financeiro.
--
-- Dois gatilhos porque a ordem varia: as vezes o anexo chega antes da CP
-- (recebimento -> financeiro), as vezes depois (CP criada e a NF anexada
-- depois). Idempotente pela URL.

CREATE OR REPLACE FUNCTION public.fn_espelhar_anexo_pedido_em_cp(
  p_cp_id uuid,
  p_pedido_id uuid
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_a RECORD;
  v_criados int := 0;
BEGIN
  IF p_cp_id IS NULL OR p_pedido_id IS NULL THEN RETURN 0; END IF;

  FOR v_a IN
    SELECT a.tipo, a.nome_arquivo, a.url, a.mime_type, a.tamanho_bytes
    FROM cmp_pedidos_anexos a
    WHERE a.pedido_id = p_pedido_id AND a.url IS NOT NULL
  LOOP
    IF EXISTS (
      SELECT 1 FROM fin_documentos d
      WHERE d.entity_type = 'cp' AND d.entity_id = p_cp_id AND d.arquivo_url = v_a.url
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO fin_documentos (
      entity_type, entity_id, tipo, nome_arquivo, arquivo_url, mime_type, tamanho_bytes
    ) VALUES (
      'cp', p_cp_id,
      CASE v_a.tipo
        WHEN 'nota_fiscal' THEN 'nota_fiscal'
        WHEN 'boleto' THEN 'boleto'
        WHEN 'comprovante_pagamento' THEN 'comprovante'
        ELSE 'outro'
      END,
      coalesce(v_a.nome_arquivo, 'Anexo do pedido'),
      v_a.url, v_a.mime_type, v_a.tamanho_bytes
    );
    v_criados := v_criados + 1;
  END LOOP;

  RETURN v_criados;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_trg_anexo_pedido_para_cps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_cp RECORD;
BEGIN
  FOR v_cp IN SELECT id FROM fin_contas_pagar WHERE pedido_id = NEW.pedido_id
  LOOP
    PERFORM fn_espelhar_anexo_pedido_em_cp(v_cp.id, NEW.pedido_id);
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_anexo_pedido_para_cps ON public.cmp_pedidos_anexos;
CREATE TRIGGER trg_anexo_pedido_para_cps
  AFTER INSERT ON public.cmp_pedidos_anexos
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_anexo_pedido_para_cps();

CREATE OR REPLACE FUNCTION public.fn_trg_cp_puxa_anexos_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.pedido_id IS NOT NULL THEN
    PERFORM fn_espelhar_anexo_pedido_em_cp(NEW.id, NEW.pedido_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cp_puxa_anexos_pedido ON public.fin_contas_pagar;
CREATE TRIGGER trg_cp_puxa_anexos_pedido
  AFTER INSERT ON public.fin_contas_pagar
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_cp_puxa_anexos_pedido();

DO $backfill$
DECLARE v_cp RECORD; v_total int := 0;
BEGIN
  FOR v_cp IN SELECT id, pedido_id FROM fin_contas_pagar WHERE pedido_id IS NOT NULL
  LOOP
    v_total := v_total + fn_espelhar_anexo_pedido_em_cp(v_cp.id, v_cp.pedido_id);
  END LOOP;
  RAISE NOTICE 'anexos espelhados: %', v_total;
END
$backfill$;
