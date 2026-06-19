-- 153_fin_legado_custos.sql
-- Custos historicos TOTVS/NIBO (legado) para relatorios de Controladoria.
-- Referencias SO por ID do TEG+ (sys_obras, fin_classes_financeiras, sys_centros_custo,
-- pmo_projetos, con_contratos). NENHUM codigo TOTVS. Tabela so-leitura (carga unica via import).

create table if not exists public.fin_legado_custos (
  id              uuid primary key default gen_random_uuid(),
  origem          text,                 -- totvs | nibo
  linha_origem    integer,
  data_emissao    date,
  data_vencimento date,
  data_pagamento  date,
  competencia     date,                 -- 1o dia do mes
  ano             integer,
  mes             integer,
  centro_custo_id uuid references public.sys_centros_custo(id),
  centro_custo_desc text,
  tipo_cc         text,                 -- obra | estrutura | frota
  obra_id         uuid references public.sys_obras(id),
  obra_nome       text,
  polo            text,                 -- F1..F8
  pmo_projeto_id  uuid references public.pmo_projetos(id),
  contrato_id     uuid references public.con_contratos(id),
  classe_id       uuid references public.fin_classes_financeiras(id),
  classe_desc     text,
  grupo_dre       text,
  natureza_dre    text,                 -- custo_direto | despesa_fixa | imposto | nao_operacional | receita
  fornecedor_nome text,
  tipo_doc        text,
  numero_documento text,
  descricao       text,
  valor           numeric(14,2),
  conf_cc         text,
  conf_nat        text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_legado_competencia on public.fin_legado_custos (competencia);
create index if not exists idx_legado_obra        on public.fin_legado_custos (obra_id);
create index if not exists idx_legado_projeto      on public.fin_legado_custos (pmo_projeto_id);
create index if not exists idx_legado_cc          on public.fin_legado_custos (centro_custo_id);
create index if not exists idx_legado_classe      on public.fin_legado_custos (classe_id);
create index if not exists idx_legado_grupo       on public.fin_legado_custos (grupo_dre);
create index if not exists idx_legado_polo        on public.fin_legado_custos (polo);

alter table public.fin_legado_custos enable row level security;
drop policy if exists fin_legado_custos_read on public.fin_legado_custos;
create policy fin_legado_custos_read on public.fin_legado_custos for select to authenticated using (true);

-- view agregada p/ a tela Relatorios Legado
create or replace view public.vw_legado_resumo as
select
  ano, mes, competencia, polo, pmo_projeto_id, obra_id, obra_nome,
  tipo_cc, grupo_dre, natureza_dre, classe_id, classe_desc, centro_custo_id, centro_custo_desc,
  count(*) as qtd, sum(valor) as valor
from public.fin_legado_custos
group by ano, mes, competencia, polo, pmo_projeto_id, obra_id, obra_nome,
         tipo_cc, grupo_dre, natureza_dre, classe_id, classe_desc, centro_custo_id, centro_custo_desc;
