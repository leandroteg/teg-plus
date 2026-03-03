# Arquitetura Agent Squads

> Módulo: Financeiro | Status: Em desenvolvimento | Última atualização: 2026-03-03

---

## O que são Agent Squads?

No contexto do TEG+, **Agent Squads** são grupos de workflows n8n especializados que trabalham de forma coordenada para sincronizar dados entre o Omie ERP e o banco de dados TEG+. Cada squad é responsável por um domínio de dados e opera de forma semi-autônoma.

A arquitetura de squads surgiu da necessidade de separar responsabilidades: em vez de um único workflow monolítico que tenta fazer tudo, cada squad tem um escopo bem definido, facilitando manutenção, debug e evolução independente.

**Princípios:**
- **Responsabilidade única:** cada squad cuida de um domínio
- **Estado compartilhado via Supabase:** os squads se comunicam através do banco de dados, não diretamente
- **Idempotência:** toda operação pode ser re-executada sem efeitos colaterais indesejados (graças ao upsert por `omie_id`)
- **Observabilidade:** toda execução é registrada no `fin_sync_log`

---

## Como os Squads se Comunicam

Os squads não chamam uns aos outros diretamente. O **Supabase** age como estado compartilhado e barramento de eventos:

```
┌──────────────────────────────────────────────────────┐
│                      Supabase                        │
│                                                      │
│  cmp_fornecedores  ←── Squad 1 (Fornecedor)          │
│  fin_contas_pagar  ←──→ Squad 2 (Contas a Pagar)     │
│  fin_contas_receber ←── Squad 3 (Contas a Receber)   │
│  fin_aprovacoes    ──→  Squad 4 (Aprovação)           │
│  fin_sync_log      ←── Todos os Squads               │
│  sys_config        ──→ Todos os Squads (leitura)     │
└──────────────────────────────────────────────────────┘
```

Quando o Squad 4 (Aprovação) precisa saber quais contas estão aprovadas, ele consulta `fin_contas_pagar` onde `status = 'aprovado'`. Esse dado foi escrito pelo Frontend, que por sua vez exibe dados escritos pelo Squad 2.

---

## Squad 1: Agent Fornecedor

**Responsabilidade:** Sincronizar o cadastro de fornecedores do Omie para o TEG+.

**Direção:** Omie → TEG+ (apenas leitura do Omie)

**Workflow:** `TEG+ | Omie - Sync Fornecedores` (arquivo: `workflow-omie-sync-fornecedores.json`)

**Webhook:** `POST /omie/sync/fornecedores`

### Fluxo do Squad 1

```
[Frontend / Agendador]
        │
        │ POST /omie/sync/fornecedores
        ▼
[n8n Trigger] ──▶ [Get Omie Credentials]
                        │
                        │ Lê omie_app_key e omie_app_secret do sys_config
                        ▼
               [Call Omie API]
               ListarFornecedores
               (até 500 por página)
                        │
                        ▼
               [Mapear Fornecedores]
               nCodFornecedor → omie_id
               cRazaoSocial   → razao_social
               cNomeFantasia  → nome_fantasia
               cnpj_cpf       → cnpj (só dígitos)
               cEmail         → email
               telefone1_numero → telefone
                        │
                        ▼
               [Upsert Supabase]
               POST /rest/v1/cmp_fornecedores
               ?onConflict=omie_id
               Prefer: resolution=merge-duplicates
                        │
                        ▼
               [Preparar Sync Log]
                        │
                        ▼
               [Inserir fin_sync_log]
                        │
                        ▼
               [Responder 200 OK]
```

### Paginação

A API do Omie retorna no máximo 500 registros por página. Para empresas com mais de 500 fornecedores, o workflow deve ser estendido com um loop de paginação que verifica `total_de_paginas` na resposta da API.

### Frequência Recomendada

- **Automático:** diariamente às 02:00 via Cron no n8n
- **Manual:** botão "Sincronizar Fornecedores" no Frontend

---

## Squad 2: Agent Contas a Pagar

**Responsabilidade:** Sincronização bidirecional de contas a pagar entre Omie e TEG+.

**Direção:** Bidirecional (Omie → TEG+ para dados; TEG+ → Omie para aprovações)

**Webhook Sync:** `POST /omie/sync/contas-pagar`
**Webhook Aprovação:** Delegado ao Squad 4

