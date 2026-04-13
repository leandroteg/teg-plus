-- Telemetria Cobli: tabelas para receber dados de posição e eventos via webhook
-- Aplicada em 2026-04-13

-- Tabela de posições (position events do Cobli)
create table if not exists tel_posicoes (
  id            uuid primary key default gen_random_uuid(),
  veiculo_id    uuid references fro_veiculos(id),
  placa         text not null,
  latitude      double precision not null,
  longitude     double precision not null,
  velocidade    real default 0,
  ignicao       boolean default false,
  hodometro     real,
  evento        text not null,
  cobli_ts      timestamptz not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_tel_pos_veic_ts on tel_posicoes (veiculo_id, cobli_ts desc);
create index if not exists idx_tel_pos_placa_ts on tel_posicoes (placa, cobli_ts desc);

alter table tel_posicoes enable row level security;
create policy "tel_posicoes_all" on tel_posicoes for all to authenticated using (true) with check (true);

-- Tabela de eventos (todos os outros eventos Cobli)
create table if not exists tel_eventos (
  id            uuid primary key default gen_random_uuid(),
  veiculo_id    uuid references fro_veiculos(id),
  placa         text not null,
  tipo_evento   text not null,
  latitude      double precision,
  longitude     double precision,
  velocidade    real,
  dados_extra   jsonb default '{}',
  cobli_ts      timestamptz not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_tel_ev_veic_tipo on tel_eventos (veiculo_id, tipo_evento, cobli_ts desc);
create index if not exists idx_tel_ev_tipo_ts on tel_eventos (tipo_evento, cobli_ts desc);

alter table tel_eventos enable row level security;
create policy "tel_eventos_all" on tel_eventos for all to authenticated using (true) with check (true);

-- View: última posição por veículo (para mapa ao vivo)
create or replace view tel_ultima_posicao as
select distinct on (veiculo_id)
  veiculo_id, placa, latitude, longitude, velocidade, ignicao, hodometro, cobli_ts
from tel_posicoes
order by veiculo_id, cobli_ts desc;
