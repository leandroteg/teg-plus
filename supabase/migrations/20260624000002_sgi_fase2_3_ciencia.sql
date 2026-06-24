-- =====================================================================
-- Módulo SGI — FASE 2 (Melhoria Contínua/PDCA) + FASE 3 (Objetivos e Metas)
-- + RPCs de Ciência (Padronização → Missões do Portal).
-- 100% ADITIVO. Reusa (sem alterar): can_access_modulo, _tg_stamp_audit_user,
-- portalteg_missoes (INSERT), rh_colaboradores/sys_obras/sys_perfis (FK/leitura).
-- =====================================================================

-- ───────── FASE 2: Melhoria Contínua (PDCA) ─────────
CREATE TABLE IF NOT EXISTS sgi_registros (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        text UNIQUE,
  tipo          text NOT NULL DEFAULT 'anomalia'
                  CHECK (tipo IN ('anomalia','falha','desvio','quase_acidente','reclamacao','oportunidade')),
  origem        text NOT NULL DEFAULT 'campo'
                  CHECK (origem IN ('campo','auditoria','cliente','meta','inspecao','outro')),
  gravidade     text NOT NULL DEFAULT 'media' CHECK (gravidade IN ('baixa','media','alta','critica')),
  area_processo text,
  obra_id       uuid REFERENCES sys_obras(id),
  titulo        text NOT NULL,
  descricao     text,
  evidencia_url text,
  status_pdca   text NOT NULL DEFAULT 'pendente'
                  CHECK (status_pdca IN ('pendente','analise_causa','plano_acao','execucao','verificacao','encerrado')),
  classificacao text NOT NULL DEFAULT 'pendente'
                  CHECK (classificacao IN ('pendente','nc','registro','dispensado')),
  responsavel_id uuid REFERENCES sys_perfis(id),
  prazo         date,
  encerrado_em  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sgi_analise_causa (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id    uuid NOT NULL REFERENCES sgi_registros(id) ON DELETE CASCADE,
  metodo         text NOT NULL DEFAULT '5porques' CHECK (metodo IN ('5porques','ishikawa','outro')),
  conteudo       jsonb NOT NULL DEFAULT '{}'::jsonb,
  causa_raiz     text,
  analisado_por_id uuid REFERENCES sys_perfis(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sgi_acoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_tipo   text NOT NULL DEFAULT 'registro'
                  CHECK (origem_tipo IN ('registro','meta','achado_auditoria','inspecao','avulsa')),
  origem_id     uuid,
  titulo        text NOT NULL,
  descricao     text,
  responsavel_id uuid REFERENCES sys_perfis(id),
  prazo         date,
  sla_horas     int,
  status        text NOT NULL DEFAULT 'aberta'
                  CHECK (status IN ('aberta','em_execucao','concluida','cancelada')),
  escalonado    boolean NOT NULL DEFAULT false,
  evidencia_url text,
  concluida_em  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sgi_verificacao (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id   uuid NOT NULL REFERENCES sgi_registros(id) ON DELETE CASCADE,
  eficaz        boolean,
  evidencia     text,
  observacao    text,
  verificado_por_id uuid REFERENCES sys_perfis(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ───────── FASE 3: Objetivos e Metas ─────────
CREATE TABLE IF NOT EXISTS sgi_objetivos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano           int NOT NULL,
  titulo        text NOT NULL,
  descricao     text,
  area_processo text,
  responsavel_id uuid REFERENCES sys_perfis(id),
  indicador     text,
  unidade       text,
  direcao       text NOT NULL DEFAULT 'maior_melhor' CHECK (direcao IN ('maior_melhor','menor_melhor')),
  status        text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','concluido','cancelado')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sgi_metas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objetivo_id  uuid NOT NULL REFERENCES sgi_objetivos(id) ON DELETE CASCADE,
  periodo      text NOT NULL DEFAULT 'anual' CHECK (periodo IN ('anual','trimestral')),
  trimestre    int CHECK (trimestre BETWEEN 1 AND 4),
  ano          int NOT NULL,
  alvo         numeric,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sgi_metas_checkin (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id       uuid NOT NULL REFERENCES sgi_metas(id) ON DELETE CASCADE,
  competencia   text NOT NULL,
  realizado     numeric,
  farol         text CHECK (farol IN ('verde','amarelo','vermelho','cinza')),
  observacao    text,
  registrado_por_id uuid REFERENCES sys_perfis(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meta_id, competencia)
);

CREATE INDEX IF NOT EXISTS idx_sgi_registros_status ON sgi_registros(status_pdca);
CREATE INDEX IF NOT EXISTS idx_sgi_acoes_status ON sgi_acoes(status);
CREATE INDEX IF NOT EXISTS idx_sgi_acoes_origem ON sgi_acoes(origem_tipo, origem_id);
CREATE INDEX IF NOT EXISTS idx_sgi_metas_obj ON sgi_metas(objetivo_id);
CREATE INDEX IF NOT EXISTS idx_sgi_checkin_meta ON sgi_metas_checkin(meta_id);

-- ───────── RLS + Auditoria (todas as novas) ─────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sgi_registros','sgi_analise_causa','sgi_acoes','sgi_verificacao','sgi_objetivos','sgi_metas','sgi_metas_checkin'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true)', t||'_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_modulo_write', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (can_access_modulo(''sgi'', auth.uid())) WITH CHECK (can_access_modulo(''sgi'', auth.uid()))', t||'_modulo_write', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS criado_por_nome text', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS atualizado_por_nome text', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'tg_audit_user_'||t, t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public._tg_stamp_audit_user()', 'tg_audit_user_'||t, t);
  END LOOP;
END $$;

-- ───────── RPCs ─────────
-- código de registro (RG-001)
CREATE OR REPLACE FUNCTION public.sgi_proximo_codigo_registro()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $fn$
  SELECT 'RG-'||lpad((COALESCE(MAX((regexp_replace(codigo,'^RG-',''))::int),0)+1)::text,3,'0')
  FROM sgi_registros WHERE codigo ~ '^RG-[0-9]+$';
$fn$;

-- Ciência: publicar documento -> vigente + cria missões de ciência no Portal
CREATE OR REPLACE FUNCTION public.sgi_documento_publicar(p_documento_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_doc sgi_documentos; v_count int := 0; v_total int := 0;
BEGIN
  SELECT * INTO v_doc FROM sgi_documentos WHERE id = p_documento_id;
  IF v_doc.id IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','documento não encontrado'); END IF;

  UPDATE sgi_documentos SET status='vigente', vigente_em=COALESCE(vigente_em, now()), updated_at=now()
   WHERE id = p_documento_id AND status <> 'obsoleto';

  IF v_doc.requer_ciencia THEN
    INSERT INTO portalteg_missoes (colaborador_id, categoria, titulo, descricao, status, prazo, acao_url, acao_label, metadata)
    SELECT c.id, 'documento_ciencia',
           'Ciência: '||v_doc.titulo,
           COALESCE(v_doc.descricao, 'Leia e confirme ciência do documento '||COALESCE(v_doc.codigo,'')),
           'pendente',
           COALESCE(v_doc.proxima_revisao, (now()+interval '15 days')::date),
           '/portal/procedimentos', 'Ler e dar ciência',
           jsonb_build_object('documento_id', v_doc.id, 'versao', v_doc.versao, 'codigo', v_doc.codigo, 'origem','sgi')
    FROM rh_colaboradores c
    WHERE c.ativo = true
      AND (
        COALESCE(v_doc.publico_alvo->>'tipo','todos') = 'todos'
        OR (v_doc.publico_alvo->>'tipo' = 'base'  AND c.base_id::text = ANY (SELECT jsonb_array_elements_text(v_doc.publico_alvo->'valores')))
        OR (v_doc.publico_alvo->>'tipo' = 'cargo' AND c.cargo       = ANY (SELECT jsonb_array_elements_text(v_doc.publico_alvo->'valores')))
      )
      AND NOT EXISTS (
        SELECT 1 FROM portalteg_missoes m
        WHERE m.colaborador_id = c.id AND m.categoria='documento_ciencia'
          AND m.metadata->>'documento_id' = v_doc.id::text
          AND COALESCE((m.metadata->>'versao')::int,0) = v_doc.versao
      );
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  SELECT count(*) INTO v_total FROM rh_colaboradores WHERE ativo = true;
  RETURN jsonb_build_object('ok',true,'missoes_criadas',v_count,'colaboradores_ativos',v_total,'requer_ciencia',v_doc.requer_ciencia);
END $fn$;

-- Ciência: relatório de adesão de um documento
CREATE OR REPLACE FUNCTION public.sgi_documento_adesao(p_documento_id uuid)
RETURNS TABLE(colaborador_id uuid, nome text, cargo text, status text, concluida_em timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $fn$
  SELECT m.colaborador_id, c.nome, c.cargo, m.status, m.concluida_em
  FROM portalteg_missoes m
  LEFT JOIN rh_colaboradores c ON c.id = m.colaborador_id
  WHERE m.categoria='documento_ciencia' AND m.metadata->>'documento_id' = p_documento_id::text
  ORDER BY (m.status='pendente') DESC, c.nome;
$fn$;

-- Metas: lançar check-in mensal (calcula farol; vermelho abre registro de melhoria)
CREATE OR REPLACE FUNCTION public.sgi_meta_checkin_lancar(p_meta_id uuid, p_competencia text, p_realizado numeric, p_observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_alvo numeric; v_dir text; v_obj uuid; v_obj_titulo text; v_area text; v_farol text; v_checkin uuid; v_registro uuid;
BEGIN
  SELECT mt.alvo, ob.direcao, ob.id, ob.titulo, ob.area_processo
    INTO v_alvo, v_dir, v_obj, v_obj_titulo, v_area
  FROM sgi_metas mt JOIN sgi_objetivos ob ON ob.id = mt.objetivo_id
  WHERE mt.id = p_meta_id;
  IF v_obj IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','meta não encontrada'); END IF;

  IF v_alvo IS NULL OR v_alvo = 0 THEN v_farol := 'cinza';
  ELSIF v_dir = 'menor_melhor' THEN
    v_farol := CASE WHEN p_realizado <= v_alvo THEN 'verde' WHEN p_realizado <= v_alvo*1.1 THEN 'amarelo' ELSE 'vermelho' END;
  ELSE
    v_farol := CASE WHEN p_realizado >= v_alvo THEN 'verde' WHEN p_realizado >= v_alvo*0.9 THEN 'amarelo' ELSE 'vermelho' END;
  END IF;

  INSERT INTO sgi_metas_checkin (meta_id, competencia, realizado, farol, observacao)
  VALUES (p_meta_id, p_competencia, p_realizado, v_farol, p_observacao)
  ON CONFLICT (meta_id, competencia)
  DO UPDATE SET realizado=EXCLUDED.realizado, farol=EXCLUDED.farol, observacao=EXCLUDED.observacao
  RETURNING id INTO v_checkin;

  IF v_farol = 'vermelho' THEN
    INSERT INTO sgi_registros (codigo, tipo, origem, gravidade, area_processo, titulo, descricao, status_pdca, classificacao)
    VALUES (sgi_proximo_codigo_registro(), 'falha','meta','alta', v_area,
            'Meta não atingida: '||COALESCE(v_obj_titulo,'(objetivo)')||' ('||p_competencia||')',
            'Check-in '||p_competencia||': realizado '||COALESCE(p_realizado::text,'-')||' vs alvo '||COALESCE(v_alvo::text,'-')||' (farol vermelho).',
            'pendente','pendente')
    RETURNING id INTO v_registro;
  END IF;

  RETURN jsonb_build_object('ok',true,'farol',v_farol,'checkin_id',v_checkin,'registro_criado',v_registro);
END $fn$;