### Fluxo do Squad 2 - Sync (Omie → TEG+)

```
[Frontend / Agendador]
        │
        │ POST /omie/sync/contas-pagar
        ▼
[n8n Trigger] ──▶ [Get Omie Credentials]
                        │
                        ▼
               [Call Omie API]
               ListarContasPagar
               Filtros: período, status
                        │
                        ▼
               [Mapear Contas]
               nCodCP        → omie_cp_id
               cFornecedor   → fornecedor_nome
               nValorDocumento → valor_original
               nValorPago    → valor_pago
               nValorAberto  → valor_aberto
               dDataVencimento → data_vencimento (parse DD/MM/AAAA)
               cStatus       → status_omie + status (mapeado)
                        │
                        ▼
               [Upsert Supabase]
               POST /rest/v1/fin_contas_pagar
               ?onConflict=omie_cp_id
                        │
                        ▼
               [Log + Responder]
```

### Lógica de Status no Squad 2

O Squad 2 aplica uma lógica especial ao mapear status: se uma conta já foi `aprovado` ou `aguardando_aprovacao` no TEG+, o sync do Omie **não sobrescreve** esse status. Apenas contas com status `pendente` ou `vencido` têm o status atualizado pelo sync.

```
Se status_teg_atual IN ('aprovado', 'aguardando_aprovacao')
  → Preservar status_teg_atual (não sobrescrever)
Senão
  → Aplicar mapeamento padrão do status Omie
```

### Frequência Recomendada

- **Automático:** a cada 4 horas via Cron no n8n
- **Manual:** botão "Sincronizar Contas a Pagar" no Frontend

---

## Squad 3: Agent Contas a Receber

**Responsabilidade:** Sincronizar contas a receber do Omie para o TEG+.

**Direção:** Omie → TEG+ (apenas leitura do Omie)

**Webhook:** `POST /omie/sync/contas-receber`

### Fluxo do Squad 3

```
[Frontend / Agendador]
        │
        │ POST /omie/sync/contas-receber
        ▼
[n8n Trigger] ──▶ [Get Omie Credentials]
                        │
                        ▼
               [Call Omie API]
               ListarContasReceber
               Filtros: período, status
                        │
                        ▼
               [Mapear Contas a Receber]
               nCodCR        → omie_cr_id
               cCliente      → cliente_nome
               nValorDocumento → valor_original
               nValorRecebido  → valor_recebido
               nValorAberto    → valor_aberto
               dDataVencimento → data_vencimento
               dDataRecebimento → data_recebimento
               cStatus       → status_omie + status (mapeado)
                        │
                        ▼
               [Upsert Supabase]
               POST /rest/v1/fin_contas_receber
               ?onConflict=omie_cr_id
                        │
                        ▼
               [Log + Responder]
```

### Diferenças do Squad 2

O Squad 3 é mais simples que o Squad 2 pois não tem a lógica de aprovação. O fluxo é sempre unidirecional: Omie é a fonte de verdade para contas a receber.

### Frequência Recomendada

- **Automático:** diariamente às 06:00 via Cron no n8n
- **Manual:** botão "Sincronizar Contas a Receber" no Frontend

---

## Squad 4: Agent Aprovação

**Responsabilidade:** Quando uma conta a pagar é aprovada no TEG+, disparar a baixa/atualização correspondente no Omie.

**Direção:** TEG+ → Omie (escrita no Omie)

**Webhook:** `POST /omie/aprovar-pagamento`

### Fluxo do Squad 4

```
[Frontend TEG+]
  (usuário aprova pagamento)
        │
        │ POST /omie/aprovar-pagamento
        │ { "conta_id": "uuid", "aprovado_por": "uuid", "observacao": "..." }
        ▼
[n8n Trigger] ──▶ [Buscar Conta no Supabase]
                   SELECT * FROM fin_contas_pagar
                   WHERE id = conta_id
                        │
                        ▼
               [Validar Status]
               status deve ser 'aguardando_aprovacao'
               ou 'pendente'
                        │
                 ┌───────┴───────┐
                 │               │
             [Válido]       [Inválido]
                 │               │
                 ▼               ▼
         [Get Omie Creds]  [Responder 400]
                 │
                 ▼
         [Call Omie API]
         AlterarContaPagar
         → Atualiza status/observação no Omie
                 │
                 ▼
         [Atualizar Supabase]
         UPDATE fin_contas_pagar
         SET status = 'aprovado',
             aprovado_por = uuid,
             aprovado_em = now()
         WHERE id = conta_id
                 │
                 ▼
         [Inserir fin_aprovacoes]
                 │
                 ▼
         [Log + Responder 200]
```

