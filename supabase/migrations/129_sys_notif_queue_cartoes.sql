-- ─────────────────────────────────────────────────────────────────────────────
-- 129_sys_notif_queue_cartoes.sql
--
-- Fila generica de notificacoes in-app (sys_notif_queue) + trigger que
-- enfileira notificacao pra cada portador quando aparece item novo na fatura
-- do cartao dele (fin_itens_fatura_cartao via OCR/n8n).
--
-- Front consome via Realtime + Notification API enquanto o usuario esta no
-- sistema. Push offline (com PWA fechada) entra no roadmap quando SERVICE
-- ROLE KEY estiver no vault — basta adicionar fn_processar_notif_queue_push
-- chamando send-push via pg_net.
-- ─────────────────────────────────────────────────────────────────────────────

-- Tabela generica de notificacoes (reutilizavel pra outros modulos depois)
CREATE TABLE IF NOT EXISTS public.sys_notif_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo          text NOT NULL,
  corpo           text,
  url             text,                          -- deep link in-app
  origem          text NOT NULL,                 -- ex: 'cartao_lancamento'
  origem_id       uuid,                          -- ex: fin_itens_fatura_cartao.id
  criada_em       timestamptz NOT NULL DEFAULT now(),
  vista_em        timestamptz,                   -- preenchido pelo front
  enviada_push_em timestamptz                    -- preenchido pelo cron de push offline
);

CREATE INDEX IF NOT EXISTS idx_sys_notif_queue_user_naovistas
  ON sys_notif_queue(user_id, criada_em DESC) WHERE vista_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_sys_notif_queue_origem
  ON sys_notif_queue(origem, origem_id);

-- RLS: usuario so ve as proprias notificacoes
ALTER TABLE public.sys_notif_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sys_notif_queue_select_proprias" ON public.sys_notif_queue;
CREATE POLICY "sys_notif_queue_select_proprias" ON public.sys_notif_queue
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "sys_notif_queue_update_proprias" ON public.sys_notif_queue;
CREATE POLICY "sys_notif_queue_update_proprias" ON public.sys_notif_queue
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger: ao inserir item na fatura do cartao, enfileira notificacao
-- pra cada portador ativo (fin_portadores_cartao.ativo=true) do cartao.
-- Itens duplicados sao filtrados por (origem='cartao_lancamento', origem_id).
CREATE OR REPLACE FUNCTION public.fn_notif_item_fatura_cartao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_cartao_label text;
  v_titulo text;
  v_corpo text;
BEGIN
  -- Compoe rotulo do cartao
  SELECT format('%s%s',
           coalesce(c.nome, c.bandeira, 'Cartao'),
           CASE WHEN c.ultimos4 IS NOT NULL THEN ' ****' || c.ultimos4 ELSE '' END)
    INTO v_cartao_label
  FROM fin_cartoes_credito c
  WHERE c.id = NEW.cartao_id;

  v_titulo := format('Novo lancamento - %s', coalesce(v_cartao_label, 'Cartao'));
  v_corpo  := format('%s - %s',
              coalesce(NEW.descricao, 'Lancamento'),
              to_char(coalesce(NEW.valor, 0), 'FM"R$" 999G999G990D00'));

  -- Insere 1 notificacao por portador ativo (evita duplicar com unique partial)
  INSERT INTO sys_notif_queue (user_id, titulo, corpo, url, origem, origem_id)
  SELECT p.user_id, v_titulo, v_corpo,
         format('/financeiro/conciliacao-cartoes?item=%s', NEW.id),
         'cartao_lancamento', NEW.id
  FROM fin_portadores_cartao p
  WHERE p.cartao_id = NEW.cartao_id
    AND p.ativo = true
    AND p.user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM sys_notif_queue q
      WHERE q.origem = 'cartao_lancamento'
        AND q.origem_id = NEW.id
        AND q.user_id = p.user_id
    );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_notif_item_fatura_cartao ON public.fin_itens_fatura_cartao;
CREATE TRIGGER tr_notif_item_fatura_cartao
  AFTER INSERT ON public.fin_itens_fatura_cartao
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notif_item_fatura_cartao();

COMMENT ON TABLE public.sys_notif_queue IS
  'Fila in-app de notificacoes por usuario. Front consome via Realtime + Notification API. Push offline entra via cron + send-push quando service role estiver disponivel.';
COMMENT ON FUNCTION public.fn_notif_item_fatura_cartao() IS
  'Trigger AFTER INSERT em fin_itens_fatura_cartao: enfileira notificacao pra cada portador ativo do cartao. Idempotente: nao duplica (origem, origem_id, user_id).';
