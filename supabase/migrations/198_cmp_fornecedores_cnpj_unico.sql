-- ─────────────────────────────────────────────────────────────────────────────
-- 198_cmp_fornecedores_cnpj_unico.sql
--
-- Fornecedor duplicado por CNPJ: o mesmo CNPJ era salvo ora com máscara
-- (19.887.731/0001-29) ora só dígitos (19887731000129), e sem constraint —
-- 5 CNPJs estavam cadastrados 2x (TEG matriz, Mercearia Centro Rio, Hotel
-- Mariana, IMA EPI's, Lux Auto Center).
--
-- 1) Funde as duplicatas: mantém o registro com movimento (pedidos/CPs/NFs;
--    empate → o mais antigo), copia campos faltantes do descartado e reaponta
--    todas as FKs antes de excluir.
-- 2) Normaliza o formato: CNPJ passa a ser SEMPRE gravado com máscara padrão
--    (trigger BEFORE INSERT/UPDATE).
-- 3) Índice ÚNICO por dígitos do CNPJ — impede duplicar de vez, em qualquer
--    formato de entrada. Frontend (useSalvarFornecedor) mostra erro amigável.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Fusão das duplicatas conhecidas
DO $$
DECLARE
  par record;
  fk record;
  v_keep uuid;
  v_lose uuid;
BEGIN
  FOR par IN
    SELECT * FROM (VALUES
      ('11188161000177', false),  -- Mercearia: mantém o antigo (tem pedidos/CPs)
      ('11931884000114', true),   -- Hotel Mariana: mantém o novo (tem pedido)
      ('12463472000240', true),   -- IMA: mantém o novo (dados bancários + razão completa)
      ('19887731000129', false),  -- TEG matriz: mantém o antigo (TEG CONSTRUCOES)
      ('54800996000149', true)    -- Lux: mantém o novo (tem pedido/CP)
    ) AS t(digits, keep_newest)
  LOOP
    IF par.keep_newest THEN
      SELECT id INTO v_keep FROM cmp_fornecedores
       WHERE regexp_replace(coalesce(cnpj,''), '\D', '', 'g') = par.digits
       ORDER BY created_at DESC LIMIT 1;
    ELSE
      SELECT id INTO v_keep FROM cmp_fornecedores
       WHERE regexp_replace(coalesce(cnpj,''), '\D', '', 'g') = par.digits
       ORDER BY created_at ASC LIMIT 1;
    END IF;

    SELECT id INTO v_lose FROM cmp_fornecedores
     WHERE regexp_replace(coalesce(cnpj,''), '\D', '', 'g') = par.digits
       AND id <> v_keep
     LIMIT 1;
    CONTINUE WHEN v_keep IS NULL OR v_lose IS NULL;

    -- Completa campos vazios do mantido com os do descartado
    UPDATE cmp_fornecedores k SET
      nome_fantasia      = coalesce(nullif(k.nome_fantasia, ''), l.nome_fantasia),
      razao_social       = coalesce(nullif(k.razao_social, ''), l.razao_social),
      inscricao_estadual = coalesce(nullif(k.inscricao_estadual, ''), l.inscricao_estadual),
      endereco           = coalesce(nullif(k.endereco, ''), l.endereco),
      cidade             = coalesce(nullif(k.cidade, ''), l.cidade),
      uf                 = coalesce(nullif(k.uf, ''), l.uf),
      cep                = coalesce(nullif(k.cep, ''), l.cep),
      telefone           = coalesce(nullif(k.telefone, ''), l.telefone),
      email              = coalesce(nullif(k.email, ''), l.email),
      contato_nome       = coalesce(nullif(k.contato_nome, ''), l.contato_nome),
      banco_codigo       = coalesce(nullif(k.banco_codigo, ''), l.banco_codigo),
      banco_nome         = coalesce(nullif(k.banco_nome, ''), l.banco_nome),
      agencia            = coalesce(nullif(k.agencia, ''), l.agencia),
      conta              = coalesce(nullif(k.conta, ''), l.conta),
      tipo_conta         = coalesce(nullif(k.tipo_conta, ''), l.tipo_conta),
      pix_chave          = coalesce(nullif(k.pix_chave, ''), l.pix_chave),
      pix_tipo           = coalesce(nullif(k.pix_tipo, ''), l.pix_tipo),
      segmento           = coalesce(nullif(k.segmento, ''), l.segmento),
      boleto             = coalesce(k.boleto, false) OR coalesce(l.boleto, false),
      cartao             = coalesce(k.cartao, false) OR coalesce(l.cartao, false)
    FROM cmp_fornecedores l
    WHERE k.id = v_keep AND l.id = v_lose;

    -- Reaponta TODAS as FKs que referenciam cmp_fornecedores (dinâmico pelo
    -- catálogo — tolerante a drift de schema entre homolog e prod)
    FOR fk IN
      SELECT c.conrelid::regclass AS tabela, a.attname AS coluna
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = any(c.conkey)
      WHERE c.confrelid = 'cmp_fornecedores'::regclass
    LOOP
      EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', fk.tabela, fk.coluna, fk.coluna)
        USING v_keep, v_lose;
    END LOOP;

    DELETE FROM cmp_fornecedores WHERE id = v_lose;
  END LOOP;
END $$;

-- 2) Normaliza o formato de TODOS os CNPJs válidos para a máscara padrão
UPDATE cmp_fornecedores
   SET cnpj = regexp_replace(
                regexp_replace(cnpj, '\D', '', 'g'),
                '^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$',
                '\1.\2.\3/\4-\5')
 WHERE cnpj IS NOT NULL
   AND length(regexp_replace(cnpj, '\D', '', 'g')) = 14;

-- Trigger: qualquer INSERT/UPDATE grava o CNPJ já com máscara
CREATE OR REPLACE FUNCTION public.cmp_fornecedores_normaliza_cnpj()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_digits text;
BEGIN
  IF NEW.cnpj IS NOT NULL THEN
    v_digits := regexp_replace(NEW.cnpj, '\D', '', 'g');
    IF length(v_digits) = 14 THEN
      NEW.cnpj := regexp_replace(v_digits, '^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$', '\1.\2.\3/\4-\5');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cmp_fornecedores_normaliza_cnpj ON public.cmp_fornecedores;
CREATE TRIGGER trg_cmp_fornecedores_normaliza_cnpj
  BEFORE INSERT OR UPDATE OF cnpj ON public.cmp_fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.cmp_fornecedores_normaliza_cnpj();

-- 3) Nunca mais: índice único por dígitos (vale para qualquer formato de entrada)
CREATE UNIQUE INDEX IF NOT EXISTS cmp_fornecedores_cnpj_digits_uniq
  ON public.cmp_fornecedores ((regexp_replace(cnpj, '\D', '', 'g')))
  WHERE cnpj IS NOT NULL AND regexp_replace(cnpj, '\D', '', 'g') <> '';

COMMENT ON INDEX public.cmp_fornecedores_cnpj_digits_uniq IS
  'Um fornecedor por CNPJ (comparado por dígitos, independente de máscara). Frontend traduz a violação em mensagem amigável (useSalvarFornecedor).';
