ALTER TABLE public.cmp_fornecedores
  ADD COLUMN IF NOT EXISTS boleto boolean NOT NULL DEFAULT false;
