-- Equipe (Obras): vincula o planejamento de equipe ao headcount do RH
-- e introduz papel (lideranca/time/apoio) + lider_id (encarregado leva o Time).
-- A tabela obr_planejamento_equipe estava vazia (0 linhas) -> alteracao 100% aditiva.

ALTER TABLE public.obr_planejamento_equipe
  ADD COLUMN IF NOT EXISTS colaborador_id uuid REFERENCES public.rh_colaboradores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS papel text NOT NULL DEFAULT 'time',
  ADD COLUMN IF NOT EXISTS lider_id uuid REFERENCES public.obr_planejamento_equipe(id) ON DELETE SET NULL;

-- papel: engenheiro | supervisor | encarregado | time | apoio
ALTER TABLE public.obr_planejamento_equipe
  DROP CONSTRAINT IF EXISTS obr_plan_equipe_papel_chk;
ALTER TABLE public.obr_planejamento_equipe
  ADD CONSTRAINT obr_plan_equipe_papel_chk
  CHECK (papel IN ('engenheiro','supervisor','encarregado','time','apoio'));

CREATE INDEX IF NOT EXISTS idx_obr_plan_equipe_colaborador ON public.obr_planejamento_equipe(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_obr_plan_equipe_lider       ON public.obr_planejamento_equipe(lider_id);
CREATE INDEX IF NOT EXISTS idx_obr_plan_equipe_obra        ON public.obr_planejamento_equipe(obra_id);

COMMENT ON COLUMN public.obr_planejamento_equipe.colaborador_id IS 'FK rh_colaboradores -- pessoa alocada (headcount real). NULL p/ entradas avulsas.';
COMMENT ON COLUMN public.obr_planejamento_equipe.papel          IS 'Papel na obra: engenheiro|supervisor|encarregado|time|apoio.';
COMMENT ON COLUMN public.obr_planejamento_equipe.lider_id       IS 'Auto-FK: membro de Time aponta p/ a alocacao do encarregado lider. Mover o lider move o Time.';