### Regras de Aprovação

- Apenas usuários com papel `financeiro` ou `admin` podem chamar este endpoint
- O TEG+ valida a permissão antes de chamar o webhook n8n
- Uma conta aprovada não pode ser re-aprovada (idempotência)
- Se a chamada ao Omie falhar, o status no Supabase **não** é atualizado (transação lógica)

### Frequência

O Squad 4 é disparado **on-demand** pelo Frontend, não tem agendamento automático.

---

## Visão Consolidada dos Squads

```
                    ┌─────────────────────────────────┐
                    │           Omie ERP               │
                    │                                  │
                    │  Fornecedores  ──────────────────┼──▶ Squad 1
                    │  Contas Pagar  ◀─────────────────┼──▶ Squad 2
                    │  Contas Receber ─────────────────┼──▶ Squad 3
                    │  Contas Pagar  ◀─────────────────┼──── Squad 4
                    └─────────────────────────────────┘

                              Supabase
                    ┌─────────────────────────────────┐
     Squad 1 ──▶   │  cmp_fornecedores                │
     Squad 2 ──▶   │  fin_contas_pagar                │   ◀── Frontend
     Squad 3 ──▶   │  fin_contas_receber              │   ◀── Frontend
     Squad 4 ──▶   │  fin_aprovacoes                  │
     Todos   ──▶   │  fin_sync_log                    │
                    └─────────────────────────────────┘
```

---

## Squads Futuros (Planejados)

### Squad 5: Agent NF (Notas Fiscais)

**Status:** Planejado

**Responsabilidade:** Sincronizar notas fiscais emitidas e recebidas do Omie para o TEG+.

**Endpoints previstos:**
- `ListarNF` de `https://app.omie.com.br/api/v1/produtos/nfvenda/`
- `ListarNFServico` de `https://app.omie.com.br/api/v1/servicos/nfse/`

**Tabela destino:** `fin_notas_fiscais` (a criar)

---

### Squad 6: Agent Remessa

**Status:** Planejado

**Responsabilidade:** Gerar arquivos de remessa bancária (CNAB 240/400) a partir das contas a pagar aprovadas no TEG+, e registrar o retorno bancário.

**Integração:** Não passa pelo Omie; integração direta com APIs bancárias (ex: Itaú, Bradesco, Sicoob).

**Tabela destino:** `fin_remessas`, `fin_retornos` (a criar)

---

### Squad 7: Agent Conciliação

**Status:** Planejado

**Responsabilidade:** Conciliação automática entre extratos bancários importados e os lançamentos no Supabase. Identifica pagamentos recebidos e vincula às contas a receber.

**Fontes de dados:**
- OFX/CSV importado pelo usuário
- API Open Finance (futuro)

**Tabela destino:** `fin_conciliacao` (a criar)

---

## Monitoramento e Observabilidade

### Tabela `fin_sync_log`

Toda execução de squad registra uma linha em `fin_sync_log`:

```sql
CREATE TABLE fin_sync_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dominio     text NOT NULL,  -- 'fornecedores', 'contas_pagar', etc.
  status      text NOT NULL,  -- 'sucesso', 'erro', 'parcial'
  registros   integer,        -- quantidade de registros processados
  mensagem    text,
  erro        text,           -- detalhes do erro se houver
  executado_em timestamptz DEFAULT now(),
  executado_por text DEFAULT 'n8n'
);
```

### Consulta de Saúde dos Squads

```sql
-- Último sync de cada domínio
SELECT DISTINCT ON (dominio)
  dominio,
  status,
  registros,
  executado_em
FROM fin_sync_log
ORDER BY dominio, executado_em DESC;
```

---

## Páginas Relacionadas

- [[TEG+ Integração Omie]] - Documentação técnica da integração
- [[Setup Integração Omie]] - Guia de configuração
- [[Índice Financeiro]] - Índice do módulo financeiro
