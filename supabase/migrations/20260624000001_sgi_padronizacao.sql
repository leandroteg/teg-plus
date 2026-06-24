-- =====================================================================
-- Módulo SGI (Governança › Gestão) — FASE 1: Padronização (controle documental)
-- 100% ADITIVO: só CREATE de objetos novos (prefixo sgi_).
-- Reusa, sem modificar: can_access_modulo() e _tg_stamp_audit_user() (chamados),
-- sys_perfis/sys_obras/sys_centros_custo (FK). Bucket e policies NOVOS,
-- escopados a 'sgi-documentos' (não afetam nada existente).
-- =====================================================================

-- 1) DOCUMENTOS -------------------------------------------------------
CREATE TABLE IF NOT EXISTS sgi_documentos (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                   text UNIQUE,
  titulo                   text NOT NULL,
  descricao                text,
  tipo                     text NOT NULL DEFAULT 'procedimento'
                             CHECK (tipo IN ('politica','procedimento','instrucao','formulario','manual','outro')),
  area_processo            text,
  status                   text NOT NULL DEFAULT 'rascunho'
                             CHECK (status IN ('rascunho','em_revisao','em_aprovacao','vigente','obsoleto')),
  versao                   int  NOT NULL DEFAULT 1,
  requer_ciencia           boolean NOT NULL DEFAULT false,
  publico_alvo             jsonb NOT NULL DEFAULT '{"tipo":"todos"}'::jsonb,
  arquivo_url              text,
  arquivo_nome             text,
  proxima_revisao          date,
  periodicidade_revisao_meses int,
  responsavel_id           uuid REFERENCES sys_perfis(id),
  obra_id                  uuid REFERENCES sys_obras(id),
  centro_custo_id          uuid REFERENCES sys_centros_custo(id),
  vigente_em               timestamptz,
  obsoleto_em              timestamptz,
  empresa_id               uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- 2) HISTÓRICO DE VERSÕES (imutável — nunca sobrescreve) --------------
CREATE TABLE IF NOT EXISTS sgi_documento_versoes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id      uuid NOT NULL REFERENCES sgi_documentos(id) ON DELETE CASCADE,
  versao            int  NOT NULL,
  arquivo_url       text,
  arquivo_nome      text,
  motivo            text,
  alterado_por_id   uuid REFERENCES sys_perfis(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (documento_id, versao)
);

-- 3) FLUXO DE APROVAÇÃO (elaboração → revisão → aprovação) ------------
CREATE TABLE IF NOT EXISTS sgi_documento_aprovacoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id    uuid NOT NULL REFERENCES sgi_documentos(id) ON DELETE CASCADE,
  versao          int  NOT NULL DEFAULT 1,
  etapa           text NOT NULL CHECK (etapa IN ('elaboracao','revisao','aprovacao')),
  responsavel_id  uuid REFERENCES sys_perfis(id),
  decisao         text NOT NULL DEFAULT 'pendente' CHECK (decisao IN ('pendente','aprovado','reprovado')),
  observacao      text,
  decidido_em     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sgi_documentos_status ON sgi_documentos(status);
CREATE INDEX IF NOT EXISTS idx_sgi_doc_versoes_doc   ON sgi_documento_versoes(documento_id);
CREATE INDEX IF NOT EXISTS idx_sgi_doc_aprov_doc     ON sgi_documento_aprovacoes(documento_id);

-- 4) RLS: SELECT aberto a autenticado + escrita via can_access_modulo('sgi') ----
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sgi_documentos','sgi_documento_versoes','sgi_documento_aprovacoes'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true)', t||'_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_modulo_write', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (can_access_modulo(''sgi'', auth.uid())) WITH CHECK (can_access_modulo(''sgi'', auth.uid()))',
      t||'_modulo_write', t);
  END LOOP;
END $$;

-- 5) Auditoria (criado_por_nome/atualizado_por_nome) via trigger NOVO
--    chamando a função já existente _tg_stamp_audit_user() ------------
DO $$
DECLARE t text; v_trigger text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sgi_documentos','sgi_documento_versoes','sgi_documento_aprovacoes'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS criado_por_nome text', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS atualizado_por_nome text', t);
    v_trigger := 'tg_audit_user_'||t;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_trigger, t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public._tg_stamp_audit_user()', v_trigger, t);
  END LOOP;
END $$;

-- 6) Storage: bucket privado NOVO + policies escopadas (não afetam outros buckets)
INSERT INTO storage.buckets (id, name, public)
VALUES ('sgi-documentos','sgi-documentos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "sgi_documentos_obj_read" ON storage.objects;
CREATE POLICY "sgi_documentos_obj_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'sgi-documentos');
DROP POLICY IF EXISTS "sgi_documentos_obj_write" ON storage.objects;
CREATE POLICY "sgi_documentos_obj_write" ON storage.objects
  FOR ALL
  USING (bucket_id = 'sgi-documentos' AND can_access_modulo('sgi', auth.uid()))
  WITH CHECK (bucket_id = 'sgi-documentos' AND can_access_modulo('sgi', auth.uid()));

-- 7) RPC NOVO: próximo código por tipo (POL-001, PRO-014, IT-003…) ----
CREATE OR REPLACE FUNCTION public.sgi_proximo_codigo_documento(p_tipo text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_prefix text; v_seq int;
BEGIN
  v_prefix := CASE p_tipo
    WHEN 'politica'     THEN 'POL'
    WHEN 'procedimento' THEN 'PRO'
    WHEN 'instrucao'    THEN 'IT'
    WHEN 'formulario'   THEN 'FOR'
    WHEN 'manual'       THEN 'MAN'
    ELSE 'DOC' END;
  SELECT COALESCE(MAX((regexp_replace(codigo, '^[A-Z]+-', ''))::int), 0) + 1
    INTO v_seq
  FROM sgi_documentos
  WHERE codigo ~ ('^'||v_prefix||'-[0-9]+$');
  RETURN v_prefix || '-' || lpad(v_seq::text, 3, '0');
END $fn$;
