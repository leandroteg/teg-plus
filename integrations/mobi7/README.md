# Integração Mobi7 — Telemetria

Sincroniza posições e comportamentos da API Mobi7 para `tel_posicoes` e `tel_eventos` no Supabase, no **mesmo padrão da Cobli** (multi-provedor via coluna `provider`).

## Visão geral

```
[Mobi7 REST API]  --pull-->  [n8n Schedule + HTTP Request]
                                       |
                                       v
                       [tel_posicoes / tel_eventos]
                                       |
                                       v
                  [Frontend Frotas / Telemetria]
```

- **Cobli** continua funcionando inalterado (push via webhook → mesmas tabelas, `provider='cobli'` por DEFAULT).
- **Mobi7** entra como pull (n8n cron → polling REST) e marca `provider='mobi7'` nas linhas inseridas.
- Dedup por `UNIQUE INDEX` parcial em `(veiculo_id, cobli_ts) WHERE provider='mobi7'`. Cobli não é tocado.

## Schema afetado

Migrations já aplicadas no Supabase:

1. `telemetria_multi_provedor`
   - `tel_posicoes.provider` (TEXT, DEFAULT 'cobli')
   - `tel_eventos.provider` (TEXT, DEFAULT 'cobli')
   - `fro_veiculos.external_ids` (JSONB, DEFAULT '{}')
   - `tel_sync_state` (cursor de polling por provider/veículo/endpoint)
   - View `tel_ultima_posicao` recriada incluindo `provider`
   - Índices: `idx_tel_pos_provider_ts`, `idx_tel_ev_provider_ts`, `idx_fro_external_ids` (GIN)
   - UNIQUE parcial: `uq_tel_pos_mobi7`, `uq_tel_ev_mobi7`

2. `trigger_ocorrencias_multi_provedor`
   - `fn_auto_ocorrencia_from_tel_evento()` estendida com switch por `provider`
   - Cobli: comportamento original preservado (speed_alert, hard_brake, hard_acceleration, hard_cornering)
   - Mobi7: speeding, acceleration_*, braking_*, cornering, hard_*

## Match veículos

13/13 placas Mobi7 mapeadas em `fro_veiculos.external_ids->>'mobi7'`.

Para auditar:

```sql
SELECT placa, external_ids->>'mobi7' AS mobi7_id
FROM fro_veiculos
WHERE external_ids ? 'mobi7'
ORDER BY placa;
```

Para adicionar um novo veículo Mobi7 manualmente:

```sql
UPDATE fro_veiculos
SET external_ids = jsonb_set(COALESCE(external_ids,'{}'::jsonb), '{mobi7}', to_jsonb('UUID-MOBI7'::text))
WHERE placa = 'PLACA';
```

## Setup do n8n (uma vez só)

### 1. Credenciais

No n8n (`https://teg-agents-n8n.nmmcas.easypanel.host`):

#### a) Postgres "Supabase TEG+"
- Tipo: **Postgres**
- Host: `db.uzfjfucrinokeuwpbeie.supabase.co`
- Port: `5432`
- Database: `postgres`
- User: `postgres`
- Password: `Lm120987!` (rotacionar — ver Plano de Ciberseguranca)
- SSL: Require

#### b) HTTP Header Auth "Mobi7 API Key"
- Tipo: **HTTP Header Auth**
- Header Name: `api-key`
- Header Value: `1d81d115-79e8-46d0-b620-ba5911c8ec20`
- Validade: até 2027-04-22

### 2. Importar workflows

1. Importe `workflow_positions_sync.json` → renomeie credenciais nos nós Postgres e HTTP para apontar pras criadas acima.
2. Importe `workflow_behaviors_sync.json` → idem.
3. Ative os dois workflows.

Os IDs `REPLACE_WITH_SUPABASE_PG_CRED` e `REPLACE_WITH_MOBI7_CRED` são placeholders — n8n vai pedir pra escolher a credencial real ao abrir cada nó.

## Periodicidade

| Workflow | Intervalo | Por quê |
|---|---|---|
| Posições | 5 min | Mapa ao vivo + KPIs próximos do realtime sem pesar a API |
| Comportamentos | 15 min | Eventos de ofensa não precisam de tempo real |

Mobi7 permite até 50 req/s. Com 13 veículos:
- A cada ciclo de posições: ~13 req em 5 min = 0,04 req/s ✓
- A cada ciclo de comportamentos: ~13 req em 15 min = 0,015 req/s ✓

Folga enorme. Pode aumentar frota sem se preocupar com rate limit.

## Cursor incremental

A tabela `tel_sync_state` guarda o último `arrivalDate` (posições) e `date` (eventos) processados por veículo. Cada execução pega só dados a partir desse cursor (+1s para evitar duplicar). Janela inicial padrão:
- Posições: últimas 2h
- Comportamentos: últimas 6h

Se um workflow ficar parado por mais de 90 dias, o histórico anterior será perdido (limite da API Mobi7 para `arrival*` é 90 dias).

## Backfill manual (opcional)

Para puxar histórico antigo de um veículo específico (ex.: testar):

```bash
curl -sS \
  "https://developer.mobi7.io/positions/v1/vehicles/MOBI7_ID/history?startDate=2026-04-01T00:00:00Z&endDate=2026-04-25T00:00:00Z&pageSize=1000" \
  -H "accept: application/json" \
  -H "api-key: 1d81d115-79e8-46d0-b620-ba5911c8ec20"
```

Ou rode o workflow manualmente apontando uma janela maior em `last_arrival_ts`.

## Observabilidade

```sql
-- Status atual da sincronização
SELECT
  ss.provider,
  fv.placa,
  ss.endpoint,
  ss.last_arrival_ts,
  ss.last_event_ts,
  ss.last_synced_at,
  ss.rows_last_batch,
  age(now(), ss.last_synced_at) AS atraso
FROM tel_sync_state ss
JOIN fro_veiculos fv ON fv.id = ss.veiculo_id
WHERE ss.provider = 'mobi7'
ORDER BY ss.last_synced_at DESC;

-- Volume diário Mobi7
SELECT
  date_trunc('day', cobli_ts) AS dia,
  COUNT(*) AS posicoes,
  COUNT(DISTINCT veiculo_id) AS veiculos
FROM tel_posicoes
WHERE provider = 'mobi7'
GROUP BY 1
ORDER BY 1 DESC
LIMIT 14;
```

## Frontend

A view `tel_ultima_posicao` agora inclui o campo `provider`. O frontend já consome essa view e mostra a última posição independente de provedor — sem mudança obrigatória.

Para mostrar badge "Cobli" / "Mobi7" na UI, ver `frontend/src/hooks/useTelemetria.ts` e adicionar coluna `provider` aos mappings (mudança opcional de UI).

## Adicionar um novo provedor (Geotab, Sascar, Onixsat...)

1. `ALTER TABLE fro_veiculos` — não precisa, `external_ids` já é JSONB extensível.
2. Adicionar `WHEN 'novo_provider' THEN ...` no CASE de `fn_auto_ocorrencia_from_tel_evento()`.
3. Criar `UNIQUE INDEX uq_tel_pos_<provider> ... WHERE provider='<provider>'`.
4. Criar workflow n8n análogo, alterando endpoint, credencial e mapeamento de payload.

A arquitetura suporta N provedores sem mudança estrutural.
